import { ymDiff } from "./calendar.ts";
import type { Cents, Recurrence, YearMonth } from "./types.ts";

/** Taxa mensal máxima aceita (15 % ao mês). */
export const MAX_MONTHLY_RATE = 0.15;
export const MAX_INSTALLMENTS = 600;
/** Trava de segurança da simulação (100 anos). */
const MAX_SIMULATED_MONTHS = 1200;
/** Meio centavo: abaixo disso o saldo conta como quitado. */
const PAID_OFF_THRESHOLD = 0.5;

/** Parcela da Tabela Price, em centavos. `monthlyRate` é fração (0,0085 = 0,85 % ao mês). */
export function pricePayment(principal: Cents, monthlyRate: number, n: number): Cents {
  return Math.round(rawPayment(principal, monthlyRate, n));
}

function rawPayment(principal: number, rate: number, n: number): number {
  return rate ? (principal * rate) / (1 - (1 + rate) ** -n) : principal / n;
}

/** Saldo devedor estimado a partir da parcela, da taxa e das parcelas que faltam. */
export function estimateBalance(payment: Cents, monthlyRate: number, n: number): Cents {
  return Math.round(monthlyRate ? (payment * (1 - (1 + monthlyRate) ** -n)) / monthlyRate : payment * n);
}

/** Parcelas que ainda faltam de um parcelamento no mês `ym` (0 se já acabou). */
export function remainingInstallments(rec: Recurrence, ym: YearMonth): number {
  if (rec.installmentsTotal === null) return 0;
  return Math.max(rec.installmentsTotal - Math.max(ymDiff(rec.start, ym) + 1, 0), 0);
}

export interface PayoffInput {
  readonly principal: Cents;
  /** Fração ao mês. */
  readonly rate: number;
  /** Parcelas que faltam (inteiro, até 600). */
  readonly n: number;
  /** Valor extra por mês. */
  readonly extra: Cents;
}

export interface PayoffRun {
  readonly months: number;
  readonly interest: Cents;
  /** Saldo devedor mês a mês, começando no saldo inicial. */
  readonly curve: readonly Cents[];
}

export type PayoffResult =
  | { readonly ok: false; readonly error: string }
  | {
      readonly ok: true;
      readonly payment: Cents;
      readonly baseline: PayoffRun;
      readonly withExtra: PayoffRun;
      readonly interestSaved: Cents;
      readonly monthsSaved: number;
    };

function run(principal: number, rate: number, payment: number, extra: number): PayoffRun {
  let balance = principal;
  let months = 0;
  let interest = 0;
  const curve = [principal];
  while (balance > PAID_OFF_THRESHOLD && months < MAX_SIMULATED_MONTHS) {
    const monthInterest = balance * rate;
    interest += monthInterest;
    balance = balance + monthInterest - (payment + extra);
    months++;
    curve.push(Math.round(Math.max(balance, 0)));
  }
  return { months, interest: Math.round(interest), curve };
}

/** Simula a quitação pela Tabela Price, com e sem valor extra por mês. Validações e textos do protótipo. */
export function simulatePayoff(input: PayoffInput): PayoffResult {
  const { principal, rate, n, extra } = input;
  if (!(principal > 0 && n > 0 && rate >= 0)) {
    return { ok: false, error: "Preencha saldo, juros e parcelas para simular." };
  }
  if (rate > MAX_MONTHLY_RATE) {
    return { ok: false, error: "Juros acima de 15% ao mês parecem errados. Confira se não digitou a taxa ao ano." };
  }
  if (n > MAX_INSTALLMENTS || !Number.isInteger(n)) {
    return { ok: false, error: "Parcelas que faltam: use um número inteiro de até 600." };
  }
  if (extra < 0) return { ok: false, error: "O valor extra não pode ser negativo." };
  const payment = rawPayment(principal, rate, n);
  const baseline = run(principal, rate, payment, 0);
  const withExtra = run(principal, rate, payment, extra);
  return {
    ok: true,
    payment: Math.round(payment),
    baseline,
    withExtra,
    interestSaved: Math.max(baseline.interest - withExtra.interest, 0),
    monthsSaved: Math.max(baseline.months - withExtra.months, 0),
  };
}
