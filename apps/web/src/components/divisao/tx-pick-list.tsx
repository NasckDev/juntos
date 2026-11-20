"use client";

import { formatBRL, monthShort } from "@juntos/core";
import { categoryOf } from "@/lib/finance";
import type { CategoryView, TxView } from "@/server/services/finance-types";
import { CategoryIcon } from "../financas/category-icon";
import { useFinanceUi } from "../financas/finance-context";

export interface TxPickListProps {
  readonly txs: readonly TxView[];
  readonly categories: readonly CategoryView[];
  /** Mostra o mês ("nov/26, ") quando o período tem mais de um mês. */
  readonly showMonth?: boolean;
}

/** Lançamentos que abrem o formulário de edição que já existe no layout (`openEditEntry`). */
export function TxPickList({ txs, categories, showMonth = false }: TxPickListProps) {
  const { openEditEntry } = useFinanceUi();
  return (
    <ul>
      {txs.map((tx) => {
        const category = categoryOf(categories, tx.categoryId);
        return (
          <li key={tx.id} className="flex min-h-14 items-center gap-3 border-t border-line first:border-t-0">
            <button
              type="button"
              onClick={() => openEditEntry(tx)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-field py-2 text-left"
            >
              <CategoryIcon icon={category.icon} hue={category.hue} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{tx.description}</span>
                <span className="block truncate text-sm text-muted">
                  {showMonth ? `${monthShort(tx.competence)}, ` : ""}Dia {tx.day}, {category.name}
                </span>
              </span>
              <span className="hv num shrink-0 font-semibold whitespace-nowrap">− {formatBRL(tx.amount)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
