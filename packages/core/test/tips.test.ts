import { describe, expect, it } from "vitest";
import { formatBRL } from "../src/money.ts";
import { tips } from "../src/tips.ts";
import { rec, tx } from "./fixtures/builders.ts";

const YM = "2026-11";

function titles(input: Parameters<typeof tips>[0]): string[] {
  return tips(input).map((t) => t.title);
}

describe("tips", () => {
  it("avisa quando as saídas passam das entradas", () => {
    const txs = [tx({ kind: "in", amount: 100000 }), tx({ amount: 120000 })];
    expect(tips({ ym: YM, txs, recurrences: [] })[0]).toEqual({
      tone: "out",
      icon: "alert",
      title: `As saídas passam das entradas em ${formatBRL(20000)}`,
      body: "Veja o que pode ficar para o mês que vem.",
    });
  });

  it("avisa com 90% ou mais comprometido (guardado conta)", () => {
    const txs = [tx({ kind: "in", amount: 100000 }), tx({ amount: 70000 }), tx({ kind: "save", amount: 20000 })];
    expect(tips({ ym: YM, txs, recurrences: [] })[0]).toMatchObject({
      tone: "warn",
      title: "90% do que entra já tem destino",
    });
  });

  it("sem aviso abaixo de 90% ou sem entradas", () => {
    expect(
      titles({ ym: YM, txs: [tx({ kind: "in", amount: 100000 }), tx({ amount: 80000 })], recurrences: [] }),
    ).toEqual([]);
    expect(titles({ ym: YM, txs: [tx({ amount: 80000 })], recurrences: [] })).toEqual([]);
  });

  it("destaca a conta fixa que mais subiu mais de R$ 50", () => {
    const txs = [
      tx({ description: "Internet", recurrenceId: "a", competence: "2026-10", amount: 10000 }),
      tx({ description: "Internet", recurrenceId: "a", competence: YM, amount: 16000 }),
      tx({ description: "Luz", recurrenceId: "b", competence: "2026-10", amount: 10000 }),
      tx({ description: "Luz", recurrenceId: "b", competence: YM, amount: 20000 }),
      tx({ description: "Gás", recurrenceId: "c", competence: "2026-10", amount: 10000 }),
      tx({ description: "Gás", recurrenceId: "c", competence: YM, amount: 15000 }),
      tx({ description: "Nova", recurrenceId: "d", competence: YM, amount: 99999 }),
      tx({ description: "Avulsa", competence: YM, amount: 99999 }),
      tx({ kind: "in", description: "Salário", recurrenceId: "e", competence: "2026-10", amount: 1 }),
      tx({ kind: "in", description: "Salário", recurrenceId: "e", competence: YM, amount: 900000 }),
    ];
    const [first] = tips({ ym: YM, txs, recurrences: [] });
    expect(first).toEqual({
      tone: "warn",
      icon: "chart",
      title: `Luz subiu ${formatBRL(10000)}`,
      body: "Comparado com outubro.",
    });
  });

  it("aumento de exatamente R$ 50 não é dica", () => {
    const txs = [
      tx({ recurrenceId: "a", competence: "2026-10", amount: 10000 }),
      tx({ recurrenceId: "a", competence: YM, amount: 15000 }),
    ];
    expect(titles({ ym: YM, txs, recurrences: [] })).toEqual([]);
  });

  it("avisa de parcelamento que termina em até 6 meses, o mais próximo primeiro", () => {
    const recurrences = [
      rec({ id: "a", description: "Carro", amount: 79000, start: "2026-01", installmentsTotal: 18 }),
      rec({ id: "b", description: "Taxa", amount: 189000, start: "2026-09", installmentsTotal: 5 }),
      rec({ id: "c", description: "Longa", start: "2026-01", installmentsTotal: 60 }),
      rec({ id: "d", description: "Pausada", start: "2026-09", installmentsTotal: 3, paused: true }),
      rec({ id: "e", description: "Acabou", start: "2026-01", installmentsTotal: 5 }),
    ];
    expect(tips({ ym: YM, txs: [], recurrences })[0]).toEqual({
      tone: "in",
      icon: "cal",
      title: "Taxa termina em janeiro 2027",
      body: `Depois disso sobram ${formatBRL(189000)} a mais por mês.`,
    });
  });

  it("avisa de conta anual em até 3 meses e sugere guardar por mês (de R$ 10 em R$ 10)", () => {
    const recurrences = [
      rec({ id: "a", description: "IPVA", amount: 100000, frequency: "yearly", start: "2027-02" }),
      rec({ id: "b", description: "Longe", frequency: "yearly", start: "2027-08" }),
      rec({ id: "c", description: "Pausada", frequency: "yearly", start: "2026-12", paused: true }),
    ];
    expect(tips({ ym: YM, txs: [], recurrences })[0]).toEqual({
      tone: "save",
      icon: "cal",
      title: "IPVA chega em fevereiro",
      body: `Conta anual de ${formatBRL(100000)}. Guardando ${formatBRL(34000)} por mês até lá, ela não pesa.`,
    });
  });

  it("conta anual no mês que vem sugere separar o valor agora", () => {
    const recurrences = [rec({ description: "Seguro", amount: 145000, frequency: "yearly", start: "2026-12" })];
    expect(tips({ ym: YM, txs: [], recurrences })[0]?.body).toBe(
      `Conta anual de ${formatBRL(145000)}. É no mês que vem: vale separar o valor agora.`,
    );
  });

  it("soma as assinaturas por ano (precisa de mais de uma)", () => {
    const sub = (description: string, day: number) => tx({ categoryId: "assin", description, amount: 2100, day });
    const [first] = tips({ ym: YM, txs: [sub("YouTube", 9), sub("Netflix", 8)], recurrences: [] });
    expect(first).toEqual({
      tone: "muted",
      icon: "rep",
      title: `2 assinaturas somam ${formatBRL(2100 * 2 * 12)} por ano`,
      body: "Netflix, YouTube.",
    });
    expect(titles({ ym: YM, txs: [sub("Netflix", 8)], recurrences: [] })).toEqual([]);
  });

  it("mostra no máximo 3 dicas, na ordem das regras", () => {
    const txs = [
      tx({ kind: "in", amount: 100000 }),
      tx({ amount: 130000 }),
      tx({ recurrenceId: "a", competence: "2026-10", amount: 1000 }),
      tx({ recurrenceId: "a", competence: YM, amount: 20000 }),
      tx({ categoryId: "assin", amount: 100 }),
      tx({ categoryId: "assin", amount: 100 }),
    ];
    const recurrences = [
      rec({ id: "b", description: "Taxa", start: "2026-09", installmentsTotal: 5 }),
      rec({ id: "c", description: "IPVA", frequency: "yearly", start: "2027-01" }),
    ];
    const result = tips({ ym: YM, txs, recurrences });
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.icon)).toEqual(["alert", "chart", "cal"]);
  });
});
