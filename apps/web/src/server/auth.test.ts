import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// O plugin nextCookies usa `cookies()` do Next; fora de uma requisição, um substituto que não faz nada.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

const { getAuth, GUEST_NAME } = await import("./auth");
const { getDb } = await import("./db");
const { user, userPreferences } = await import("./db/schema");
const { listUserSpaces } = await import("./services/spaces");
const { migrateTestDb } = await import("./test/helpers");

beforeAll(async () => {
  await migrateTestDb();
});

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const token = cookies.find((cookie) => cookie.startsWith("juntos.session_token="));
  if (!token) throw new Error(`Cookie de sessão ausente: ${cookies.join(" | ")}`);
  return token.split(";")[0] ?? "";
}

describe("Better Auth com o banco do app", () => {
  it("convidado entra, ganha o espaço Casa vazio e a sessão é lida pelo cookie", async () => {
    const auth = getAuth();
    const response = await auth.api.signInAnonymous({ headers: new Headers(), asResponse: true });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string; name: string } };
    expect(body.user.name).toBe(GUEST_NAME);

    const [created] = await getDb().select().from(user).where(eq(user.id, body.user.id));
    expect(created?.isAnonymous).toBe(true);
    const spaces = await listUserSpaces(getDb(), body.user.id);
    expect(spaces).toEqual([expect.objectContaining({ name: "Casa", role: "owner" })]);
    const prefs = await getDb().select().from(userPreferences).where(eq(userPreferences.userId, body.user.id));
    expect(prefs).toHaveLength(1);

    const session = await auth.api.getSession({ headers: new Headers({ cookie: sessionCookie(response) }) });
    expect(session?.user.id).toBe(body.user.id);
    expect(session?.user.isAnonymous).toBe(true);
  });

  it("sem as variáveis do Google, o provedor não existe", async () => {
    const response = await getAuth().api.signInSocial({
      body: { provider: "google", callbackURL: "/inicio" },
      headers: new Headers(),
      asResponse: true,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
