import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./segmented";

type Kind = "out" | "in" | "save";
const OPTIONS = [
  { value: "out", label: "Saída" },
  { value: "in", label: "Entrada" },
  { value: "save", label: "Guardado" },
] as const;

function Harness({ onChange }: { onChange: (v: Kind) => void }) {
  const [value, setValue] = useState<Kind>("out");
  return (
    <Segmented
      label="Tipo do lançamento"
      options={OPTIONS}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("Segmented", () => {
  it("é um grupo de rádios com nome e uma opção marcada", () => {
    render(<Harness onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Tipo do lançamento" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Saída" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Entrada" })).not.toBeChecked();
  });

  it("troca a opção com clique", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByText("Guardado"));
    expect(onChange).toHaveBeenCalledWith("save");
    expect(screen.getByRole("radio", { name: "Guardado" })).toBeChecked();
  });

  it("troca a opção com as setas do teclado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "Saída" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("in");
    expect(screen.getByRole("radio", { name: "Entrada" })).toBeChecked();
  });
});
