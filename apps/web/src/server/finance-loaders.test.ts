import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "./session";

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
vi.mock("./session", () => ({ getSession: async () => sessionState.current }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

const { todayInSaoPaulo, todayParts, ymAdd } = await import("@juntos/core");
const { getDb } = await import("./db");
const { budgets, categories, goalDeposits, goals, notifications, recurrences, transactions } = await import(
  "./db/schema"
);
const { countUnseenNotifications, loadEntryFormData, loadHomeData, loadLancamentosData } = await import(
  "./finance-loaders"
);
const { addMember, createTestUser, migrateTestDb, sessionOf } = await import("./test/helpers");
const { DEFAULT_NOTIFY } = await import("./db/schema");

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

describe("leitura das telas financeiras", () => {
  it("Início: conta nova vazia, depois metas, orçamento e contas fixas lançadas no período e no anterior", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const db = getDb();
    const ym = todayParts(todayInSaoPaulo()).ym;
    const period = { start: ym, span: 1 };

    const empty = await loadHomeData(rafa.home.id, period);
    expect(empty).toMatchObject({ hasData: false, txs: [], goals: [], budgets: [], recurrences: [] });

    await db.insert(recurrences).values({
      spaceId: rafa.home.id,
      kind: "out",
      description: "Aluguel",
      amountCents: 250_000,
      categoryId: await categoryId("moradia"),
      frequency: "monthly",
      day: 5,
      startCompetence: `${ymAdd(ym, -2)}-01`,
    });
    const [goal] = await db
      .insert(goals)
      .values({ spaceId: rafa.home.id, name: "Reserva", targetCents: 1_000_000 })
      .returning();
    const [kept, removed] = await db
      .insert(transactions)
      .values([
        {
          spaceId: rafa.home.id,
          kind: "save",
          description: "Meta: Reserva",
          amountCents: 40_000,
          competence: `${ym}-01`,
          day: 1,
          categoryId: await categoryId("reserva"),
          paid: true,
        },
        {
          spaceId: rafa.home.id,
          kind: "save",
          description: "Meta: Reserva",
          amountCents: 10_000,
          competence: `${ym}-01`,
          day: 1,
          categoryId: await categoryId("reserva"),
          paid: true,
          deletedAt: new Date(),
        },
      ])
      .returning();
    if (!goal || !kept || !removed) throw new Error("Falha ao preparar a meta.");
    await db.insert(goalDeposits).values([
      { spaceId: rafa.home.id, goalId: goal.id, transactionId: kept.id, amountCents: 40_000 },
      { spaceId: rafa.home.id, goalId: goal.id, transactionId: removed.id, amountCents: 10_000 },
    ]);
    await db
      .insert(budgets)
      .values({ spaceId: rafa.home.id, categoryId: await categoryId("moradia"), monthlyLimitCents: 200_000 });

    const home = await loadHomeData(rafa.home.id, period);
    expect(home.hasData).toBe(true);
    expect(home.goals).toEqual([expect.objectContaining({ name: "Reserva", saved: 40_000, target: 1_000_000 })]);
    expect(home.budgets).toEqual([expect.objectContaining({ monthlyLimit: 200_000 })]);
    expect(home.txs.filter((t) => t.description === "Aluguel")).toHaveLength(1);
    expect(home.previousTxs.map((t) => t.description)).toEqual(["Aluguel"]);

    const [auto] = await db.select().from(notifications).where(eq(notifications.spaceId, rafa.home.id));
    expect(auto).toMatchObject({ type: "auto", dedupeKey: `auto-${ym}` });
    expect(await countUnseenNotifications(rafa.home.id, rafa.id, DEFAULT_NOTIFY)).toBe(1);
    expect(await countUnseenNotifications(rafa.home.id, rafa.id, { ...DEFAULT_NOTIFY, auto: false })).toBe(0);
  });

  it("quem só vê lê as telas; quem não participa não lê", async () => {
    const rafa = await createTestUser("Rafa");
    const carol = await createTestUser("Carol");
    const stranger = await createTestUser("Fulano");
    await addMember(rafa.home.id, carol.id, "viewer");
    const period = { start: todayParts(todayInSaoPaulo()).ym, span: 3 };

    sessionState.current = sessionOf(carol);
    const data = await loadLancamentosData(rafa.home.id, period);
    expect(data.role).toBe("viewer");
    expect(data.members.map((m) => [m.name, m.isYou])).toEqual([
      ["Carol", true],
      ["Rafa", false],
    ]);
    expect((await loadEntryFormData(rafa.home.id)).role).toBe("viewer");

    sessionState.current = sessionOf(stranger);
    await expect(loadLancamentosData(rafa.home.id, period)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
