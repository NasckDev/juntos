import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Sonner e feedback novos a cada teste: os dois guardam estado no módulo. */
async function setup() {
  vi.resetModules();
  const { Toaster } = await import("sonner");
  const feedback = await import("./feedback");
  render(<Toaster />);
  return feedback;
}

const toasts = () => document.querySelectorAll("[data-sonner-toast]:not([data-removed='true'])");

describe("avisos de ação (toast)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("um aviso por vez: o novo toma o lugar do anterior, sem levar o Desfazer dele", async () => {
    const { toastWithUndo } = await setup();
    act(() => toastWithUndo("Lançamento salvo.", async () => ({ ok: true, data: null })));
    expect(await screen.findByText("Lançamento salvo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeInTheDocument();

    act(() => toastWithUndo("Limite salvo.", null));
    expect(await screen.findByText("Limite salvo.")).toBeInTheDocument();
    expect(screen.queryByText("Lançamento salvo.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
    expect(toasts()).toHaveLength(1);
  });

  it("depois de tocar em Desfazer, o aviso seguinte aparece sempre", async () => {
    const user = userEvent.setup();
    const { toastWithUndo } = await setup();
    act(() => toastWithUndo("Acerto desfeito.", async () => ({ ok: true, data: null })));
    await user.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(await screen.findByText("Ação desfeita.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Acerto desfeito.")).toBeNull());
  });

  it("depois que o aviso some sozinho, o próximo aparece de novo", async () => {
    const { toastWithUndo } = await setup();
    act(() => toastWithUndo("Conta fixa atualizada.", null));
    expect(await screen.findByText("Conta fixa atualizada.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Conta fixa atualizada.")).toBeNull(), { timeout: 6_000 });

    act(() => toastWithUndo("Conta fixa atualizada.", null));
    expect(await screen.findByText("Conta fixa atualizada.")).toBeInTheDocument();
  });

  it("erro do desfazer aparece como erro", async () => {
    const user = userEvent.setup();
    const { toastWithUndo } = await setup();
    act(() => toastWithUndo("Meta excluída.", async () => ({ ok: false, error: "Não dá mais para desfazer." })));
    await user.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(await screen.findByText("Não dá mais para desfazer.")).toBeInTheDocument();
  });
});
