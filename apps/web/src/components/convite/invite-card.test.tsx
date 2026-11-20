import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const acceptInvite = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/members", () => ({ acceptInvite }));
const auth = vi.hoisted(() => ({ signInWithGoogle: vi.fn(), signInAsGuest: vi.fn() }));
vi.mock("@/lib/auth-client", () => auth);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { InviteCard, type InviteView } from "./invite-card";

const TOKEN = "a".repeat(43);
const VALID: InviteView = {
  status: "valid",
  spaceName: "Casa",
  inviterName: "Rafa",
  role: "editor",
  expiresAt: "2026-11-27T12:00:00.000Z",
};

beforeEach(() => {
  for (const fn of [...Object.values(router), acceptInvite, ...Object.values(auth)]) fn.mockReset();
});

describe("InviteCard", () => {
  it("convite válido sem sessão mostra espaço, quem convidou e permissão, e oferece Google e convidado", () => {
    render(<InviteCard token={TOKEN} invite={VALID} signedIn={false} googleEnabled />);
    expect(screen.getByRole("heading", { name: "Rafa convidou você para “Casa”" })).toBeInTheDocument();
    expect(screen.getByText(/Pode editar/)).toBeInTheDocument();
    expect(screen.getByText(/27 de novembro de 2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar como convidado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar convite" })).not.toBeInTheDocument();
  });

  it("sem Google configurado, só o convidado aparece", () => {
    render(<InviteCard token={TOKEN} invite={VALID} signedIn={false} googleEnabled={false} />);
    expect(screen.queryByRole("button", { name: /Continuar com Google/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar como convidado" })).toBeInTheDocument();
  });

  it("Google volta para o próprio convite", async () => {
    const user = userEvent.setup();
    auth.signInWithGoogle.mockResolvedValue({ ok: true });
    render(<InviteCard token={TOKEN} invite={VALID} signedIn={false} googleEnabled />);
    await user.click(screen.getByRole("button", { name: /Continuar com Google/ }));
    expect(auth.signInWithGoogle).toHaveBeenCalledWith(`/convite/${TOKEN}`, `/convite/${TOKEN}?erro=google`);
  });

  it("entrar como convidado atualiza a página para mostrar 'Aceitar convite'", async () => {
    const user = userEvent.setup();
    auth.signInAsGuest.mockResolvedValue({ ok: true });
    render(<InviteCard token={TOKEN} invite={VALID} signedIn={false} googleEnabled={false} />);
    await user.click(screen.getByRole("button", { name: "Entrar como convidado" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("com sessão, aceitar chama a action e leva ao espaço", async () => {
    const user = userEvent.setup();
    acceptInvite.mockResolvedValue({ ok: true, data: { spaceId: "s1", spaceName: "Casa", role: "editor" } });
    render(<InviteCard token={TOKEN} invite={VALID} signedIn googleEnabled />);
    await user.click(screen.getByRole("button", { name: "Aceitar convite" }));
    expect(acceptInvite).toHaveBeenCalledWith({ token: TOKEN });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/inicio"));
  });

  it("mostra o erro do servidor ao aceitar e não navega", async () => {
    const user = userEvent.setup();
    acceptInvite.mockResolvedValue({ ok: false, error: "Esse convite já foi usado." });
    render(<InviteCard token={TOKEN} invite={VALID} signedIn googleEnabled />);
    await user.click(screen.getByRole("button", { name: "Aceitar convite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse convite já foi usado.");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", "Este convite venceu", /Peça um novo link para Rafa/],
    ["used", "Este convite já foi usado", /uma única vez/],
  ] as const)("convite %s não oferece aceitar", (status, title, text) => {
    render(<InviteCard token={TOKEN} invite={{ ...VALID, status }} signedIn googleEnabled />);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar convite" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir o Juntos" })).toHaveAttribute("href", "/inicio");
  });

  it("convite inválido sem sessão leva para a entrada", () => {
    render(<InviteCard token="x" invite={{ status: "invalid" }} signedIn={false} googleEnabled />);
    expect(screen.getByRole("heading", { name: "Convite não encontrado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a entrada" })).toHaveAttribute("href", "/entrar");
  });
});
