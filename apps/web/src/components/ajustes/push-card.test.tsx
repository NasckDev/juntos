import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  savePushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
  sendTestPush: vi.fn(),
}));
vi.mock("@/server/actions/push", () => ({
  savePushSubscription: actions.savePushSubscription,
  removePushSubscription: actions.removePushSubscription,
}));
vi.mock("@/server/actions/push-test", () => ({ sendTestPush: actions.sendTestPush }));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { PUSH_COPY, PushCard } from "./push-card";

const KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

interface FakeSubscription {
  endpoint: string;
  toJSON: () => { endpoint: string; expirationTime: null; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
}

function fakeSubscription(): FakeSubscription {
  const endpoint = "https://push.example.com/send/abc";
  return {
    endpoint,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "BOr6x_y-z", auth: "q1w2e3" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

/** Simula o navegador com Push API: permissão, service worker e inscrição. */
function installBrowserPush(permission: NotificationPermission) {
  let subscription: FakeSubscription | null = null;
  const pushManager = {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async () => {
      subscription = fakeSubscription();
      return subscription;
    }),
  };
  const registration = { pushManager };
  const request = vi.fn(async () => permission);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(async () => registration),
    },
  });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", Object.assign(class {}, { permission, requestPermission: request }));
  return { pushManager, request };
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
  actions.savePushSubscription.mockResolvedValue({ ok: true, data: { saved: true } });
  actions.removePushSubscription.mockResolvedValue({ ok: true, data: { removed: true } });
  toastMock.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("PushCard", () => {
  it("explica em vez de mostrar o botão quando o servidor não tem push configurado", async () => {
    render(<PushCard serverEnabled={false} vapidPublicKey={null} />);
    expect(await screen.findByText(PUSH_COPY.serverOff)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar/ })).not.toBeInTheDocument();
  });

  it("explica quando o navegador não suporta", async () => {
    render(<PushCard serverEnabled vapidPublicKey={KEY} />);
    expect(await screen.findByText(PUSH_COPY.unsupported)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar/ })).not.toBeInTheDocument();
  });

  it("explica como liberar quando a permissão está bloqueada", async () => {
    installBrowserPush("denied");
    render(<PushCard serverEnabled vapidPublicKey={KEY} />);
    expect(await screen.findByText(PUSH_COPY.denied)).toBeInTheDocument();
  });

  it("ativa: pede permissão, inscreve e grava no servidor; depois envia o teste e desativa", async () => {
    const user = userEvent.setup();
    const { pushManager, request } = installBrowserPush("granted");
    actions.sendTestPush.mockResolvedValue({ ok: true, data: { sent: 1, removed: 0, failed: 0 } });
    render(<PushCard serverEnabled vapidPublicKey={KEY} />);

    await user.click(await screen.findByRole("button", { name: "Ativar notificações neste aparelho" }));

    await waitFor(() => expect(screen.getByText("Ativadas neste aparelho.")).toBeInTheDocument());
    expect(request).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }),
    );
    expect(actions.savePushSubscription).toHaveBeenCalledWith({
      endpoint: "https://push.example.com/send/abc",
      expirationTime: null,
      keys: { p256dh: "BOr6x_y-z", auth: "q1w2e3" },
    });

    await user.click(screen.getByRole("button", { name: "Enviar notificação de teste" }));
    await waitFor(() => expect(actions.sendTestPush).toHaveBeenCalled());
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("Notificação enviada"));

    await user.click(screen.getByRole("button", { name: "Desativar neste aparelho" }));
    await waitFor(() =>
      expect(actions.removePushSubscription).toHaveBeenCalledWith({ endpoint: "https://push.example.com/send/abc" }),
    );
    expect(await screen.findByRole("button", { name: "Ativar notificações neste aparelho" })).toBeInTheDocument();
  });

  it("desfaz a inscrição do navegador se o servidor recusar gravar", async () => {
    const user = userEvent.setup();
    installBrowserPush("granted");
    actions.savePushSubscription.mockResolvedValue({ ok: false, error: "Recusado." });
    render(<PushCard serverEnabled vapidPublicKey={KEY} />);

    await user.click(await screen.findByRole("button", { name: "Ativar notificações neste aparelho" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Recusado."));
    expect(screen.queryByText("Ativadas neste aparelho.")).not.toBeInTheDocument();
  });

  it("mostra o erro do servidor no envio do teste", async () => {
    const user = userEvent.setup();
    const { pushManager } = installBrowserPush("granted");
    pushManager.getSubscription.mockResolvedValue(fakeSubscription());
    actions.sendTestPush.mockResolvedValue({ ok: false, error: "Nenhum aparelho está inscrito." });
    render(<PushCard serverEnabled vapidPublicKey={KEY} />);

    await user.click(await screen.findByRole("button", { name: "Enviar notificação de teste" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Nenhum aparelho está inscrito."));
  });
});
