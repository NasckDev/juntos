import { isYearMonth, MAX_SCREEN_SPAN } from "@juntos/core";
import * as z from "zod";
import { idSchema } from "./common";

/** Mensagens da divisão e dos acertos, no tom do protótipo. */
export const SPLIT_MESSAGES = {
  period: "Escolha um mês ou um período de até 3 meses.",
  nothingToSettle: "Não há nada para acertar neste período.",
  settlementNotFound: "Não encontramos esse acerto. Ele pode já ter sido desfeito.",
  customNeedsTwo: "A divisão personalizada só vale quando o espaço tem duas pessoas.",
  percent: "A parte da primeira pessoa vai de 0 a 100%.",
} as const;

/** Período da tela (`?mes=2026-11&meses=3`): primeiro mês e quantos meses (1 a 3). */
export const periodFields = {
  start: z.string({ error: SPLIT_MESSAGES.period }).refine(isYearMonth, { error: SPLIT_MESSAGES.period }),
  span: z
    .number({ error: SPLIT_MESSAGES.period })
    .int({ error: SPLIT_MESSAGES.period })
    .min(1, { error: SPLIT_MESSAGES.period })
    .max(MAX_SCREEN_SPAN, { error: SPLIT_MESSAGES.period }),
};

export const registerSettlementSchema = z.object({ spaceId: idSchema, ...periodFields });
export type RegisterSettlementInput = z.input<typeof registerSettlementSchema>;

/** Máximo de acertos de uma vez: 3 pessoas ou mais geram poucos movimentos; o teto só barra abuso. */
export const MAX_UNSETTLE = 50;

export const unsettleSchema = z.object({
  spaceId: idSchema,
  ids: z.array(idSchema, { error: SPLIT_MESSAGES.settlementNotFound }).min(1).max(MAX_UNSETTLE),
});
export type UnsettleInput = z.input<typeof unsettleSchema>;
