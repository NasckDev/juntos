import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

/** Largura simulada da janela: os testes mudam com `setViewportWidth` para escolher celular ou computador. */
let viewportWidth = 1440;

export function setViewportWidth(width: number): void {
  viewportWidth = width;
}

function matches(query: string): boolean {
  const min = /min-width:\s*([\d.]+)(px|rem)/.exec(query);
  if (!min?.[1]) return false;
  const px = Number(min[1]) * (min[2] === "rem" ? 16 : 1);
  return viewportWidth >= px;
}

// jsdom não tem matchMedia, ResizeObserver nem scrollIntoView.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.scrollIntoView ??= () => undefined;
// O vaul captura o ponteiro ao arrastar a folha; o jsdom não implementa.
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;
