import { currentNotices, type IsoDate, missingForMonth, type NewTx, todayParts, type YearMonth } from "@juntos/core";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { notifications, recurrences, transactions } from "../db/schema";
import type { TxView } from "./finance-types";
import { recurrenceToCore } from "./recurrences-read";
import { competenceDate, toTxView } from "./transactions";

/** Só o aviso "N contas fixas lançadas em <mês>" (os outros avisos são gerados pela rotina diária). */
const AUTO_ONLY = { late: false, due: false, budget: false, goal: false, people: false, auto: true } as const;

type RecurrenceRow = typeof recurrences.$inferSelect;

async function activeRecurrences(db: Executor, spaceId: string): Promise<RecurrenceRow[]> {
  return db
    .select()
    .from(recurrences)
    .where(and(eq(recurrences.spaceId, spaceId), isNull(recurrences.deletedAt), eq(recurrences.paused, false)));
}

interface MissingTx {
  readonly ym: YearMonth;
  readonly generated: NewTx;
}

/** O que falta lançar em cada mês, comparando com o que existe (inclusive excluídos). Só lê. */
async function findMissing(
  db: Executor,
  spaceId: string,
  recs: readonly RecurrenceRow[],
  wanted: readonly YearMonth[],
  today: IsoDate,
): Promise<MissingTx[]> {
  const existingRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.spaceId, spaceId),
        isNotNull(transactions.recurrenceId),
        inArray(transactions.competence, wanted.map(competenceDate)),
      ),
    );
  const existing = existingRows.map((row) => toTxView(row));
  const models = recs.map(recurrenceToCore);
  return wanted.flatMap((ym) => missingForMonth(models, existing, ym, today).map((generated) => ({ ym, generated })));
}

/**
 * Contas fixas que ainda faltam nos meses, calculadas em memória e **sem gravar** (para quem só vê, que não pode
 * escrever no espaço; ADR 0006). O id é provisório (`pendente:<conta fixa>:<mês>`), só para listar.
 */
export async function previewMissingMonths(
  db: Executor,
  spaceId: string,
  months: readonly YearMonth[],
  today: IsoDate,
): Promise<TxView[]> {
  const wanted = [...new Set(months)];
  if (wanted.length === 0) return [];
  const recs = await activeRecurrences(db, spaceId);
  if (recs.length === 0) return [];
  const missing = await findMissing(db, spaceId, recs, wanted, today);
  return missing.map(({ ym, generated }) => ({ ...generated, id: `pendente:${generated.recurrenceId}:${ym}` }));
}

/**
 * Lança as contas fixas que faltam nos meses abertos (`ensureMonth` do protótipo). Idempotente:
 *
 * - `missingForMonth` do core compara com o que já existe, **inclusive os lançamentos excluídos**, para que um
 *   lançamento gerado e excluído pela pessoa não volte;
 * - o índice único `(recurrence_id, competence)` + `on conflict do nothing` protege contra duas requisições ao
 *   mesmo tempo.
 *
 * Meses passados e o dia de hoje nascem pagos (regra do core). Quando o mês de hoje recebe lançamentos pela
 * primeira vez, registra o aviso "N contas fixas lançadas em <mês>" (chave `auto-AAAA-MM`, sem repetir).
 * Devolve o que foi criado.
 */
export async function materializeMonths(
  db: Database,
  spaceId: string,
  months: readonly YearMonth[],
  today: IsoDate,
): Promise<TxView[]> {
  const wanted = [...new Set(months)];
  if (wanted.length === 0) return [];
  const recs = await activeRecurrences(db, spaceId);
  if (recs.length === 0) return [];

  return db.transaction(async (tx) => {
    const missing = await findMissing(tx, spaceId, recs, wanted, today);
    const values = missing.map(({ ym, generated }) => ({
      spaceId,
      kind: generated.kind,
      description: generated.description,
      amountCents: generated.amount,
      competence: competenceDate(ym),
      day: generated.day,
      categoryId: generated.categoryId,
      paid: generated.paid,
      paidAt: generated.paid ? `${ym}-${String(generated.day).padStart(2, "0")}` : null,
      paymentMethod: generated.paymentMethod,
      paidBy: generated.paidBy,
      personal: generated.personal,
      note: generated.note,
      recurrenceId: generated.recurrenceId,
      installmentNumber: generated.installment,
      installmentsTotal: generated.installmentsTotal,
      yearly: generated.yearly,
    }));
    if (values.length === 0) return [];
    const inserted = await tx
      .insert(transactions)
      .values(values)
      .onConflictDoNothing({ target: [transactions.recurrenceId, transactions.competence] })
      .returning();
    const created = inserted.map((row) => toTxView(row));

    const nowYm = todayParts(today).ym;
    const launchedNow = created.filter((t) => t.competence === nowYm);
    const [notice] = currentNotices({
      today,
      txs: [],
      budgets: {},
      goals: [],
      members: [],
      categories: [],
      prefs: AUTO_ONLY,
      launchedRecurring: launchedNow,
    });
    if (notice) {
      await tx
        .insert(notifications)
        .values({
          spaceId,
          type: notice.kind,
          dedupeKey: notice.dedupeKey,
          title: notice.title,
          body: notice.body,
          href: "/lancamentos",
          competence: competenceDate(nowYm),
        })
        .onConflictDoNothing({ target: [notifications.spaceId, notifications.dedupeKey] });
    }
    return created;
  });
}
