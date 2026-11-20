"use client";

import { formatBRL, type IsoDate, isLate, monthShort } from "@juntos/core";
import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { categoryOf, paidLabel, signOf } from "@/lib/finance";
import { setTransactionPaid } from "@/server/actions/transactions";
import type { CategoryView, TxView } from "@/server/services/finance-types";
import { CategoryIcon } from "./category-icon";
import { toastError, toastWithUndo } from "./feedback";
import { useFinanceUi } from "./finance-context";

const VALUE_TONE = { in: "text-in", out: "text-ink", save: "text-save" } as const;

/** Botão redondo de pago/recebido (`chkBtn`), com alvo de 44 px no celular. */
export function PaidToggle({ tx, className }: { tx: TxView; className?: string }) {
  const { form, canEdit } = useFinanceUi();
  const [optimistic, setOptimistic] = useOptimistic(tx.paid);
  const [, startTransition] = useTransition();
  const shown = { ...tx, paid: optimistic };
  const label = `${paidLabel(shown)}: ${tx.description}`;

  function toggle() {
    const paid = !optimistic;
    startTransition(async () => {
      setOptimistic(paid);
      const result = await setTransactionPaid({ spaceId: form.spaceId, id: tx.id, paid });
      if (!result.ok) return toastError(result.error);
      const message = paid
        ? tx.kind === "in"
          ? "Marcado como recebido."
          : "Marcado como pago."
        : "Voltou para em aberto.";
      toastWithUndo(message, () => setTransactionPaid({ spaceId: form.spaceId, id: tx.id, paid: !paid }));
    });
  }

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={label}
      title={paidLabel(shown)}
      disabled={!canEdit}
      onClick={toggle}
      className={cn(
        "hit grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-line2 bg-surface text-transparent transition-colors lg:size-5",
        "hover:border-in aria-pressed:border-in aria-pressed:bg-in aria-pressed:text-white disabled:cursor-default disabled:opacity-100",
        className,
      )}
    >
      <Check aria-hidden="true" className="size-3.5 lg:size-3" strokeWidth={3} />
    </button>
  );
}

/** Etiquetas ao lado do nome (`chipsOf`): Atrasado, "5 de 54" ou Anual, Pessoal. */
export function TxTags({ tx, today }: { tx: TxView; today: IsoDate }) {
  return (
    <>
      {isLate(tx, today) ? <Tag kind="late" className="ml-1.5" /> : null}
      {tx.installmentsTotal && tx.installment ? (
        <Tag kind="installment" current={tx.installment} total={tx.installmentsTotal} className="ml-1.5" />
      ) : tx.yearly ? (
        <Tag kind="annual" className="ml-1.5" />
      ) : null}
      {tx.personal ? <Tag kind="personal" className="ml-1.5" /> : null}
    </>
  );
}

export function TxValue({ tx, className }: { tx: TxView; className?: string }) {
  return (
    <span className={cn("hv num shrink-0 font-semibold whitespace-nowrap", VALUE_TONE[tx.kind], className)}>
      {signOf(tx.kind)}
      {formatBRL(tx.amount)}
    </span>
  );
}

export interface TxLineProps {
  tx: TxView;
  categories: readonly CategoryView[];
  today: IsoDate;
  /** Mostra o mês ("nov/26, ") quando a lista mistura meses. */
  showMonth?: boolean;
  /** Ícone da categoria à esquerda do nome. */
  withIcon?: boolean;
  /** Mostra a observação (Lista). */
  withNote?: boolean;
}

/** Linha de lançamento em lista (`rowc` do protótipo): pago, nome e etiquetas, dia e categoria, valor. */
export function TxLine({ tx, categories, today, showMonth = false, withIcon = false, withNote = false }: TxLineProps) {
  const { openEditEntry } = useFinanceUi();
  const category = categoryOf(categories, tx.categoryId);
  return (
    <li className="flex min-h-14 items-center gap-3 border-t border-line py-2 first:border-t-0">
      <PaidToggle tx={tx} />
      <button
        type="button"
        onClick={() => openEditEntry(tx)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-field py-1 text-left"
      >
        {withIcon ? <CategoryIcon icon={category.icon} hue={category.hue} size="sm" /> : null}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-medium", tx.paid && "text-muted")}>
            {tx.description}
            <TxTags tx={tx} today={today} />
          </span>
          <span className="block truncate text-sm text-muted">
            {showMonth ? `${monthShort(tx.competence)}, ` : ""}Dia {tx.day}, {category.name}
            {withNote && tx.note ? `. Obs.: ${tx.note}` : ""}
          </span>
        </span>
      </button>
      <TxValue tx={tx} />
    </li>
  );
}

/** Linha de "Próximos vencimentos": bloco da data à esquerda, valor e o botão de pago à direita. */
export function UpcomingLine({
  tx,
  categories,
  today,
}: {
  tx: TxView;
  categories: readonly CategoryView[];
  today: IsoDate;
}) {
  const { openEditEntry } = useFinanceUi();
  const category = categoryOf(categories, tx.categoryId);
  return (
    <li className="flex min-h-16 items-center gap-3 border-t border-line py-2.5 first:border-t-0">
      <button
        type="button"
        onClick={() => openEditEntry(tx)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-field text-left"
      >
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 flex-col items-center justify-center rounded-[0.7rem] bg-surface2 leading-none"
        >
          <b className="num text-md font-bold">{tx.day}</b>
          <small className="mt-0.5 text-micro text-muted">{monthShort(tx.competence).slice(0, 3)}</small>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {tx.description}
            <TxTags tx={tx} today={today} />
          </span>
          <span className="block truncate text-sm text-muted">
            Dia {tx.day}, {category.name}
          </span>
        </span>
        <TxValue tx={tx} className="text-md" />
      </button>
      <PaidToggle tx={tx} />
    </li>
  );
}
