import { describe, expect, it } from "vitest";
import { buildWorkbookModel } from "../src/export/workbook-model.ts";
import { parseMonthlySheet } from "../src/import/monthly-sheet.ts";
import { planImport } from "../src/import/review.ts";
import { parseWorkbook } from "../src/import/workbook.ts";
import { totals } from "../src/totals.ts";
import type { Tx } from "../src/types.ts";
import { member, tx } from "./fixtures/builders.ts";
import { modelToGrids } from "./fixtures/monthly-sheet.ts";

const TODAY = "2026-11-19";
const members = [member("ana", "Ana"), member("bia", "Bia")];

/** Dados fictícios em dois anos, com parcela, anual, observação e quem pagou. */
const original: Tx[] = [
  tx({
    kind: "in",
    description: "Salário Ana",
    amount: 520000,
    competence: "2026-01",
    day: 5,
    categoryId: "salario",
    paid: true,
    paidBy: "ana",
  }),
  tx({
    kind: "in",
    description: "Freela Bia",
    amount: 80050,
    competence: "2026-01",
    day: 18,
    categoryId: "extra",
    paid: true,
    paidBy: "bia",
    note: "Logo da padaria",
  }),
  tx({
    description: "Aluguel",
    amount: 150000,
    competence: "2026-01",
    day: 10,
    categoryId: "moradia",
    paid: true,
    paymentMethod: "Boleto",
    paidBy: "ana",
  }),
  tx({
    description: "Taxa de obra",
    amount: 189000,
    competence: "2026-01",
    day: 25,
    categoryId: "moradia",
    installment: 7,
    installmentsTotal: 29,
    paidBy: "bia",
  }),
  tx({ description: "IPVA", amount: 200000, competence: "2026-02", day: 28, categoryId: "transp", yearly: true }),
  tx({
    kind: "save",
    description: "Reserva",
    amount: 40000,
    competence: "2026-02",
    day: 6,
    categoryId: "reserva",
    paid: true,
  }),
  tx({
    description: "Mercado",
    amount: 99999,
    competence: "2026-03",
    day: 3,
    categoryId: "mercado",
    paid: true,
    paymentMethod: "Pix",
  }),
  tx({ description: "Viagem de fim de ano", amount: 350000, competence: "2027-01", day: 31, categoryId: "lazer" }),
  tx({
    kind: "in",
    description: "Salário Ana",
    amount: 530000,
    competence: "2027-01",
    day: 5,
    categoryId: "salario",
    paidBy: "ana",
  }),
];

function project(t: Omit<Tx, "id">) {
  return {
    kind: t.kind,
    description: t.description,
    amount: t.amount,
    competence: t.competence,
    day: t.day,
    categoryId: t.categoryId,
    paid: t.paid,
    paymentMethod: t.paymentMethod,
    paidBy: t.paidBy,
    note: t.note,
    installment: t.installment,
    installmentsTotal: t.installmentsTotal,
  };
}

function byKey<T extends { competence: string; day: number; description: string }>(list: readonly T[]): T[] {
  return [...list].sort(
    (a, b) => a.competence.localeCompare(b.competence) || a.day - b.day || a.description.localeCompare(b.description),
  );
}

describe("ida e volta: exportar e importar", () => {
  it("a aba Lançamentos volta com os mesmos lançamentos (inclusive em dois anos)", () => {
    const months = ["2026-01", "2026-02", "2026-03", "2027-01"];
    const grids = modelToGrids(buildWorkbookModel({ months, txs: original, members }));

    const parsed = parseWorkbook(grids, 2026);
    expect(parsed.source).toBe("detailed");

    const plan = planImport(parsed.items, { mode: "add", today: TODAY, members });
    expect(byKey(plan.create).map(project)).toEqual(byKey(original).map(project));
  });

  it("a planilha mensal volta com os mesmos totais por mês e os mesmos itens", () => {
    const months = ["2026-01", "2026-02", "2026-03"];
    const inYear = original.filter((t) => t.competence.startsWith("2026"));
    const grids = modelToGrids(buildWorkbookModel({ months, txs: inYear, members }));

    const items = parseMonthlySheet(grids, 2026);
    const plan = planImport(items, { mode: "add", today: TODAY });

    for (const ym of months) {
      const expected = totals(inYear.filter((t) => t.competence === ym));
      const got = totals(plan.create.filter((t) => t.competence === ym).map((t, i) => ({ ...t, id: `x${i}` })));
      expect([ym, got.in, got.out, got.save]).toEqual([ym, expected.in, expected.out, expected.save]);
    }
    const labels = (list: readonly { description: string; amount: number; kind: string }[]) =>
      list.map((t) => `${t.kind}|${t.description}|${t.amount}`).sort();
    const expectedLabels = inYear.map((t) => ({
      kind: t.kind,
      amount: t.amount,
      description: t.installmentsTotal ? `${t.description} ${t.installment}/${t.installmentsTotal}` : t.description,
    }));
    expect(labels(plan.create)).toEqual(labels(expectedLabels));
    const taxa = plan.create.find((t) => t.description.startsWith("Taxa de obra"));
    expect(taxa).toMatchObject({ installment: 7, installmentsTotal: 29 });
  });

  it("a planilha mensal exportada não confunde as abas Visão Geral e Lançamentos com meses", () => {
    const grids = modelToGrids(buildWorkbookModel({ months: ["2026-01"], txs: original, members }));
    const names = grids.map((g) => g.name);
    expect(names).toEqual(["Janeiro", "Visão Geral", "Lançamentos"]);
    const items = parseMonthlySheet(grids, 2026);
    expect(new Set(items.map((i) => i.month))).toEqual(new Set([1]));
  });
});
