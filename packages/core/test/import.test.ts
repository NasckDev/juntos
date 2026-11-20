import { describe, expect, it } from "vitest";
import { parseDetailedSheet, parseSheetDate } from "../src/import/detailed.ts";
import { parseMonthlySheet } from "../src/import/monthly-sheet.ts";
import { markExisting, planImport, resolveCompetence } from "../src/import/review.ts";
import { type Cell, type ImportItem, parseInstallment } from "../src/import/types.ts";
import { parseWorkbook, yearFromFileName } from "../src/import/workbook.ts";
import { member, tx } from "./fixtures/builders.ts";
import { buildMonthlySheets, toExcelSerial } from "./fixtures/monthly-sheet.ts";

function item(overrides: Partial<ImportItem> = {}): ImportItem {
  return {
    source: "monthly",
    year: 2026,
    month: 11,
    day: 10,
    kind: "out",
    description: "Aluguel",
    amount: 150000,
    status: "",
    paid: null,
    paymentMethod: "",
    categoryId: "moradia",
    whoName: "",
    note: "",
    installment: null,
    installmentsTotal: null,
    ...overrides,
  };
}

describe("parseMonthlySheet", () => {
  const items = parseMonthlySheet(buildMonthlySheets(), 2026);
  const jan = items.filter((i) => i.month === 1);
  const feb = items.filter((i) => i.month === 2);

  it("lê as três seções de cada aba de mês e ignora abas de outro nome", () => {
    expect(jan.map((i) => [i.kind, i.description, i.amount])).toEqual([
      ["in", "Salário Ana", 520000],
      ["in", "Freela Bia", 80050],
      ["out", "Aluguel", 150000],
      ["out", "Internet", 12000],
      ["out", "Cartão Azul", 90075],
      ["out", "Taxa de obra 7/29", 189000],
      ["save", "Reserva de emergência", 40000],
    ]);
    expect(feb).toHaveLength(2);
    expect(items.every((i) => i.year === 2026)).toBe(true);
  });

  it("ignora valor zero e linhas sem valor numérico", () => {
    expect(jan.some((i) => i.description === "Zerada")).toBe(false);
  });

  it("lê a parcela do nome", () => {
    const taxa = jan.find((i) => i.description.startsWith("Taxa"));
    expect(taxa).toMatchObject({ installment: 7, installmentsTotal: 29 });
    expect(jan.find((i) => i.description === "Aluguel")?.installment).toBeNull();
  });

  it("separa situação de meio de pagamento", () => {
    const by = (name: string) => jan.find((i) => i.description === name);
    expect(by("Aluguel")).toMatchObject({ status: "pago", paymentMethod: "" });
    expect(by("Internet")).toMatchObject({ status: "pix", paymentMethod: "Pix" });
    expect(by("Cartão Azul")).toMatchObject({ status: "-", paymentMethod: "" });
    expect(by("Salário Ana")).toMatchObject({ status: "", paymentMethod: "" });
  });

  it("usa dia 5 para entradas e 10 para o resto, e sugere a categoria", () => {
    expect(jan.filter((i) => i.kind === "in").every((i) => i.day === 5)).toBe(true);
    expect(jan.filter((i) => i.kind !== "in").every((i) => i.day === 10)).toBe(true);
    expect(jan.find((i) => i.description === "Cartão Azul")?.categoryId).toBe("cartao");
    expect(jan.find((i) => i.description === "Salário Ana")?.categoryId).toBe("salario");
    expect(jan.find((i) => i.description === "Freela Bia")?.categoryId).toBe("extra");
  });

  it("aceita variações de título, espaços e a coluna deslocada", () => {
    const rows: Cell[][] = [
      ["lixo"],
      [null, null, "  Renda   Mensal "],
      [null, null, "Salário", 100],
      [null, null, "Despesa mensal"],
      [null, null, "Luz", 10.5, "Débito"],
      [null, null, "Economias mensais"],
      [null, null, "Cofre", 5],
      [null, null, "Texto", "abc"],
      [null, null, "Negativa", -3],
      [null, null, 42, 3],
    ];
    const result = parseMonthlySheet([{ name: " janeiro ", rows }], 2025);
    expect(result.map((i) => [i.kind, i.description, i.amount, i.paymentMethod])).toEqual([
      ["in", "Salário", 10000, ""],
      ["out", "Luz", 1050, "Débito"],
      ["save", "Cofre", 500, ""],
    ]);
  });

  it("aba de mês sem a seção Renda mensal não rende itens", () => {
    expect(parseMonthlySheet([{ name: "Março", rows: [[null, "Algo", 5]] }], 2026)).toEqual([]);
  });
});

describe("parseInstallment", () => {
  it("lê 7/29 com ou sem espaços", () => {
    expect(parseInstallment("Taxa 7/29")).toEqual({ installment: 7, total: 29 });
    expect(parseInstallment("Taxa 7 / 29")).toEqual({ installment: 7, total: 29 });
    expect(parseInstallment("Taxa")).toBeNull();
  });
});

describe("parseSheetDate", () => {
  it("aceita número de série, dd/mm/aaaa e ISO", () => {
    expect(parseSheetDate(toExcelSerial("2026-11-05"))).toEqual({ year: 2026, month: 11, day: 5 });
    expect(parseSheetDate(toExcelSerial("2026-11-05") + 0.75)).toEqual({ year: 2026, month: 11, day: 5 });
    expect(parseSheetDate("05/11/2026")).toEqual({ year: 2026, month: 11, day: 5 });
    expect(parseSheetDate("5/1/2026")).toEqual({ year: 2026, month: 1, day: 5 });
    expect(parseSheetDate("2026-11-05")).toEqual({ year: 2026, month: 11, day: 5 });
  });

  it("recusa 31 de fevereiro, 29/02 fora de bissexto e lixo", () => {
    expect(parseSheetDate("31/02/2026")).toBeNull();
    expect(parseSheetDate("29/02/2026")).toBeNull();
    expect(parseSheetDate("29/02/2028")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseSheetDate("2026-02-30")).toBeNull();
    expect(parseSheetDate("ontem")).toBeNull();
    expect(parseSheetDate(0)).toBeNull();
    expect(parseSheetDate(Number.NaN)).toBeNull();
    expect(parseSheetDate(null)).toBeNull();
    expect(parseSheetDate(undefined)).toBeNull();
  });
});

describe("parseDetailedSheet", () => {
  const header: Cell[] = [
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
  ];
  const rows: Cell[][] = [
    ["Lançamentos do Juntos"],
    header,
    [toExcelSerial("2026-11-05"), "Entrada", "Salário Ana", "Salário", 5200, "Recebido", "", "Ana", "", ""],
    ["19/11/2026", "Saída", "Taxa de obra", "Moradia", "1.890,50", "Pago", "Boleto", "Bia", "7/29", "Parcela do apê"],
    ["2026-12-01", "Guardado", "Reserva", "", 400, "Em aberto", "", "", "", ""],
    ["31/02/2026", "Saída", "Data impossível", "", 10, "", "", "", "", ""],
    ["05/11/2026", "Saída", "", "", 10, "", "", "", "", ""],
    ["05/11/2026", "Saída", "Valor zero", "", 0, "", "", "", "", ""],
    ["05/11/2026", "Saída", "Valor ruim", "", "abc", "", "", "", "", ""],
    ["05/11/2026", "Saída", "Valor infinito", "", Number.POSITIVE_INFINITY, "", "", "", "", ""],
    ["05/11/2026", "Transferência", "Tipo ruim", "", 10, "", "", "", "", ""],
    ["05/11/2026", "Despesa", "Curso de inglês", "Categoria inventada", 80, "Concluído", "", "", "", ""],
    [],
  ];

  it("lê as linhas válidas com todas as colunas", () => {
    const items = parseDetailedSheet(rows);
    expect(items.map((i) => i.description)).toEqual(["Salário Ana", "Taxa de obra", "Reserva", "Curso de inglês"]);
    expect(items[0]).toMatchObject({
      source: "detailed",
      year: 2026,
      month: 11,
      day: 5,
      kind: "in",
      amount: 520000,
      paid: true,
      categoryId: "salario",
      whoName: "Ana",
    });
    expect(items[1]).toMatchObject({
      day: 19,
      amount: 189050,
      paid: true,
      paymentMethod: "Boleto",
      categoryId: "moradia",
      whoName: "Bia",
      installment: 7,
      installmentsTotal: 29,
      note: "Parcela do apê",
    });
    expect(items[2]).toMatchObject({ kind: "save", year: 2026, month: 12, paid: false, categoryId: "reserva" });
    expect(items[3]).toMatchObject({ kind: "out", paid: true, categoryId: "educ" });
  });

  it("sem cabeçalho reconhecível devolve vazio", () => {
    expect(parseDetailedSheet([["a", "b"], ["c"]])).toEqual([]);
    expect(parseDetailedSheet([])).toEqual([]);
  });

  it("funciona com menos colunas e cabeçalho sem acento", () => {
    const items = parseDetailedSheet([
      ["data", "tipo", "descricao", "valor", "situacao"],
      ["05/11/2026", "saida", "Luz", 180, "pago"],
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ categoryId: "contas", paid: true, whoName: "", note: "", paymentMethod: "" });
  });

  it("linha mais curta que o cabeçalho não quebra", () => {
    const items = parseDetailedSheet([header, ["05/11/2026", "Saída", "Luz", "", 10]]);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("");
  });
});

describe("parseWorkbook e nome do arquivo", () => {
  it("com aba Lançamentos é o arquivo do app; sem ela, a planilha mensal", () => {
    const detailed = parseWorkbook(
      [
        ...buildMonthlySheets(),
        {
          name: " lançamentos ",
          rows: [
            ["Data", "Tipo", "Descrição", "Valor"],
            ["05/11/2026", "Saída", "Luz", 10],
          ],
        },
      ],
      2026,
    );
    expect(detailed.source).toBe("detailed");
    expect(detailed.items).toHaveLength(1);
    const monthly = parseWorkbook(buildMonthlySheets(), 2026);
    expect(monthly.source).toBe("monthly");
    expect(monthly.items.length).toBeGreaterThan(5);
    expect(parseWorkbook([{ name: "Outra", rows: [] }], 2026).items).toEqual([]);
  });

  it("acha o ano no nome do arquivo", () => {
    expect(yearFromFileName("Gasto 2025.xlsx", 2026)).toBe(2025);
    expect(yearFromFileName("gastos.xlsx", 2026)).toBe(2026);
  });
});

describe("markExisting", () => {
  const existing = tx({ competence: "2026-11", description: "Taxa de obra", amount: 189000 });

  it("marca o que já existe, ignorando parcela no nome, acento e maiúsculas", () => {
    const rows = markExisting(
      [
        item({ description: "TAXA de obra 7/29", amount: 189000 }),
        item({ description: "Taxa de obra", amount: 189001 }),
        item({ description: "Taxa de obra", amount: 189000, kind: "in" }),
        item({ description: "Taxa de obra", amount: 189000, month: 12 }),
      ],
      [existing],
    );
    expect(rows.map((r) => [r.existing, r.selected])).toEqual([
      [true, false],
      [false, true],
      [false, true],
      [false, true],
    ]);
  });

  it("o ano escolhido muda a competência na planilha mensal, mas não na detalhada", () => {
    const monthly = item({ year: 2025 });
    const detailed = item({ source: "detailed", year: 2025 });
    expect(resolveCompetence(monthly)).toBe("2025-11");
    expect(resolveCompetence(monthly, 2026)).toBe("2026-11");
    expect(resolveCompetence(detailed, 2026)).toBe("2025-11");
    const [row] = markExisting([monthly], [existing], { year: 2026 });
    expect(row?.competence).toBe("2026-11");
  });
});

describe("planImport", () => {
  const today = "2026-11-19";

  it("planilha mensal: meses passados contam como pagos, exceto com situação '-'", () => {
    const plan = planImport(
      [item({ month: 10, status: "pago" }), item({ month: 10, status: "" }), item({ month: 10, status: "-" })],
      { mode: "add", today },
    );
    expect(plan.create.map((t) => t.paid)).toEqual([true, true, false]);
  });

  it("mês atual e futuro só contam como pagos com situação preenchida", () => {
    const plan = planImport(
      [
        item({ month: 11, status: "pago" }),
        item({ month: 11, status: "" }),
        item({ month: 11, status: "-" }),
        item({ month: 12, status: "pix" }),
        item({ month: 12, status: "" }),
      ],
      { mode: "add", today },
    );
    expect(plan.create.map((t) => t.paid)).toEqual([true, false, false, true, false]);
  });

  it("planilha detalhada usa a situação do próprio arquivo", () => {
    const plan = planImport(
      [item({ source: "detailed", paid: true, month: 12 }), item({ source: "detailed", paid: false, month: 1 })],
      { mode: "add", today },
    );
    expect(plan.create.map((t) => t.paid)).toEqual([true, false]);
  });

  it("ajusta o dia ao fim do mês e usa o ano escolhido só na planilha mensal", () => {
    const plan = planImport(
      [item({ month: 2, day: 31 }), item({ source: "detailed", year: 2024, month: 2, day: 29 })],
      { mode: "add", today, year: 2027 },
    );
    expect(plan.create.map((t) => [t.competence, t.day])).toEqual([
      ["2027-02", 28],
      ["2024-02", 29],
    ]);
    expect(plan.competences).toEqual(["2024-02", "2027-02"]);
  });

  it("liga 'Quem' ao membro pelo nome e deixa o resto sem pagador", () => {
    const plan = planImport([item({ whoName: " ana " }), item({ whoName: "Zé" }), item({ whoName: "" })], {
      mode: "add",
      today,
      members: [member("m1", "Ana")],
    });
    expect(plan.create.map((t) => t.paidBy)).toEqual(["m1", null, null]);
    expect(planImport([item({ whoName: "Ana" })], { mode: "add", today }).create[0]?.paidBy).toBeNull();
  });

  it("copia parcela, categoria, observação e meio de pagamento", () => {
    const [created] = planImport(
      [item({ installment: 3, installmentsTotal: 10, note: "obs", paymentMethod: "Pix", categoryId: "saude" })],
      { mode: "add", today },
    ).create;
    expect(created).toMatchObject({
      installment: 3,
      installmentsTotal: 10,
      note: "obs",
      paymentMethod: "Pix",
      categoryId: "saude",
      personal: false,
      recurrenceId: null,
      yearly: false,
    });
  });

  it("no modo substituir informa os meses a limpar antes de gravar", () => {
    const items = [item({ month: 3 }), item({ month: 1 }), item({ month: 3 })];
    expect(planImport(items, { mode: "replace", today }).replaceCompetences).toEqual(["2026-01", "2026-03"]);
    expect(planImport(items, { mode: "add", today }).replaceCompetences).toEqual([]);
  });
});
