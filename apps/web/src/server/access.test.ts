import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "./session";

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
vi.mock("./session", () => ({ getSession: async () => sessionState.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

const { AccessError, assertMember, requireMember, roleAtLeast } = await import("./access");
const { deleteSpace, renameSpace, switchSpace } = await import("./actions/spaces");
const { getDb } = await import("./db");
const { listUserSpaces } = await import("./services/spaces");
const { addMember, createTestUser, migrateTestDb, sessionOf } = await import("./test/helpers");

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

async function expectAccessError(promise: Promise<unknown>, code: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHENTICATED") {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(AccessError);
  expect((error as InstanceType<typeof AccessError>).code).toBe(code);
  return error as InstanceType<typeof AccessError>;
}

describe("papéis", () => {
  it("ordena owner > editor > viewer", () => {
    expect(roleAtLeast("owner", "editor")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("editor", "owner")).toBe(false);
  });
});

describe("assertMember", () => {
  it("quem só vê não passa quando a ação exige editar", async () => {
    const owner = await createTestUser("Rafa");
    const viewer = await createTestUser("Lu");
    await addMember(owner.home.id, viewer.id, "viewer");

    await expect(assertMember(getDb(), viewer.id, owner.home.id, "viewer")).resolves.toMatchObject({ role: "viewer" });
    await expectAccessError(assertMember(getDb(), viewer.id, owner.home.id, "editor"), "FORBIDDEN");
  });

  it("quem não é membro recebe a mesma resposta de um espaço que não existe", async () => {
    const owner = await createTestUser("Rafa");
    const stranger = await createTestUser("Ana");

    const existing = await expectAccessError(assertMember(getDb(), stranger.id, owner.home.id, "viewer"), "NOT_FOUND");
    const missing = await expectAccessError(assertMember(getDb(), stranger.id, randomUUID(), "viewer"), "NOT_FOUND");
    const malformed = await expectAccessError(assertMember(getDb(), stranger.id, "nao-e-uuid", "viewer"), "NOT_FOUND");

    expect(existing.message).toBe(missing.message);
    expect(existing.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(malformed.message).toBe(missing.message);
  });

  it("espaço excluído some para todos os membros", async () => {
    const owner = await createTestUser("Rafa");
    const db = getDb();
    const { createSpace } = await import("./services/spaces");
    const extra = await createSpace(db, owner.id, "Viagem");
    const { deleteSpace: remove } = await import("./services/spaces");
    await remove(db, owner.id, extra.id);
    await expectAccessError(assertMember(db, owner.id, extra.id, "viewer"), "NOT_FOUND");
  });
});

describe("requireMember", () => {
  it("sem sessão, pede login", async () => {
    await expectAccessError(requireMember(randomUUID(), "viewer"), "UNAUTHENTICATED");
  });

  it("com sessão, devolve o usuário e o papel", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const { membership, user } = await requireMember(owner.home.id, "owner");
    expect(user.id).toBe(owner.id);
    expect(membership.role).toBe("owner");
  });
});

describe("Server Actions de espaço respeitam o papel", () => {
  it("quem só vê não renomeia", async () => {
    const owner = await createTestUser("Rafa");
    const viewer = await createTestUser("Lu");
    await addMember(owner.home.id, viewer.id, "viewer");
    sessionState.current = sessionOf(viewer);

    const result = await renameSpace({ spaceId: owner.home.id, name: "Nossa casa" });
    expect(result).toEqual({ ok: false, error: "Você não tem permissão para fazer isso neste espaço." });
  });

  it("quem edita também não exclui o espaço; só o dono", async () => {
    const owner = await createTestUser("Rafa");
    const editor = await createTestUser("Lu");
    await addMember(owner.home.id, editor.id, "editor");
    sessionState.current = sessionOf(editor);

    const denied = await deleteSpace({ spaceId: owner.home.id });
    expect(denied.ok).toBe(false);
  });

  it("o dono exclui (com desfazer) e o espaço seguinte fica ativo", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const { createSpace } = await import("./actions/spaces");
    const created = await createSpace({ name: "Viagem" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await deleteSpace({ spaceId: created.data.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nextSpaceId).toBe(owner.home.id);
    expect(result.data.undo.token).toMatch(/^[0-9a-f-]{36}$/);
    const spaces = await listUserSpaces(getDb(), owner.id);
    expect(spaces.map((space) => space.id)).toEqual([owner.home.id]);
  });

  it("o dono não fica sem nenhum espaço", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const result = await deleteSpace({ spaceId: owner.home.id });
    expect(result).toEqual({
      ok: false,
      error: "Você precisa ter pelo menos um espaço. Crie outro antes de excluir este.",
    });
  });

  it("quem não participa não consegue trocar para o espaço de outra pessoa", async () => {
    const owner = await createTestUser("Rafa");
    const stranger = await createTestUser("Ana");
    sessionState.current = sessionOf(stranger);
    const result = await switchSpace({ spaceId: owner.home.id });
    expect(result).toEqual({ ok: false, error: "Não encontramos esse espaço." });
  });

  it("nome repetido usa a mensagem do protótipo", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const { createSpace } = await import("./actions/spaces");
    const result = await createSpace({ name: "  casa " });
    expect(result).toEqual({
      ok: false,
      error: "Você já tem um espaço com esse nome.",
      fieldErrors: { name: "Você já tem um espaço com esse nome." },
    });
  });

  it("sem sessão, a ação não roda", async () => {
    const result = await renameSpace({ spaceId: randomUUID(), name: "Casa nova" });
    expect(result).toEqual({ ok: false, error: "Sua sessão terminou. Entre de novo para continuar." });
  });
});
