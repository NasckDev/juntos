import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AppearancePrefs, DEFAULT_PREFS, PREFS_STORAGE_KEY } from "@/lib/preferences";

const updatePreferences = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/account", () => ({ updatePreferences }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { AparenciaPanel } from "./aparencia-panel";

const INITIAL: AppearancePrefs = { ...DEFAULT_PREFS };

function storedPrefs(): AppearancePrefs {
  return JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? "{}") as AppearancePrefs;
}

beforeEach(() => {
  updatePreferences.mockReset();
  updatePreferences.mockResolvedValue({ ok: true, data: {} });
  toastError.mockReset();
  localStorage.clear();
  for (const attr of ["data-theme", "data-accent", "data-font", "data-hide"]) {
    document.documentElement.removeAttribute(attr);
  }
});

describe("AparenciaPanel", () => {
  it("aplica o tema escuro na hora, salva no servidor e espelha no localStorage", async () => {
    const user = userEvent.setup();
    render(<AparenciaPanel initial={INITIAL} />);

    await user.click(screen.getByRole("button", { name: "Escuro" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(updatePreferences).toHaveBeenCalledWith({ theme: "dark" });
    expect(storedPrefs().theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Automático tira o data-theme (segue o aparelho) e guarda 'auto'", async () => {
    const user = userEvent.setup();
    render(<AparenciaPanel initial={{ ...INITIAL, theme: "dark" }} />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "Automático" }));

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(updatePreferences).toHaveBeenCalledWith({ theme: "auto" });
    expect(storedPrefs().theme).toBe("auto");
  });

  it("troca a cor de destaque, o tamanho da letra e esconde valores", async () => {
    const user = userEvent.setup();
    render(<AparenciaPanel initial={INITIAL} />);

    await user.click(screen.getByRole("button", { name: "Esmeralda" }));
    await user.click(screen.getByRole("radio", { name: "Grande" }));
    await user.click(screen.getByRole("switch", { name: /Esconder valores/ }));

    expect(document.documentElement).toHaveAttribute("data-accent", "esmeralda");
    expect(document.documentElement).toHaveAttribute("data-font", "grande");
    expect(document.documentElement).toHaveAttribute("data-hide", "true");
    expect(updatePreferences).toHaveBeenCalledWith({ accent: "esmeralda" });
    expect(updatePreferences).toHaveBeenCalledWith({ fontSize: "grande" });
    expect(updatePreferences).toHaveBeenCalledWith({ hideValues: true });
    expect(storedPrefs()).toEqual({ theme: "auto", accent: "esmeralda", font: "grande", hide: true });
  });

  it("desfaz na tela e avisa quando o servidor não consegue salvar", async () => {
    const user = userEvent.setup();
    updatePreferences.mockResolvedValue({ ok: false, error: "Não foi possível salvar agora." });
    render(<AparenciaPanel initial={INITIAL} />);

    await user.click(screen.getByRole("button", { name: "Claro" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não foi possível salvar agora."));
    expect(screen.getByRole("button", { name: "Automático" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("aplica as preferências do servidor ao abrir (outro aparelho)", () => {
    render(<AparenciaPanel initial={{ theme: "light", accent: "rosa", font: "maior", hide: false }} />);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveAttribute("data-accent", "rosa");
    expect(document.documentElement).toHaveAttribute("data-font", "maior");
  });
});
