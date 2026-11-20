"use client";

import type { IsoDate, Kind } from "@juntos/core";
import { createContext, use } from "react";
import type { EntryFormData, RecurrenceView, TxView } from "@/server/services/finance-types";
import type { Repeat } from "@/server/validators/transactions";

/** Como abrir o formulário de lançamento novo (botões "+ Entrada", "Adicionar" no dia, primeiros passos). */
export interface NewEntryOptions {
  readonly kind?: Kind;
  readonly repeat?: Repeat;
  /** Data já escolhida (Calendário: o dia selecionado). */
  readonly date?: IsoDate;
  /** Categoria já escolhida (Orçamento: o "+" da categoria). */
  readonly categoryId?: string;
}

export interface FinanceUi {
  readonly form: EntryFormData;
  /** Quem só vê não lança, não marca como pago e não edita. */
  readonly canEdit: boolean;
  readonly openNewEntry: (options?: NewEntryOptions) => void;
  readonly openEditEntry: (tx: TxView) => void;
  readonly openRecurrence: (recurrence: RecurrenceView) => void;
}

export const FinanceContext = createContext<FinanceUi | null>(null);

/** Abre os formulários de qualquer tela do grupo autenticado. */
export function useFinanceUi(): FinanceUi {
  const ui = use(FinanceContext);
  if (!ui) throw new Error("useFinanceUi precisa estar dentro do AppFrame.");
  return ui;
}
