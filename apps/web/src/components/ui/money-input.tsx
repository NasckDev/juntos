"use client";

import { type Cents, formatMoneyInput, parseMoney } from "@juntos/core";
import { type FocusEvent, type InputHTMLAttributes, type Ref, useState } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";
import { fieldClasses } from "./input";

export interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "size"> {
  /** Valor em centavos inteiros; `null` = vazio. */
  value: Cents | null;
  /** Chamado a cada digitação com o valor lido em pt-BR (`parseMoney`), ou `null` se não for número. */
  onValueChange: (cents: Cents | null) => void;
  /** `lg`: o valor principal do formulário de lançamento. */
  size?: "md" | "lg";
  ref?: Ref<HTMLInputElement>;
}

/**
 * Campo de dinheiro: prefixo "R$", teclado numérico (`inputMode="decimal"`) e formatação ao sair
 * ("1200,5" vira "1.200,50"). Enquanto a pessoa digita, o texto não é mexido.
 */
export function MoneyInput({
  value,
  onValueChange,
  size = "md",
  className,
  id,
  onFocus,
  onBlur,
  "aria-describedby": describedBy,
  ...props
}: MoneyInputProps) {
  const a11y = useFieldControl({ id, "aria-describedby": describedBy });
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = value === null ? "" : formatMoneyInput(value);
  const shown = draft ?? formatted;

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setDraft(formatted);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const text = event.target.value;
    const parsed = parseMoney(text);
    // Texto que não é número fica como está, para a pessoa ver e corrigir junto com a mensagem de erro.
    setDraft(parsed === null && text.trim() !== "" ? text : null);
    onBlur?.(event);
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-semibold text-muted",
          size === "lg" ? "text-lg" : "text-base lg:text-md",
        )}
      >
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          fieldClasses,
          "num",
          size === "lg"
            ? "h-14 pl-12 text-2xl font-[650] tracking-[-0.02em] lg:h-14 lg:text-2xl"
            : "h-11 pl-10 lg:h-10",
        )}
        value={shown}
        onChange={(event) => {
          setDraft(event.target.value);
          onValueChange(parseMoney(event.target.value));
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...a11y}
        {...props}
      />
    </div>
  );
}
