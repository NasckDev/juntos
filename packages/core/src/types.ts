/** Valor em centavos inteiros. Nunca guarde fração de real (ADR 0002). */
export type Cents = number;
/** Mês de competência no formato "AAAA-MM". */
export type YearMonth = string;
/** Data no formato "AAAA-MM-DD", sempre no fuso America/Sao_Paulo. */
export type IsoDate = string;
export type Kind = "in" | "out" | "save";
export type SplitMode = "equal" | "income" | "custom";
export type Role = "owner" | "editor" | "viewer";

export interface Tx {
  readonly id: string;
  readonly kind: Kind;
  readonly description: string;
  readonly amount: Cents;
  readonly competence: YearMonth;
  /** Dia do vencimento (ou do recebimento) dentro do mês. */
  readonly day: number;
  readonly categoryId: string;
  readonly paid: boolean;
  readonly paymentMethod: string;
  /** Id do membro que pagou ou recebeu; `null` quando não informado. */
  readonly paidBy: string | null;
  /** Gasto pessoal: fica fora da divisão. */
  readonly personal: boolean;
  readonly note: string;
  readonly recurrenceId: string | null;
  readonly installment: number | null;
  readonly installmentsTotal: number | null;
  readonly yearly: boolean;
}

export interface Recurrence {
  readonly id: string;
  readonly kind: Kind;
  readonly description: string;
  readonly amount: Cents;
  readonly categoryId: string;
  readonly frequency: "monthly" | "yearly";
  readonly day: number;
  readonly start: YearMonth;
  readonly installmentsTotal: number | null;
  readonly paymentMethod: string;
  readonly paidBy: string | null;
  readonly personal: boolean;
  readonly paused: boolean;
}

export interface Member {
  readonly id: string;
  readonly name: string;
  /** Convites pendentes não entram na divisão. */
  readonly active: boolean;
}

export interface Settlement {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly amount: Cents;
  readonly periodStart: YearMonth;
  readonly periodEnd: YearMonth;
}

export interface Goal {
  readonly id: string;
  readonly name: string;
  readonly target: Cents;
  readonly saved: Cents;
  readonly monthly: Cents;
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly hue: number;
  readonly kind: Kind;
}
