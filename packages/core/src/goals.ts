import { todayParts, ymAdd } from "./calendar.ts";
import { formatBRL } from "./money.ts";
import type { NewTx } from "./recurrence.ts";
import type { Cents, Goal, IsoDate, YearMonth } from "./types.ts";

export interface GoalProgress {
  /** 0 a 100. */
  readonly percent: number;
  readonly left: Cents;
  readonly reached: boolean;
}

export function goalProgress(goal: Goal): GoalProgress {
  const left = Math.max(goal.target - goal.saved, 0);
  return { percent: Math.min(100, Math.round((goal.saved / goal.target) * 100)), left, reached: left === 0 };
}

/** Meses até completar com o valor mensal: 0 se já completou, `null` se não há valor mensal. */
export function forecastMonths(goal: Goal): number | null {
  const { left } = goalProgress(goal);
  if (left === 0) return 0;
  return goal.monthly > 0 ? Math.ceil(left / goal.monthly) : null;
}

/** Mês previsto para completar (a partir do mês de hoje), ou `null` se concluída ou sem valor mensal. */
export function forecastMonth(goal: Goal, today: IsoDate): YearMonth | null {
  const months = forecastMonths(goal);
  return months === null || months === 0 ? null : ymAdd(todayParts(today).ym, months);
}

export type DepositCheck =
  | { readonly ok: true; readonly amount: Cents }
  | { readonly ok: false; readonly error: string };

/** O depósito precisa ser maior que zero e não passa do que falta. */
export function validateDeposit(goal: Goal, amount: Cents | null): DepositCheck {
  if (amount === null || !(amount > 0)) return { ok: false, error: "Digite um valor maior que zero." };
  const { left } = goalProgress(goal);
  if (amount > left) return { ok: false, error: `Faltam só ${formatBRL(left)} para a meta. Digite até esse valor.` };
  return { ok: true, amount };
}

/** Meta com o depósito somado. */
export function applyDeposit(goal: Goal, amount: Cents): Goal {
  return { ...goal, saved: goal.saved + amount };
}

/** Lançamento "Guardado" que o depósito gera (pago, categoria Reserva). */
export function depositTx(goal: Goal, amount: Cents, today: IsoDate, paidBy: string | null): NewTx {
  const now = todayParts(today);
  return {
    kind: "save",
    description: `Meta: ${goal.name}`,
    amount,
    competence: now.ym,
    day: now.day,
    categoryId: "reserva",
    paid: true,
    paymentMethod: "",
    paidBy,
    personal: false,
    note: "",
    recurrenceId: null,
    installment: null,
    installmentsTotal: null,
    yearly: false,
  };
}
