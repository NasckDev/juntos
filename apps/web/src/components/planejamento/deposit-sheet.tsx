"use client";

import { formatBRL, monthName, todayParts, validateDeposit } from "@juntos/core";
import { type FormEvent, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { depositToGoal } from "@/server/actions/goals";
import { deleteTransaction } from "@/server/actions/transactions";
import type { GoalView } from "@/server/services/finance-types";
import { toastWithUndo } from "../financas/feedback";

export interface DepositSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly spaceId: string;
  readonly goal: GoalView;
  readonly today: string;
  /** A meta chegou ao valor com este depósito (abre a celebração). */
  readonly onReached: (goal: GoalView) => void;
}

/** "Guardar nesta meta" (`A.deposit` e `depf` do protótipo): o valor vira lançamento Guardado deste mês. */
export function DepositSheet({ open, onOpenChange, spaceId, goal, today, onReached }: DepositSheetProps) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const left = Math.max(goal.target - goal.saved, 0);
  const [amount, setAmount] = useState<number | null>(goal.monthly > 0 ? Math.min(goal.monthly, left) : null);
  const [error, setError] = useState<string | null>(null);
  const month = monthName(todayParts(today).ym).toLowerCase();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const check = validateDeposit(
      { id: goal.id, name: goal.name, target: goal.target, saved: goal.saved, monthly: goal.monthly },
      amount,
    );
    if (!check.ok) return setError(check.error);
    startTransition(async () => {
      const result = await depositToGoal({ spaceId, goalId: goal.id, amount: check.amount });
      if (!result.ok) return setError(result.fieldErrors?.amount ?? result.error);
      onOpenChange(false);
      if (result.data.reached) return onReached(goal);
      const { transactionId } = result.data;
      toastWithUndo("Valor guardado na meta.", () => deleteTransaction({ spaceId, id: transactionId }));
    });
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Guardar em “${goal.name}”`}
      description={`Faltam ${formatBRL(left)}. O valor entra como “Guardado” em ${month}.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} aria-label={`Guardar em ${goal.name}`}>
        <Field label="Valor" error={error} required>
          <MoneyInput
            value={amount}
            placeholder="0,00"
            autoFocus
            onValueChange={(next) => {
              setAmount(next);
              setError(null);
            }}
          />
        </Field>
      </form>
    </ResponsiveSheet>
  );
}
