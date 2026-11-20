import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";

describe("Field", () => {
  it("liga rótulo e dica ao campo sem marcar erro", () => {
    render(
      <Field label="Descrição" hint="Como aparece na lista">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Descrição");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Como aparece na lista");
  });

  it("mostra o erro embaixo do campo com aria-invalid e aria-describedby", () => {
    render(
      <Field
        label="Descrição"
        hint="Como aparece na lista"
        error="Escreva uma descrição, por exemplo: Mercado."
        required
      >
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Descrição");
    const alert = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(alert).toHaveTextContent("Escreva uma descrição, por exemplo: Mercado.");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(alert.id);
    expect(input).toHaveAccessibleDescription("Como aparece na lista Escreva uma descrição, por exemplo: Mercado.");
    // o erro vem depois do campo no DOM (embaixo)
    expect(input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("vale também para o select", () => {
    render(
      <Field label="Categoria" error="Escolha uma categoria.">
        <Select options={[{ value: "mercado", label: "Mercado" }]} placeholder="Escolha…" />
      </Field>,
    );
    const select = screen.getByLabelText("Categoria");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Escolha uma categoria.");
  });
});
