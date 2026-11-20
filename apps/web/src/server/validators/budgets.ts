import * as z from "zod";
import { idSchema } from "./common";

/** Limite mensal máximo: R$ 100 milhões (o protótipo recusa acima de 1e8 reais). */
export const MAX_BUDGET_CENTS = 10_000_000_000;

export const BUDGET_MESSAGES = {
  limit: "Digite um valor maior que zero ou deixe vazio.",
  limitTooHigh: "Valor muito alto. Confira os zeros.",
  noHistory: "Ainda não há meses anteriores para calcular.",
} as const;

/** Limite mensal em centavos; `null` tira o limite da categoria. */
export const setBudgetSchema = z.object({
  spaceId: idSchema,
  categoryId: idSchema,
  limit: z
    .number({ error: BUDGET_MESSAGES.limit })
    .int({ error: BUDGET_MESSAGES.limit })
    .positive({ error: BUDGET_MESSAGES.limit })
    .max(MAX_BUDGET_CENTS, { error: BUDGET_MESSAGES.limitTooHigh })
    .nullable(),
});
export type SetBudgetInput = z.input<typeof setBudgetSchema>;

export const suggestBudgetsSchema = z.object({ spaceId: idSchema });
export type SuggestBudgetsInput = z.input<typeof suggestBudgetsSchema>;
