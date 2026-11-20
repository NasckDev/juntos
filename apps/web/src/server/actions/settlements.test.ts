import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../session";

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
vi.mock("../session", () => ({ getSession: async () => sessionState.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

const { todayInSaoPaulo, todayParts, ymAdd } = await import("@juntos/core");
const { registerSettlement, unsettle } = await import("./settlements");
const { setSplitMode } = await import("./split");
const { undo } = await import("./undo");
const { loadDivisionData } = await import("../division-loaders");
const { getDb } = await import("../db");
const { categories, settlements, spaces, transactions } = await import("../db/schema");
const { SPLIT_MESSAGES } = await import("../validators/settlements");
const { addMember, createTestUser, migrateTestDb, sessionOf } = await import("../test/helpers");

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

const YM = todayParts(todayInSaoPaulo()).ym;
const FORBIDDEN = "Você não tem permissão para fazer isso neste espaço.";

async function categoryId(): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, "outros"));
  if (!row) throw new Error("Categoria padrão não semeada.");
  return row.id;
}

async function addTx(
  spaceId: string,
  patch: { kind?: "in" | "out"; amount: number; paidBy: string | null; paid?: boolean; ym?: string; name?: string },
): Promise<void> {
  await getDb()
    .insert(transactions)
    .values({
      spaceId,
      kind: patch.kind ?? "out",
      description: patch.name ?? "Mercado",
      amountCents: patch.amount,
      competence: `${patch.ym ?? YM}-01`,
      day: 10,
      categoryId: await categoryId(),
      paid: patch.paid ?? true,
      paymentMethod: "Pix",
      paidBy: patch.paidBy,
    });
}

/** Rafa (dono) e Lu (editora) num espaço; Rafa pagou R$ 100,00 e Lu R$ 20,00: Lu deve R$ 40,00 a Rafa. */
async function twoPeople() {
  const rafa = await createTestUser("Rafa");
  const lu = await createTestUser("Lu");
  const spaceId = rafa.home.id;
  const luMemberId = await addMember(spaceId, lu.id, "editor");
  await addTx(spaceId, { amount: 10_000, paidBy: rafa.home.memberId });
  await addTx(spaceId, { amount: 2_000, paidBy: luMemberId, name: "Padaria" });
  return { rafa, lu, spaceId, rafaId: rafa.home.memberId, luId: luMemberId };
}

const month = { start: YM, span: 1 };

describe("acertos da divisão", () => {
  it("registra o acerto, grava início e fim do período e zera a diferença", async () => {
    const { rafa, spaceId, rafaId, luId } = await twoPeople();
    sessionState.current = sessionOf(rafa);

    const before = await loadDivisionData(spaceId, month);
    expect(before.division.moves).toEqual([{ from: luId, to: rafaId, amount: 4_000 }]);

    const result = await registerSettlement({ spaceId, ...month });
    if (!result.ok) throw new Error(result.error);
    expect(result.data.total).toBe(4_000);

    const rows = await getDb()
      .select()
      .from(settlements)
      .where(and(eq(settlements.spaceId, spaceId), isNull(settlements.deletedAt)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromMember: luId,
      toMember: rafaId,
      amountCents: 4_000,
      periodStart: `${YM}-01`,
      periodEnd: `${YM}-01`,
      createdBy: rafa.id,
    });

    const after = await loadDivisionData(spaceId, month);
    expect(after.division.moves).toEqual([]);
    expect(after.division.people.map((p) => p.balance)).toEqual([0, 0]);
    expect(after.settlements).toHaveLength(1);
  });

  it("não registra duas vezes a mesma diferença", async () => {
    const { rafa, spaceId } = await twoPeople();
    sessionState.current = sessionOf(rafa);
    expect((await registerSettlement({ spaceId, ...month })).ok).toBe(true);
    expect(await registerSettlement({ spaceId, ...month })).toEqual({
      ok: false,
      error: SPLIT_MESSAGES.nothingToSettle,
    });
  });

  it("no período de 3 meses o acerto guarda o primeiro e o último mês e vale para o período inteiro", async () => {
    const { rafa, spaceId } = await twoPeople();
    sessionState.current = sessionOf(rafa);
    const period = { start: YM, span: 3 };
    const result = await registerSettlement({ spaceId, ...period });
    if (!result.ok) throw new Error(result.error);

    const [row] = await getDb().select().from(settlements).where(eq(settlements.spaceId, spaceId));
    expect(row).toMatchObject({ periodStart: `${YM}-01`, periodEnd: `${ymAdd(YM, 2)}-01` });

    expect((await loadDivisionData(spaceId, period)).division.moves).toEqual([]);
    // Num período menor, o acerto de 3 meses não cabe inteiro e não conta.
    expect((await loadDivisionData(spaceId, month)).division.moves).toHaveLength(1);
  });

  it("desfaz um acerto e o 'Desfazer' do toast o traz de volta", async () => {
    const { rafa, spaceId } = await twoPeople();
    sessionState.current = sessionOf(rafa);
    const registered = await registerSettlement({ spaceId, ...month });
    if (!registered.ok) throw new Error(registered.error);

    const removed = await unsettle({ spaceId, ids: [...registered.data.ids] });
    if (!removed.ok) throw new Error(removed.error);
    expect((await loadDivisionData(spaceId, month)).division.moves).toHaveLength(1);
    expect(await unsettle({ spaceId, ids: [...registered.data.ids] })).toEqual({
      ok: false,
      error: SPLIT_MESSAGES.settlementNotFound,
    });

    expect(await undo({ token: removed.data.undo.token })).toMatchObject({ ok: true, data: { affected: 1 } });
    expect((await loadDivisionData(spaceId, month)).division.moves).toEqual([]);
  });

  it("quem só vê lê a divisão, mas não registra, não desfaz nem muda o modo", async () => {
    const { rafa, spaceId } = await twoPeople();
    const carol = await createTestUser("Carol");
    await addMember(spaceId, carol.id, "viewer");
    sessionState.current = sessionOf(rafa);
    const registered = await registerSettlement({ spaceId, ...month });
    if (!registered.ok) throw new Error(registered.error);

    sessionState.current = sessionOf(carol);
    expect((await loadDivisionData(spaceId, month)).role).toBe("viewer");
    expect(await registerSettlement({ spaceId, ...month })).toEqual({ ok: false, error: FORBIDDEN });
    expect(await unsettle({ spaceId, ids: [...registered.data.ids] })).toEqual({ ok: false, error: FORBIDDEN });
    expect(await setSplitMode({ spaceId, mode: "income" })).toEqual({ ok: false, error: FORBIDDEN });
  });

  it("quem não é do espaço não registra nem lê", async () => {
    const { spaceId } = await twoPeople();
    const stranger = await createTestUser("Fulano");
    sessionState.current = sessionOf(stranger);
    expect((await registerSettlement({ spaceId, ...month })).ok).toBe(false);
    await expect(loadDivisionData(spaceId, month)).rejects.toThrow();
  });

  it("valida o período", async () => {
    const { rafa, spaceId } = await twoPeople();
    sessionState.current = sessionOf(rafa);
    expect((await registerSettlement({ spaceId, start: YM, span: 4 })).ok).toBe(false);
    expect((await registerSettlement({ spaceId, start: "2026-13", span: 1 })).ok).toBe(false);
  });
});

describe("modo de divisão", () => {
  it("o personalizado só vale com 2 pessoas e usa o percentual da primeira", async () => {
    const { rafa, spaceId, rafaId, luId } = await twoPeople();
    sessionState.current = sessionOf(rafa);

    expect(await setSplitMode({ spaceId, mode: "custom", pct: 70 })).toEqual({
      ok: true,
      data: { mode: "custom", pct: 70 },
    });
    const custom = await loadDivisionData(spaceId, month);
    expect(custom.division.mode).toBe("custom");
    // Total R$ 120,00: Rafa fica com 70% (R$ 84,00) e pagou R$ 100,00; Lu deve R$ 16,00.
    expect(custom.division.moves).toEqual([{ from: luId, to: rafaId, amount: 1_600 }]);
    expect(custom.members.map((m) => m.name)).toEqual(["Rafa", "Lu"]);

    const third = await createTestUser("Carol");
    await addMember(spaceId, third.id, "editor");
    expect(await setSplitMode({ spaceId, mode: "custom", pct: 50 })).toEqual({
      ok: false,
      error: SPLIT_MESSAGES.customNeedsTwo,
    });
    // Com 3 pessoas o modo salvo continua, mas a conta cai para partes iguais.
    expect((await loadDivisionData(spaceId, month)).division.mode).toBe("equal");
  });

  it("valida modo e percentual e salva só no espaço certo", async () => {
    const { rafa, spaceId } = await twoPeople();
    const other = await createTestUser("Outro");
    sessionState.current = sessionOf(rafa);
    expect((await setSplitMode({ spaceId, mode: "custom", pct: 101 })).ok).toBe(false);
    expect((await setSplitMode({ spaceId, mode: "custom", pct: 12.5 })).ok).toBe(false);
    expect((await setSplitMode({ spaceId, mode: "nada" as "equal" })).ok).toBe(false);
    expect((await setSplitMode({ spaceId, mode: "income" })).ok).toBe(true);
    const [mine] = await getDb().select().from(spaces).where(eq(spaces.id, spaceId));
    const [others] = await getDb().select().from(spaces).where(eq(spaces.id, other.home.id));
    expect(mine?.splitMode).toBe("income");
    expect(others?.splitMode).toBe("equal");
  });
});

describe("renda no modo proporcional", () => {
  it("conta só as entradas recebidas; sem renda recebida, cai para partes iguais", async () => {
    const { rafa, spaceId, rafaId, luId } = await twoPeople();
    sessionState.current = sessionOf(rafa);
    await setSplitMode({ spaceId, mode: "income" });

    // Sem nenhuma entrada recebida: partes iguais.
    await addTx(spaceId, { kind: "in", amount: 500_000, paidBy: rafaId, paid: false, name: "Salário previsto" });
    const noIncome = await loadDivisionData(spaceId, month);
    expect(noIncome.division.mode).toBe("equal");

    // Só a entrada da Rafa foi recebida: a renda da Lu (prevista) não entra, e a Rafa arca com 100%.
    await addTx(spaceId, { kind: "in", amount: 300_000, paidBy: rafaId, paid: true, name: "Freela" });
    await addTx(spaceId, { kind: "in", amount: 900_000, paidBy: luId, paid: false, name: "Salário da Lu" });
    const received = await loadDivisionData(spaceId, month);
    expect(received.division.mode).toBe("income");
    expect(received.division.people.map((p) => p.income)).toEqual([300_000, 0]);
    expect(received.division.people.map((p) => p.percent)).toEqual([1, 0]);

    // Quando a entrada da Lu é recebida, a divisão passa a seguir as duas rendas (300 e 900 = 25% e 75%).
    await addTx(spaceId, { kind: "in", amount: 900_000, paidBy: luId, paid: true, name: "Salário recebido" });
    const both = await loadDivisionData(spaceId, month);
    expect(both.division.people.map((p) => p.percent)).toEqual([0.25, 0.75]);
  });
});

describe("Sem quem pagou", () => {
  it("lista as saídas pagas compartilhadas sem pagador e deixa de fora as pessoais", async () => {
    const { rafa, spaceId } = await twoPeople();
    sessionState.current = sessionOf(rafa);
    await addTx(spaceId, { amount: 3_000, paidBy: null, name: "Feira" });
    await getDb()
      .insert(transactions)
      .values({
        spaceId,
        kind: "out",
        description: "Presente",
        amountCents: 5_000,
        competence: `${YM}-01`,
        day: 3,
        categoryId: await categoryId(),
        paid: true,
        paidBy: null,
        personal: true,
      });
    const data = await loadDivisionData(spaceId, month);
    expect(data.division.withoutPayer.map((t) => t.description)).toEqual(["Feira"]);
    expect(data.division.personalCount).toBe(1);
    expect(data.division.total).toBe(12_000);
  });
});
