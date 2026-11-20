import * as z from "zod";
import { ACCENTS, FONT_SIZES, THEMES } from "../db/schema/notifications";
import { MESSAGES } from "./common";

export const notifySchema = z
  .object({
    late: z.boolean(),
    due: z.boolean(),
    budget: z.boolean(),
    goal: z.boolean(),
    auto: z.boolean(),
    people: z.boolean(),
  })
  .partial()
  .strict();

/** Atualização parcial: só os campos enviados mudam. */
export const updatePreferencesSchema = z
  .object({
    theme: z.enum(THEMES, { error: "Tema inválido." }),
    accent: z.enum(ACCENTS, { error: "Cor de destaque inválida." }),
    fontSize: z.enum(FONT_SIZES, { error: "Tamanho de letra inválido." }),
    hideValues: z.boolean(),
    notify: notifySchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: "Nada para salvar." });
export type UpdatePreferencesInput = z.input<typeof updatePreferencesSchema>;

/** Avatares desenhados do protótipo (a1 a a8); nulo volta para as iniciais. */
export const AVATAR_CODES = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"] as const;

export const updateProfileSchema = z
  .object({
    name: z
      .string({ error: MESSAGES.profileNameShort })
      .trim()
      .min(2, { error: MESSAGES.profileNameShort })
      .max(40, { error: MESSAGES.profileNameLong }),
    avatar: z.enum(AVATAR_CODES, { error: "Avatar inválido." }).nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: "Nada para salvar." });
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
