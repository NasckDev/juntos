import { splitProportional } from "./money.ts";
import type { Cents, Member, Settlement, SplitMode, Tx, YearMonth } from "./types.ts";

export interface DivisionInput {
  readonly members: readonly Member[];
  /** Lançamentos do período exibido. */
  readonly txs: readonly Tx[];
  readonly mode: SplitMode;
  /** Parte (em %) da primeira pessoa no modo personalizado. Padrão 50. */
  readonly customPct?: number;
  readonly settlements?: readonly Settlement[];
  /**
   * Período exibido. Um acerto vale se o período dele cabe inteiro dentro deste.
   * Sem `period`, todos os acertos informados valem.
   */
  readonly period?: { readonly start: YearMonth; readonly end: YearMonth };
}

export interface PersonDivision {
  readonly memberId: string;
  readonly name: string;
  readonly paid: Cents;
  /** Renda recebida no período. */
  readonly income: Cents;
  /** Parte justa. */
  readonly share: Cents;
  /** Fração (0 a 1) das despesas que cabe à pessoa. */
  readonly percent: number;
  /** Positivo = a receber; negativo = a pagar. Já considera os acertos. */
  readonly balance: Cents;
  readonly items: readonly Tx[];
}

export interface Move {
  readonly from: string;
  readonly to: string;
  readonly amount: Cents;
}

export interface Division {
  /** Modo efetivamente usado (pode cair para "equal"). */
  readonly mode: SplitMode;
  readonly total: Cents;
  readonly people: readonly PersonDivision[];
  readonly moves: readonly Move[];
  /** Saídas pagas e compartilhadas sem "quem pagou" (ficam fora da conta). */
  readonly withoutPayer: readonly Tx[];
  /** Acertos que entraram na conta. */
  readonly settlements: readonly Settlement[];
  /** Quantas saídas pagas ficaram de fora por serem pessoais. */
  readonly personalCount: number;
}

function sumAmount(txs: readonly Tx[]): Cents {
  return txs.reduce((acc, t) => acc + t.amount, 0);
}

function effectiveMode(mode: SplitMode, memberCount: number, totalIncome: Cents): SplitMode {
  if (mode === "custom" && memberCount !== 2) return "equal";
  if (mode === "income" && totalIncome === 0) return "equal";
  return mode;
}

/** Quitação gulosa: o maior devedor paga ao maior credor, e assim por diante. */
function settleGreedy(people: readonly PersonDivision[]): Move[] {
  const debtors = people
    .filter((p) => p.balance < 0)
    .map((p) => ({ id: p.memberId, left: -p.balance }))
    .sort((a, b) => b.left - a.left);
  const creditors = people
    .filter((p) => p.balance > 0)
    .map((p) => ({ id: p.memberId, left: p.balance }))
    .sort((a, b) => b.left - a.left);
  const moves: Move[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    if (!debtor || !creditor) break;
    const amount = Math.min(debtor.left, creditor.left);
    moves.push({ from: debtor.id, to: creditor.id, amount });
    debtor.left -= amount;
    creditor.left -= amount;
    if (debtor.left === 0) d++;
    if (creditor.left === 0) c++;
  }
  return moves;
}

function appliesTo(s: Settlement, period: DivisionInput["period"]): boolean {
  if (!period) return true;
  return s.periodStart >= period.start && s.periodEnd <= period.end;
}

/**
 * Divisão das despesas entre as pessoas do espaço, tudo em centavos.
 * Só entram saídas pagas, não pessoais e com pagador (membro ativo). A renda usada no modo "income" são só as
 * entradas já recebidas; sem renda recebida, cai para partes iguais. "custom" só vale com 2 pessoas.
 */
export function computeDivision(input: DivisionInput): Division {
  const members = input.members.filter((m) => m.active);
  const memberIds = new Set(members.map((m) => m.id));
  const paidOut = input.txs.filter((t) => t.kind === "out" && t.paid);
  const shared = paidOut.filter((t) => !t.personal);
  const counted = shared.filter((t) => t.paidBy !== null && memberIds.has(t.paidBy));
  const withoutPayer = shared.filter((t) => t.paidBy === null || !memberIds.has(t.paidBy));
  const total = sumAmount(counted);

  const income = members.map((m) => sumAmount(input.txs.filter((t) => t.kind === "in" && t.paid && t.paidBy === m.id)));
  const mode = effectiveMode(
    input.mode,
    members.length,
    income.reduce((a, v) => a + v, 0),
  );

  const customPct = Math.min(100, Math.max(0, input.customPct ?? 50));
  const weights = mode === "income" ? income : mode === "custom" ? [customPct, 100 - customPct] : members.map(() => 1);
  const weightSum = weights.reduce((a, w) => a + w, 0);
  const shares = splitProportional(total, weights);

  const applied = (input.settlements ?? []).filter((s) => appliesTo(s, input.period));
  const people: PersonDivision[] = members.map((m, i) => {
    const items = counted.filter((t) => t.paidBy === m.id);
    const paid = sumAmount(items);
    const share = shares[i] ?? 0;
    const adjust = applied.reduce(
      (acc, s) => acc + (s.from === m.id ? s.amount : 0) - (s.to === m.id ? s.amount : 0),
      0,
    );
    return {
      memberId: m.id,
      name: m.name,
      paid,
      income: income[i] ?? 0,
      share,
      percent: (weights[i] ?? 0) / weightSum,
      balance: paid - share + adjust,
      items,
    };
  });

  return {
    mode,
    total,
    people,
    moves: settleGreedy(people),
    withoutPayer,
    settlements: applied,
    personalCount: paidOut.length - shared.length,
  };
}
