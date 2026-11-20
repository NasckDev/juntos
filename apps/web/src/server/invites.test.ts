import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "./crypto";
import { getDb } from "./db";
import { invites, notifications, spaceMembers } from "./db/schema";
import {
  acceptInvite,
  changeMemberRole,
  createInvite,
  getInvitePreview,
  INVITE_TTL_MS,
  listMembers,
  purgeExpiredInvites,
  removeMember,
} from "./services/members";
import { listUserSpaces } from "./services/spaces";
import { addMember, createTestUser, migrateTestDb, type TestUser } from "./test/helpers";

beforeAll(async () => {
  await migrateTestDb();
});

const DAY = 24 * 60 * 60 * 1000;

function tokenOf(url: string): string {
  const token = url.split("/convite/")[1];
  if (!token) throw new Error("Link sem token.");
  return token;
}

async function inviteFrom(owner: TestUser, email: string, now = new Date()) {
  return createInvite(
    getDb(),
    { id: owner.id, email: owner.email },
    { spaceId: owner.home.id, email, role: "editor" },
    now,
  );
}

describe("criar convite", () => {
  it("guarda só o hash SHA-256 do token de 32 bytes e vence em 7 dias", async () => {
    const owner = await createTestUser("Rafa");
    const now = new Date("2026-11-20T12:00:00Z");
    const created = await inviteFrom(owner, "lu@example.com", now);
    const token = tokenOf(created.inviteUrl);

    expect(created.inviteUrl).toBe(`http://localhost:3010/convite/${token}`);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(created.expiresAt.getTime() - now.getTime()).toBe(INVITE_TTL_MS);

    const [row] = await getDb().select().from(invites).where(eq(invites.memberId, created.memberId));
    expect(row?.tokenHash).toBe(sha256Hex(token));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("aparece como pendente na lista de pessoas", async () => {
    const owner = await createTestUser("Rafa");
    await inviteFrom(owner, "Lu@Example.com");
    const people = await listMembers(getDb(), owner.id, owner.home.id);
    expect(people).toHaveLength(2);
    expect(people[0]).toMatchObject({ role: "owner", isYou: true, status: "active" });
    expect(people[1]).toMatchObject({ name: "lu@example.com", status: "invited", role: "editor" });
    expect(people[1]?.inviteExpiresAt).toBeInstanceOf(Date);
  });

  it("recusa o próprio e-mail e convite repetido, com as mensagens do protótipo", async () => {
    const owner = await createTestUser("Rafa");
    await expect(inviteFrom(owner, owner.email ?? "")).rejects.toThrow("Esse é o seu próprio e-mail.");
    await inviteFrom(owner, "lu@example.com");
    await expect(inviteFrom(owner, "LU@example.com")).rejects.toThrow(
      "Essa pessoa já está neste espaço ou já foi convidada.",
    );
  });

  it("recusa quem já participa com aquele e-mail", async () => {
    const owner = await createTestUser("Rafa");
    const partner = await createTestUser("Lu");
    await addMember(owner.home.id, partner.id, "editor");
    await expect(inviteFrom(owner, partner.email ?? "")).rejects.toThrow(
      "Essa pessoa já está neste espaço ou já foi convidada.",
    );
  });

  it("só o dono convida", async () => {
    const owner = await createTestUser("Rafa");
    const editor = await createTestUser("Lu");
    await addMember(owner.home.id, editor.id, "editor");
    await expect(
      createInvite(
        getDb(),
        { id: editor.id, email: editor.email },
        { spaceId: owner.home.id, email: "ana@example.com", role: "viewer" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("convite vencido para o mesmo e-mail é renovado com token novo", async () => {
    const owner = await createTestUser("Rafa");
    const start = new Date("2026-11-01T12:00:00Z");
    const first = await inviteFrom(owner, "lu@example.com", start);
    const later = new Date(start.getTime() + 8 * DAY);
    const second = await inviteFrom(owner, "lu@example.com", later);
    expect(second.memberId).toBe(first.memberId);
    expect(tokenOf(second.inviteUrl)).not.toBe(tokenOf(first.inviteUrl));
    const rows = await getDb().select().from(invites).where(eq(invites.memberId, first.memberId));
    expect(rows).toHaveLength(1);
  });
});

describe("aceitar convite", () => {
  it("vira membro ativo com o papel do convite e avisa quem convidou", async () => {
    const owner = await createTestUser("Rafa");
    const guest = await createTestUser("Lu", { anonymous: true });
    const created = await inviteFrom(owner, "lu@example.com");

    const accepted = await acceptInvite(getDb(), { id: guest.id, name: "Lu" }, tokenOf(created.inviteUrl));
    expect(accepted).toEqual({ spaceId: owner.home.id, spaceName: "Casa", role: "editor" });

    const spaces = await listUserSpaces(getDb(), guest.id);
    expect(spaces.map((space) => space.id)).toContain(owner.home.id);
    const [notice] = await getDb().select().from(notifications).where(eq(notifications.userId, owner.id));
    expect(notice?.title).toBe("Lu aceitou seu convite");
  });

  it("é de uso único", async () => {
    const owner = await createTestUser("Rafa");
    const first = await createTestUser("Lu");
    const second = await createTestUser("Ana");
    const token = tokenOf((await inviteFrom(owner, "lu@example.com")).inviteUrl);

    await acceptInvite(getDb(), { id: first.id, name: first.name }, token);
    await expect(acceptInvite(getDb(), { id: second.id, name: second.name }, token)).rejects.toThrow(
      "Este convite já foi usado.",
    );
    await expect(listUserSpaces(getDb(), second.id)).resolves.toHaveLength(1);
  });

  it("vence depois de 7 dias", async () => {
    const owner = await createTestUser("Rafa");
    const partner = await createTestUser("Lu");
    const start = new Date("2026-11-01T12:00:00Z");
    const token = tokenOf((await inviteFrom(owner, "lu@example.com", start)).inviteUrl);

    const afterExpiry = new Date(start.getTime() + INVITE_TTL_MS + 1000);
    await expect(acceptInvite(getDb(), { id: partner.id, name: partner.name }, token, afterExpiry)).rejects.toThrow(
      "Este convite venceu. Peça um novo para quem convidou você.",
    );
    const preview = await getInvitePreview(getDb(), token, afterExpiry);
    expect(preview.status).toBe("expired");
  });

  it("token desconhecido não revela nada", async () => {
    const partner = await createTestUser("Lu");
    const fake = Buffer.alloc(32, 7).toString("base64url");
    await expect(getInvitePreview(getDb(), fake)).resolves.toEqual({ status: "invalid" });
    await expect(acceptInvite(getDb(), { id: partner.id, name: partner.name }, fake)).rejects.toThrow(
      "Este convite não existe ou já foi usado.",
    );
  });

  it("a prévia não consome o convite", async () => {
    const owner = await createTestUser("Rafa");
    const partner = await createTestUser("Lu");
    const token = tokenOf((await inviteFrom(owner, "lu@example.com")).inviteUrl);
    await expect(getInvitePreview(getDb(), token)).resolves.toMatchObject({
      status: "valid",
      spaceName: "Casa",
      inviterName: "Rafa",
    });
    await expect(acceptInvite(getDb(), { id: partner.id, name: partner.name }, token)).resolves.toMatchObject({
      role: "editor",
    });
  });
});

describe("papéis e remoção", () => {
  it("o dono troca a permissão e remove; o dono não pode ser removido", async () => {
    const owner = await createTestUser("Rafa");
    const partner = await createTestUser("Lu");
    const memberId = await addMember(owner.home.id, partner.id, "editor");

    await changeMemberRole(getDb(), owner.id, { spaceId: owner.home.id, memberId, role: "viewer" });
    const [changed] = await getDb().select().from(spaceMembers).where(eq(spaceMembers.id, memberId));
    expect(changed?.role).toBe("viewer");

    const ownerMember = owner.home.memberId;
    await expect(removeMember(getDb(), owner.id, { spaceId: owner.home.id, memberId: ownerMember })).rejects.toThrow(
      "O dono não pode ser removido do espaço.",
    );

    await removeMember(getDb(), owner.id, { spaceId: owner.home.id, memberId });
    const [removed] = await getDb().select().from(spaceMembers).where(eq(spaceMembers.id, memberId));
    expect(removed?.status).toBe("removed");
    await expect(listUserSpaces(getDb(), partner.id)).resolves.toHaveLength(1);
  });

  it("quem edita não muda permissões", async () => {
    const owner = await createTestUser("Rafa");
    const editor = await createTestUser("Lu");
    const viewer = await createTestUser("Ana");
    await addMember(owner.home.id, editor.id, "editor");
    const viewerMember = await addMember(owner.home.id, viewer.id, "viewer");
    await expect(
      changeMemberRole(getDb(), editor.id, { spaceId: owner.home.id, memberId: viewerMember, role: "editor" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a rotina diária apaga convites vencidos e a pessoa pendente", async () => {
    const owner = await createTestUser("Rafa");
    const start = new Date("2026-10-01T12:00:00Z");
    const created = await inviteFrom(owner, "ana@example.com", start);
    const purged = await purgeExpiredInvites(getDb(), new Date(start.getTime() + 8 * DAY));
    expect(purged).toBeGreaterThanOrEqual(1);
    const rows = await getDb().select().from(spaceMembers).where(eq(spaceMembers.id, created.memberId));
    expect(rows).toHaveLength(0);
  });
});
