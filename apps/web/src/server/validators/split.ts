import * as z from "zod";
import { idSchema } from "./common";
import { SPLIT_MESSAGES } from "./settlements";

export const SPLIT_MODE_VALUES = ["equal", "income", "custom"] as const;

export const setSplitSchema = z.object({
  spaceId: idSchema,
  mode: z.enum(SPLIT_MODE_VALUES, { error: "Escolha como dividir: partes iguais, pela renda ou personalizado." }),
  /** Parte (em %) da primeira pessoa; só vale no modo personalizado. Sem ela, mantém a que já estava salva. */
  pct: z
    .number({ error: SPLIT_MESSAGES.percent })
    .int({ error: SPLIT_MESSAGES.percent })
    .min(0, { error: SPLIT_MESSAGES.percent })
    .max(100, { error: SPLIT_MESSAGES.percent })
    .optional(),
});
export type SetSplitInput = z.input<typeof setSplitSchema>;
