import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("web-push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("web-push")>()),
  sendNotification,
}));
vi.mock("./env", async (importOriginal) => {
  const original = await importOriginal<typeof import("./env")>();
  return {
    ...original,
    env: {
      ...original.env,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "chave-publica-de-teste",
      VAPID_PRIVATE_KEY: "chave-privada-de-teste",
      VAPID_SUBJECT: "mailto:teste@example.com",
    },
    isPushEnabled: () => true,
  };
});

const { WebPushError } = await import("web-push");
const { getDb } = await import("./db");
const { pushSubscriptions } = await import("./db/schema");
const { MAX_PUSH_SUBSCRIPTIONS, PUSH_TIMEOUT_MS, safeHref, saveSubscription, sendPush } = await import("./push");
const { createTestUser, migrateTestDb } = await import("./test/helpers");

const KEYS = { p256dh: "BOr6x_y-z", auth: "q1w2e3" };
const FCM = "https://fcm.googleapis.com/fcm/send/";

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const subscriptionsOf = (userId: string) =>
  getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

describe("sendPush", () => {
  it("manda com timeout de 10 s e só para endereços da lista; os de fora saem sem receber POST", async () => {
    const person = await createTestUser("Rafa");
    await saveSubscription(getDb(), person.id, { endpoint: `${FCM}aparelho-1`, keys: KEYS }, null);
    // Gravada direto no banco, como uma inscrição antiga de antes da conferência.
    await getDb()
      .insert(pushSubscriptions)
      .values({ userId: person.id, endpoint: "https://10.0.0.5/interno", ...KEYS });

    const result = await sendPush(getDb(), person.id, { title: "Juntos", body: "Oi" });

    expect(result).toEqual({ enabled: true, sent: 1, removed: 1, failed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, , options] = sendNotification.mock.calls[0] ?? [];
    expect(subscription).toMatchObject({ endpoint: `${FCM}aparelho-1` });
    expect(options).toMatchObject({ timeout: PUSH_TIMEOUT_MS });
    expect(PUSH_TIMEOUT_MS).toBe(10_000);
    expect((await subscriptionsOf(person.id)).map((row) => row.endpoint)).toEqual([`${FCM}aparelho-1`]);
  });

  it("na falha, o log leva só host e status, nunca o corpo da resposta nem o caminho do aparelho", async () => {
    const person = await createTestUser("Rafa");
    await saveSubscription(getDb(), person.id, { endpoint: `${FCM}segredo-do-aparelho`, keys: KEYS }, null);
    sendNotification.mockRejectedValue(
      new WebPushError("Received unexpected response code", 500, {}, "erro\nFALSO: admin logou", `${FCM}x`),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await sendPush(getDb(), person.id, { title: "Juntos", body: "Oi" });

    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(log).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(log.mock.calls[0]);
    expect(logged).toContain("fcm.googleapis.com");
    expect(logged).toContain("500");
    expect(logged).not.toContain("FALSO");
    expect(logged).not.toContain("segredo-do-aparelho");
  });

  it("o link da notificação é sempre um caminho do app", async () => {
    const person = await createTestUser("Rafa");
    await saveSubscription(getDb(), person.id, { endpoint: `${FCM}aparelho-2`, keys: KEYS }, null);
    await sendPush(getDb(), person.id, { title: "Juntos", body: "Oi", href: "/\\evil.example.com" });
    const [, body] = sendNotification.mock.calls[0] ?? [];
    expect(JSON.parse(String(body))).toMatchObject({ href: "/inicio" });
  });
});

describe("safeHref", () => {
  it("mantém caminhos internos e recusa barra invertida, //, controle e esquemas", () => {
    expect(safeHref("/lancamentos?mes=2026-11")).toBe("/lancamentos?mes=2026-11");
    for (const bad of ["//evil.example.com", "/\\evil.example.com", "/\t/evil.example.com", "javascript:alert(1)"]) {
      expect(safeHref(bad)).toBe("/inicio");
    }
    expect(safeHref(undefined)).toBe("/inicio");
  });
});

describe("saveSubscription", () => {
  it(`guarda no máximo ${MAX_PUSH_SUBSCRIPTIONS} aparelhos por pessoa; a inscrição mais antiga sai`, async () => {
    const person = await createTestUser("Rafa");
    const base = Date.parse("2026-11-20T12:00:00Z");
    for (let i = 0; i <= MAX_PUSH_SUBSCRIPTIONS; i += 1) {
      await saveSubscription(getDb(), person.id, { endpoint: `${FCM}a${i}`, keys: KEYS }, null, new Date(base + i));
    }
    const endpoints = (await subscriptionsOf(person.id)).map((row) => row.endpoint);
    expect(endpoints).toHaveLength(MAX_PUSH_SUBSCRIPTIONS);
    expect(endpoints).not.toContain(`${FCM}a0`);
    expect(endpoints).toContain(`${FCM}a${MAX_PUSH_SUBSCRIPTIONS}`);
  });
});
