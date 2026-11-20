import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "./db";
import { categories, importBatches, transactions } from "./db/schema";
import { createSpace, deleteSpace, listUserSpaces } from "./services/spaces";
import { addMember, createTestUser, migrateTestDb } from "./test/helpers";
import { applyUndo, createUndoToken, purgeUndoTokens, UNDO_EXPIRED_MESSAGE, UNDO_TTL_MS } from "./undo";

beforeAll(async () => {
  await migrateTestDb();
});

async function categoryId(key: string): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, key));
  if (!row) throw new Error(`Categoria padrão ${key} não semeada.`);
  return row.id;
}

async function insertTransaction(spaceId: string, values: Partial<typeof transactions.$inferInsert> = {}) {
  const [row] = await getDb()
    .insert(transactions)
    .values({
      spaceId,
      kind: "out",
      description: "Mercado",
      amountCents: 12_345,
      competence: "2026-11-01",
      day: 10,
      categoryId: await categoryId("mercado"),
      ...values,
    })
    .returning();
  if (!row) throw new Error("Falha ao criar lançamento.");
  return row;
}

describe("desfazer exclusão (soft delete)", () => {
  it("restaura o espaço excluído, uma vez só", async () => {
    const owner = await createTestUser("Rafa");
    const db = getDb();
    const trip = await createSpace(db, owner.id, "Viagem");
    const { undo } = await deleteSpace(db, owner.id, trip.id);
    expect(undo.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(UNDO_TTL_MS);

    const result = await applyUndo(db, owner.id, undo.token);
    expect(result).toMatchObject({ spaceId: trip.id, affected: 1 });
    expect((await listUserSpaces(db, owner.id)).map((space) => space.name)).toContain("Viagem");

    await expect(applyUndo(db, owner.id, undo.token)).rejects.toThrow(UNDO_EXPIRED_MESSAGE);
  });

  it("restaura lançamentos excluídos do espaço", async () => {
    const owner = await createTestUser("Rafa");
    const db = getDb();
    const tx = await insertTransaction(owner.home.id, { deletedAt: new Date() });
    const { token } = await createUndoToken(db, {
      userId: owner.id,
      spaceId: owner.home.id,
      action: { type: "restore", entity: "transactions", ids: [tx.id] },
    });
    await expect(applyUndo(db, owner.id, token)).resolves.toMatchObject({ affected: 1 });
    const [restored] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
    expect(restored?.deletedAt).toBeNull();
  });

  it("não restaura lançamento de outro espaço com o mesmo token", async () => {
    const owner = await createTestUser("Rafa");
    const other = await createTestUser("Ana");
    const db = getDb();
    const foreign = await insertTransaction(other.home.id, { deletedAt: new Date() });
    const { token } = await createUndoToken(db, {
      userId: owner.id,
      spaceId: owner.home.id,
      action: { type: "restore", entity: "transactions", ids: [foreign.id] },
    });
    await expect(applyUndo(db, owner.id, token)).resolves.toMatchObject({ affected: 0 });
    const [still] = await db.select().from(transactions).where(eq(transactions.id, foreign.id));
    expect(still?.deletedAt).not.toBeNull();
  });

  it("vence em 10 minutos", async () => {
    const owner = await createTestUser("Rafa");
    const db = getDb();
    const createdAt = new Date("2026-11-20T12:00:00Z");
    const { token } = await createUndoToken(db, {
      userId: owner.id,
      spaceId: owner.home.id,
      action: { type: "restore", entity: "transactions", ids: [] },
      now: createdAt,
    });
    const late = new Date(createdAt.getTime() + UNDO_TTL_MS + 1);
    await expect(applyUndo(db, owner.id, token, late)).rejects.toThrow(UNDO_EXPIRED_MESSAGE);
  });

  it("só vale para quem criou e exige poder editar", async () => {
    const owner = await createTestUser("Rafa");
    const viewer = await createTestUser("Lu");
    await addMember(owner.home.id, viewer.id, "viewer");
    const db = getDb();
    const tx = await insertTransaction(owner.home.id, { deletedAt: new Date() });
    const ownerToken = await createUndoToken(db, {
      userId: owner.id,
      spaceId: owner.home.id,
      action: { type: "restore", entity: "transactions", ids: [tx.id] },
    });
    await expect(applyUndo(db, viewer.id, ownerToken.token)).rejects.toThrow(UNDO_EXPIRED_MESSAGE);

    const viewerToken = await createUndoToken(db, {
      userId: viewer.id,
      spaceId: owner.home.id,
      action: { type: "restore", entity: "transactions", ids: [tx.id] },
    });
    await expect(applyUndo(db, viewer.id, viewerToken.token)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("desfazer lote de importação", () => {
  it("tira os lançamentos do lote e marca o lote como desfeito", async () => {
    const owner = await createTestUser("Rafa");
    const db = getDb();
    const [batch] = await db
      .insert(importBatches)
      .values({
        spaceId: owner.home.id,
        fileName: "planilha.xlsx",
        source: "monthly-sheet",
        mode: "add",
        status: "done",
      })
      .returning();
    if (!batch) throw new Error("Falha ao criar lote.");
    await insertTransaction(owner.home.id, { importBatchId: batch.id, description: "Luz" });
    await insertTransaction(owner.home.id, { importBatchId: batch.id, description: "Água" });
    const kept = await insertTransaction(owner.home.id, { description: "Feito à mão" });

    const { token } = await createUndoToken(db, {
      userId: owner.id,
      spaceId: owner.home.id,
      action: { type: "revert-import", batchId: batch.id },
    });
    await expect(applyUndo(db, owner.id, token)).resolves.toMatchObject({ affected: 2 });

    const alive = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.spaceId, owner.home.id), isNull(transactions.deletedAt)));
    expect(alive.map((row) => row.id)).toEqual([kept.id]);
    const [after] = await db.select().from(importBatches).where(eq(importBatches.id, batch.id));
    expect(after?.status).toBe("undone");
  });
});

describe("limpeza", () => {
  it("apaga tokens vencidos ou usados", async () => {
    const owner = await createTestUser("Rafa");
    const db = getDb();
    const old = new Date("2020-01-01T00:00:00Z");
    await createUndoToken(db, {
      userId: owner.id,
      spaceId: owner.home.id,
      action: { type: "restore", entity: "goals", ids: [] },
      now: old,
    });
    expect(await purgeUndoTokens(db)).toBeGreaterThanOrEqual(1);
  });
});
