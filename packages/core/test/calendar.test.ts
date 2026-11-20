import { describe, expect, it } from "vitest";
import {
  clampDay,
  daysIn,
  isoDateOf,
  isRealDate,
  isYearMonth,
  monthName,
  monthShort,
  monthsBetween,
  parseYearMonth,
  periodLabel,
  periodMonths,
  previousPeriod,
  todayInSaoPaulo,
  todayParts,
  ymAdd,
  ymDiff,
  ymLabel,
  ymOf,
} from "../src/calendar.ts";

describe("meses", () => {
  it("soma e subtrai meses atravessando o ano", () => {
    expect(ymAdd("2026-11", 3)).toBe("2027-02");
    expect(ymAdd("2026-01", -1)).toBe("2025-12");
    expect(ymAdd("2026-12", 12)).toBe("2027-12");
  });

  it("calcula a diferença em meses", () => {
    expect(ymDiff("2026-11", "2027-02")).toBe(3);
    expect(ymDiff("2027-02", "2026-11")).toBe(-3);
  });

  it("conhece o tamanho do mês, inclusive fevereiro de ano bissexto", () => {
    expect(daysIn("2026-02")).toBe(28);
    expect(daysIn("2028-02")).toBe(29);
    expect(daysIn("2026-04")).toBe(30);
    expect(daysIn("2026-12")).toBe(31);
  });

  it("ajusta o dia ao fim do mês (31 de fevereiro)", () => {
    expect(clampDay("2026-02", 31)).toBe(28);
    expect(clampDay("2028-02", 31)).toBe(29);
    expect(clampDay("2026-04", 31)).toBe(30);
    expect(clampDay("2026-03", 31)).toBe(31);
    expect(clampDay("2026-03", 0)).toBe(1);
  });

  it("valida e interpreta AAAA-MM", () => {
    expect(isYearMonth("2026-11")).toBe(true);
    expect(isYearMonth("2026-13")).toBe(false);
    expect(parseYearMonth("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(() => parseYearMonth("2026-3")).toThrow(RangeError);
  });

  it("monta rótulos", () => {
    expect(ymOf(2026, 3)).toBe("2026-03");
    expect(monthName("2026-03")).toBe("Março");
    expect(monthShort("2026-11")).toBe("nov/26");
    expect(ymLabel("2026-11")).toBe("Novembro 2026");
  });
});

describe("períodos", () => {
  it("lista os meses de um período que atravessa o ano", () => {
    expect(periodMonths("2026-11", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("calcula o período anterior de mesmo tamanho", () => {
    expect(previousPeriod("2026-11", 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(previousPeriod("2027-01", 2)).toEqual(["2026-11", "2026-12"]);
  });

  it("recusa período inválido", () => {
    expect(() => periodMonths("2026-11", 0)).toThrow(RangeError);
    expect(() => periodMonths("2026-11", 1.5)).toThrow(RangeError);
  });

  it("rotula períodos", () => {
    expect(periodLabel("2026-11", 1)).toBe("Novembro 2026");
    expect(periodLabel("2026-09", 3)).toBe("Set – Nov 2026");
    expect(periodLabel("2026-11", 3)).toBe("Nov 2026 – Jan 2027");
  });

  it("lista meses entre dois extremos, vazio se invertidos", () => {
    expect(monthsBetween("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(monthsBetween("2026-11", "2026-11")).toEqual(["2026-11"]);
    expect(monthsBetween("2026-12", "2026-11")).toEqual([]);
  });
});

describe("datas", () => {
  it("separa o mês e o dia de hoje", () => {
    expect(todayParts("2026-11-19")).toEqual({ ym: "2026-11", day: 19 });
    expect(() => todayParts("2026-02-3")).toThrow(RangeError);
  });

  it("não aceita 31 de fevereiro nem 29 de fevereiro fora de ano bissexto", () => {
    expect(isRealDate(2026, 2, 31)).toBe(false);
    expect(isRealDate(2026, 2, 29)).toBe(false);
    expect(isRealDate(2028, 2, 29)).toBe(true);
    expect(isRealDate(2026, 13, 1)).toBe(false);
    expect(isRealDate(2026, 4, 0)).toBe(false);
    expect(isRealDate(2026, 4, 1.5)).toBe(false);
  });

  it("monta datas ISO", () => {
    expect(isoDateOf(2026, 3, 5)).toBe("2026-03-05");
  });

  it("calcula hoje em São Paulo a partir de um instante", () => {
    expect(todayInSaoPaulo(new Date("2026-11-20T01:30:00Z"))).toBe("2026-11-19");
    expect(todayInSaoPaulo(new Date("2026-11-20T12:00:00Z"))).toBe("2026-11-20");
    expect(todayInSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
