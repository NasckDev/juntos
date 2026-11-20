import { and, eq, isNull } from "drizzle-orm";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildMonthlySheets } from "../../../../../packages/core/test/fixtures/monthly-sheet";
import { getDb } from "../db";
import { importBatches, notifications, spaces, transactions } from "../db/schema";
import { DomainError } from "../result";
import { gridsToXlsx, insertTxs } from "../test/finance-fixtures";
import { createTestUser, migrateTestDb, type TestUser } from "../test/helpers";
import { applyUndo } from "../undo";
import type { ExportFilterData } from "../validators/export";
import { IMPORT_MESSAGES, MAX_IMPORT_BYTES } from "../validators/import";
import { buildExport, exportFileName, fileSlug } from "./export";
import { csvAmount, csvText } from "./export-files";
import { cancelImport, confirmImport, createImportBatch, findPendingImport, reviewExisting } from "./import";
import { checkUpload, readWorkbook, XLSX_MIME } from "./import-workbook";
import { listTransactions } from "./transactions";

const TODAY = "2026-11-20";
const YEAR_2026: Omit<ExportFilterData, "spaceId"> = {
  from: "2026-01",
  to: "2026-12",
  kinds: ["in", "out", "save"],
  status: "all",
  who: null,
  categoryIds: [],
};

beforeAll(async () => {
  await migrateTestDb();
});

function filterFor(
  spaceId: string,
  patch: Partial<Omit<typeof YEAR_2026, "kinds">> & { kinds?: ("in" | "out" | "save")[] } = {},
) {
  return { spaceId, ...YEAR_2026, kinds: [...YEAR_2026.kinds], categoryIds: [], ...patch };
}

/** Lançamentos fictícios em dois meses: entrada paga com pessoa, conta paga, parcela, conta em aberto e guardado. */
async function seed(owner: TestUser): Promise<string[]> {
  return insertTxs(owner.home.id, owner.id, [
    {
      kind: "in",
      description: "Salário Ana",
      amount: 520_000,
      competence: "2026-01",
      day: 5,
      category: "salario",
      paid: true,
      paidBy: owner.home.memberId,
    },
    {
      description: "Aluguel",
      amount: 150_000,
      competence: "2026-01",
      day: 10,
      category: "moradia",
      paid: true,
      paymentMethod: "Boleto",
      paidBy: owner.home.memberId,
    },
    {
      description: "Taxa de obra",
      amount: 189_000,
      competence: "2026-01",
      day: 25,
      category: "moradia",
      installment: 7,
      installmentsTotal: 29,
    },
    { description: "Internet", amount: 12_050, competence: "2026-02", day: 12, category: "contas", note: "Fibra" },
    {
      kind: "save",
      description: "Reserva",
      amount: 40_000,
      competence: "2026-02",
      day: 15,
      category: "reserva",
      paid: true,
    },
  ]);
}

async function liveTxs(spaceId: string) {
  return getDb()
    .select()
    .from(transactions)
    .where(and(eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)));
}

function comparable(rows: Awaited<ReturnType<typeof liveTxs>>) {
  return rows
    .map((t) => ({
      kind: t.kind,
      description: t.description,
      amount: t.amountCents,
      competence: t.competence,
      day: t.day,
      categoryId: t.categoryId,
      paid: t.paid,
      paymentMethod: t.paymentMethod,
      paidBy: t.paidBy,
      note: t.note,
      installment: t.installmentNumber,
      installmentsTotal: t.installmentsTotal,
    }))
    .sort((a, b) => `${a.competence}${a.description}`.localeCompare(`${b.competence}${b.description}`));
}

const actorOf = (owner: TestUser) => ({ userId: owner.id, memberId: owner.home.memberId });

describe("exportação", () => {
  it("Excel no modelo da planilha: abas por mês com fórmulas, Visão Geral com soma 3D e Lançamentos", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    const file = await buildExport(getDb(), "xlsx", filterFor(owner.home.id), TODAY);
    expect(file.fileName).toBe("Gasto_anual_2026_Casa.xlsx");
    expect(file.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.body.buffer);
    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
      "Visão Geral",
      "Lançamentos",
    ]);
    const jan = workbook.getWorksheet("Janeiro");
    if (!jan) throw new Error("sem aba Janeiro");
    expect(jan.getCell("C4").value).toEqual({ formula: "SUM(C14:C14)", result: 5200 });
    expect(jan.getCell("C6").value).toMatchObject({ formula: "SUM(C18:C19)", result: 3390 });
    expect(jan.getCell("C10").value).toMatchObject({ formula: "C4-C6-C8", result: 1810 });
    expect(jan.getCell("B11").value).toMatchObject({ formula: "IF(C4>0,MIN(C6/C4,1),0)" });
    expect(jan.getCell("C4").numFmt).toBe('"R$" #,##0.00');
    expect(jan.getCell("B19").value).toBe("Taxa de obra 7/29");
    expect(jan.getCell("D18").value).toBe("pago");
    expect(jan.views[0]?.showGridLines).toBe(false);

    const overview = workbook.getWorksheet("Visão Geral");
    expect(overview?.getCell("C3").value).toBe("Renda anual total");
    expect(overview?.getCell("C4").value).toMatchObject({ formula: "SUM('Janeiro:Dezembro'!C4)", result: 5200 });
    expect(overview?.getCell("C8").value).toMatchObject({ formula: "SUM('Janeiro:Dezembro'!C8)", result: 400 });

    const listing = workbook.getWorksheet("Lançamentos");
    expect(listing?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(listing?.autoFilter).toBe("A1:J1");
    expect(listing?.getRow(1).values).toEqual([
      undefined,
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
    expect(listing?.getCell("E2").numFmt).toBe('"R$" #,##0.00');
    expect(listing?.getCell("H2").value).toBe("Rafa");
    expect(listing?.rowCount).toBe(6);
  });

  it("PDF começa com %PDF e CSV tem BOM, ponto e vírgula e centavos sem ponto flutuante", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    const pdf = await buildExport(getDb(), "pdf", filterFor(owner.home.id, { from: "2026-01", to: "2026-02" }), TODAY);
    expect(pdf.fileName).toBe("Juntos_relatorio_2026-01_a_2026-02_Casa.pdf");
    expect(new TextDecoder().decode(pdf.body.slice(0, 5))).toBe("%PDF-");

    const csv = await buildExport(getDb(), "csv", filterFor(owner.home.id, { kinds: ["out"] }), TODAY);
    expect([...csv.body.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder().decode(csv.body).trim().split("\r\n");
    expect(lines[0]).toBe("Mês;Dia;Tipo;Descrição;Categoria;Valor;Situação;Pago com;Quem;Observação");
    expect(lines).toHaveLength(4);
    expect(lines).toContain('2026-02;12;Saída;"Internet";"Contas da casa";120,50;Em aberto;"";"";"Fibra"');
  });

  it("filtros sem resultado dão a mensagem do protótipo; nomes e textos do arquivo", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    await expect(
      buildExport(getDb(), "csv", filterFor(owner.home.id, { status: "open", kinds: ["in"] }), TODAY),
    ).rejects.toThrow(new DomainError("Nenhum lançamento com esses filtros."));
    expect(exportFileName("xlsx", { from: "2026-03", to: "2026-03" }, "Viagem à praia")).toBe(
      "Juntos_2026-03_Viagem_a_praia.xlsx",
    );
    expect(fileSlug("Lançamentos")).toBe("Lancamentos");
    expect(csvAmount(12_050)).toBe("120,50");
    expect(csvAmount(5)).toBe("0,05");
    expect(csvText('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });
});

describe("importação: arquivo", () => {
  it("só aceita .xlsx de verdade, até 5 MB", async () => {
    const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0]);
    expect(checkUpload({ name: "gasto.xlsx", type: XLSX_MIME, size: 10 }, zip)).toBeNull();
    expect(checkUpload({ name: "gasto.xlsx", type: "", size: 10 }, zip)).toBeNull();
    expect(checkUpload({ name: "gasto.csv", type: "text/csv", size: 10 })).toBe(IMPORT_MESSAGES.notXlsx);
    expect(checkUpload({ name: "gasto.xlsx", type: "application/pdf", size: 10 })).toBe(IMPORT_MESSAGES.notXlsx);
    expect(checkUpload({ name: "gasto.xls", type: "application/vnd.ms-excel", size: 10 })).toBe(
      IMPORT_MESSAGES.notXlsx,
    );
    expect(checkUpload({ name: "gasto.xlsx", type: XLSX_MIME, size: MAX_IMPORT_BYTES + 1 })).toBe(
      IMPORT_MESSAGES.tooBig,
    );
    const fake = new TextEncoder().encode("não é zip");
    expect(checkUpload({ name: "gasto.xlsx", type: XLSX_MIME, size: fake.length }, fake)).toBe(IMPORT_MESSAGES.notXlsx);
    await expect(readWorkbook(zip)).rejects.toThrow();
  });

  it("planilha sem abas de mês nem Lançamentos dá a mensagem do protótipo", async () => {
    const owner = await createTestUser("Rafa");
    const bytes = await gridsToXlsx([{ name: "Plan1", rows: [["qualquer coisa", 10]] }]);
    const sheets = await readWorkbook(bytes);
    await expect(createImportBatch(getDb(), actorOf(owner), owner.home.id, "x.xlsx", sheets, TODAY)).rejects.toThrow(
      IMPORT_MESSAGES.noSheets,
    );
  });
});

describe("importação: planilha mensal (fixture fictícia gerada em memória)", () => {
  async function upload(owner: TestUser) {
    const bytes = await gridsToXlsx(buildMonthlySheets());
    const sheets = await readWorkbook(bytes);
    return createImportBatch(getDb(), actorOf(owner), owner.home.id, "Gasto 2025.xlsx", sheets, TODAY);
  }

  it("lê as abas, guarda o lote em revisão com o ano do arquivo e grava na confirmação, com desfazer", async () => {
    const owner = await createTestUser("Rafa");
    const batch = await upload(owner);
    expect(batch.count).toBe(9);
    const pending = await findPendingImport(getDb(), owner.home.id, owner.id);
    expect(pending).toMatchObject({ id: batch.batchId, source: "monthly", year: 2025, fileName: "Gasto 2025.xlsx" });
    expect(pending?.items.map((i) => i.description)).toContain("Taxa de obra 7/29");

    const result = await confirmImport(
      getDb(),
      actorOf(owner),
      {
        spaceId: owner.home.id,
        batchId: batch.batchId,
        selected: pending?.items.map((_, i) => i) ?? [],
        year: 2025,
        destination: "here",
        mode: "add",
      },
      TODAY,
    );
    expect(result).toMatchObject({ count: 9, spaceId: owner.home.id, createdSpace: false, openMonth: "2025-02" });
    const rows = await liveTxs(owner.home.id);
    expect(rows).toHaveLength(9);
    const taxa = rows.find((r) => r.description === "Taxa de obra 7/29");
    expect(taxa).toMatchObject({
      competence: "2025-01-01",
      day: 10,
      paid: true,
      installmentNumber: 7,
      installmentsTotal: 29,
    });
    expect(rows.find((r) => r.description === "Cartão Azul")?.paid).toBe(false);
    const [stored] = await getDb().select().from(importBatches).where(eq(importBatches.id, batch.batchId));
    expect(stored).toMatchObject({ status: "done", rowsImported: 9, mode: "add" });
    const [notice] = await getDb()
      .select()
      .from(notifications)
      .where(and(eq(notifications.spaceId, owner.home.id), eq(notifications.type, "import")));
    expect(notice).toMatchObject({ title: "9 lançamentos importados", body: "Da planilha Gasto 2025.xlsx." });

    await applyUndo(getDb(), owner.id, result.undo.token);
    expect(await liveTxs(owner.home.id)).toHaveLength(0);
    const [undone] = await getDb().select().from(importBatches).where(eq(importBatches.id, batch.batchId));
    expect(undone?.status).toBe("undone");
  });

  it("marca o que já existe, soma ou substitui o mês, e o desfazer devolve o que foi substituído", async () => {
    const owner = await createTestUser("Rafa");
    const [aluguel, extra] = await insertTxs(owner.home.id, owner.id, [
      { description: "Aluguel", amount: 150_000, competence: "2025-01", day: 10, category: "moradia" },
      { description: "Padaria", amount: 3_000, competence: "2025-01", day: 3, category: "mercado" },
    ]);
    const batch = await upload(owner);
    const pending = await findPendingImport(getDb(), owner.home.id, owner.id);
    if (!pending) throw new Error("sem lote");
    const existing = await reviewExisting(getDb(), owner.home.id, pending, 2025, "here");
    const flagged = pending.items.filter((_, i) => existing[i]).map((i) => `${i.month}:${i.description}`);
    expect(flagged).toEqual(["1:Aluguel"]);
    // Com outro ano, nada existe; num espaço novo, também não.
    expect((await reviewExisting(getDb(), owner.home.id, pending, 2024, "here")).some(Boolean)).toBe(false);
    expect((await reviewExisting(getDb(), owner.home.id, pending, 2025, "new")).some(Boolean)).toBe(false);

    const january = pending.items.flatMap((item, i) => (item.month === 1 && !existing[i] ? [i] : []));
    const result = await confirmImport(
      getDb(),
      actorOf(owner),
      {
        spaceId: owner.home.id,
        batchId: batch.batchId,
        selected: january,
        year: 2025,
        destination: "here",
        mode: "replace",
      },
      TODAY,
    );
    const after = await liveTxs(owner.home.id);
    expect(after.map((t) => t.id)).not.toContain(aluguel);
    expect(after.map((t) => t.id)).not.toContain(extra);
    expect(after).toHaveLength(january.length);

    await applyUndo(getDb(), owner.id, result.undo.token);
    expect((await liveTxs(owner.home.id)).map((t) => t.id).sort()).toEqual([aluguel, extra].sort());
  });

  it('importa num espaço novo ("Planilha 2025") e o desfazer exclui esse espaço', async () => {
    const owner = await createTestUser("Rafa");
    const batch = await upload(owner);
    const result = await confirmImport(
      getDb(),
      actorOf(owner),
      {
        spaceId: owner.home.id,
        batchId: batch.batchId,
        selected: [0, 1],
        year: 2025,
        destination: "new",
        mode: "replace",
      },
      TODAY,
    );
    expect(result.createdSpace).toBe(true);
    const [created] = await getDb().select().from(spaces).where(eq(spaces.id, result.spaceId));
    expect(created?.name).toBe("Planilha 2025");
    expect(await liveTxs(result.spaceId)).toHaveLength(2);
    expect(await liveTxs(owner.home.id)).toHaveLength(0);

    await applyUndo(getDb(), owner.id, result.undo.token);
    const [deleted] = await getDb().select().from(spaces).where(eq(spaces.id, result.spaceId));
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it("cancelar descarta o lote; confirmar lote alheio ou já usado falha; nada selecionado também", async () => {
    const owner = await createTestUser("Rafa");
    const other = await createTestUser("Lu");
    const batch = await upload(owner);
    const input = {
      spaceId: owner.home.id,
      batchId: batch.batchId,
      selected: [0],
      year: 2025,
      destination: "here" as const,
      mode: "add" as const,
    };
    await expect(confirmImport(getDb(), actorOf(other), input, TODAY)).rejects.toThrow(IMPORT_MESSAGES.gone);
    await expect(confirmImport(getDb(), actorOf(owner), { ...input, selected: [999] }, TODAY)).rejects.toThrow(
      IMPORT_MESSAGES.selectOne,
    );
    await cancelImport(getDb(), owner.id, owner.home.id, batch.batchId);
    expect(await findPendingImport(getDb(), owner.home.id, owner.id)).toBeNull();
    await expect(confirmImport(getDb(), actorOf(owner), input, TODAY)).rejects.toThrow(IMPORT_MESSAGES.gone);
  });
});

describe("ida e volta: o Excel exportado pelo app, reimportado pelo app", () => {
  it("devolve os mesmos lançamentos", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    const original = comparable(await liveTxs(owner.home.id));
    const file = await buildExport(getDb(), "xlsx", filterFor(owner.home.id), TODAY);

    await getDb().update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.spaceId, owner.home.id));
    const sheets = await readWorkbook(file.body);
    const batch = await createImportBatch(getDb(), actorOf(owner), owner.home.id, file.fileName, sheets, TODAY);
    const pending = await findPendingImport(getDb(), owner.home.id, owner.id);
    expect(pending?.source).toBe("detailed");
    expect(batch.count).toBe(original.length);
    await confirmImport(
      getDb(),
      actorOf(owner),
      {
        spaceId: owner.home.id,
        batchId: batch.batchId,
        selected: pending?.items.map((_, i) => i) ?? [],
        year: null,
        destination: "here",
        mode: "add",
      },
      TODAY,
    );
    expect(comparable(await liveTxs(owner.home.id))).toEqual(original);
  });

  it('reimportar sem apagar: tudo vem marcado como "Já existe", menos o que foi excluído', async () => {
    const owner = await createTestUser("Rafa");
    const ids = await seed(owner);
    const file = await buildExport(getDb(), "xlsx", filterFor(owner.home.id), TODAY);
    await getDb()
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(eq(transactions.id, ids[3] ?? ""));
    await createImportBatch(
      getDb(),
      actorOf(owner),
      owner.home.id,
      file.fileName,
      await readWorkbook(file.body),
      TODAY,
    );
    const pending = await findPendingImport(getDb(), owner.home.id, owner.id);
    if (!pending) throw new Error("sem lote");
    const existing = await reviewExisting(getDb(), owner.home.id, pending, null, "here");
    expect(pending.items.filter((_, i) => !existing[i]).map((i) => i.description)).toEqual(["Internet"]);
    expect(await listTransactions(getDb(), owner.home.id, ["2026-02"])).toHaveLength(1);
  });
});
