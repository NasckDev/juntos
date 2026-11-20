"use client";

import type { Cents } from "@juntos/core";
import { Pause, Play, Trash2 } from "lucide-react";
import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Select } from "@/components/ui/select";
import { deleteRecurrence, setRecurrencePaused, updateRecurrence } from "@/server/actions/recurrences";
import { undo } from "@/server/actions/undo";
import type { EntryFormData, RecurrenceView } from "@/server/services/finance-types";
import { type UpdateRecurrenceInput, updateRecurrenceSchema } from "@/server/validators/recurrences";
import { DESCRIPTION_MAX } from "@/server/validators/transactions";
import { toastError, toastWithUndo } from "./feedback";

export interface RecurrenceFormSheetProps {
  readonly open: boolean;
  readonly recurrence: RecurrenceView;
  readonly data: EntryFormData;
  readonly canEdit: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** "Editar conta fixa" (`recForm` do protótipo), com pausar, retomar e excluir. */
export function RecurrenceFormSheet({ open, recurrence, data, canEdit, onOpenChange }: RecurrenceFormSheetProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState(recurrence.description);
  const [amount, setAmount] = useState<Cents | null>(recurrence.amount);
  const [day, setDay] = useState(String(recurrence.day));
  const [categoryId, setCategoryId] = useState(recurrence.categoryId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const categories = data.categories.filter((category) => category.kind === recurrence.kind);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || pending) return;
    const draft = {
      spaceId: data.spaceId,
      id: recurrence.id,
      description,
      amount,
      day,
      categoryId,
    };
    const parsed = updateRecurrenceSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        if (!(key in next)) next[key] = issue.message;
      }
      return showErrors(next);
    }
    const input: UpdateRecurrenceInput = { ...draft, amount: parsed.data.amount };
    startTransition(async () => {
      const result = await updateRecurrence(input);
      if (!result.ok) {
        if (result.fieldErrors) showErrors({ ...result.fieldErrors });
        else setErrors({ _: result.error });
        return;
      }
      onOpenChange(false);
      toastWithUndo("Conta fixa atualizada.", null);
    });
  }

  function togglePause() {
    const paused = !recurrence.paused;
    startTransition(async () => {
      const result = await setRecurrencePaused({ spaceId: data.spaceId, id: recurrence.id, paused });
      if (!result.ok) return toastError(result.error);
      onOpenChange(false);
      toastWithUndo(paused ? "Conta pausada." : "Conta retomada.", () =>
        setRecurrencePaused({ spaceId: data.spaceId, id: recurrence.id, paused: !paused }),
      );
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecurrence({ spaceId: data.spaceId, id: recurrence.id });
      if (!result.ok) return toastError(result.error);
      onOpenChange(false);
      toastWithUndo("Não vai mais repetir.", () => undo({ token: result.data.undo.token }));
    });
  }

  const footer = canEdit ? (
    <>
      <Button variant="ghost" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button type="submit" form={formId} disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </>
  ) : (
    <Button variant="ghost" onClick={() => onOpenChange(false)}>
      Fechar
    </Button>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={canEdit ? "Editar conta fixa" : "Conta fixa"}
      description="Vale deste mês em diante, nos lançamentos ainda em aberto."
      footer={footer}
    >
      <form ref={formRef} id={formId} noValidate onSubmit={handleSubmit} aria-label="Editar conta fixa">
        <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <Field label="Descrição" error={errors.description} required>
            <Input
              value={description}
              maxLength={DESCRIPTION_MAX}
              autoComplete="off"
              onChange={(event) => {
                setDescription(event.target.value);
                clear("description");
              }}
            />
          </Field>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
            <Field label="Valor" error={errors.amount} required>
              <MoneyInput
                value={amount}
                onValueChange={(next) => {
                  setAmount(next);
                  clear("amount");
                }}
              />
            </Field>
            <Field label="Dia" error={errors.day} required>
              <Input
                inputMode="numeric"
                maxLength={2}
                value={day}
                autoComplete="off"
                onChange={(event) => {
                  setDay(event.target.value);
                  clear("day");
                }}
              />
            </Field>
          </div>
          <Field label="Categoria" error={errors.categoryId}>
            <Select
              value={categoryId}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              onChange={(event) => {
                setCategoryId(event.target.value);
                clear("categoryId");
              }}
            />
          </Field>
          {errors._ ? (
            <p role="alert" className="text-sm font-semibold text-out">
              {errors._}
            </p>
          ) : null}
        </fieldset>
      </form>
      {canEdit ? (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <Button
            variant="ghost"
            icon={recurrence.paused ? <Play /> : <Pause />}
            disabled={pending}
            onClick={togglePause}
          >
            {recurrence.paused ? "Retomar" : "Pausar"}
          </Button>
          <Button variant="danger" icon={<Trash2 />} disabled={pending} onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      ) : null}
    </ResponsiveSheet>
  );
}
