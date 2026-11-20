import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

const Icon = () => <svg data-testid="icone" aria-hidden="true" />;

describe("Button", () => {
  it("botão comum: ícone antes do texto e type=button por padrão", () => {
    render(<Button icon={<Icon />}>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toHaveAttribute("type", "button");
    expect(button.firstElementChild).toBe(screen.getByTestId("icone"));
  });

  it("com asChild, o filho ganha o visual do botão e o ícone vai para dentro dele, antes do texto", () => {
    render(
      <Button asChild variant="line" icon={<Icon />} className="extra">
        <a href="/dados?aba=exportar">Exportar o ano</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Exportar o ano" });
    expect(link).toHaveAttribute("href", "/dados?aba=exportar");
    expect(link).toHaveClass("extra", "rounded-field");
    expect(link.firstElementChild).toBe(screen.getByTestId("icone"));
    expect(link).toHaveTextContent("Exportar o ano");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
