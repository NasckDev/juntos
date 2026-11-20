import { describe, expect, it } from "vitest";
import { formatBRL } from "../src/money.ts";
import { estimateBalance, pricePayment, remainingInstallments, simulatePayoff } from "../src/price.ts";
import { projectMonths, upcomingChanges, variableAverage, yearlyDistance } from "../src/projection.ts";
import { rec, tx } from "./fixtures/builders.ts";

const TODAY = "2026-11-19";

describe("projectMonths", () => {
  const salary = rec({ id: "sal", kind: "in", description: "Salário", amount: 500000, categoryId: "salario" });
  const rent = rec({ id: "rent", description: "Aluguel", amount: 150000 });
  const history = [
    tx({ competence: "2026-10", amount: 30000 }),
    tx({ competence: "2026-09", amount: 60000 }),
    tx({ competence: "2026-10", amount: 999999, recurrenceId: "rent" }),
  ];

  it("usa a média dos variáveis dos meses anteriores com dados (agosto não tem)", () => {
    expect(variableAverage(history, TODAY)).toBe(45000);
  });

  it("sem nenhum variável a média é zero", () => {
    expect(variableAverage([], TODAY)).toBe(0);
  });

  it("projeta 6 meses com fixas, variável médio e acumulado", () => {
    const p = projectMonths({ txs: history, recurrences: [salary, rent], today: TODAY });
    expect(p.rows.map((r) => r.ym)).toEqual(["2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05"]);
    expect(p.variableAverage).toBe(45000);
    expect(p.rows[0]).toMatchObject({ in: 500000, fixed: 150000, variable: 45000, left: 305000, accumulated: 305000 });
    expect(p.accumulated).toBe(305000 * 6);
    expect(p.tightest?.ym).toBe("2026-12");
    expect(p.hasData).toBe(true);
  });

  it("desconta o variável já lançado no mês futuro e não duplica a conta fixa já lançada", () => {
    const txs = [
      ...history,
      tx({ competence: "2026-12", amount: 10000 }),
      tx({ competence: "2026-12", amount: 150000, recurrenceId: "rent" }),
    ];
    const p = projectMonths({ txs, recurrences: [salary, rent], today: TODAY, months: 2 });
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toMatchObject({ fixed: 160000, variable: 35000, left: 305000 });
  });

  it("variável já lançado acima da média não vira negativo", () => {
    const txs = [...history, tx({ competence: "2026-12", amount: 100000 })];
    const p = projectMonths({ txs, recurrences: [], today: TODAY, months: 1 });
    expect(p.rows[0]?.variable).toBe(0);
  });

  it("sem entradas nem contas fixas não há o que projetar", () => {
    const p = projectMonths({ txs: [], recurrences: [], today: TODAY });
    expect(p.hasData).toBe(false);
    expect(p.accumulated).toBe(0);
  });

  it("horizonte zero não tem mês mais apertado", () => {
    expect(projectMonths({ txs: [], recurrences: [], today: TODAY, months: 0 }).tightest).toBeNull();
  });
});

describe("upcomingChanges", () => {
  it("lista parcelas que terminam e anuais que chegam, em ordem", () => {
    const changes = upcomingChanges(
      [
        rec({ id: "a", description: "Taxa", amount: 189000, start: "2026-05", installmentsTotal: 9 }),
        rec({ id: "b", description: "IPVA", amount: 200000, frequency: "yearly", start: "2027-02" }),
        rec({ id: "c", description: "Seguro", amount: 145000, frequency: "yearly", start: "2026-12" }),
      ],
      TODAY,
    );
    expect(changes.map((c) => [c.monthsAhead, c.tone])).toEqual([
      [1, "warn"],
      [2, "in"],
      [3, "warn"],
    ]);
    expect(changes[1]?.title).toBe("Taxa termina em janeiro 2027");
    expect(changes[1]?.body).toBe(`Libera ${formatBRL(189000)} por mês a partir de fevereiro.`);
    expect(changes[0]?.title).toBe("Seguro em dezembro 2026");
    expect(changes[0]?.body).toBe(`Conta anual de ${formatBRL(145000)}.`);
  });

  it("ignora pausadas, já encerradas, distantes e anual deste mês (conta como daqui a 12)", () => {
    const changes = upcomingChanges(
      [
        rec({ id: "p", paused: true, installmentsTotal: 12, start: "2026-06" }),
        rec({ id: "old", installmentsTotal: 3, start: "2025-01" }),
        rec({ id: "far", installmentsTotal: 60, start: "2026-01" }),
        rec({ id: "thisMonth", frequency: "yearly", start: "2026-11" }),
        rec({ id: "lateYear", frequency: "yearly", start: "2027-08" }),
        rec({ id: "plain" }),
      ],
      TODAY,
    );
    expect(changes).toEqual([]);
  });

  it("calcula a distância anual, inclusive para início no passado", () => {
    expect(yearlyDistance(rec({ frequency: "yearly", start: "2026-08" }), "2026-11")).toBe(9);
    expect(yearlyDistance(rec({ frequency: "yearly", start: "2026-11" }), "2026-11")).toBe(12);
    expect(yearlyDistance(rec({ frequency: "yearly", start: "2027-02" }), "2026-11")).toBe(3);
  });
});

describe("Tabela Price", () => {
  it("sem juros a parcela é saldo dividido pelas parcelas", () => {
    expect(pricePayment(120000, 0, 12)).toBe(10000);
    expect(estimateBalance(10000, 0, 12)).toBe(120000);
  });

  it("parcela e saldo estimado são inversos (dentro do arredondamento)", () => {
    const payment = pricePayment(18000000, 0.0085, 240);
    expect(payment * 240).toBeGreaterThan(18000000);
    expect(Math.abs(estimateBalance(payment, 0.0085, 240) - 18000000)).toBeLessThan(500);
  });

  it("conta as parcelas que faltam", () => {
    const r = rec({ start: "2026-05", installmentsTotal: 9 });
    expect(remainingInstallments(r, "2026-11")).toBe(2);
    expect(remainingInstallments(r, "2027-06")).toBe(0);
    expect(remainingInstallments(r, "2026-01")).toBe(9);
    expect(remainingInstallments(rec(), "2026-11")).toBe(0);
  });
});

describe("simulatePayoff", () => {
  const base = { principal: 12000000, rate: 0.0085, n: 120, extra: 0 };

  it("simula sem juros: o extra encurta o prazo sem economizar juros", () => {
    const r = simulatePayoff({ principal: 120000, rate: 0, n: 12, extra: 10000 });
    expect(r).toMatchObject({ ok: true, payment: 10000, interestSaved: 0, monthsSaved: 6 });
    if (r.ok) {
      expect(r.baseline.months).toBe(12);
      expect(r.withExtra.months).toBe(6);
      expect(r.baseline.curve).toHaveLength(13);
      expect(r.baseline.curve[12]).toBe(0);
    }
  });

  it("com juros, o extra economiza juros e tempo", () => {
    const r = simulatePayoff({ ...base, extra: 30000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.baseline.months).toBe(120);
      expect(r.withExtra.months).toBeLessThan(120);
      expect(r.interestSaved).toBeGreaterThan(0);
      expect(r.monthsSaved).toBe(120 - r.withExtra.months);
      expect(r.baseline.interest).toBeGreaterThan(r.withExtra.interest);
    }
  });

  it("sem extra não há economia", () => {
    const r = simulatePayoff(base);
    expect(r).toMatchObject({ ok: true, interestSaved: 0, monthsSaved: 0 });
  });

  it("aceita exatamente 15% ao mês e 600 parcelas", () => {
    expect(simulatePayoff({ ...base, rate: 0.15 }).ok).toBe(true);
    expect(simulatePayoff({ ...base, n: 600 }).ok).toBe(true);
  });

  it("valida com as mensagens do protótipo", () => {
    const error = (input: Parameters<typeof simulatePayoff>[0]): string | null => {
      const r = simulatePayoff(input);
      return r.ok ? null : r.error;
    };
    expect(error({ ...base, rate: 0.16 })).toBe(
      "Juros acima de 15% ao mês parecem errados. Confira se não digitou a taxa ao ano.",
    );
    expect(error({ ...base, n: 601 })).toBe("Parcelas que faltam: use um número inteiro de até 600.");
    expect(error({ ...base, n: 12.5 })).toBe("Parcelas que faltam: use um número inteiro de até 600.");
    expect(error({ ...base, extra: -1 })).toBe("O valor extra não pode ser negativo.");
    expect(error({ ...base, principal: 0 })).toBe("Preencha saldo, juros e parcelas para simular.");
    expect(error({ ...base, n: 0 })).toBe("Preencha saldo, juros e parcelas para simular.");
    expect(error({ ...base, rate: -0.01 })).toBe("Preencha saldo, juros e parcelas para simular.");
  });
});
