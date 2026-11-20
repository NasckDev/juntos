import type { Cell, SheetGrid } from "@juntos/core";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { getDb } from "../db";
import { categories, transactions } from "../db/schema";

/** Id (uuid) da categoria padrão pela chave ("moradia", "salario"...). */
export async function categoryId(key: string): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, key));
  if (!row) throw new Error(`Categoria ${key} não semeada.`);
  return row.id;
}

export interface TestTx {
  readonly kind?: "in" | "out" | "save";
  readonly description: string;
  readonly amount: number;
  /** "2026-01" */
  readonly competence: string;
  readonly day: number;
  readonly category: string;
  readonly paid?: boolean;
  readonly paymentMethod?: string;
  readonly paidBy?: string | null;
  readonly note?: string;
  readonly installment?: number | null;
  readonly installmentsTotal?: number | null;
}

/** Grava lançamentos direto no banco (dados fictícios dos testes). */
export async function insertTxs(spaceId: string, userId: string, list: readonly TestTx[]): Promise<string[]> {
  const values = await Promise.all(
    list.map(async (t) => ({
      spaceId,
      kind: t.kind ?? "out",
      description: t.description,
      amountCents: t.amount,
      competence: `${t.competence}-01`,
      day: t.day,
      categoryId: await categoryId(t.category),
      paid: t.paid ?? false,
      paymentMethod: t.paymentMethod ?? "",
      paidBy: t.paidBy ?? null,
      note: t.note ?? "",
      installmentNumber: t.installment ?? null,
      installmentsTotal: t.installmentsTotal ?? null,
      createdBy: userId,
      updatedBy: userId,
    })),
  );
  const rows = await getDb().insert(transactions).values(values).returning({ id: transactions.id });
  return rows.map((row) => row.id);
}

/** Planilha .xlsx gerada em memória a partir de grades (a fixture fictícia do core). Nada vai para o disco. */
export async function gridsToXlsx(grids: readonly SheetGrid[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  for (const grid of grids) {
    const sheet = workbook.addWorksheet(grid.name);
    grid.rows.forEach((row: readonly Cell[], r) => {
      row.forEach((value, c) => {
        if (value !== null) sheet.getCell(r + 1, c + 1).value = value;
      });
    });
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
