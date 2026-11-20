"use client";

import { ChevronDown } from "lucide-react";
import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";
import { fieldClasses } from "./input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectOption[];
  /** Primeira opção vazia ("Escolha…"). */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Select nativo (melhor no celular e para leitores de tela) com o visual dos campos. */
export function Select({
  options,
  placeholder,
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: SelectProps) {
  const a11y = useFieldControl({ id, "aria-describedby": describedBy });
  return (
    <div className={cn("relative min-w-0", className)}>
      <select className={cn(fieldClasses, "h-11 appearance-none pr-9 lg:h-10")} {...a11y} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
