import type { Goal, Member, Recurrence, Tx } from "../../src/types.ts";

let counter = 0;

/** Lançamento de teste com valores neutros; sobrescreva só o que importa para o caso. */
export function tx(overrides: Partial<Tx> = {}): Tx {
  counter += 1;
  return {
    id: `t${counter}`,
    kind: "out",
    description: "Conta",
    amount: 10000,
    competence: "2026-11",
    day: 10,
    categoryId: "outros",
    paid: false,
    paymentMethod: "",
    paidBy: null,
    personal: false,
    note: "",
    recurrenceId: null,
    installment: null,
    installmentsTotal: null,
    yearly: false,
    ...overrides,
  };
}

export function rec(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    id: "r1",
    kind: "out",
    description: "Internet",
    amount: 12000,
    categoryId: "contas",
    frequency: "monthly",
    day: 10,
    start: "2026-01",
    installmentsTotal: null,
    paymentMethod: "Pix",
    paidBy: null,
    personal: false,
    paused: false,
    ...overrides,
  };
}

export function member(id: string, name: string, active = true): Member {
  return { id, name, active };
}

export function goal(overrides: Partial<Goal> = {}): Goal {
  return { id: "g1", name: "Viagem", target: 100000, saved: 25000, monthly: 10000, ...overrides };
}

/** Remove o espaço não separável que o Intl coloca depois de "R$". */
export function plain(text: string): string {
  return text.replace(/ /g, " ");
}
