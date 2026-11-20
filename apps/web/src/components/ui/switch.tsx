"use client";

import { Switch as RadixSwitch } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** Linha menor embaixo do rótulo. */
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Interruptor com rótulo clicável, como as linhas de Ajustes do protótipo. */
export function Switch({ checked, onCheckedChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex min-h-11 items-center gap-3", className)}>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-medium">{label}</span>
        {description ? (
          <span id={descId} className="block text-sm text-muted">
            {description}
          </span>
        ) : null}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={descId}
        className={cn(
          "hit relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-line2 transition-colors",
          "data-[state=checked]:bg-brand disabled:opacity-50",
        )}
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-transform data-[state=checked]:translate-x-[1.125rem]" />
      </RadixSwitch.Root>
    </div>
  );
}
