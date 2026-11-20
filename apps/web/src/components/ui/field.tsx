"use client";

import { createContext, type ReactNode, use, useId } from "react";
import { cn } from "@/lib/cn";

interface FieldControl {
  id: string;
  invalid: boolean;
  describedBy: string | undefined;
  required: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/**
 * Props de acessibilidade para o controle dentro de um `Field`. `Input`, `MoneyInput`, `Select` e `Textarea`
 * já chamam isto; use em controles próprios.
 */
export function useFieldControl(own?: { id?: string | undefined; "aria-describedby"?: string | undefined }) {
  const ctx = use(FieldContext);
  if (!ctx) return { id: own?.id, "aria-describedby": own?.["aria-describedby"] };
  const describedBy = [own?.["aria-describedby"], ctx.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    id: own?.id ?? ctx.id,
    "aria-invalid": ctx.invalid ? (true as const) : undefined,
    "aria-describedby": describedBy,
    "aria-required": ctx.required ? (true as const) : undefined,
  };
}

export interface FieldProps {
  label: ReactNode;
  /** Texto de ajuda, embaixo do rótulo e antes do erro. */
  hint?: ReactNode;
  /** Mensagem de erro (do protótipo, em português). Liga `aria-invalid` no controle. */
  error?: string | null | undefined;
  /** Marca o controle como obrigatório para leitores de tela. */
  required?: boolean;
  /** Força o id do controle (padrão: gerado). */
  id?: string;
  /** Esconde o rótulo visualmente, mantendo para leitores de tela. */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}

/** Rótulo + controle + dica + erro embaixo, ligados por `aria-describedby`. */
export function Field({ label, hint, error, required = false, id, hideLabel, className, children }: FieldProps) {
  const auto = useId();
  const controlId = id ?? `f${auto}`;
  const hintId = hint ? `${controlId}-dica` : undefined;
  const errorId = error ? `${controlId}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className={cn("text-sm font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      <FieldContext value={{ id: controlId, invalid: Boolean(error), describedBy, required }}>{children}</FieldContext>
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-out">
          {error}
        </p>
      ) : null}
    </div>
  );
}
