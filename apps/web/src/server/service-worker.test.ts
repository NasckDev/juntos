import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/*
 * O service worker (`public/sw.js`) é um script solto, sem build. Aqui ele roda num contexto isolado do Node com um
 * `self` falso, para testar as funções e o evento de push como o navegador os chamaria.
 */

const ORIGIN = "https://juntos.example.com";
const SOURCE = readFileSync(path.resolve(import.meta.dirname, "../../public/sw.js"), "utf8");

type Listener = (event: unknown) => void;

function loadWorker() {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn(async () => undefined);
  const self = {
    location: { origin: ORIGIN },
    registration: { showNotification },
    clients: { claim: async () => undefined, matchAll: async () => [], openWindow: async () => null },
    skipWaiting: () => undefined,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  const context = vm.createContext({ self, URL });
  vm.runInContext(SOURCE, context);
  const safePath = (href: unknown): string => vm.runInContext("safePath", context)(href);
  return { listeners, showNotification, safePath };
}

describe("service worker", () => {
  it("safePath mantém caminhos do app", () => {
    const { safePath } = loadWorker();
    expect(safePath("/lancamentos?mes=2026-11")).toBe("/lancamentos?mes=2026-11");
    expect(safePath("/ajustes/avisos#push")).toBe("/ajustes/avisos#push");
  });

  it.each([
    "//evil.example.com",
    "/\\evil.example.com",
    "\\\\evil.example.com",
    "/\t/evil.example.com",
    "/\n/evil.example.com",
    "/inicio\r\nX: 1",
    "javascript:alert(1)",
    "https://evil.example.com/inicio",
    "inicio",
    "",
    42,
    null,
  ])("safePath recusa %j", (href) => {
    expect(loadWorker().safePath(href)).toBe("/inicio");
  });

  it("a notificação leva o ícone do app e só um caminho seguro", async () => {
    const { listeners, showNotification } = loadWorker();
    let pending: Promise<unknown> = Promise.resolve();
    listeners.get("push")?.({
      data: { json: () => ({ title: "Juntos", body: "Oi", href: "/\\evil.example.com" }), text: () => "" },
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
    expect(showNotification).toHaveBeenCalledWith(
      "Juntos",
      expect.objectContaining({ icon: "/icons/icon-192.png", data: { href: "/inicio" } }),
    );
  });
});
