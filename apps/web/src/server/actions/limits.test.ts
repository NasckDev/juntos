import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../session";

/*
 * Limites de tentativas (ADR 0006) e regras do convite por e-mail, pelas Server Actions e rotas de verdade.
 * Para não repetir dezenas de operações, o contador é levado até o limite direto no banco (`fillQuota`) e só a
 * tentativa seguinte passa pela ação.
 */

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../session", () => ({ getSession: async () => sessionState.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("../email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../email")>()),
  sendEmail,
}));
vi.mock("../env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../env")>()),
  isPushEnabled: () => true,
}));

const { createInvite } = await import("./members");
const { createSpace } = await import("./spaces");
const { savePushSubscription } = await import("./push");
const { confirmImport } = await import("./import");
const { GET: exportRoute } = await import("@/app/api/exportar/route");
const { getDb } = await import("../db");
const { INVITE_SUBJECT } = await import("../email");
const { INVITE_MESSAGES, MAX_PENDING_INVITES } = await import("../services/members");
const { hashedPart, hitRateLimit, RATE_LIMIT_MESSAGE, RATE_RULES, rateKey } = await import("../rate-limit");
const { createTestUser, migrateTestDb, sessionOf } = await import("../test/helpers");
const { insertTxs } = await import("../test/finance-fixtures");

type Rule = (typeof RATE_RULES)[keyof typeof RATE_RULES];

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ sent: true });
});

async function fillQuota(rule: Rule, key: string): Promise<void> {
  for (let i = 0; i < rule.limit; i += 1) await hitRateLimit(getDb(), rule, key);
}

describe("convite por e-mail", () => {
  it("conta Google envia o e-mail com assunto fixo; nome do espaço e de quem convida só no corpo, escapados", async () => {
    const owner = await createTestUser("Rafa <b>");
    sessionState.current = sessionOf(owner);
    const result = await createInvite({ spaceId: owner.home.id, email: "lu@example.com", role: "editor" });
    expect(result).toMatchObject({ ok: true, data: { emailSent: true } });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [message] = sendEmail.mock.calls[0] ?? [];
    expect(message.subject).toBe(INVITE_SUBJECT);
    expect(message.subject).toBe("Você foi convidado para um espaço no Juntos");
    expect(message.html).toContain("Rafa &lt;b&gt;");
    expect(message.html).not.toContain("Rafa <b>");
  });

  it("convidado anônimo gera o link para copiar, mas nenhum e-mail sai", async () => {
    const guest = await createTestUser("Convidado", { anonymous: true });
    sessionState.current = sessionOf(guest);
    const result = await createInvite({ spaceId: guest.home.id, email: "alvo@example.com", role: "viewer" });
    expect(result).toMatchObject({ ok: true, data: { emailSent: false } });
    if (result.ok) expect(result.data.inviteUrl).toContain("/convite/");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it(`no máximo ${MAX_PENDING_INVITES} convites pendentes por espaço`, async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const { createInvite: createInviteService } = await import("../services/members");
    for (let i = 0; i < MAX_PENDING_INVITES; i += 1) {
      await createInviteService(
        getDb(),
        { id: owner.id, email: owner.email },
        { spaceId: owner.home.id, email: `pessoa${i}@example.com`, role: "viewer" },
      );
    }
    const result = await createInvite({ spaceId: owner.home.id, email: "mais@example.com", role: "viewer" });
    expect(result).toMatchObject({ ok: false, error: INVITE_MESSAGES.tooManyPending });
  });

  it("20 convites por dia por pessoa e 5 por destinatário por dia", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const recipient = "alvo@example.com";
    await fillQuota(RATE_RULES.inviteRecipient, rateKey(RATE_RULES.inviteRecipient, owner.id, hashedPart(recipient)));
    expect(await createInvite({ spaceId: owner.home.id, email: recipient, role: "viewer" })).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });

    const other = await createTestUser("Lu");
    sessionState.current = sessionOf(other);
    await fillQuota(RATE_RULES.inviteCreate, rateKey(RATE_RULES.inviteCreate, other.id));
    expect(await createInvite({ spaceId: other.home.id, email: "novo@example.com", role: "viewer" })).toEqual({
      ok: false,
      error: RATE_LIMIT_MESSAGE,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("limites por pessoa nas ações", () => {
  it("criar espaço: 10 por dia", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    expect((await createSpace({ name: "Viagem" })).ok).toBe(true);
    await fillQuota(RATE_RULES.spaceCreate, rateKey(RATE_RULES.spaceCreate, owner.id));
    expect(await createSpace({ name: "Praia" })).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
  });

  it("salvar inscrição de push: 20 por dia", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const input = { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "BOr6x", auth: "q1w2" } };
    expect((await savePushSubscription(input)).ok).toBe(true);
    await fillQuota(RATE_RULES.pushSubscribe, rateKey(RATE_RULES.pushSubscribe, owner.id));
    expect(await savePushSubscription(input)).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
  });

  it("confirmar importação: 20 por hora (antes de tocar no lote)", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    await fillQuota(RATE_RULES.importConfirm, rateKey(RATE_RULES.importConfirm, owner.id));
    const result = await confirmImport({
      spaceId: owner.home.id,
      batchId: "00000000-0000-4000-8000-000000000000",
      selected: [0],
      year: 2025,
      destination: "here",
      mode: "add",
    });
    expect(result).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
  });

  it("exportar: 30 por hora, com 429", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    await insertTxs(owner.home.id, owner.id, [
      { description: "Aluguel", amount: 150_000, competence: "2026-03", day: 10, category: "moradia" },
    ]);
    const url = `http://localhost:3010/api/exportar?espaco=${owner.home.id}&formato=csv&de=2026-01&ate=2026-12`;
    expect((await exportRoute(new Request(url))).status).toBe(200);
    await fillQuota(RATE_RULES.exportDownload, rateKey(RATE_RULES.exportDownload, owner.id));
    const blocked = await exportRoute(new Request(url));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
  });
});
