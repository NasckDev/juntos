"use client";

import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Segmented } from "@/components/ui/segmented";
import { createCategory, deleteCategory } from "@/server/actions/categories";
import {
  CATEGORY_ICONS,
  CATEGORY_MESSAGES,
  CATEGORY_NAME_MAX,
  createCategorySchema,
} from "@/server/validators/categories";
import { categoryIconOf } from "../financas/category-icon";
import { toastWithUndo } from "../financas/feedback";
import { MoneyDraftInput } from "./money-draft-input";
import { EMPTY_MONEY, isInvalidMoney, type MoneyDraft } from "./optional-money";

type CategoryKind = "out" | "in" | "save";

const KIND_OPTIONS: readonly { value: CategoryKind; label: string }[] = [
  { value: "out", label: "Saída" },
  { value: "in", label: "Entrada" },
  { value: "save", label: "Guardado" },
];

const ICON_LABELS: Record<string, string> = {
  casa: "Casa",
  contas: "Contas",
  cartao: "Cartão",
  mercado: "Mercado",
  carro: "Carro",
  assinatura: "Assinatura",
  saude: "Saúde",
  estudo: "Estudo",
  lazer: "Lazer",
  caixa: "Caixa",
  trabalho: "Trabalho",
  dinheiro: "Dinheiro",
  reserva: "Reserva",
  etiqueta: "Etiqueta",
  presente: "Presente",
  viagem: "Viagem",
  conserto: "Conserto",
  alvo: "Alvo",
};

export interface CategoryFormSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly spaceId: string;
  /** Com `fixedKind` (Orçamento: só saída) o tipo não aparece; sem ele, a pessoa escolhe (Ajustes). */
  readonly fixedKind?: CategoryKind;
}

/** "Nova categoria" (`catnew` e `catf` do protótipo): nome, ícone, tipo e limite mensal opcional. */
export function CategoryFormSheet({ open, onOpenChange, spaceId, fixedKind }: CategoryFormSheetProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [kind, setKind] = useState<CategoryKind>(fixedKind ?? "out");
  const [limit, setLimit] = useState<MoneyDraft>(EMPTY_MONEY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const activeKind = fixedKind ?? kind;

  function showErrors(next: Record<string, string>) {
    setErrors(next);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
  }

  function clear(field: string) {
    setErrors((current) => {
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (activeKind === "out" && isInvalidMoney(limit)) return showErrors({ limit: CATEGORY_MESSAGES.limit });
    const parsed = createCategorySchema.safeParse({
      spaceId,
      name,
      icon,
      kind: activeKind,
      limit: activeKind === "out" ? limit.cents : null,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        if (!(key in next)) next[key] = issue.message;
      }
      return showErrors(next);
    }
    startTransition(async () => {
      const result = await createCategory(parsed.data);
      if (!result.ok) {
        if (result.fieldErrors) showErrors({ ...result.fieldErrors });
        else setErrors({ _: result.error });
        return;
      }
      const { id } = result.data;
      onOpenChange(false);
      toastWithUndo(`Categoria “${parsed.data.name}” criada.`, () => deleteCategory({ spaceId, id }));
    });
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Nova categoria"
      description="Para o que não se encaixa nas categorias prontas, como pets ou reforma."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Criando…" : "Criar categoria"}
          </Button>
        </>
      }
    >
      <form ref={formRef} id={formId} noValidate onSubmit={handleSubmit} aria-label="Nova categoria">
        <div className="flex flex-col gap-4">
          <Field label="Nome" error={errors.name} required>
            <Input
              value={name}
              maxLength={CATEGORY_NAME_MAX}
              placeholder="Ex.: pets"
              autoComplete="off"
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                clear("name");
              }}
            />
          </Field>
          {fixedKind ? null : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Tipo</span>
              <Segmented label="Tipo da categoria" options={KIND_OPTIONS} value={kind} onValueChange={setKind} />
            </div>
          )}
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1.5 text-sm font-medium">Ícone</legend>
            <div role="radiogroup" aria-label="Ícone da categoria" className="grid grid-cols-6 gap-2">
              {CATEGORY_ICONS.map((key) => {
                const Icon = categoryIconOf(key);
                return (
                  <label key={key} title={ICON_LABELS[key] ?? key} className="relative block">
                    <input
                      type="radio"
                      name="icone"
                      value={key}
                      checked={key === icon}
                      onChange={() => setIcon(key)}
                      aria-label={ICON_LABELS[key] ?? key}
                      className="peer sr-only"
                    />
                    <span className="grid h-11 cursor-pointer place-items-center rounded-field border border-line2 bg-surface text-muted transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-text peer-focus-visible:ring-2 peer-focus-visible:ring-brand [&_svg]:size-5">
                      <Icon aria-hidden="true" />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {activeKind === "out" ? (
            <Field label="Limite por mês (opcional)" error={errors.limit}>
              <MoneyDraftInput
                draft={limit}
                onDraftChange={(next) => {
                  setLimit(next);
                  clear("limit");
                }}
                placeholder="Sem limite"
              />
            </Field>
          ) : null}
          {errors._ ? (
            <p role="alert" className="text-sm font-semibold text-out">
              {errors._}
            </p>
          ) : null}
        </div>
      </form>
    </ResponsiveSheet>
  );
}
