import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../session";

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
vi.mock("../session", () => ({ getSession: async () => sessionState.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

const { createTransaction, deleteTransaction, searchTransactions, setTransactionPaid } = await import("./transactions");
const { deleteRecurrence } = await import("./recurrences");
const { undo } = await import("./undo");
const { getDb } = await import("../db");
const { categories } = await import("../db/schema");
const { addMember, createTestUser, migrateTestDb, sessionOf } = await import("../test/helpers");
const { TX_MESSAGES } = await import("../validators/transactions");

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

async function categoryId(key: string): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, key));
  if (!row) throw new Error(`Categoria ${key} não semeada.`);
  return row.id;
}

async function input(spaceId: string, patch: Record<string, unknown> = {}) {
  return {
    spaceId,
    kind: "out" as const,
    amount: 8_600,
    description: "MEI",
    date: "2026-11-20",
    categoryId: await categoryId("outros"),
    paidBy: null,
    paid: false,
    paymentMethod: "Pix",
    note: "",
    personal: false,
    repeat: "none" as const,
    installments: "",
    confirmDuplicate: false,
    ...patch,
  };
}

describe("ações de lançamento", () => {
  it("quem só vê lê, mas não lança, não marca como pago e não exclui", async () => {
    const rafa = await createTestUser("Rafa");
    const carol = await createTestUser("Carol");
    await addMember(rafa.home.id, carol.id, "viewer");

    sessionState.current = sessionOf(rafa);
    const created = await createTransaction(await input(rafa.home.id));
    if (!created.ok) throw new Error(created.error);

    sessionState.current = sessionOf(carol);
    const denied = await createTransaction(await input(rafa.home.id, { description: "Outra conta" }));
    expect(denied).toEqual({ ok: false, error: "Você não tem permissão para fazer isso neste espaço." });
    expect((await setTransactionPaid({ spaceId: rafa.home.id, id: created.data.id, paid: true })).ok).toBe(false);
    expect((await deleteTransaction({ spaceId: rafa.home.id, id: created.data.id })).ok).toBe(false);

    const found = await searchTransactions({ spaceId: rafa.home.id, query: "mei" });
    expect(found.ok && found.data.map((t) => t.id)).toEqual([created.data.id]);
  });

  it("quem não é do espaço não lê nem escreve", async () => {
    const rafa = await createTestUser("Rafa");
    const stranger = await createTestUser("Fulano");
    sessionState.current = sessionOf(stranger);
    expect(await searchTransactions({ spaceId: rafa.home.id, query: "mei" })).toEqual({
      ok: false,
      error: "Não encontramos esse espaço.",
    });
    expect((await createTransaction(await input(rafa.home.id))).ok).toBe(false);
  });

  it("devolve o aviso de duplicado no campo da descrição e salva ao confirmar", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    expect((await createTransaction(await input(rafa.home.id))).ok).toBe(true);
    const again = await createTransaction(await input(rafa.home.id));
    expect(again).toEqual({
      ok: false,
      error: TX_MESSAGES.duplicate,
      fieldErrors: { description: TX_MESSAGES.duplicate },
    });
    expect((await createTransaction(await input(rafa.home.id, { confirmDuplicate: true }))).ok).toBe(true);
  });

  it("devolve os erros de validação por campo", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const result = await createTransaction(await input(rafa.home.id, { amount: null, description: "x", date: "" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toMatchObject({
      amount: TX_MESSAGES.amount,
      description: TX_MESSAGES.descriptionShort,
      date: TX_MESSAGES.date,
    });
  });

  it("exclui e desfaz pelo token; conta fixa também", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const created = await createTransaction(await input(rafa.home.id, { repeat: "monthly" }));
    if (!created.ok || !created.data.recurrenceId) throw new Error("Falha ao criar.");

    const removed = await deleteTransaction({ spaceId: rafa.home.id, id: created.data.id });
    if (!removed.ok) throw new Error(removed.error);
    expect(await undo({ token: removed.data.undo.token })).toMatchObject({ ok: true, data: { affected: 1 } });

    const stopped = await deleteRecurrence({ spaceId: rafa.home.id, id: created.data.recurrenceId });
    if (!stopped.ok) throw new Error(stopped.error);
    expect(await undo({ token: stopped.data.undo.token })).toMatchObject({ ok: true, data: { affected: 1 } });
  });
});
