import { describe, expect, it } from "vitest";
import { findDuplicate, normalizeName } from "../src/duplicates.ts";
import { DUE_SOON_HOME_DAYS, DUE_SOON_NOTIFY_DAYS, groupBySituation, isDueSoon, isLate } from "../src/status.ts";
import { byCategory, dailyBalance, delta, deltaLabel, receivedSoFar, totals } from "../src/totals.ts";
import { tx } from "./fixtures/builders.ts";

const TODAY = "2026-11-19";

describe("isLate", () => {
  it("vencido e não pago é atrasado; hoje ainda não", () => {
    expect(isLate(tx({ day: 18 }), TODAY)).toBe(true);
    expect(isLate(tx({ day: 19 }), TODAY)).toBe(false);
    expect(isLate(tx({ day: 20 }), TODAY)).toBe(false);
  });

  it("meses anteriores em aberto são atrasados; futuros, não", () => {
    expect(isLate(tx({ competence: "2026-10", day: 30 }), TODAY)).toBe(true);
    expect(isLate(tx({ competence: "2026-12", day: 1 }), TODAY)).toBe(false);
  });

  it("pago e entrada nunca atrasam", () => {
    expect(isLate(tx({ day: 1, paid: true }), TODAY)).toBe(false);
    expect(isLate(tx({ day: 1, kind: "in" }), TODAY)).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("usa as constantes 7 e 3 dias", () => {
    expect(DUE_SOON_HOME_DAYS).toBe(7);
    expect(DUE_SOON_NOTIFY_DAYS).toBe(3);
  });

  it("vence em breve na janela, mas atrasado não", () => {
    expect(isDueSoon(tx({ day: 22 }), TODAY, 3)).toBe(true);
    expect(isDueSoon(tx({ day: 23 }), TODAY, 3)).toBe(false);
    expect(isDueSoon(tx({ day: 26 }), TODAY, 7)).toBe(true);
    expect(isDueSoon(tx({ day: 19 }), TODAY, 3)).toBe(true);
    expect(isDueSoon(tx({ day: 18 }), TODAY, 3)).toBe(false);
  });

  it("não vale para pagos, entradas ou outros meses", () => {
    expect(isDueSoon(tx({ day: 20, paid: true }), TODAY, 3)).toBe(false);
    expect(isDueSoon(tx({ day: 20, kind: "in" }), TODAY, 3)).toBe(false);
    expect(isDueSoon(tx({ day: 20, competence: "2026-12" }), TODAY, 3)).toBe(false);
  });

  it("atrasado vs vence em breve: o mesmo lançamento nunca é os dois", () => {
    const late = tx({ day: 10 });
    const soon = tx({ day: 21 });
    expect([isLate(late, TODAY), isDueSoon(late, TODAY, 7)]).toEqual([true, false]);
    expect([isLate(soon, TODAY), isDueSoon(soon, TODAY, 7)]).toEqual([false, true]);
  });
});

describe("groupBySituation", () => {
  it("separa atrasados, em aberto e concluídos", () => {
    const a = tx({ day: 1 });
    const b = tx({ day: 25 });
    const c = tx({ day: 1, paid: true });
    const d = tx({ kind: "in", day: 1 });
    const groups = groupBySituation([a, b, c, d], TODAY);
    expect(groups.late).toEqual([a]);
    expect(groups.open).toEqual([b, d]);
    expect(groups.done).toEqual([c]);
  });
});

describe("totals", () => {
  it("soma entradas, saídas pagas e a pagar, guardado e sobra", () => {
    const t = totals([
      tx({ kind: "in", amount: 500000 }),
      tx({ amount: 100000, paid: true }),
      tx({ amount: 50000 }),
      tx({ kind: "save", amount: 20000 }),
    ]);
    expect(t).toEqual({ in: 500000, out: 150000, save: 20000, outPaid: 100000, outDue: 50000, left: 330000 });
  });

  it("lista vazia é tudo zero", () => {
    expect(totals([]).left).toBe(0);
  });
});

describe("byCategory", () => {
  it("agrupa por categoria do tipo e ordena do maior para o menor", () => {
    const list = [
      tx({ categoryId: "mercado", amount: 100 }),
      tx({ categoryId: "lazer", amount: 300 }),
      tx({ categoryId: "mercado", amount: 400 }),
      tx({ kind: "in", categoryId: "salario", amount: 9999 }),
    ];
    expect(byCategory(list, "out")).toEqual([
      { categoryId: "mercado", total: 500 },
      { categoryId: "lazer", total: 300 },
    ]);
    expect(byCategory(list, "save")).toEqual([]);
  });
});

describe("receivedSoFar", () => {
  it("só conta o que já foi recebido e o que já foi pago", () => {
    const list = [
      tx({ kind: "in", amount: 1000, paid: true }),
      tx({ kind: "in", amount: 500 }),
      tx({ amount: 200, paid: true }),
      tx({ kind: "save", amount: 100, paid: true }),
      tx({ amount: 999 }),
    ];
    expect(receivedSoFar(list)).toEqual({ received: 1000, spent: 300 });
  });
});

describe("dailyBalance", () => {
  it("acumula dia a dia e começa em zero", () => {
    const points = dailyBalance(
      [
        tx({ kind: "in", amount: 1000, day: 2 }),
        tx({ amount: 300, day: 2 }),
        tx({ kind: "save", amount: 100, day: 28 }),
        tx({ amount: 5000, competence: "2026-12" }),
      ],
      "2026-11",
    );
    expect(points).toHaveLength(31);
    expect(points[0]).toEqual({ day: 0, balance: 0 });
    expect(points[1]?.balance).toBe(0);
    expect(points[2]?.balance).toBe(700);
    expect(points[27]?.balance).toBe(700);
    expect(points[28]?.balance).toBe(600);
    expect(points[30]?.balance).toBe(600);
  });

  it("fevereiro tem 28 dias (29 em ano bissexto)", () => {
    expect(dailyBalance([], "2026-02")).toHaveLength(29);
    expect(dailyBalance([], "2028-02")).toHaveLength(30);
  });
});

describe("delta", () => {
  it("compara com o período anterior", () => {
    expect(delta(1100, 1000)).toEqual({ percent: 10, direction: "up" });
    expect(delta(900, 1000)).toEqual({ percent: 10, direction: "down" });
    expect(delta(1000, 1000)).toEqual({ percent: 0, direction: "same" });
  });

  it("sem base de comparação devolve null", () => {
    expect(delta(500, 0)).toBeNull();
  });

  it("usa o módulo da base quando ela é negativa", () => {
    expect(delta(-500, -1000)).toEqual({ percent: 50, direction: "up" });
  });

  it("escreve a frase como o protótipo", () => {
    expect(deltaLabel(delta(1100, 1000), "2026-11", false)).toBe("10% acima de outubro");
    expect(deltaLabel(delta(900, 1000), "2026-11", true)).toBe("10% abaixo do período anterior");
    expect(deltaLabel(delta(1000, 1000), "2026-11", false)).toBe("igual a outubro");
    expect(deltaLabel(delta(1000, 1000), "2026-11", true)).toBe("igual ao período anterior");
    expect(deltaLabel(null, "2026-11", false)).toBe("");
    expect(deltaLabel(delta(1100, 1000), "2026-01", false)).toBe("10% acima de dezembro");
  });
});

describe("findDuplicate", () => {
  const existing = tx({ id: "a", description: "Conta de Luz", amount: 18000, day: 12 });

  it("acha igual por nome normalizado, valor, tipo, competência e dia", () => {
    const candidate = {
      description: "  conta de LUZ ",
      amount: 18000,
      kind: "out",
      competence: "2026-11",
      day: 12,
    } as const;
    expect(findDuplicate(candidate, [existing])).toBe(existing);
    expect(findDuplicate({ ...candidate, description: "Conta de luz" }, [existing])).toBe(existing);
  });

  it("ignora acento, valor, tipo, mês e dia diferentes", () => {
    const base = { description: "Conta de luz", amount: 18000, kind: "out", competence: "2026-11", day: 12 } as const;
    expect(findDuplicate({ ...base, amount: 18001 }, [existing])).toBeNull();
    expect(findDuplicate({ ...base, kind: "in" }, [existing])).toBeNull();
    expect(findDuplicate({ ...base, competence: "2026-12" }, [existing])).toBeNull();
    expect(findDuplicate({ ...base, day: 13 }, [existing])).toBeNull();
    expect(findDuplicate({ ...base, description: "Outra" }, [existing])).toBeNull();
  });

  it("a edição não se acusa como duplicada de si mesma", () => {
    const base = { description: "Conta de luz", amount: 18000, kind: "out", competence: "2026-11", day: 12 } as const;
    expect(findDuplicate(base, [existing], "a")).toBeNull();
  });

  it("normaliza acentos", () => {
    expect(normalizeName("  Ápê   Obra ")).toBe("ape obra");
  });
});
