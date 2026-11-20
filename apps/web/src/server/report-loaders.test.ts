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
const { categories, recurrences, transactions } = await import("./db/schema");
const { loadReportData } = await import("./report-loaders");
const { createTestUser, migrateTestDb, sessionOf } = await import("./test/helpers");

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

const YM = todayParts(todayInSaoPaulo()).ym;
const YEAR = YM.slice(0, 4);

async function categoryId(key: string): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, key));
  if (!row) throw new Error(`Categoria ${key} não semeada.`);
  return row.id;
}

describe("leitura dos Relatórios", () => {
  it("conta nova: ano vazio, sem lançamentos", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const data = await loadReportData(rafa.home.id, { start: YM, span: 1 });
    expect(data).toMatchObject({ year: YEAR, yearTxs: [], txs: [], previousTxs: [] });
  });

  it("separa o ano, o período e o período anterior; lança as contas fixas dos 12 meses", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const db = getDb();
    const other = await categoryId("outros");
    await db.insert(transactions).values([
      {
        spaceId: rafa.home.id,
        kind: "out",
        description: "Mercado",
        amountCents: 9_000,
        competence: `${YM}-01`,
        day: 4,
        categoryId: other,
        paid: true,
      },
      {
        spaceId: rafa.home.id,
        kind: "out",
        description: "Farmácia",
        amountCents: 3_000,
        competence: `${ymAdd(YM, -1)}-01`,
        day: 4,
        categoryId: other,
        paid: true,
      },
    ]);
    await db.insert(recurrences).values({
      spaceId: rafa.home.id,
      kind: "out",
      description: "Internet",
      amountCents: 10_000,
      categoryId: other,
      frequency: "monthly",
      day: 8,
      startCompetence: `${YEAR}-01-01`,
    });

    const data = await loadReportData(rafa.home.id, { start: YM, span: 1 });
    const internet = data.yearTxs.filter((t) => t.description === "Internet");
    expect(internet).toHaveLength(12);
    expect(data.txs.map((t) => t.description).sort()).toEqual(["Internet", "Mercado"]);
    expect(data.previousTxs.map((t) => t.description).sort()).toEqual(
      YM.endsWith("-01") ? [] : ["Farmácia", "Internet"],
    );
  });

  it("quem não é do espaço não lê", async () => {
    const rafa = await createTestUser("Rafa");
    const stranger = await createTestUser("Fulano");
    sessionState.current = sessionOf(stranger);
    await expect(loadReportData(rafa.home.id, { start: YM, span: 1 })).rejects.toThrow();
  });
});
