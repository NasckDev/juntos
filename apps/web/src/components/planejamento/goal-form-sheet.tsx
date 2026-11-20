"use client";

import { formatBRL } from "@juntos/core";
import { Trash2 } from "lucide-react";
import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Select } from "@/components/ui/select";
import { createGoal, deleteGoal, updateGoal } from "@/server/actions/goals";
import { undo } from "@/server/actions/undo";
import type { GoalView } from "@/server/services/finance-types";
import {
  createGoalSchema,
  GOAL_ICONS,
  GOAL_MESSAGES,
  GOAL_NAME_MAX,
  updateGoalSchema,
} from "@/server/validators/goals";
import { toastError, toastWithUndo } from "../financas/feedback";
import { MoneyDraftInput } from "./money-draft-input";
import { EMPTY_MONEY, isInvalidMoney, type MoneyDraft, moneyDraftOf } from "./optional-money";

export interface GoalFormSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly spaceId: string;
  /** Sem meta = "Nova meta". */
  readonly goal?: GoalView;
}

/** "Nova meta" e "Editar meta" (`goalForm` e `goalf` do protótipo). */
export function GoalFormSheet({ open, onOpenChange, spaceId, goal }: GoalFormSheetProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState(goal?.icon === "meta" || !goal ? "alvo" : goal.icon);
  const [target, setTarget] = useState<number | null>(goal?.target ?? null);
  const [saved, setSaved] = useState<MoneyDraft>(EMPTY_MONEY);
  const [monthly, setMonthly] = useState<MoneyDraft>(
    goal && goal.monthly > 0 ? moneyDraftOf(goal.monthly) : EMPTY_MONEY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = goal !== undefined;

  function clear(field: string) {
    setErrors((current) => {
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  }

  function showErrors(next: Record<string, string>) {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
  }

  function issuesOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
    const next: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path.map(String).join(".");
      if (!(key in next)) next[key] = issue.message;
    }
    return next;
  }

  function handleFailure(result: { error: string; fieldErrors?: Readonly<Record<string, string>> | undefined }) {
    if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) showErrors({ ...result.fieldErrors });
    else setErrors({ _: result.error });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const invalid: Record<string, string> = {};
    if (!editing && isInvalidMoney(saved)) invalid.saved = GOAL_MESSAGES.savedInvalid;
    if (isInvalidMoney(monthly)) invalid.monthly = GOAL_MESSAGES.monthlyInvalid;
    const base = { spaceId, name, icon, target, monthly: monthly.cents ?? 0 };

    if (goal) {
      const parsed = updateGoalSchema.safeParse({ ...base, id: goal.id });
      if (!parsed.success || Object.keys(invalid).length > 0) {
        return showErrors({ ...(parsed.success ? {} : issuesOf(parsed.error.issues)), ...invalid });
      }
      return startTransition(async () => {
        const result = await updateGoal(parsed.data);
        if (!result.ok) return handleFailure(result);
        onOpenChange(false);
        toastWithUndo("Meta salva.", null);
      });
    }

    const parsed = createGoalSchema.safeParse({ ...base, saved: saved.cents ?? 0 });
    if (!parsed.success || Object.keys(invalid).length > 0) {
      return showErrors({ ...(parsed.success ? {} : issuesOf(parsed.error.issues)), ...invalid });
    }
    startTransition(async () => {
      const result = await createGoal(parsed.data);
      if (!result.ok) return handleFailure(result);
      onOpenChange(false);
      toastWithUndo("Meta salva.", null);
    });
  }

  function handleDelete(current: GoalView) {
    startTransition(async () => {
      const result = await deleteGoal({ spaceId, id: current.id });
      if (!result.ok) return toastError(result.error);
      onOpenChange(false);
      toastWithUndo("Meta excluída.", () => undo({ token: result.data.undo.token }));
    });
  }

  const title = editing ? "Editar meta" : "Nova meta";
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
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
      <form ref={formRef} id={formId} noValidate onSubmit={handleSubmit} aria-label={title}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
            <Field label="Nome da meta" error={errors.name} required>
              <Input
                value={name}
                maxLength={GOAL_NAME_MAX}
                placeholder="Ex.: viagem de férias"
                autoComplete="off"
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                  clear("name");
                }}
              />
            </Field>
            <Field label="Tipo" error={errors.icon}>
              <Select
                value={icon}
                options={GOAL_ICONS}
                onChange={(event) => {
                  setIcon(event.target.value);
                  clear("icon");
                }}
              />
            </Field>
          </div>
          <Field label="Quanto precisa juntar" error={errors.target} required>
            <MoneyInput
              value={target}
              placeholder="0,00"
              onValueChange={(next) => {
                setTarget(next);
                clear("target");
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {goal ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium">Já guardado</span>
                <p className="hv num flex min-h-11 items-center font-semibold lg:min-h-10">{formatBRL(goal.saved)}</p>
              </div>
            ) : (
              <Field label="Já guardado" error={errors.saved} hint="Entra como Guardado em lançamentos, hoje.">
                <MoneyDraftInput
                  draft={saved}
                  placeholder="Opcional"
                  onDraftChange={(next) => {
                    setSaved(next);
                    clear("saved");
                  }}
                />
              </Field>
            )}
            <Field label="Guardar por mês" error={errors.monthly}>
              <MoneyDraftInput
                draft={monthly}
                placeholder="Opcional"
                onDraftChange={(next) => {
                  setMonthly(next);
                  clear("monthly");
                }}
              />
            </Field>
          </div>
          {goal ? (
            <p className="text-sm text-muted">
              Para guardar mais, use “Guardar nesta meta”: o valor entra como lançamento Guardado.
            </p>
          ) : null}
          {errors._ ? (
            <p role="alert" className="text-sm font-semibold text-out">
              {errors._}
            </p>
          ) : null}
        </div>
      </form>
      {goal ? (
        <div className="mt-6 border-t border-line pt-5">
          <Button variant="danger" icon={<Trash2 />} disabled={pending} onClick={() => handleDelete(goal)}>
            Excluir
          </Button>
        </div>
      ) : null}
    </ResponsiveSheet>
  );
}
