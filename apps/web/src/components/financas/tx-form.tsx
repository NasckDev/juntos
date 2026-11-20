"use client";

import { type Cents, daysIn, type IsoDate, type Kind, monthName, todayParts, type YearMonth } from "@juntos/core";
import { ChevronDown, Repeat as RepeatIcon } from "lucide-react";
import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { suggestCategoryId } from "@/lib/finance";
import {
  createTransaction,
  deleteTransaction,
  discardCreatedTransaction,
  duplicateTransaction,
  updateTransaction,
} from "@/server/actions/transactions";
import { undo } from "@/server/actions/undo";
import type { ActionResult } from "@/server/result";
import type { EntryFormData, TxView } from "@/server/services/finance-types";
import {
  createTransactionSchema,
  DESCRIPTION_MAX,
  type EditScope,
  NOTE_MAX,
  PAYMENT_METHOD_MAX,
  type Repeat,
  TX_MESSAGES,
  type UpdateTransactionInput,
  updateTransactionSchema,
} from "@/server/validators/transactions";
import { toastError, toastWithUndo } from "./feedback";
import type { NewEntryOptions } from "./finance-context";

export type TxFormMode =
  | { readonly type: "new"; readonly options: NewEntryOptions }
  | { readonly type: "edit"; readonly tx: TxView };

export interface TxFormSheetProps {
  readonly open: boolean;
  readonly mode: TxFormMode;
  readonly data: EntryFormData;
  readonly canEdit: boolean;
  /** Mês aberto na tela (o primeiro do período): define a data padrão e o "salvo em <mês>". */
  readonly viewYm: YearMonth;
  readonly onOpenChange: (open: boolean) => void;
  /** Depois de salvar: a tela pode ir para o mês do lançamento. */
  readonly onSaved: (competence: YearMonth) => void;
}

const KIND_OPTIONS = [
  { value: "out", label: "Saída" },
  { value: "in", label: "Entrada" },
  { value: "save", label: "Guardar" },
] as const;

const SCOPE_OPTIONS = [
  { value: "one", label: "Só neste mês" },
  { value: "next", label: "Neste e nos próximos" },
] as const;

const REPEAT_SELECT = [
  { value: "none", label: "Não repetir" },
  { value: "monthly", label: "Todo mês" },
  { value: "yearly", label: "Todo ano" },
] as const;

/** Até 80 nomes na lista de sugestões, como no protótipo. */
const SUGGESTIONS = 80;

function whoLabel(kind: Kind): string {
  if (kind === "in") return "Quem recebeu";
  if (kind === "save") return "Quem guardou";
  return "Quem pagou";
}

function isoOf(ym: YearMonth, day: number): IsoDate {
  return `${ym}-${String(day).padStart(2, "0")}`;
}

/** Data padrão (`txForm`): hoje no mês atual; nos outros meses, o mesmo dia (ajustado ao fim do mês). */
function defaultDate(viewYm: YearMonth, today: IsoDate): IsoDate {
  const now = todayParts(today);
  if (viewYm === now.ym) return today;
  return isoOf(viewYm, Math.min(now.day, daysIn(viewYm)));
}

interface FormState {
  kind: Kind;
  amount: Cents | null;
  description: string;
  date: string;
  categoryId: string;
  categoryTouched: boolean;
  paidBy: string;
  paid: boolean;
  paidTouched: boolean;
  scope: EditScope;
  paymentMethod: string;
  repeat: Repeat;
  installments: string;
  note: string;
  personal: boolean;
}

function initialState(mode: TxFormMode, data: EntryFormData, viewYm: YearMonth): FormState {
  if (mode.type === "edit") {
    const { tx } = mode;
    return {
      kind: tx.kind,
      amount: tx.amount,
      description: tx.description,
      date: isoOf(tx.competence, tx.day),
      categoryId: tx.categoryId,
      categoryTouched: true,
      paidBy: tx.paidBy ?? "",
      paid: tx.paid,
      paidTouched: true,
      scope: "one",
      paymentMethod: tx.paymentMethod,
      repeat: "none",
      installments: "",
      note: tx.note,
      personal: tx.personal,
    };
  }
  const kind = mode.options.kind ?? "out";
  const date = mode.options.date ?? defaultDate(viewYm, data.today);
  // Categoria vinda de fora (Orçamento) só vale se existir e for do tipo; fica "tocada" para o nome não trocá-la.
  const preset = data.categories.find((category) => category.id === mode.options.categoryId && category.kind === kind);
  return {
    kind,
    amount: null,
    description: "",
    date,
    categoryId: preset?.id ?? suggestCategoryId(data.categories, "", kind) ?? "",
    categoryTouched: preset !== undefined,
    paidBy: data.currentMemberId,
    paid: date <= data.today,
    paidTouched: false,
    scope: "one",
    paymentMethod: "",
    repeat: mode.options.repeat ?? "none",
    installments: "",
    note: "",
    personal: false,
  };
}

/** Primeira mensagem de cada campo. */
function issuesOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Formulário de lançamento (`txForm` do protótipo): painel lateral no computador, folha de baixo no celular. */
export function TxFormSheet({ open, mode, data, canEdit, viewYm, onOpenChange, onSaved }: TxFormSheetProps) {
  const formId = useId();
  const isEdit = mode.type === "edit";
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<FormState>(() => initialState(mode, data, viewYm));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    () => state.paymentMethod !== "" || state.note !== "" || state.personal || state.repeat !== "none",
  );

  const members = data.members;
  const showWho = members.length > 1;
  const recurring = isEdit && mode.tx.recurrenceId !== null;
  const categories = data.categories.filter((category) => category.kind === state.kind);
  const names = [...new Set(data.memories.map((memory) => memory.description))].slice(0, SUGGESTIONS);

  function update(patch: Partial<FormState>, fields: readonly string[] = []) {
    setState((current) => ({ ...current, ...patch }));
    setConfirmDuplicate(false);
    if (fields.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        for (const field of fields) delete next[field];
        // O aviso de duplicado fica na descrição, mas vale para o lançamento inteiro.
        if (next.description === TX_MESSAGES.duplicate) delete next.description;
        return next;
      });
    }
  }

  function changeKind(kind: Kind) {
    update(
      {
        kind,
        categoryId: suggestCategoryId(data.categories, state.description, kind) ?? "",
        categoryTouched: false,
      },
      ["kind", "categoryId"],
    );
  }

  /** Nome já usado: repete categoria, valor, forma de pagamento e pessoa do último (só no lançamento novo). */
  function changeDescription(description: string) {
    const key = description.trim().toLowerCase();
    const last = isEdit
      ? undefined
      : data.memories.find((memory) => memory.kind === state.kind && memory.description.toLowerCase() === key);
    const patch: Partial<FormState> = { description };
    if (last && key) {
      if (!state.categoryTouched) patch.categoryId = last.categoryId;
      if (state.amount === null) patch.amount = last.amount;
      if (state.paymentMethod === "") patch.paymentMethod = last.paymentMethod;
      if (showWho && last.paidBy) patch.paidBy = last.paidBy;
    } else if (!state.categoryTouched) {
      patch.categoryId = suggestCategoryId(data.categories, description, state.kind) ?? state.categoryId;
    }
    update(patch, ["description", "categoryId"]);
  }

  function changeDate(date: string) {
    update(state.paidTouched ? { date } : { date, paid: date <= data.today }, ["date"]);
  }

  function focusFirstError() {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    });
  }

  function showErrors(next: Record<string, string>) {
    setErrors(next);
    focusFirstError();
  }

  function common() {
    return {
      spaceId: data.spaceId,
      kind: state.kind,
      amount: state.amount,
      description: state.description,
      date: state.date,
      categoryId: state.categoryId,
      paidBy: showWho ? state.paidBy || null : isEdit ? mode.tx.paidBy : data.currentMemberId,
      paid: state.paid,
      paymentMethod: state.paymentMethod,
      note: state.note,
      personal: state.kind === "out" && state.personal,
    };
  }

  function handleFailure(result: Extract<ActionResult<unknown>, { ok: false }>) {
    if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      showErrors({ ...result.fieldErrors });
      if (result.fieldErrors.description === TX_MESSAGES.duplicate) setConfirmDuplicate(true);
      return;
    }
    setErrors({ _: result.error });
  }

  function submitNew() {
    const input = { ...common(), repeat: state.repeat, installments: state.installments, confirmDuplicate };
    const parsed = createTransactionSchema.safeParse(input);
    if (!parsed.success) return showErrors(issuesOf(parsed.error.issues));
    startTransition(async () => {
      const result = await createTransaction(parsed.data);
      if (!result.ok) return handleFailure(result);
      const { id, recurrenceId, competence } = result.data;
      const where = competence !== viewYm ? ` em ${monthName(competence).toLowerCase()}` : "";
      toastWithUndo(`Lançamento salvo${where}.`, () =>
        discardCreatedTransaction({ spaceId: data.spaceId, id, recurrenceId }),
      );
      onOpenChange(false);
      onSaved(competence);
    });
  }

  function submitEdit(tx: TxView) {
    const draft = { ...common(), id: tx.id, scope: recurring ? state.scope : "one" };
    const parsed = updateTransactionSchema.safeParse(draft);
    if (!parsed.success) return showErrors(issuesOf(parsed.error.issues));
    const previous: UpdateTransactionInput = {
      spaceId: data.spaceId,
      id: tx.id,
      kind: tx.kind,
      amount: tx.amount,
      description: tx.description,
      date: isoOf(tx.competence, tx.day),
      categoryId: tx.categoryId,
      paidBy: tx.paidBy,
      paid: tx.paid,
      paymentMethod: tx.paymentMethod,
      note: tx.note,
      personal: tx.personal,
      scope: "one",
    };
    startTransition(async () => {
      const result = await updateTransaction(parsed.data);
      if (!result.ok) return handleFailure(result);
      // "Neste e nos próximos" mexe em vários meses e no modelo: sem desfazer automático.
      toastWithUndo("Lançamento atualizado.", parsed.data.scope === "next" ? null : () => updateTransaction(previous));
      onOpenChange(false);
      onSaved(result.data.competence);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || pending) return;
    if (mode.type === "edit") submitEdit(mode.tx);
    else submitNew();
  }

  function handleDelete(tx: TxView) {
    startTransition(async () => {
      const result = await deleteTransaction({ spaceId: data.spaceId, id: tx.id });
      if (!result.ok) return toastError(result.error);
      onOpenChange(false);
      toastWithUndo("Lançamento excluído.", () => undo({ token: result.data.undo.token }));
    });
  }

  function handleDuplicate(tx: TxView) {
    startTransition(async () => {
      const result = await duplicateTransaction({ spaceId: data.spaceId, id: tx.id });
      if (!result.ok) return toastError(result.error);
      onOpenChange(false);
      toastWithUndo("Lançamento duplicado.", () => deleteTransaction({ spaceId: data.spaceId, id: result.data.id }));
    });
  }

  const title = isEdit ? (canEdit ? "Editar lançamento" : "Lançamento") : "Novo lançamento";
  const footer = !canEdit ? (
    <Button variant="ghost" onClick={() => onOpenChange(false)}>
      Fechar
    </Button>
  ) : (
    <>
      {mode.type === "edit" ? (
        <>
          <Button variant="danger" disabled={pending} onClick={() => handleDelete(mode.tx)} className="lg:mr-auto">
            Excluir
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => handleDuplicate(mode.tx)}>
            Duplicar
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
      )}
      <Button type="submit" form={formId} disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </>
  );

  const repeatHint =
    mode.type === "edit" && mode.tx.recurrenceId
      ? `Este lançamento se repete ${mode.tx.yearly ? "todo ano" : "todo mês"}${
          mode.tx.installmentsTotal ? `, parcela ${mode.tx.installment} de ${mode.tx.installmentsTotal}` : ""
        }.`
      : null;

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={title} footer={footer}>
      <form ref={formRef} id={formId} noValidate onSubmit={handleSubmit} aria-label={title}>
        <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          {repeatHint ? (
            <p className="flex items-start gap-2 rounded-field bg-brand-soft px-3 py-2.5 text-sm text-brand-text">
              <RepeatIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {repeatHint}
            </p>
          ) : null}
          <Segmented label="Tipo" options={KIND_OPTIONS} value={state.kind} onValueChange={changeKind} />
          <Field label="Valor" error={errors.amount} required>
            <MoneyInput
              size="lg"
              placeholder="0,00"
              value={state.amount}
              onValueChange={(amount) => update({ amount }, ["amount"])}
              autoFocus={!isEdit}
            />
          </Field>
          <Field label="Descrição" error={errors.description} required>
            <Input
              value={state.description}
              onChange={(event) => changeDescription(event.target.value)}
              maxLength={DESCRIPTION_MAX}
              placeholder="Ex.: conta de luz"
              autoComplete="off"
              list={`${formId}-nomes`}
            />
          </Field>
          <datalist id={`${formId}-nomes`}>
            {names.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" error={errors.date} required>
              <Input type="date" value={state.date} onChange={(event) => changeDate(event.target.value)} />
            </Field>
            <Field label="Categoria" error={errors.categoryId}>
              <Select
                value={state.categoryId}
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                onChange={(event) => update({ categoryId: event.target.value, categoryTouched: true }, ["categoryId"])}
              />
            </Field>
          </div>
          {showWho ? (
            <Field label={whoLabel(state.kind)} error={errors.paidBy}>
              <Select
                value={state.paidBy}
                options={[
                  ...members.map((member) => ({
                    value: member.id,
                    label: `${member.name}${member.isYou ? " (você)" : ""}`,
                  })),
                  { value: "", label: "Não informar" },
                ]}
                onChange={(event) => update({ paidBy: event.target.value }, ["paidBy"])}
              />
            </Field>
          ) : null}
          <Switch
            checked={state.paid}
            onCheckedChange={(paid) => update({ paid, paidTouched: true })}
            label={state.kind === "in" ? "Já foi recebido" : "Já foi pago"}
          />
          {recurring ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium" id={`${formId}-escopo`}>
                Aplicar a mudança em
              </p>
              <Segmented
                label="Aplicar a mudança em"
                options={SCOPE_OPTIONS}
                value={state.scope}
                onValueChange={(scope) => update({ scope })}
              />
            </div>
          ) : null}
          <details
            open={moreOpen}
            onToggle={(event) => setMoreOpen(event.currentTarget.open)}
            className="group rounded-field border border-line"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-medium [&::-webkit-details-marker]:hidden">
              <span className="whitespace-nowrap">Mais opções</span>
              <small className="min-w-0 truncate text-sm font-normal text-muted">
                pagamento, repetição, observação
              </small>
              <ChevronDown
                aria-hidden="true"
                className="ml-auto size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="flex flex-col gap-4 border-t border-line px-3 pt-3 pb-4">
              <Field label="Pago com" error={errors.paymentMethod}>
                <Input
                  value={state.paymentMethod}
                  onChange={(event) => update({ paymentMethod: event.target.value }, ["paymentMethod"])}
                  maxLength={PAYMENT_METHOD_MAX}
                  placeholder="Pix, cartão…"
                  autoComplete="off"
                  list={`${formId}-formas`}
                />
              </Field>
              <datalist id={`${formId}-formas`}>
                {data.paymentMethods.map((method) => (
                  <option key={method} value={method} />
                ))}
              </datalist>
              {isEdit ? null : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Repetir">
                    <Select
                      value={state.repeat}
                      options={REPEAT_SELECT}
                      onChange={(event) => {
                        const repeat = REPEAT_SELECT.find((o) => o.value === event.target.value)?.value ?? "none";
                        update({ repeat }, ["installments"]);
                      }}
                    />
                  </Field>
                  {state.repeat === "monthly" ? (
                    <Field label="Parcelas" error={errors.installments}>
                      <Input
                        inputMode="numeric"
                        value={state.installments}
                        onChange={(event) => update({ installments: event.target.value }, ["installments"])}
                        placeholder="Sem fim"
                        autoComplete="off"
                      />
                    </Field>
                  ) : null}
                </div>
              )}
              <Field label="Observação" error={errors.note}>
                <Input
                  value={state.note}
                  onChange={(event) => update({ note: event.target.value }, ["note"])}
                  maxLength={NOTE_MAX}
                  autoComplete="off"
                />
              </Field>
              {showWho && state.kind === "out" ? (
                <Switch
                  checked={state.personal}
                  onCheckedChange={(personal) => update({ personal })}
                  label="Gasto pessoal"
                  description="Fica fora da divisão entre as pessoas"
                />
              ) : null}
            </div>
          </details>
          {errors._ ? (
            <p role="alert" className="text-sm font-semibold text-out">
              {errors._}
            </p>
          ) : null}
        </fieldset>
      </form>
    </ResponsiveSheet>
  );
}
