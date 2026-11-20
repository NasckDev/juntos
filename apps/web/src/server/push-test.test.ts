import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "./session";

const state = vi.hoisted(() => ({
  session: null as SessionUser | null,
  pushEnabled: true,
  result: { enabled: true, sent: 1, removed: 0, failed: 0 } as
    | { enabled: false }
    | { enabled: true; sent: number; removed: number; failed: number },
}));
const sendPushMock = vi.hoisted(() => vi.fn());

vi.mock("./session", () => ({ getSession: async () => state.session }));
vi.mock("./env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./env")>()),
  isPushEnabled: () => state.pushEnabled,
}));
vi.mock("./push", () => ({ sendPush: sendPushMock }));

const { sendTestPush } = await import("./actions/push-test");
const { PUSH_TEST_MESSAGES } = await import("./push-test-messages");

const USER: SessionUser = {
  id: "u1",
  name: "Rafa",
  email: "rafa@example.com",
  isAnonymous: false,
  avatar: null,
  image: null,
  deletionRequestedAt: null,
};

beforeEach(() => {
  state.session = USER;
  state.pushEnabled = true;
  state.result = { enabled: true, sent: 1, removed: 0, failed: 0 };
  sendPushMock.mockReset();
  sendPushMock.mockImplementation(async () => state.result);
});

describe("sendTestPush", () => {
  it("manda para os aparelhos da pessoa logada e devolve a contagem", async () => {
    state.result = { enabled: true, sent: 2, removed: 1, failed: 0 };
    const result = await sendTestPush();
    expect(result).toEqual({ ok: true, data: { sent: 2, removed: 1, failed: 0 } });
    expect(sendPushMock).toHaveBeenCalledTimes(1);
    const [, userId, payload] = sendPushMock.mock.calls[0] ?? [];
    expect(userId).toBe("u1");
    expect(payload).toMatchObject({ href: "/ajustes/avisos", tag: "teste" });
  });

  it("explica quando o push não está configurado no servidor e não tenta enviar", async () => {
    state.pushEnabled = false;
    expect(await sendTestPush()).toEqual({ ok: false, error: PUSH_TEST_MESSAGES.disabled });
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("diz para ativar quando não há aparelho inscrito", async () => {
    state.result = { enabled: true, sent: 0, removed: 0, failed: 0 };
    expect(await sendTestPush()).toEqual({ ok: false, error: PUSH_TEST_MESSAGES.noDevice });
  });

  it("avisa quando o serviço de push recusou todos os envios", async () => {
    state.result = { enabled: true, sent: 0, removed: 0, failed: 2 };
    expect(await sendTestPush()).toEqual({ ok: false, error: PUSH_TEST_MESSAGES.allFailed });
  });

  it("sem sessão, não envia", async () => {
    state.session = null;
    const result = await sendTestPush();
    expect(result.ok).toBe(false);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("trata o retorno desligado do serviço como não configurado", async () => {
    state.result = { enabled: false };
    expect(await sendTestPush()).toEqual({ ok: false, error: PUSH_TEST_MESSAGES.disabled });
  });
});
