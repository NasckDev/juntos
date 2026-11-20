import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_PATH, firstParam, safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("aceita caminhos internos, com consulta e âncora", () => {
    expect(safeReturnPath("/lancamentos")).toBe("/lancamentos");
    expect(safeReturnPath("/lancamentos?mes=2026-11&q=luz")).toBe("/lancamentos?mes=2026-11&q=luz");
    expect(safeReturnPath("/ajustes/pessoas#convite")).toBe("/ajustes/pessoas#convite");
    expect(safeReturnPath("/convite/abc_DEF-123")).toBe("/convite/abc_DEF-123");
  });

  it.each([
    "https://evil.example.com",
    "http://evil.example.com/inicio",
    "//evil.example.com",
    "//evil.example.com/inicio",
    "/\\evil.example.com",
    "\\\\evil.example.com",
    "/\\/evil.example.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "inicio",
    "evil.example.com",
    " /inicio",
    "/\t/evil.example.com",
    "/\n/evil.example.com",
    "/inicio\r\nSet-Cookie: x=1",
    "/\u0000",
    "",
  ])("recusa %j", (value) => {
    expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
  });

  it("não deixa o destino sair do domínio nem com codificação", () => {
    const result = safeReturnPath("/%2F%2Fevil.example.com");
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
  });

  it("não volta para a própria tela de entrada (evita laço)", () => {
    expect(safeReturnPath("/entrar")).toBe(DEFAULT_RETURN_PATH);
    expect(safeReturnPath("/entrar?voltar=/inicio")).toBe(DEFAULT_RETURN_PATH);
  });

  it("recusa tipos que não são texto e textos enormes", () => {
    expect(safeReturnPath(undefined)).toBe(DEFAULT_RETURN_PATH);
    expect(safeReturnPath(null)).toBe(DEFAULT_RETURN_PATH);
    expect(safeReturnPath(["/inicio"])).toBe(DEFAULT_RETURN_PATH);
    expect(safeReturnPath(`/${"a".repeat(3000)}`)).toBe(DEFAULT_RETURN_PATH);
  });

  it("usa o destino alternativo quando pedido", () => {
    expect(safeReturnPath("https://evil.example.com", "/ajustes")).toBe("/ajustes");
  });
});

describe("firstParam", () => {
  it("pega o primeiro valor de um parâmetro repetido", () => {
    expect(firstParam(["/a", "/b"])).toBe("/a");
    expect(firstParam("/a")).toBe("/a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});
