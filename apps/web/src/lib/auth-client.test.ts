import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  releaseThisDevice: vi.fn(),
  removePushSubscription: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("better-auth/react", () => ({ createAuthClient: () => ({ signOut: mocks.signOut }) }));
vi.mock("better-auth/client/plugins", () => ({ anonymousClient: () => ({}) }));
vi.mock("./push-client", () => ({ releaseThisDevice: mocks.releaseThisDevice }));
vi.mock("@/server/actions/push", () => ({ removePushSubscription: mocks.removePushSubscription }));

const { signOut } = await import("./auth-client");

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

beforeEach(() => {
  calls.length = 0;
  mocks.releaseThisDevice.mockReset().mockImplementation(async () => {
    calls.push("release");
    return ENDPOINT;
  });
  mocks.removePushSubscription.mockReset().mockImplementation(async () => {
    calls.push("remove");
    return { ok: true, data: { removed: true } };
  });
  mocks.signOut.mockReset().mockImplementation(async () => {
    calls.push("signOut");
    return { error: null };
  });
});

describe("signOut", () => {
  it("remove a inscrição de push deste navegador antes de encerrar a sessão", async () => {
    expect(await signOut()).toEqual({ ok: true });
    expect(mocks.removePushSubscription).toHaveBeenCalledWith({ endpoint: ENDPOINT });
    expect(calls).toEqual(["release", "remove", "signOut"]);
  });

  it("sem inscrição neste navegador, só sai", async () => {
    mocks.releaseThisDevice.mockResolvedValue(null);
    expect(await signOut()).toEqual({ ok: true });
    expect(mocks.removePushSubscription).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("se o servidor falhar ao apagar, a saída continua", async () => {
    mocks.removePushSubscription.mockRejectedValue(new Error("sem rede"));
    expect(await signOut()).toEqual({ ok: true });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
