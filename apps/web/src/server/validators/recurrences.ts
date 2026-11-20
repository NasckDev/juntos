import * as z from "zod";
import { idSchema } from "./common";
import { DESCRIPTION_MAX, MAX_AMOUNT_CENTS, TX_MESSAGES } from "./transactions";

/** Mensagens do formulário "Editar conta fixa" (`submit #recf` do protótipo). */
export const REC_MESSAGES = {
  descriptionShort: "Use pelo menos 2 letras na descrição.",
  amount: "Digite um valor maior que zero, como 120,50.",
  amountTooHigh: "Valor muito alto. Confira os zeros.",
  day: "O dia precisa ser um número de 1 a 31.",
  notFound: "Não encontramos essa conta fixa. Ela pode ter sido excluída.",
} as const;

/** Dia digitado: só dígitos, de 1 a 31. */
export function parseDay(text: string): number | null {
  const raw = text.trim();
  if (!/^\d{1,2}$/.test(raw)) return null;
  const day = Number(raw);
  return day >= 1 && day <= 31 ? day : null;
}

export const updateRecurrenceSchema = z.object({
  spaceId: idSchema,
  id: idSchema,
  description: z
    .string({ error: REC_MESSAGES.descriptionShort })
    .trim()
    .min(2, { error: REC_MESSAGES.descriptionShort })
    .max(DESCRIPTION_MAX, { error: TX_MESSAGES.descriptionLong }),
  amount: z
    .number({ error: REC_MESSAGES.amount })
    .int({ error: REC_MESSAGES.amount })
    .positive({ error: REC_MESSAGES.amount })
    .max(MAX_AMOUNT_CENTS, { error: REC_MESSAGES.amountTooHigh }),
  /** Texto do campo "Dia". */
  day: z
    .string({ error: REC_MESSAGES.day })
    .refine((value) => parseDay(value) !== null, { error: REC_MESSAGES.day })
    .transform((value) => parseDay(value) ?? 1),
  categoryId: z.uuid({ error: TX_MESSAGES.category }),
});
export type UpdateRecurrenceInput = z.input<typeof updateRecurrenceSchema>;
export type UpdateRecurrenceData = z.output<typeof updateRecurrenceSchema>;

export const recurrenceRefSchema = z.object({ spaceId: idSchema, id: idSchema });
export type RecurrenceRefInput = z.input<typeof recurrenceRefSchema>;

export const setRecurrencePausedSchema = z.object({ spaceId: idSchema, id: idSchema, paused: z.boolean() });
export type SetRecurrencePausedInput = z.input<typeof setRecurrencePausedSchema>;
