import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const actions = vi.hoisted(() => ({ switchSpace: vi.fn(), createSpace: vi.fn() }));
vi.mock("@/server/actions/spaces", () => actions);
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { SpacesSheet } from "./spaces-sheet";

const SPACES = [
  { id: "s1", name: "Casa", memberCount: 2 },
  { id: "s2", name: "Viagem", memberCount: 1 },
];

function renderSheet(onOpenChange = vi.fn()) {
  render(<SpacesSheet open onOpenChange={onOpenChange} spaces={SPACES} activeSpaceId="s1" />);
  return onOpenChange;
}

beforeEach(() => {
  for (const fn of [...Object.values(router), ...Object.values(actions), ...Object.values(toastMock)]) fn.mockReset();
});

describe("SpacesSheet", () => {
  it("lista os espaços com o atual marcado e o subtítulo de pessoas", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /Casa/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Viagem/ })).toHaveAttribute("aria-current", "false");
    expect(screen.getByText("2 pessoas")).toBeInTheDocument();
    expect(screen.getByText("Privado, só você")).toBeInTheDocument();
  });

  it("trocar de espaço chama switchSpace e fecha", async () => {
    const user = userEvent.setup();
    actions.switchSpace.mockResolvedValue({ ok: true, data: { spaceId: "s2" } });
    const onOpenChange = renderSheet();
    await user.click(screen.getByRole("button", { name: /Viagem/ }));
    expect(actions.switchSpace).toHaveBeenCalledWith({ spaceId: "s2" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("escolher o espaço atual só fecha", async () => {
    const user = userEvent.setup();
    const onOpenChange = renderSheet();
    await user.click(screen.getByRole("button", { name: /Casa/ }));
    expect(actions.switchSpace).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("criar espaço chama createSpace, fecha e vai para o início", async () => {
    const user = userEvent.setup();
    actions.createSpace.mockResolvedValue({ ok: true, data: { id: "s3", name: "Reforma" } });
    const onOpenChange = renderSheet();
    await user.type(screen.getByLabelText("Criar um espaço novo"), "Reforma");
    await user.click(screen.getByRole("button", { name: "Criar espaço" }));
    expect(actions.createSpace).toHaveBeenCalledWith({ name: "Reforma" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/inicio"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("mostra a mensagem do protótipo embaixo do campo quando o nome é recusado", async () => {
    const user = userEvent.setup();
    actions.createSpace.mockResolvedValue({
      ok: false,
      error: "Você já tem um espaço com esse nome.",
      fieldErrors: { name: "Você já tem um espaço com esse nome." },
    });
    renderSheet();
    await user.type(screen.getByLabelText("Criar um espaço novo"), "Casa");
    await user.click(screen.getByRole("button", { name: "Criar espaço" }));
    expect(await screen.findByText("Você já tem um espaço com esse nome.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
