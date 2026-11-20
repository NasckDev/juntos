import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setViewportWidth } from "../test-setup";
import { type MonthPeriod, MonthPicker } from "./month-picker";

const NOW = "2026-11";

function setup(value: MonthPeriod = { start: NOW, span: 1 }, allowRange = true) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<MonthPicker value={value} onChange={onChange} currentYm={NOW} allowRange={allowRange} />);
  return { onChange, user };
}

afterEach(() => setViewportWidth(1440));

describe("MonthPicker", () => {
  it("avança e volta um mês pelos botões", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-12", span: 1 });
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-10", span: 1 });
  });

  it("abre pelo teclado, foca o mês escolhido, anda com as setas e escolhe com Enter", async () => {
    const { onChange, user } = setup();
    const trigger = screen.getByRole("button", { name: /Novembro 2026/ });
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("dialog", { name: "Escolher mês ou período" });
    const november = within(dialog).getByRole("button", { name: "Novembro de 2026, mês atual" });
    expect(november).toHaveFocus();
    expect(november).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{ArrowRight}");
    expect(within(dialog).getByRole("button", { name: "Dezembro de 2026" })).toHaveFocus();

    // Seta para baixo no fim do ano passa para o ano seguinte
    await user.keyboard("{ArrowDown}");
    expect(within(dialog).getByRole("button", { name: "Março de 2027" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-12", span: 1 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("escolhe um período de até 3 meses e recusa um maior", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: /Novembro 2026/ }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("radio", { name: "Período" }));
    expect(within(dialog).getByText("Toque no primeiro e no último mês, até 3 meses.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Junho de 2026" }));
    await user.click(within(dialog).getByRole("button", { name: "Outubro de 2026" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("Escolha no máximo 3 meses.");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Agosto de 2026" }));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-08", span: 3 });
  });

  it("mostra 'Mês atual' fora do mês de hoje e volta para ele", async () => {
    const { onChange, user } = setup({ start: "2026-08", span: 3 });
    expect(screen.getByRole("button", { name: /Ago – Out 2026/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Período anterior" }));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-05", span: 3 });
    await user.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(onChange).toHaveBeenLastCalledWith({ start: NOW, span: 1 });
  });

  it("sem período, ignora o span e não mostra a escolha de modo", async () => {
    const { user } = setup({ start: NOW, span: 3 }, false);
    expect(screen.getByRole("button", { name: /Novembro 2026/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Novembro 2026/ }));
    const dialog = await screen.findByRole("dialog", { name: "Escolher mês" });
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
  });

  it("no celular abre a grade numa folha de baixo e escolhe o mês", async () => {
    setViewportWidth(390);
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: /Novembro 2026/ }));
    const sheet = await screen.findByRole("dialog", { name: "Escolher mês ou período" });
    await user.click(within(sheet).getByRole("button", { name: "Janeiro de 2026" }));
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-01", span: 1 });
  });
});
