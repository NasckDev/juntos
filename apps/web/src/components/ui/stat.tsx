import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { HideValue } from "./hide-value";

export type StatTone = "ink" | "in" | "out" | "save" | "warn";

const TONE: Record<StatTone, string> = {
  ink: "text-ink",
  in: "text-in",
  out: "text-out",
  save: "text-save",
  warn: "text-warn",
};

export interface StatProps {
  label: ReactNode;
  /** Valor já formatado (ex.: `formatBRL(cents)`). */
  value: ReactNode;
  /** Linha de apoio: "4% acima de outubro". */
  hint?: ReactNode;
  tone?: StatTone;
  /** Valor em dinheiro: desfoca com "esconder valores". Padrão: sim. */
  money?: boolean;
  size?: "md" | "lg";
  className?: string;
}

export function Stat({ label, value, hint, tone = "ink", money = true, size = "md", className }: StatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={cn("mt-0.5 font-[650] tracking-[-0.02em]", size === "lg" ? "text-2xl" : "text-xl", TONE[tone])}>
        {money ? <HideValue>{value}</HideValue> : <span className="num">{value}</span>}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
