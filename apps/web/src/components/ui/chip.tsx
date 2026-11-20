import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filtro ligado. Vira `aria-pressed`. */
  selected?: boolean;
  icon?: ReactNode;
}

/** Filtro em forma de pílula (Todos, Em aberto, Entradas…). */
export function Chip({ selected = false, icon, className, children, type, ...props }: ChipProps) {
  return (
    <button
      type={type ?? "button"}
      aria-pressed={selected}
      className={cn(
        "hit inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors lg:h-8",
        "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--line2)] hover:text-ink",
        "aria-pressed:bg-ink aria-pressed:text-surface aria-pressed:shadow-none [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
