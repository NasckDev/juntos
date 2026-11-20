"use client";

import { MoneyInput, type MoneyInputProps } from "@/components/ui/money-input";
import { type MoneyDraft, moneyDraftFromText } from "./optional-money";

export interface MoneyDraftInputProps extends Omit<MoneyInputProps, "value" | "onValueChange" | "onInput"> {
  draft: MoneyDraft;
  onDraftChange: (draft: MoneyDraft) => void;
}

/** `MoneyInput` que guarda também o texto digitado, para campos opcionais saberem o que é vazio e o que é inválido. */
export function MoneyDraftInput({ draft, onDraftChange, ...props }: MoneyDraftInputProps) {
  return (
    <MoneyInput
      {...props}
      value={draft.cents}
      onValueChange={() => undefined}
      onInput={(event) => onDraftChange(moneyDraftFromText(event.currentTarget.value))}
    />
  );
}
