import type { IsoDate, YearMonth } from "./types.ts";

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Período máximo nas telas (Início, Lista, Orçamento, Divisão, Relatórios). */
export const MAX_SCREEN_SPAN = 3;
/** Período máximo na exportação. */
export const MAX_EXPORT_SPAN = 36;

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isYearMonth(value: string): boolean {
  return YM.test(value);
}

export function parseYearMonth(ym: YearMonth): { year: number; month: number } {
  const m = YM.exec(ym);
  if (!m) throw new RangeError(`Mês inválido: ${ym}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function ymOf(year: number, month: number): YearMonth {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function ymAdd(ym: YearMonth, months: number): YearMonth {
  const { year, month } = parseYearMonth(ym);
  const total = year * 12 + (month - 1) + months;
  return ymOf(Math.floor(total / 12), (total % 12) + 1);
}

/** Meses de `from` até `to` (positivo se `to` vem depois). */
export function ymDiff(from: YearMonth, to: YearMonth): number {
  const a = parseYearMonth(from);
  const b = parseYearMonth(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function daysIn(ym: YearMonth): number {
  const { year, month } = parseYearMonth(ym);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthName(ym: YearMonth): string {
  return MONTH_NAMES[parseYearMonth(ym).month - 1] as string;
}

/** "nov/26" */
export function monthShort(ym: YearMonth): string {
  return `${monthName(ym).slice(0, 3).toLowerCase()}/${ym.slice(2, 4)}`;
}

/** "Novembro 2026" */
export function ymLabel(ym: YearMonth): string {
  return `${monthName(ym)} ${ym.slice(0, 4)}`;
}

/** Os `span` meses a partir de `start`. */
export function periodMonths(start: YearMonth, span: number): YearMonth[] {
  if (!Number.isInteger(span) || span < 1) throw new RangeError(`Período inválido: ${span}`);
  return Array.from({ length: span }, (_, i) => ymAdd(start, i));
}

/** O período de mesmo tamanho imediatamente anterior. */
export function previousPeriod(start: YearMonth, span: number): YearMonth[] {
  return periodMonths(ymAdd(start, -span), span);
}

/** "Nov – Jan 2027", ou "Novembro 2026" para um mês só. */
export function periodLabel(start: YearMonth, span: number): string {
  if (span <= 1) return ymLabel(start);
  const end = ymAdd(start, span - 1);
  const short = (ym: YearMonth) => `${monthName(ym).slice(0, 3)} ${ym.slice(0, 4)}`;
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${monthName(start).slice(0, 3)} – ${short(end)}`
    : `${short(start)} – ${short(end)}`;
}

export function todayParts(today: IsoDate): { ym: YearMonth; day: number } {
  const m = ISO.exec(today);
  if (!m) throw new RangeError(`Data inválida: ${today}`);
  return { ym: `${m[1]}-${m[2]}`, day: Number(m[3]) };
}

/** Data de hoje em America/Sao_Paulo. Use na borda (servidor ou cliente), nunca dentro das regras. */
export function todayInSaoPaulo(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** Ajusta o dia ao tamanho do mês (31 em fevereiro vira 28 ou 29). */
export function clampDay(ym: YearMonth, day: number): number {
  return Math.min(Math.max(1, Math.trunc(day)), daysIn(ym));
}

/** Todos os meses de `from` até `to`, inclusive. Vazio se `from` vem depois de `to`. */
export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const count = ymDiff(from, to) + 1;
  return count < 1 ? [] : periodMonths(from, count);
}

/** Verdadeiro se o dia existe no calendário (31 de fevereiro não existe; 29 de fevereiro só em ano bissexto). */
export function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysIn(ymOf(year, month));
}

export function isoDateOf(year: number, month: number, day: number): IsoDate {
  return `${ymOf(year, month)}-${String(day).padStart(2, "0")}`;
}
