import { asc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../db";
import {
  categories,
  notificationReads,
  notifications,
  spaceMembers,
  spaces,
  transactions,
  user,
  userPreferences,
} from "../db/schema";
import { addMember, createTestUser, memberRow, migrateTestDb } from "../test/helpers";
import { getPreferences, updatePreferences } from "./preferences";
import { createSpace, listUserSpaces } from "./spaces";
import { ensureUserSetup, linkGuestToAccount } from "./users";

beforeAll(async () => {
  await migrateTestDb();
});

async function addTransaction(spaceId: string, createdBy: string) {
  const [category] = await getDb().select().from(categories).where(eq(categories.key, "moradia"));
  if (!category) throw new Error("Categorias padrão não semeadas.");
  const [row] = await getDb()
    .insert(transactions)
    .values({
      spaceId,
      kind: "out",
      description: "Aluguel",
      amountCents: 150_000,
      competence: "2026-11-01",
      day: 5,
      categoryId: category.id,
      createdBy,
    })
    .returning();
  return row;
}

describe("conta nova", () => {
  it("começa com um espaço Casa vazio, como dona, e as preferências padrão", async () => {
    const created = await createTestUser("Rafa");
    const spaces = await listUserSpaces(getDb(), created.id);
    expect(spaces).toEqual([expect.objectContaining({ name: "Casa", role: "owner" })]);
    await expect(getPreferences(getDb(), created.id)).resolves.toMatchObject({ theme: "auto", accent: "indigo" });
  });

  it("garantir de novo não cria outro espaço", async () => {
    const created = await createTestUser("Rafa");
    await ensureUserSetup(getDb(), created.id);
    await expect(listUserSpaces(getDb(), created.id)).resolves.toHaveLength(1);
  });

  it("semeia as 13 categorias padrão globais", async () => {
    const rows = await getDb().select().from(categories);
    expect(rows.filter((row) => row.spaceId === null)).toHaveLength(13);
  });
});

describe("convidado vira conta Google", () => {
  it("leva os espaços com dados, descarta o Casa vazio da conta nova e leva as preferências", async () => {
    const db = getDb();
    const guest = await createTestUser("Convidado", { anonymous: true });
    await addTransaction(guest.home.id, guest.id);
    await updatePreferences(db, guest.id, { accent: "vinho", theme: "dark" });
    const account = await createTestUser("Rafa");

    await linkGuestToAccount(db, guest.id, account.id);

    const spaces = await listUserSpaces(db, account.id);
    expect(spaces.map((space) => space.id)).toEqual([guest.home.id]);
    expect(spaces[0]).toMatchObject({ name: "Casa", role: "owner" });
    const [moved] = await db.select().from(transactions).where(eq(transactions.spaceId, guest.home.id));
    expect(moved?.createdBy).toBe(account.id);
    await expect(getPreferences(db, account.id)).resolves.toMatchObject({ accent: "vinho", theme: "dark" });

    // Depois o Better Auth apaga o convidado; nada da conta pode ir junto.
    await db.delete(user).where(eq(user.id, guest.id));
    await expect(listUserSpaces(db, account.id)).resolves.toHaveLength(1);
  });

  it("conta antiga com dados: os dois espaços ficam e o do convidado ganha sufixo", async () => {
    const db = getDb();
    const account = await createTestUser("Rafa");
    await addTransaction(account.home.id, account.id);
    await updatePreferences(db, account.id, { accent: "azul" });
    const guest = await createTestUser("Convidado", { anonymous: true });
    await addTransaction(guest.home.id, guest.id);
    await updatePreferences(db, guest.id, { accent: "rosa" });

    await linkGuestToAccount(db, guest.id, account.id);

    const names = (await listUserSpaces(db, account.id)).map((space) => space.name).sort();
    expect(names).toEqual(["Casa", "Casa (2)"]);
    await expect(getPreferences(db, account.id)).resolves.toMatchObject({ accent: "azul" });
  });

  it("espaço compartilhado com a própria conta fica uma vez só, com o maior papel", async () => {
    const db = getDb();
    const owner = await createTestUser("Ana");
    const shared = await createSpace(db, owner.id, "Viagem");
    const account = await createTestUser("Rafa");
    const guest = await createTestUser("Convidado", { anonymous: true });
    await addMember(shared.id, account.id, "viewer");
    await addMember(shared.id, guest.id, "editor");

    await linkGuestToAccount(db, guest.id, account.id);

    const viagem = (await listUserSpaces(db, account.id)).filter((space) => space.id === shared.id);
    expect(viagem).toEqual([expect.objectContaining({ role: "editor" })]);
  });

  it("quem foi removida do espaço continua removida, mesmo que o convidado participasse", async () => {
    const db = getDb();
    const owner = await createTestUser("Ana");
    const shared = await createSpace(db, owner.id, "Viagem");
    const account = await createTestUser("Rafa");
    const guest = await createTestUser("Convidado", { anonymous: true });
    const accountMember = await addMember(shared.id, account.id, "viewer");
    await db.update(spaceMembers).set({ status: "removed" }).where(eq(spaceMembers.id, accountMember));
    await addMember(shared.id, guest.id, "editor");

    await linkGuestToAccount(db, guest.id, account.id);

    expect(await memberRow(accountMember)).toMatchObject({ status: "removed", role: "viewer" });
    expect((await listUserSpaces(db, account.id)).map((space) => space.id)).not.toContain(shared.id);
  });

  it("o visto e lido do convidado passam para a conta, sem sobrescrever o que a conta já tinha", async () => {
    const db = getDb();
    const owner = await createTestUser("Ana");
    const shared = await createSpace(db, owner.id, "Viagem");
    const account = await createTestUser("Rafa");
    const guest = await createTestUser("Convidado", { anonymous: true });
    await addMember(shared.id, account.id, "viewer");
    await addMember(shared.id, guest.id, "editor");
    const [a, b] = await db
      .insert(notifications)
      .values([
        { spaceId: shared.id, type: "auto", dedupeKey: "aviso-a", title: "A" },
        { spaceId: shared.id, type: "auto", dedupeKey: "aviso-b", title: "B" },
      ])
      .returning({ id: notifications.id });
    if (!a || !b) throw new Error("sem avisos");
    const accountSaw = new Date("2026-11-01T10:00:00Z");
    const guestSaw = new Date("2026-11-10T10:00:00Z");
    await db.insert(notificationReads).values([
      { notificationId: a.id, userId: account.id, seenAt: accountSaw, readAt: null },
      { notificationId: a.id, userId: guest.id, seenAt: guestSaw, readAt: guestSaw },
      { notificationId: b.id, userId: guest.id, seenAt: guestSaw, readAt: guestSaw },
    ]);

    await linkGuestToAccount(db, guest.id, account.id);

    const reads = await db
      .select()
      .from(notificationReads)
      .where(eq(notificationReads.userId, account.id))
      .orderBy(asc(notificationReads.seenAt));
    expect(reads.map((r) => [r.notificationId, r.seenAt, r.readAt])).toEqual([
      [a.id, accountSaw, null],
      [b.id, guestSaw, guestSaw],
    ]);
    expect(await db.select().from(notificationReads).where(eq(notificationReads.userId, guest.id))).toEqual([]);
  });

  it("preferências nunca mudadas não sobrescrevem as da conta", async () => {
    const db = getDb();
    const guest = await createTestUser("Convidado", { anonymous: true });
    const account = await createTestUser("Rafa");
    await linkGuestToAccount(db, guest.id, account.id);
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, account.id));
    expect(prefs?.updatedAt).toBeNull();
    // Os dois "Casa" estavam vazios: fica um só.
    const remaining = await listUserSpaces(db, account.id);
    expect(remaining).toHaveLength(1);
    expect(await db.select().from(spaces).where(eq(spaces.id, account.home.id))).toHaveLength(0);
  });
});
