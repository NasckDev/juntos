import { type Cents, formatBRL, formatBRL0 } from "@juntos/core";
import { cn } from "@/lib/cn";
import { ChartTable } from "./chart-table";
import { percentOf } from "./scale";

export interface DonutPart {
  id: string;
  label: string;
  value: Cents;
  /** Cor CSS da categoria (`hsl(hue 52% 56%)` no protótipo). */
  color: string;
}

export interface DonutProps {
  parts: readonly DonutPart[];
  /** Texto no centro, acima do total. */
  centerLabel?: string;
  /** Nome do gráfico para leitores de tela. */
  title?: string;
  /** Quantas fatias antes de "Demais categorias". */
  top?: number;
  className?: string;
}

const R = 58;
const C = 2 * Math.PI * R;
const REST_COLOR = "var(--line2)";

/** Agrupa as maiores fatias e soma o resto em "Demais categorias" (`catBreak` do protótipo). */
export function donutSlices(parts: readonly DonutPart[], top = 5): DonutPart[] {
  const sorted = [...parts].filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((acc, p) => acc + p.value, 0);
  return rest > 0 ? [...head, { id: "_demais", label: "Demais categorias", value: rest, color: REST_COLOR }] : head;
}

/** Rosca com as 5 maiores categorias + demais, total no centro e legenda com valor e percentual. */
export function Donut({
  parts,
  centerLabel = "Saídas",
  title = "Saídas por categoria",
  top = 5,
  className,
}: DonutProps) {
  const slices = donutSlices(parts, top);
  const total = slices.reduce((acc, p) => acc + p.value, 0);
  let offset = 0;
  const arcs = slices.map((p) => {
    const len = total ? (p.value / total) * C : 0;
    const arc = { ...p, dash: Math.max(len - 2, 0), offset };
    offset += len;
    return arc;
  });

  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7", className)}>
      <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false" className="size-40 shrink-0 lg:size-44">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--surface3)" strokeWidth="18" />
        {arcs.map((a) => (
          <circle
            key={a.id}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="18"
            strokeDasharray={`${a.dash} ${C}`}
            strokeDashoffset={-a.offset}
            transform="rotate(-90 80 80)"
          />
        ))}
        <text x="80" y="73" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--muted)">
          {centerLabel}
        </text>
        <text className="hv num" x="80" y="94" textAnchor="middle" fontSize="16" fontWeight="750" fill="var(--ink)">
          {formatBRL0(total)}
        </text>
      </svg>
      <ul aria-label={title} className="w-full min-w-0 flex-1">
        {slices.map((p) => (
          <li key={p.id} className="flex min-h-9 items-center gap-2.5 border-t border-line py-1.5 first:border-t-0">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <b className="hv num font-semibold">{formatBRL0(p.value)}</b>
            <span className="num w-10 shrink-0 text-right text-sm text-muted">{percentOf(p.value, total)}%</span>
          </li>
        ))}
      </ul>
      <ChartTable
        mode="hidden"
        caption={`${title}, total ${formatBRL(total)}`}
        columns={["Categoria", "Valor", "Parte do total"]}
        rows={slices.map((p) => [p.label, formatBRL(p.value), `${percentOf(p.value, total)}%`])}
      />
    </div>
  );
}
