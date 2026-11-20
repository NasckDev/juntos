import { DEFAULT_NOTICE_PREFS } from "@juntos/core";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { DEFAULT_NOTIFY, notifications, spaceMembers } from "../db/schema";
import { insertTxs } from "../test/finance-fixtures";
import { createTestUser, migrateTestDb, type TestUser } from "../test/helpers";
import {
  computeNotices,
  enabledTypes,
  HISTORY_LIMIT,
  listHistory,
  markAllRead,
  markRead,
  markSeen,
  syncNotices,
  trimHistory,
} from "./notifications";

const TODAY = "2026-11-20";

beforeAll(async () => {
  await migrateTestDb();
});

/** Uma conta atrasada (outubro), uma vencendo amanhã e um convite pendente. */
async function seed(owner: TestUser): Promise<void> {
  await insertTxs(owner.home.id, owner.id, [
    { description: "Luz", amount: 18_000, competence: "2026-10", day: 15, category: "contas" },
    { description: "Internet", amount: 12_050, competence: "2026-11", day: 21, category: "contas" },
    { description: "Mercado", amount: 50_000, competence: "2026-11", day: 2, category: "mercado", paid: true },
  ]);
  await getDb()
    .insert(spaceMembers)
    .values({ spaceId: owner.home.id, invitedEmail: "lu@example.com", role: "editor", status: "invited" });
}

describe("avisos do espaço", () => {
  it("calcula os avisos ativos com os dados reais e respeita as preferências", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    const all = await computeNotices(getDb(), owner.home.id, TODAY);
    expect(all.map((n) => [n.kind, n.title])).toEqual([
      ["late", "Luz está atrasada"],
      ["due", "Internet vence no dia 21"],
      ["invite", "Convite aguardando resposta"],
    ]);
    const noLate = await computeNotices(getDb(), owner.home.id, TODAY, { ...DEFAULT_NOTICE_PREFS, late: false });
    expect(noLate.map((n) => n.kind)).toEqual(["due", "invite"]);
  });

  it("leva os avisos ao histórico uma vez só (chave de deduplicação)", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    const first = await syncNotices(getDb(), owner.home.id, TODAY);
    expect(first.map((n) => n.type)).toEqual(["late", "due", "invite"]);
    expect(first.find((n) => n.type === "invite")?.href).toBe("/ajustes/pessoas");
    expect(await syncNotices(getDb(), owner.home.id, TODAY)).toEqual([]);
    const rows = await getDb().select().from(notifications).where(eq(notifications.spaceId, owner.home.id));
    expect(rows).toHaveLength(3);
  });

  it("filtra por categoria, não lidas e tipos desligados; marca vistos e lidos", async () => {
    const owner = await createTestUser("Rafa");
    await seed(owner);
    await syncNotices(getDb(), owner.home.id, TODAY);
    const db = getDb();
    const all = await listHistory(db, owner.home.id, owner.id, DEFAULT_NOTIFY, "todas");
    expect(all).toMatchObject({ unread: 3, unseen: 3 });
    expect((await listHistory(db, owner.home.id, owner.id, DEFAULT_NOTIFY, "contas")).items.map((i) => i.type)).toEqual(
      expect.arrayContaining(["late", "due"]),
    );
    expect((await listHistory(db, owner.home.id, owner.id, DEFAULT_NOTIFY, "pessoas")).items).toHaveLength(1);
    expect((await listHistory(db, owner.home.id, owner.id, DEFAULT_NOTIFY, "plano")).items).toHaveLength(0);
    const withoutPeople = await listHistory(db, owner.home.id, owner.id, { ...DEFAULT_NOTIFY, people: false }, "todas");
    expect(withoutPeople.items.map((i) => i.type)).not.toContain("invite");
    expect(enabledTypes({ ...DEFAULT_NOTIFY, late: false })).toContain("import");

    expect(await markSeen(db, owner.home.id, owner.id)).toBe(3);
    const late = all.items.find((i) => i.type === "late");
    if (!late) throw new Error("sem aviso de atraso");
    expect(await markRead(db, owner.home.id, owner.id, late.id)).toEqual({ href: "/lancamentos" });
    const unread = await listHistory(db, owner.home.id, owner.id, DEFAULT_NOTIFY, "nao-lidas");
    expect(unread).toMatchObject({ unread: 2, unseen: 0 });
    expect(unread.items.map((i) => i.id)).not.toContain(late.id);

    expect(await markAllRead(db, owner.home.id, owner.id)).toBe(2);
    expect((await listHistory(db, owner.home.id, owner.id, DEFAULT_NOTIFY, "todas")).unread).toBe(0);
  });

  it("quem não é do espaço não marca nada; o histórico guarda os últimos 200", async () => {
    const owner = await createTestUser("Rafa");
    const stranger = await createTestUser("Fulano");
    await seed(owner);
    await syncNotices(getDb(), owner.home.id, TODAY);
    const [row] = await getDb().select().from(notifications).where(eq(notifications.spaceId, owner.home.id));
    if (!row) throw new Error("sem aviso");
    // Outro espaço: o aviso não é encontrado.
    expect(await markRead(getDb(), stranger.home.id, stranger.id, row.id)).toBeNull();

    const base = Date.parse("2026-01-01T00:00:00Z");
    await getDb()
      .insert(notifications)
      .values(
        Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => ({
          spaceId: owner.home.id,
          type: "auto" as const,
          dedupeKey: `teste-${i}`,
          title: `Aviso ${i}`,
          createdAt: new Date(base + i * 60_000),
        })),
      );
    expect(await trimHistory(getDb(), owner.home.id)).toBe(8);
    const left = await getDb().select().from(notifications).where(eq(notifications.spaceId, owner.home.id));
    expect(left).toHaveLength(HISTORY_LIMIT);
  });
});
