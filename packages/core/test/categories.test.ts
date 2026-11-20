import { describe, expect, it } from "vitest";
import { categoryById, categoryByName, DEFAULT_CATEGORIES, guessCategory } from "../src/categories.ts";

describe("categorias padrão", () => {
  it("tem as 13 do protótipo com ids únicos", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(13);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(13);
  });
});

describe("guessCategory", () => {
  it.each([
    ["Aluguel", "out", "moradia"],
    ["Condomínio", "out", "moradia"],
    ["Cartão Nubank", "out", "cartao"],
    ["Conta de luz", "out", "contas"],
    ["Internet", "out", "contas"],
    ["Netflix", "out", "assin"],
    ["Plano de saúde", "out", "saude"],
    ["Curso de inglês", "out", "educ"],
    ["IPVA", "out", "transp"],
    ["Restaurante", "out", "lazer"],
    ["Mercado do mês", "out", "mercado"],
    ["Coisa qualquer", "out", "outros"],
    ["Salário Ana", "in", "salario"],
    ["13º", "in", "salario"],
    ["Freela", "in", "extra"],
    ["Qualquer coisa", "save", "reserva"],
  ] as const)("%s (%s) vira %s", (description, kind, expected) => {
    expect(guessCategory(description, kind)).toBe(expected);
  });
});

describe("busca de categorias", () => {
  it("acha por id e cai em Outros se o id não existe", () => {
    expect(categoryById("mercado").name).toBe("Mercado");
    expect(categoryById("nao-existe").id).toBe("outros");
  });

  it("tem um Outros de reserva se a lista não o contém", () => {
    expect(categoryById("x", []).id).toBe("outros");
  });

  it("acha por nome e tipo, sem diferenciar maiúsculas", () => {
    expect(categoryByName(" salário ", "in")?.id).toBe("salario");
    expect(categoryByName("Salário", "out")).toBeUndefined();
  });
});
