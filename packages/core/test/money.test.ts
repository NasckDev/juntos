import { describe, expect, it } from "vitest";
import {
  assertCents,
  formatBRL,
  formatBRL0,
  formatBRLCompact,
  formatCompact,
  formatMoneyInput,
  parseMoney,
  splitProportional,
  sumCents,
} from "../src/money.ts";
import { plain } from "./fixtures/builders.ts";

describe("parseMoney", () => {
  it.each([
    ["1.200", 120000],
    ["1.200,50", 120050],
    ["12,5", 1250],
    ["1.5", 150],
    ["120,50", 12050],
    ["R$ 1.234,56", 123456],
    ["1.234.567", 123456700],
    ["0,005", 1],
    ["1,005", 101],
    ["1,004", 100],
    ["5.", 500],
    [".5", 50],
    ["-12,30", -1230],
    ["-0", 0],
    ["  7  ", 700],
  ])("lê %j como %i centavos", (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
  });

  it.each([["abc"], [""], ["   "], ["-"], ["."], ["1,2,3"], ["12-3"], ["--5"], ["9".repeat(30)]])(
    "devolve null para %j",
    (text) => {
      expect(parseMoney(text)).toBeNull();
    },
  );

  it("devolve null para null e undefined", () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
  });
});

describe("assertCents", () => {
  it("aceita inteiro e recusa fração", () => {
    expect(assertCents(150)).toBe(150);
    expect(() => assertCents(1.5)).toThrow(RangeError);
    expect(() => assertCents(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatação", () => {
  it("formata em reais", () => {
    expect(plain(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(plain(formatBRL0(123456))).toBe("R$ 1.235");
    expect(formatMoneyInput(123456)).toBe("1.234,56");
  });

  it("abrevia valores para eixos", () => {
    expect(formatCompact(85000)).toBe("850");
    expect(formatCompact(120000)).toBe("1,2 mil");
    expect(formatCompact(200000)).toBe("2 mil");
    expect(formatBRLCompact(-150000)).toBe("-1,5 mil");
  });

  it("soma centavos", () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(sumCents([])).toBe(0);
  });
});

describe("splitProportional", () => {
  it("divide centavos ímpares sem perder 1 centavo", () => {
    const parts = splitProportional(10001, [1, 1]);
    expect(parts).toEqual([5001, 5000]);
    expect(sumCents(parts)).toBe(10001);
  });

  it("divide por 3 mantendo a soma exata", () => {
    const parts = splitProportional(100, [1, 1, 1]);
    expect(sumCents(parts)).toBe(100);
    expect([...parts].sort()).toEqual([33, 33, 34]);
  });

  it("respeita os pesos", () => {
    expect(splitProportional(1000, [3, 1])).toEqual([750, 250]);
  });

  it("pesos todos zero dividem em partes iguais", () => {
    expect(splitProportional(10, [0, 0])).toEqual([5, 5]);
  });

  it("lista vazia devolve vazio e peso negativo é erro", () => {
    expect(splitProportional(100, [])).toEqual([]);
    expect(() => splitProportional(100, [1, -1])).toThrow(RangeError);
    expect(() => splitProportional(100, [Number.NaN])).toThrow(RangeError);
  });
});
