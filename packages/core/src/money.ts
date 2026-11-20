import type { Cents } from "./types.ts";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PLAIN = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const THOUSANDS_ONLY = /^-?\d{1,3}(\.\d{3})+$/;
const DECIMAL = /^(-?)(\d*)(?:\.(\d*))?$/;

/**
 * Lê um valor digitado em pt-BR e devolve centavos inteiros, ou `null` se não for um número.
 * "1.200" = R$ 1.200,00 (grupos de três dígitos), "1.200,50" = R$ 1.200,50, "12,5" = R$ 12,50, "1.5" = R$ 1,50.
 * A conta é feita sobre os dígitos (sem ponto flutuante); a terceira casa decimal arredonda para cima a partir de 5.
 */
export function parseMoney(text: string | null | undefined): Cents | null {
  let s = String(text ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "");
  if (!/\d/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (THOUSANDS_ONLY.test(s)) s = s.replace(/\./g, "");
  const m = DECIMAL.exec(s);
  if (!m) return null;
  const whole = Number(m[2] || "0");
  const fraction = m[3] ?? "";
  const cents = Number(`${fraction}00`.slice(0, 2));
  const roundUp = Number(fraction.charAt(2) || "0") >= 5 ? 1 : 0;
  const total = whole * 100 + cents + roundUp;
  if (!Number.isSafeInteger(total)) return null;
  return m[1] === "-" ? -total || 0 : total;
}

/** Garante que o número é um inteiro seguro de centavos. */
export function assertCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Valor em centavos inválido: ${value}`);
  return value;
}

/** "R$ 1.234,56" */
export function formatBRL(cents: Cents): string {
  return BRL.format(cents / 100);
}

/** "R$ 1.235", sem centavos, para resumos e legendas. */
export function formatBRL0(cents: Cents): string {
  return BRL0.format(Math.round(cents / 100));
}

/** "1.234,56", sem o símbolo, para preencher campos de formulário. */
export function formatMoneyInput(cents: Cents): string {
  return PLAIN.format(cents / 100);
}

/** "1,2 mil", "850": rótulo curto para calendário e eixos. */
export function formatCompact(cents: Cents): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) {
    return `${(reais / 1000).toFixed(1).replace(".", ",").replace(",0", "")} mil`;
  }
  return String(Math.round(reais));
}

/** Nome usado pela especificação para {@link formatCompact}. */
export function formatBRLCompact(cents: Cents): string {
  return formatCompact(cents);
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}

/**
 * Divide `total` em partes proporcionais aos pesos, em centavos, pelo método do maior resto.
 * A soma das partes é sempre exatamente `total`. Pesos todos zero dividem em partes iguais.
 */
export function splitProportional(total: Cents, weights: readonly number[]): Cents[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) throw new RangeError("Pesos precisam ser números positivos");
  const sum = weights.reduce((a, w) => a + w, 0);
  const ws = sum === 0 ? weights.map(() => 1) : weights;
  const wsum = sum === 0 ? ws.length : sum;
  const raw = ws.map((w) => (total * w) / wsum);
  const parts = raw.map((r) => Math.floor(r));
  let rest = total - parts.reduce((a, p) => a + p, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    parts[i] = (parts[i] ?? 0) + 1;
    rest -= 1;
  }
  return parts;
}
