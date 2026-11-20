import { cn } from "@/lib/cn";

export type ProgressTone = "brand" | "in" | "warn" | "out" | "auto";
type ResolvedTone = Exclude<ProgressTone, "auto">;

export interface ProgressProps {
  value: number;
  max: number;
  /** Nome acessível: "Mercado, 89% do limite". */
  label: string;
  /** `auto`: verde até 85 %, alerta até 100 %, vermelho acima (regra do orçamento no protótipo). */
  tone?: ProgressTone;
  size?: "sm" | "md";
  className?: string;
}

const FILL: Record<ResolvedTone, string> = {
  brand: "bg-brand",
  in: "bg-in",
  warn: "bg-warn",
  out: "bg-out",
};

/** Cor da barra de orçamento pelo percentual usado (`budgetMini` no protótipo). */
export function budgetTone(pct: number): "in" | "warn" | "out" {
  if (pct > 100) return "out";
  if (pct >= 85) return "warn";
  return "in";
}

export function Progress({ value, max, label, tone = "brand", size = "md", className }: ProgressProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const resolved: ResolvedTone = tone === "auto" ? budgetTone(pct) : tone;
  const width = Math.min(Math.max(pct, 0), 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-valuetext={`${pct}%`}
      className={cn("overflow-hidden rounded-full bg-surface3", size === "md" ? "h-2" : "h-1.5", className)}
    >
      <div className={cn("h-full rounded-full", FILL[resolved])} style={{ width: `${width}%` }} />
    </div>
  );
}
