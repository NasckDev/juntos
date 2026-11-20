import { describe, expect, it } from "vitest";
import {
  BUDGET_NOTIFY_PERCENT,
  BUDGET_ROUNDING,
  budgetStatus,
  budgetTone,
  spentByCategory,
  suggestBudgets,
} from "../src/budget.ts";
import { applyDeposit, depositTx, forecastMonth, forecastMonths, goalProgress, validateDeposit } from "../src/goals.ts";
import { formatBRL } from "../src/money.ts";
import { goal, tx } from "./fixtures/builders.ts";

describe("budgetStatus", () => {
  it("multiplica o limite mensal pelos meses do período", () => {
    const s = budgetStatus({ mercado: 90000 }, { mercado: 120000 }, 3);
    expect(s.lines[0]).toMatchObject({ limit: 270000, spent: 120000, percent: 44, remaining: 150000, tone: "in" });
    expect(s.totalLimit).toBe(270000);
  });

  it("classifica em ok, perto e estourado", () => {
    expect(budgetTone(84)).toBe("in");
    expect(budgetTone(85)).toBe("warn");
    expect(budgetTone(100)).toBe("warn");
    expect(budgetTone(101)).toBe("out");
  });

  it("ordena as categorias mais apertadas primeiro e ignora sem limite", () => {
    const s = budgetStatus({ a: 1000, b: 1000, c: 0 }, { a: 500, b: 1200, c: 9999, d: 5 }, 1);
    expect(s.lines.map((l) => l.categoryId)).toEqual(["b", "a"]);
    expect(s.lines[0]).toMatchObject({ remaining: -200, tone: "out" });
    expect(s.totalSpent).toBe(1700);
    expect(s.percent).toBe(85);
    expect(s.tone).toBe("warn");
  });

  it("sem limites devolve tudo zerado", () => {
    expect(budgetStatus({}, { a: 10 }, 1)).toMatchObject({ lines: [], totalLimit: 0, percent: 0, tone: "in" });
  });

  it("gasto sem registro na categoria conta zero", () => {
    expect(budgetStatus({ a: 1000 }, {}, 1).lines[0]?.spent).toBe(0);
  });
});

describe("spentByCategory", () => {
  it("soma só saídas por categoria", () => {
    const spent = spentByCategory([
      tx({ categoryId: "a", amount: 100 }),
      tx({ categoryId: "a", amount: 50 }),
      tx({ kind: "in", categoryId: "a", amount: 999 }),
    ]);
    expect(spent).toEqual({ a: 150 });
  });
});

describe("suggestBudgets", () => {
  it("usa a média de 3 meses arredondada para cima de R$ 50", () => {
    expect(BUDGET_ROUNDING).toBe(5000);
    expect(BUDGET_NOTIFY_PERCENT).toBe(90);
    const list = [
      tx({ categoryId: "mercado", amount: 60000 }),
      tx({ categoryId: "mercado", amount: 60000 }),
      tx({ categoryId: "mercado", amount: 60100 }),
      tx({ categoryId: "lazer", amount: 15000 }),
      tx({ categoryId: "exato", amount: 30000 }),
    ];
    expect(suggestBudgets(list)).toEqual({ mercado: 65000, lazer: 5000, exato: 10000 });
  });

  it("sem saídas devolve vazio", () => {
    expect(suggestBudgets([tx({ kind: "in" })])).toEqual({});
    expect(suggestBudgets([tx({ amount: 0 })])).toEqual({});
  });
});

describe("metas", () => {
  it("calcula progresso, falta e conclusão", () => {
    expect(goalProgress(goal())).toEqual({ percent: 25, left: 75000, reached: false });
    expect(goalProgress(goal({ saved: 100000 }))).toEqual({ percent: 100, left: 0, reached: true });
    expect(goalProgress(goal({ saved: 150000 })).percent).toBe(100);
  });

  it("prevê os meses até completar", () => {
    expect(forecastMonths(goal())).toBe(8);
    expect(forecastMonths(goal({ monthly: 0 }))).toBeNull();
    expect(forecastMonths(goal({ saved: 100000 }))).toBe(0);
  });

  it("prevê o mês da conclusão", () => {
    expect(forecastMonth(goal(), "2026-11-19")).toBe("2027-07");
    expect(forecastMonth(goal({ monthly: 0 }), "2026-11-19")).toBeNull();
    expect(forecastMonth(goal({ saved: 100000 }), "2026-11-19")).toBeNull();
  });

  it("valida o depósito com as mensagens do protótipo", () => {
    expect(validateDeposit(goal(), 5000)).toEqual({ ok: true, amount: 5000 });
    expect(validateDeposit(goal(), 75000)).toEqual({ ok: true, amount: 75000 });
    expect(validateDeposit(goal(), 0)).toEqual({ ok: false, error: "Digite um valor maior que zero." });
    expect(validateDeposit(goal(), null)).toEqual({ ok: false, error: "Digite um valor maior que zero." });
  });

  it("recusa depósito maior que o que falta", () => {
    expect(validateDeposit(goal(), 75001)).toEqual({
      ok: false,
      error: `Faltam só ${formatBRL(75000)} para a meta. Digite até esse valor.`,
    });
  });

  it("soma o depósito sem mutar a meta e gera o lançamento Guardado", () => {
    const g = goal();
    const next = applyDeposit(g, 5000);
    expect(next.saved).toBe(30000);
    expect(g.saved).toBe(25000);
    expect(depositTx(g, 5000, "2026-11-19", "ana")).toMatchObject({
      kind: "save",
      description: "Meta: Viagem",
      amount: 5000,
      competence: "2026-11",
      day: 19,
      categoryId: "reserva",
      paid: true,
      paidBy: "ana",
    });
  });
});
