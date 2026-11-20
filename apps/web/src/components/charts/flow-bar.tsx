import { type Cents, formatBRL0 } from "@juntos/core";
import { cn } from "@/lib/cn";

export interface FlowBarProps {
  /** Saídas já pagas. */
  paid: Cents;
  /** Saídas que ainda vão ser pagas. */
  due: Cents;
  /** Guardado no período. */
  saved: Cents;
  /** Sobra prevista (entrou − saiu − guardou). Negativa = falta. */
  left: Cents;
  /** `hero`: dentro do resumo escuro; `surface`: num painel comum. */
  tone?: "hero" | "surface";
  className?: string;
}

/**
 * Barra de destino do dinheiro (Início): já pago, falta pagar (hachurado), guardado e sobra.
 * A barra é decorativa; a legenda em lista leva os valores para todos.
 */
export function FlowBar({ paid, due, saved, left, tone = "surface", className }: FlowBarProps) {
  const short = left < 0;
  const segments = [
    { key: "paid", label: "Já pago", value: paid, swatch: "bg-flow-paid", fill: "bg-flow-paid" },
    { key: "due", label: "Falta pagar", value: due, swatch: "flow-due", fill: "flow-due" },
    { key: "save", label: "Guardado", value: saved, swatch: "bg-flow-save", fill: "bg-flow-save" },
    {
      key: "left",
      label: short ? "Falta" : "Sobra",
      value: Math.abs(left),
      swatch: short ? "bg-out" : "bg-flow-left",
      fill: "bg-flow-left",
    },
  ] as const;
  const total = paid + due + saved + Math.max(left, 0);
  const muted = tone === "hero" ? "text-hero-mute" : "text-muted";
  const strong = tone === "hero" ? "text-hero-ink" : "text-ink";

  return (
    <div className={cn("min-w-0", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "flex h-2.5 gap-0.5 overflow-hidden rounded-full",
          tone === "hero" ? "bg-hero-track" : "bg-surface3",
        )}
      >
        {segments.map((s) =>
          s.key === "left" && short ? null : (
            <i
              key={s.key}
              className={cn("block min-w-0", s.fill)}
              style={{ flexGrow: total > 0 ? s.value / total : 0, flexBasis: 0 }}
            />
          ),
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key} className={cn("flex items-center gap-1.5 whitespace-nowrap", muted)}>
            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-[0.2rem]", s.swatch)} />
            {s.label}
            <b className={cn("hv num font-semibold", s.key === "left" && short ? "text-out" : strong)}>
              {formatBRL0(s.value)}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}
