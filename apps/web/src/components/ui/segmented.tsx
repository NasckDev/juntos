"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Nome do grupo para leitores de tela ("Tipo do lançamento"). */
  label: string;
  /** `name` dos rádios (padrão: gerado). */
  name?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Escolha única entre 2 a 4 opções, como no protótipo: rádios nativos (setas do teclado funcionam sozinhas).
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  name,
  size = "md",
  className,
}: SegmentedProps<T>) {
  const auto = useId();
  const group = name ?? `seg${auto}`;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-[0.7rem] bg-surface3 p-1", className)}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label key={o.value} className="relative min-w-0">
            <input
              type="radio"
              name={group}
              value={o.value}
              checked={checked}
              onChange={() => onValueChange(o.value)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <span
              className={cn(
                "grid place-items-center rounded-[0.5rem] px-2 text-center font-medium text-muted transition-colors",
                "peer-hover:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
                "peer-checked:bg-surface peer-checked:font-semibold peer-checked:text-ink peer-checked:shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_var(--line)]",
                size === "md" ? "h-10 text-sm lg:h-8" : "h-8 text-xs lg:h-7",
              )}
            >
              {o.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
