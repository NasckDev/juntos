import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setViewportWidth } from "../test-setup";
import { Button } from "./button";
import { Field } from "./field";
import { Input } from "./input";
import { ResponsiveSheet } from "./responsive-sheet";

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
      title="Nova saída"
      description="Preencha o valor e a descrição."
      trigger={<Button>Novo lançamento</Button>}
      footer={<Button onClick={() => setOpen(false)}>Salvar</Button>}
    >
      <Field label="Descrição">
        <Input />
      </Field>
    </ResponsiveSheet>
  );
}

afterEach(() => setViewportWidth(1440));

describe("ResponsiveSheet", () => {
  it("no computador abre um painel lateral modal que prende o foco", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));

    const dialog = await screen.findByRole("dialog", { name: "Nova saída" });
    expect(dialog).toHaveAccessibleDescription("Preencha o valor e a descrição.");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    // Tab percorre só o que está dentro do painel
    for (let i = 0; i < 5; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("fecha com Esc e devolve o foco a quem abriu", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Novo lançamento" });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("fecha pelo botão Fechar", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    await user.click(await screen.findByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("no celular abre como folha de baixo com o mesmo título e fecha com Esc", async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));

    const dialog = await screen.findByRole("dialog", { name: "Nova saída" });
    expect(dialog).toHaveAttribute("data-vaul-drawer");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await user.keyboard("{Escape}");
    // o vaul só desmonta depois da animação de saída (que o jsdom não roda); o estado já é "fechado"
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "closed"));
  });
});
