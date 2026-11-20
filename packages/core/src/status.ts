import { todayParts } from "./calendar.ts";
import type { IsoDate, Tx } from "./types.ts";

/** Início lista o que vence em até 7 dias. */
export const DUE_SOON_HOME_DAYS = 7;
/** Os avisos usam 3 dias. */
export const DUE_SOON_NOTIFY_DAYS = 3;

/** Atrasado = vencido e não pago. Entradas nunca ficam atrasadas. O dia de hoje ainda não está atrasado. */
export function isLate(tx: Tx, today: IsoDate): boolean {
  if (tx.paid || tx.kind === "in") return false;
  const now = todayParts(today);
  return tx.competence < now.ym || (tx.competence === now.ym && tx.day < now.day);
}

/**
 * Vence em breve: saída ou guardado em aberto, no mês de hoje, com vencimento de hoje até hoje + `days`.
 * A janela não atravessa o fim do mês (igual ao protótipo).
 */
export function isDueSoon(tx: Tx, today: IsoDate, days: number): boolean {
  if (tx.paid || tx.kind === "in") return false;
  const now = todayParts(today);
  return tx.competence === now.ym && tx.day >= now.day && tx.day <= now.day + days;
}

export interface SituationGroups {
  /** Atrasados */
  readonly late: Tx[];
  /** Em aberto (não atrasados) */
  readonly open: Tx[];
  /** Concluídos (pagos ou recebidos) */
  readonly done: Tx[];
}

/** Agrupa a lista em Atrasados, Em aberto e Concluídos, mantendo a ordem de entrada. */
export function groupBySituation(txs: readonly Tx[], today: IsoDate): SituationGroups {
  return {
    late: txs.filter((t) => isLate(t, today)),
    open: txs.filter((t) => !t.paid && !isLate(t, today)),
    done: txs.filter((t) => t.paid),
  };
}
