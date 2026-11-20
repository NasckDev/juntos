import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateProfile = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/account", () => ({ updateProfile }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { WelcomeSheet, welcomeStorageKey } from "./welcome-sheet";

beforeEach(() => {
  updateProfile.mockReset();
  localStorage.clear();
});

describe("WelcomeSheet", () => {
  it("abre para quem ainda não tem nome e não oferece dados de exemplo", async () => {
    render(<WelcomeSheet userId="u1" needsName />);
    expect(await screen.findByText("Como podemos chamar você?")).toBeInTheDocument();
    expect(screen.queryByText(/exemplo/i)).not.toBeInTheDocument();
  });

  it("não abre quando a pessoa já tem nome", () => {
    render(<WelcomeSheet userId="u1" needsName={false} />);
    expect(screen.queryByText("Bem-vindo ao Juntos")).not.toBeInTheDocument();
  });

  it("não abre de novo depois de visto", () => {
    localStorage.setItem(welcomeStorageKey("u1"), "1");
    render(<WelcomeSheet userId="u1" needsName />);
    expect(screen.queryByText("Bem-vindo ao Juntos")).not.toBeInTheDocument();
  });

  it("salva o nome e marca como visto", async () => {
    const user = userEvent.setup();
    updateProfile.mockResolvedValue({ ok: true, data: { saved: true } });
    render(<WelcomeSheet userId="u1" needsName />);
    await user.type(await screen.findByLabelText("Como podemos chamar você?"), "Rafa");
    await user.click(screen.getByRole("button", { name: "Começar" }));
    expect(updateProfile).toHaveBeenCalledWith({ name: "Rafa" });
    await waitFor(() => expect(screen.queryByText("Bem-vindo ao Juntos")).not.toBeInTheDocument());
    expect(localStorage.getItem(welcomeStorageKey("u1"))).toBe("1");
  });

  it("mostra a mensagem do servidor quando o nome é curto e continua aberta", async () => {
    const user = userEvent.setup();
    updateProfile.mockResolvedValue({
      ok: false,
      error: "Digite seu nome, com pelo menos 2 letras.",
      fieldErrors: { name: "Digite seu nome, com pelo menos 2 letras." },
    });
    render(<WelcomeSheet userId="u1" needsName />);
    await user.type(await screen.findByLabelText("Como podemos chamar você?"), "R");
    await user.click(screen.getByRole("button", { name: "Começar" }));
    expect(await screen.findByText("Digite seu nome, com pelo menos 2 letras.")).toBeInTheDocument();
    expect(localStorage.getItem(welcomeStorageKey("u1"))).toBeNull();
  });

  it("'Agora não' fecha e não insiste nas próximas visitas", async () => {
    const user = userEvent.setup();
    render(<WelcomeSheet userId="u1" needsName />);
    await user.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(updateProfile).not.toHaveBeenCalled();
    expect(localStorage.getItem(welcomeStorageKey("u1"))).toBe("1");
  });
});
