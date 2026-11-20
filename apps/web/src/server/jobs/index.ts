import type { Database } from "../db";
import { sendEmail } from "../email";
import { isEmailEnabled } from "../env";
import { sendPush } from "../push";
import { purgeStaleRateLimits } from "../rate-limit";
import { purgeExpiredInvites } from "../services/members";
import { idleGuests, purgeUser, usersDueForDeletion } from "../services/users";
import { purgeUndoTokens } from "../undo";
import { runDailyNotices } from "./daily-notices";

/**
 * Rotina diária (`/api/cron/diario`). Cada job é idempotente: rodar duas vezes no mesmo dia não muda nada.
 *
 * Como acrescentar um job (ex.: materializar as contas fixas do mês, gerar avisos e enviar push/e-mail,
 * especificação 5.7): crie a função real em `src/server/jobs/`, devolva quantos registros afetou e
 * registre-a em `DAILY_JOBS`. Só entram jobs que fazem trabalho de verdade.
 */
export interface DailyJobContext {
  readonly db: Database;
  readonly now: Date;
}

export interface DailyJob {
  /** Identificador estável, aparece no relatório da execução. */
  readonly name: string;
  readonly run: (context: DailyJobContext) => Promise<number>;
}

export interface DailyJobReport {
  readonly name: string;
  readonly ok: boolean;
  readonly affected: number;
  readonly error?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Carência da exclusão de conta (decisão 9) e prazo do convidado parado (decisão 10). */
export const GRACE_DAYS = 30;

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export const DAILY_JOBS: readonly DailyJob[] = [
  {
    name: "excluir-contas-com-carencia-vencida",
    run: async ({ db, now }) => {
      const ids = await usersDueForDeletion(db, daysAgo(now, GRACE_DAYS));
      for (const id of ids) await purgeUser(db, id);
      return ids.length;
    },
  },
  {
    name: "excluir-convidados-parados",
    run: async ({ db, now }) => {
      const ids = await idleGuests(db, daysAgo(now, GRACE_DAYS));
      for (const id of ids) await purgeUser(db, id);
      return ids.length;
    },
  },
  {
    name: "limpar-convites-vencidos",
    run: ({ db, now }) => purgeExpiredInvites(db, now),
  },
  {
    name: "limpar-tokens-de-desfazer",
    run: ({ db, now }) => purgeUndoTokens(db, now),
  },
  {
    name: "limpar-limites-de-tentativas",
    run: ({ db, now }) => purgeStaleRateLimits(db, now),
  },
  {
    // Contas fixas do mês, avisos do dia (sem repetir) e push/e-mail só dos avisos novos.
    name: "avisos-do-dia",
    run: async (context) => {
      const report = await runDailyNotices(context, { sendPush, sendEmail, emailEnabled: isEmailEnabled() });
      return report.notices;
    },
  },
];

/** Roda todos os jobs; a falha de um não impede os outros e aparece no relatório. */
export async function runDailyJobs(
  context: DailyJobContext,
  jobs: readonly DailyJob[] = DAILY_JOBS,
): Promise<DailyJobReport[]> {
  const reports: DailyJobReport[] = [];
  for (const job of jobs) {
    try {
      reports.push({ name: job.name, ok: true, affected: await job.run(context) });
    } catch (error: unknown) {
      console.error(`Job diário "${job.name}" falhou:`, error);
      reports.push({
        name: job.name,
        ok: false,
        affected: 0,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
  return reports;
}
