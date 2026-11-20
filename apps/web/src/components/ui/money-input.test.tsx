import type { Cents } from "@juntos/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Field } from "./field";
import { MoneyInput } from "./money-input";

function Harness({ initial = null, onChange }: { initial?: Cents | null; onChange?: (v: Cents | null) => void }) {
  const [value, setValue] = useState<Cents | null>(initial);
  return (
    <Field label="Valor">
      <MoneyInput
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </Field>
  );
}

describe("MoneyInput", () => {
  it("abre o teclado numérico e mostra o prefixo R$", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Valor");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByText("R$")).toHaveAttribute("aria-hidden", "true");
  });

  it("lê o valor em pt-BR enquanto digita e formata ao sair do campo", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Valor");

    await user.type(input, "1200,5");
    expect(onChange).toHaveBeenLastCalledWith(120050);
    expect(input).toHaveValue("1200,5");

    await user.tab();
    expect(input).toHaveValue("1.200,50");
  });

  it("mostra o valor inicial formatado e entende milhar com ponto", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={8600} onChange={onChange} />);
    const input = screen.getByLabelText("Valor");
    expect(input).toHaveValue("86,00");

    await user.clear(input);
    await user.type(input, "1.200");
    expect(onChange).toHaveBeenLastCalledWith(120000);
    await user.tab();
    expect(input).toHaveValue("1.200,00");
  });

  it("mantém o texto que não é número, para a pessoa corrigir", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Valor");

    await user.type(input, "abc");
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.tab();
    expect(input).toHaveValue("abc");
  });
});
