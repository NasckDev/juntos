import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacidadePage from "@/app/privacidade/page";
import TermosPage from "@/app/termos/page";

describe("páginas legais", () => {
  it("a política de privacidade explica dados, direitos e contato", () => {
    render(<PrivacidadePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeInTheDocument();
    for (const title of ["Quais dados guardamos", "Seus direitos e controles", "Contato"]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    const contact = screen.getByRole("link", { name: "github.com/NasckDev/juntos" });
    expect(contact).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("os termos levam à privacidade e à entrada", () => {
    render(<TermosPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Política de privacidade" })).toHaveAttribute("href", "/privacidade");
    expect(screen.getByRole("link", { name: "Entrar no Juntos" })).toHaveAttribute("href", "/entrar");
  });
});
