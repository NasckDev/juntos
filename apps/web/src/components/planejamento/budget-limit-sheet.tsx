"use client";

import { type FormEvent, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { setBudget } from "@/server/actions/budgets";
import { BUDGET_MESSAGES, MAX_BUDGET_CENTS } from "@/server/validators/budgets";
import { toastWithUndo } from "../financas/feedback";
import { MoneyDraftInput } from "./money-draft-input";
import { isInvalidMoney, type MoneyDraft, moneyDraftOf } from "./optional-money";

export interface BudgetLimitSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly spaceId: string;
  readonly category: { readonly id: string; readonly name: string };
  /** Limite mensal atual (centavos) ou `null`. */
  readonly current: number | null;
}

/** Definir, editar ou remover o limite mensal de uma categoria (`budedit` e `budf` do protótipo). */
export function BudgetLimitSheet({ open, onOpenChange, spaceId, category, current }: BudgetLimitSheetProps) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<MoneyDraft>(moneyDraftOf(current));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (isInvalidMoney(draft) || (draft.cents !== null && draft.cents <= 0)) return setError(BUDGET_MESSAGES.limit);
    if (draft.cents !== null && draft.cents > MAX_BUDGET_CENTS) return setError(BUDGET_MESSAGES.limitTooHigh);
    const limit = draft.cents;
    startTransition(async () => {
      const result = await setBudget({ spaceId, categoryId: category.id, limit });
      if (!result.ok) return setError(result.fieldErrors?.limit ?? result.error);
      onOpenChange(false);
      toastWithUndo(limit === null ? "Limite removido." : "Limite salvo.", null);
    });
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Limite de ${category.name}`}
      description="O máximo que vocês querem gastar por mês nesta categoria."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} aria-label={`Limite de ${category.name}`}>
        <Field label="Limite por mês" error={error} hint="Deixe vazio para tirar o limite.">
          <MoneyDraftInput
            draft={draft}
            onDraftChange={(next) => {
              setDraft(next);
              setError(null);
            }}
            placeholder="Sem limite"
            autoFocus
          />
        </Field>
      </form>
    </ResponsiveSheet>
  );
}
