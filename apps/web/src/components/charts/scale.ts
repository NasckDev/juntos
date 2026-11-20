import type { Cents } from "@juntos/core";

/**
 * Eixo com valores redondos (`barsChart` do protótipo): passo de 1, 2, 2,5, 5 ou 10 × 10ⁿ reais,
 * cerca de 4 divisões, topo arredondado para cima.
 */
export function niceTicks(maxCents: Cents, divisions = 4): { top: Cents; ticks: Cents[] } {
  const max = Math.max(1, maxCents / 100);
  const raw = max / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * magnitude).find((k) => k >= raw) ?? 10 * magnitude;
  const top = step * Math.ceil(max / step);
  const ticks: Cents[] = [];
  for (let i = 0; i * step <= top + 1e-9; i += 1) ticks.push(Math.round(i * step * 100));
  return { top: Math.round(top * 100), ticks };
}

const ONE_DECIMAL = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Rótulo curto do eixo: "R$ 0", "R$ 500", "R$ 2,5 mil", "R$ 1,2 mi". */
export function axisLabel(cents: Cents): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1e6) return `R$ ${ONE_DECIMAL.format(reais / 1e6)} mi`;
  if (Math.abs(reais) >= 1e3) return `R$ ${ONE_DECIMAL.format(reais / 1e3)} mil`;
  return `R$ ${Math.round(reais)}`;
}

/** Percentual inteiro de `part` em `total` (0 quando não há total). */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
