import { describe, expect, it } from "vitest";
import {
  type ExportFilter,
  exportFilter,
  exportMonths,
  filterForExport,
  validateExportRange,
} from "../src/export/filters.ts";
import {
  buildWorkbookModel,
  type ModelCell,
  type ModelFormula,
  type SheetModel,
} from "../src/export/workbook-model.ts";
import { member, tx } from "./fixtures/builders.ts";

const FILTER: ExportFilter = {
  from: "2026-01",
  to: "2026-12",
  kinds: ["in", "out", "save"],
  status: "all",
  who: null,
  categoryIds: [],
};

describe("validateExportRange", () => {
  it("aceita de 1 a 36 meses", () => {
    expect(validateExportRange(FILTER)).toBeNull();
    expect(validateExportRange({ ...FILTER, from: "2026-01", to: "2026-01" })).toBeNull();
    expect(validateExportRange({ ...FILTER, from: "2026-01", to: "2028-12" })).toBeNull();
  });

  it("exportação com mais de 36 meses é erro", () => {
    expect(validateExportRange({ ...FILTER, from: "2026-01", to: "2029-01" })).toBe(
      "Escolha no máximo 36 meses por vez.",
    );
  });

  it("período invertido e sem tipo marcado são erro", () => {
    expect(validateExportRange({ ...FILTER, from: "2026-05", to: "2026-04" })).toBe(
      "O mês inicial vem depois do final. Ajuste o período.",
    );
    expect(validateExportRange({ ...FILTER, kinds: [] })).toBe("Marque pelo menos um tipo de lançamento.");
  });
});

describe("exportFilter e filterForExport", () => {
  const list = [
    tx({ id: "a", kind: "in", paid: true, paidBy: "ana", categoryId: "salario", competence: "2026-02", day: 5 }),
    tx({ id: "b", kind: "out", paid: false, paidBy: "bia", categoryId: "mercado", competence: "2026-01", day: 9 }),
    tx({
      id: "c",
      kind: "out",
      paid: true,
      paidBy: "ana",
      categoryId: "lazer",
      competence: "2026-01",
      day: 9,
      description: "A",
    }),
    tx({ id: "d", kind: "save", paid: true, paidBy: null, categoryId: "reserva", competence: "2025-12" }),
    tx({ id: "e", kind: "out", competence: "2026-01", day: 2 }),
  ];
  const ids = (f: ExportFilter) => filterForExport(f, list).map((t) => t.id);

  it("filtra por período e ordena por mês, dia e descrição", () => {
    expect(ids(FILTER)).toEqual(["e", "c", "b", "a"]);
  });

  it("filtra por tipo, situação, pessoa e categoria", () => {
    expect(ids({ ...FILTER, kinds: ["in"] })).toEqual(["a"]);
    expect(ids({ ...FILTER, status: "paid" })).toEqual(["c", "a"]);
    expect(ids({ ...FILTER, status: "open" })).toEqual(["e", "b"]);
    expect(ids({ ...FILTER, who: "ana" })).toEqual(["c", "a"]);
    expect(ids({ ...FILTER, categoryIds: ["mercado", "salario"] })).toEqual(["b", "a"]);
  });

  it("período inválido não exporta nada", () => {
    expect(ids({ ...FILTER, from: "2026-12", to: "2026-01" })).toEqual([]);
    expect(ids({ ...FILTER, kinds: [] })).toEqual([]);
  });

  it("o predicado sozinho não olha o período", () => {
    expect(exportFilter(FILTER)(list[3] as (typeof list)[number])).toBe(true);
  });

  it("lista os meses, vazio se invertido e nunca mais de 36", () => {
    expect(exportMonths({ ...FILTER, from: "2026-11", to: "2027-01" })).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(exportMonths({ ...FILTER, from: "2026-12", to: "2026-01" })).toEqual([]);
    expect(exportMonths({ ...FILTER, from: "2020-01", to: "2030-01" })).toHaveLength(36);
  });
});

describe("buildWorkbookModel", () => {
  const members = [member("ana", "Ana")];
  const txs = [
    tx({
      kind: "in",
      description: "Salário",
      amount: 520000,
      competence: "2026-01",
      day: 5,
      categoryId: "salario",
      paid: true,
      paidBy: "ana",
    }),
    tx({ kind: "in", description: "Freela", amount: 80050, competence: "2026-01", day: 7, categoryId: "extra" }),
    tx({ description: "Aluguel", amount: 150000, competence: "2026-01", day: 10, categoryId: "moradia", paid: true }),
    tx({ description: "Internet", amount: 12000, competence: "2026-01", day: 12, paymentMethod: "Pix" }),
    tx({ description: "Taxa", amount: 189000, competence: "2026-01", day: 25, installment: 3, installmentsTotal: 29 }),
    tx({
      description: "Obra 7/29",
      amount: 1000,
      competence: "2026-01",
      day: 26,
      installment: 7,
      installmentsTotal: 29,
    }),
    tx({ kind: "save", description: "Reserva", amount: 40000, competence: "2026-01", day: 6, categoryId: "reserva" }),
    tx({ kind: "in", description: "Salário", amount: 520000, competence: "2026-02", day: 5, categoryId: "salario" }),
    tx({ description: "Aluguel", amount: 150000, competence: "2026-02", day: 10 }),
  ];
  const model = buildWorkbookModel({ months: ["2026-01", "2026-02"], txs, members });
  const [jan, feb, overview, listing] = model.sheets as [SheetModel, SheetModel, SheetModel, SheetModel];
  const cell = (sheet: SheetModel, address: string): ModelCell => {
    const found = sheet.cells.find((c) => c.address === address);
    if (!found) throw new Error(`Sem célula ${address}`);
    return found;
  };
  const formula = (sheet: SheetModel, address: string): ModelFormula => {
    const value = cell(sheet, address).value;
    if (typeof value !== "object" || value === null || !("formula" in value))
      throw new Error(`${address} não é fórmula`);
    return value;
  };

  it("cria uma aba por mês, Visão Geral e Lançamentos, nessa ordem", () => {
    expect(model.creator).toBe("Juntos");
    expect(model.sheets.map((s) => s.name)).toEqual(["Janeiro", "Fevereiro", "Visão Geral", "Lançamentos"]);
    expect(jan.showGridLines).toBe(false);
  });

  it("monta o cabeçalho e as células C3 a C10 e B11 com as fórmulas", () => {
    expect(cell(jan, "B1").value).toBe("Orçamento");
    expect(cell(jan, "B2").value).toBe("Percentual da renda gasta");
    expect(cell(jan, "C2").value).toBe("Resumo");
    expect(cell(jan, "C3").value).toBe("Renda mensal total");
    expect(formula(jan, "C4")).toEqual({ formula: "SUM(C14:C15)", result: 6000.5 });
    expect(cell(jan, "C5").value).toBe("Despesa mensal total");
    expect(formula(jan, "C6")).toEqual({ formula: "SUM(C19:C22)", result: 3520 });
    expect(cell(jan, "C7").value).toBe("Economia mensal total");
    expect(formula(jan, "C8")).toEqual({ formula: "SUM(C26:C26)", result: 400 });
    expect(cell(jan, "C9").value).toBe("Saldo em dinheiro");
    expect(formula(jan, "C10")).toEqual({ formula: "C4-C6-C8", result: 2080.5 });
    expect(formula(jan, "B11").formula).toBe("IF(C4>0,MIN(C6/C4,1),0)");
    expect(formula(jan, "B11").result).toBeCloseTo(3520 / 6000.5, 10);
    expect(cell(jan, "C4").numFmt).toBe('"R$" #,##0.00');
    expect(cell(jan, "B11").numFmt).toBe("0%");
  });

  it("as seções começam na linha 12 com títulos e tabelas", () => {
    expect(cell(jan, "B12").value).toBe("Renda mensal");
    expect(cell(jan, "B17").value).toBe("Despesas mensais");
    expect(cell(jan, "B24").value).toBe("Economia mensal");
    expect(jan.tables.map((t) => [t.name, t.ref, t.columns.length])).toEqual([
      ["Renda1", "B13", 2],
      ["Despesas1", "B18", 3],
      ["Economia1", "B25", 2],
    ]);
    expect(jan.tables[0]?.rows).toEqual([
      ["Salário", 5200],
      ["Freela", 800.5],
    ]);
  });

  it("despesas mostram situação: pago, meio de pagamento ou '-', e parcela no rótulo", () => {
    expect(jan.tables[1]?.rows).toEqual([
      ["Aluguel", 1500, "pago"],
      ["Internet", 120, "Pix"],
      ["Taxa 3/29", 1890, "-"],
      ["Obra 7/29", 10, "-"],
    ]);
  });

  it("seção vazia ganha uma linha de reserva para a fórmula não quebrar", () => {
    expect(feb.tables[2]?.rows).toEqual([["", 0]]);
    expect(formula(feb, "C8")).toEqual({ formula: "SUM(C22:C22)", result: 0 });
    expect(formula(feb, "B11").result).toBeCloseTo(150000 / 520000, 10);
  });

  it("percentual da renda gasta é limitado a 100% e vale 0 sem renda", () => {
    const over = buildWorkbookModel({
      months: ["2026-03", "2026-04"],
      txs: [
        tx({ kind: "in", amount: 100, competence: "2026-03" }),
        tx({ amount: 500, competence: "2026-03" }),
        tx({ amount: 500, competence: "2026-04" }),
      ],
      members,
    });
    expect(formula(over.sheets[0] as SheetModel, "B11").result).toBe(1);
    expect(formula(over.sheets[1] as SheetModel, "B11").result).toBe(0);
  });

  it("Visão Geral soma em 3D entre a primeira e a última aba", () => {
    expect(cell(overview, "C3").value).toBe("Renda total do período");
    expect(formula(overview, "C4")).toEqual({ formula: "SUM('Janeiro:Fevereiro'!C4)", result: 11200.5 });
    expect(formula(overview, "C6").formula).toBe("SUM('Janeiro:Fevereiro'!C6)");
    expect(formula(overview, "C8").formula).toBe("SUM('Janeiro:Fevereiro'!C8)");
    expect(formula(overview, "C10")).toEqual({ formula: "C4-C6-C8", result: 11200.5 - 5020 - 400 });
    expect(overview.tables.map((t) => t.name)).toEqual(["RendaTotal", "DespesasMes", "EconomiaMes"]);
    expect(overview.tables[0]?.rows).toEqual([
      ["Salário", 10400],
      ["Freela", 800.5],
    ]);
    expect(overview.tables[1]?.rows).toEqual([
      ["Janeiro", { formula: "'Janeiro'!C6", result: 3520 }],
      ["Fevereiro", { formula: "'Fevereiro'!C6", result: 1500 }],
    ]);
    expect(overview.tables[2]?.rows[0]).toEqual(["Janeiro", { formula: "'Janeiro'!C8", result: 400 }]);
  });

  it("rótulos anuais só com 12 meses do mesmo ano; com anos diferentes usa 'Mmm AAAA' nas abas", () => {
    const year = buildWorkbookModel({
      months: Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`),
      txs: [],
      members,
    });
    const yearOverview = year.sheets[12] as SheetModel;
    expect(cell(yearOverview, "C3").value).toBe("Renda anual total");
    expect(cell(yearOverview, "C5").value).toBe("Despesa anual total");
    expect(cell(yearOverview, "C7").value).toBe("Economia anual total");
    expect(formula(yearOverview, "C4").formula).toBe("SUM('Janeiro:Dezembro'!C4)");

    const across = buildWorkbookModel({ months: ["2026-12", "2027-01"], txs: [], members });
    expect(across.sheets.map((s) => s.name)).toEqual(["Dez 2026", "Jan 2027", "Visão Geral", "Lançamentos"]);
    expect(formula(across.sheets[2] as SheetModel, "C4").formula).toBe("SUM('Dez 2026:Jan 2027'!C4)");
    expect(cell(across.sheets[2] as SheetModel, "C3").value).toBe("Renda total do período");
  });

  it("aba Lançamentos tem as colunas pedidas, cabeçalho congelado e uma linha por lançamento", () => {
    expect(listing.frozenRows).toBe(1);
    expect(listing.autoFilter).toEqual({ from: "A1", to: "J1" });
    expect(listing.headerRow?.fill).toBe("FF4F46E5");
    const headers = "ABCDEFGHIJ".split("").map((c) => cell(listing, `${c}1`).value);
    expect(headers).toEqual([
      "Data",
      "Tipo",
      "Descrição",
      "Categoria",
      "Valor",
      "Situação",
      "Pago com",
      "Quem",
      "Parcela",
      "Observação",
    ]);
    expect(listing.columns).toHaveLength(10);
    const rowFor = (row: number) => "ABCDEFGHIJ".split("").map((c) => cell(listing, `${c}${row}`).value);
    expect(rowFor(2)).toEqual([
      { date: "2026-01-05" },
      "Entrada",
      "Salário",
      "Salário",
      5200,
      "Recebido",
      "",
      "Ana",
      "",
      "",
    ]);
    expect(rowFor(3)).toEqual([
      { date: "2026-01-06" },
      "Guardado",
      "Reserva",
      "Reserva",
      400,
      "Em aberto",
      "",
      "",
      "",
      "",
    ]);
    expect(rowFor(5)[5]).toBe("Pago");
    expect(rowFor(7)[8]).toBe("3/29");
    expect(listing.cells.filter((c) => c.address.endsWith("1")).length).toBeGreaterThanOrEqual(10);
    expect(cell(listing, "A2").numFmt).toBe("dd/mm/yyyy");
    expect(cell(listing, "E2").numFmt).toBe('"R$" #,##0.00');
  });

  it("parcela sem número fica 0/total na listagem em vez de quebrar", () => {
    const m = buildWorkbookModel({
      months: ["2026-01"],
      txs: [tx({ competence: "2026-01", installment: null, installmentsTotal: 5 })],
      members,
    });
    expect(m.sheets[2]?.cells.find((c) => c.address === "I2")?.value).toBe("0/5");
  });

  it("aplica o filtro recebido", () => {
    const only = buildWorkbookModel({ months: ["2026-01"], txs, members, filter: (t) => t.kind === "in" });
    expect(formula(only.sheets[0] as SheetModel, "C6").result).toBe(0);
    expect(only.sheets[2]?.cells.filter((c) => c.address.startsWith("B")).length).toBe(3);
  });

  it("recusa 0 meses e mais de 36 meses", () => {
    expect(() => buildWorkbookModel({ months: [], txs: [], members })).toThrow("Escolha pelo menos um mês.");
    const many = Array.from(
      { length: 37 },
      (_, i) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    );
    expect(() => buildWorkbookModel({ months: many, txs: [], members })).toThrow("Escolha no máximo 36 meses por vez.");
    expect(buildWorkbookModel({ months: many.slice(0, 36), txs: [], members }).sheets).toHaveLength(38);
  });
});
