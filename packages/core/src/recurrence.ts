import { clampDay, todayParts, ymDiff } from "./calendar.ts";
import type { IsoDate, Recurrence, Tx, YearMonth } from "./types.ts";

export type NewTx = Omit<Tx, "id">;

/** Campos de uma conta fixa que "neste e nos próximos" pode alterar. */
export type RecurrenceChanges = Partial<
  Pick<Recurrence, "description" | "amount" | "day" | "categoryId" | "paymentMethod" | "paidBy" | "personal">
>;

/** A conta fixa gera lançamento em `ym`? Pausada, antes do início, depois da última parcela ou fora do ano: não. */
export function occursIn(rec: Recurrence, ym: YearMonth): boolean {
  if (rec.paused) return false;
  const index = ymDiff(rec.start, ym);
  if (index < 0) return false;
  if (rec.frequency === "yearly") return index % 12 === 0;
  return rec.installmentsTotal === null || index < rec.installmentsTotal;
}

/**
 * Lançamento que a conta fixa gera em `ym`, ou `null` se ela não cai nesse mês.
 * O dia é ajustado ao fim do mês (31 em fevereiro vira 28 ou 29). Meses passados e o dia de hoje já nascem pagos.
 */
export function materialize(rec: Recurrence, ym: YearMonth, today: IsoDate): NewTx | null {
  if (!occursIn(rec, ym)) return null;
  const now = todayParts(today);
  const day = clampDay(ym, rec.day);
  return {
    kind: rec.kind,
    description: rec.description,
    amount: rec.amount,
    competence: ym,
    day,
    categoryId: rec.categoryId,
    paid: ym < now.ym || (ym === now.ym && day <= now.day),
    paymentMethod: rec.paymentMethod,
    paidBy: rec.paidBy,
    personal: rec.personal,
    note: "",
    recurrenceId: rec.id,
    installment: rec.installmentsTotal === null ? null : ymDiff(rec.start, ym) + 1,
    installmentsTotal: rec.installmentsTotal,
    yearly: rec.frequency === "yearly",
  };
}

/**
 * O que falta lançar em `ym`. Idempotente: quem já tem lançamento com o mesmo `recurrenceId` e competência
 * não é gerado de novo, então rodar duas vezes (ou com o resultado da primeira) não duplica nada.
 */
export function missingForMonth(
  recs: readonly Recurrence[],
  existing: readonly Tx[],
  ym: YearMonth,
  today: IsoDate,
): NewTx[] {
  const done = new Set(
    existing.filter((t) => t.competence === ym && t.recurrenceId !== null).map((t) => t.recurrenceId),
  );
  const created: NewTx[] = [];
  for (const rec of recs) {
    if (done.has(rec.id)) continue;
    const tx = materialize(rec, ym, today);
    if (tx) created.push(tx);
  }
  return created;
}

/**
 * "Neste e nos próximos": altera o modelo e só os lançamentos futuros em aberto (competência depois de `fromYm`).
 * O lançamento editado e os já pagos ficam como estão.
 */
export function applyForward(
  recurrence: Recurrence,
  txs: readonly Tx[],
  fromYm: YearMonth,
  changes: RecurrenceChanges,
): { recurrence: Recurrence; txs: Tx[] } {
  const next: Recurrence = { ...recurrence, ...changes };
  const updated = txs.map((tx) => {
    if (tx.recurrenceId !== recurrence.id || tx.paid || tx.competence <= fromYm) return tx;
    const patch: { -readonly [K in keyof Tx]?: Tx[K] } = {};
    if (changes.description !== undefined) patch.description = changes.description;
    if (changes.amount !== undefined) patch.amount = changes.amount;
    if (changes.categoryId !== undefined) patch.categoryId = changes.categoryId;
    if (changes.paymentMethod !== undefined) patch.paymentMethod = changes.paymentMethod;
    if (changes.paidBy !== undefined) patch.paidBy = changes.paidBy;
    if (changes.personal !== undefined) patch.personal = changes.personal;
    if (changes.day !== undefined) patch.day = clampDay(tx.competence, changes.day);
    return { ...tx, ...patch };
  });
  return { recurrence: next, txs: updated };
}

function futureOpenIds(rec: Recurrence, txs: readonly Tx[], today: IsoDate): string[] {
  const now = todayParts(today);
  return txs.filter((t) => t.recurrenceId === rec.id && !t.paid && t.competence > now.ym).map((t) => t.id);
}

/** Pausar: a conta passa a `paused` e os lançamentos futuros em aberto (meses depois do atual) devem ser apagados. */
export function pauseEffects(
  rec: Recurrence,
  txs: readonly Tx[],
  today: IsoDate,
): { recurrence: Recurrence; removeIds: string[] } {
  return { recurrence: { ...rec, paused: true }, removeIds: futureOpenIds(rec, txs, today) };
}

/** Retomar: recria os lançamentos dos meses futuros já abertos (`openMonths`) que ainda não têm o da conta. */
export function resumeEffects(
  rec: Recurrence,
  txs: readonly Tx[],
  today: IsoDate,
  openMonths: readonly YearMonth[],
): { recurrence: Recurrence; create: NewTx[] } {
  const resumed: Recurrence = { ...rec, paused: false };
  const now = todayParts(today);
  const months = [...new Set(openMonths)].filter((ym) => ym > now.ym).sort();
  const create = months.flatMap((ym) => missingForMonth([resumed], txs, ym, today));
  return { recurrence: resumed, create };
}

/** Excluir: apaga os futuros em aberto e desliga os demais do modelo (o histórico fica, sem `recurrenceId`). */
export function deleteEffects(
  rec: Recurrence,
  txs: readonly Tx[],
  today: IsoDate,
): { removeIds: string[]; detachIds: string[] } {
  const removeIds = futureOpenIds(rec, txs, today);
  const removed = new Set(removeIds);
  const detachIds = txs.filter((t) => t.recurrenceId === rec.id && !removed.has(t.id)).map((t) => t.id);
  return { removeIds, detachIds };
}
