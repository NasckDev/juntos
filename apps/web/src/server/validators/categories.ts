import * as z from "zod";
import { MAX_BUDGET_CENTS } from "./budgets";
import { idSchema } from "./common";

/** Ícones que a pessoa pode escolher ao criar uma categoria (`ICONS` do protótipo), na ordem dele. */
export const CATEGORY_ICONS = [
  "casa",
  "contas",
  "cartao",
  "mercado",
  "carro",
  "assinatura",
  "saude",
  "estudo",
  "lazer",
  "caixa",
  "trabalho",
  "dinheiro",
  "reserva",
  "etiqueta",
  "presente",
  "viagem",
  "conserto",
  "alvo",
] as const;
export type CategoryIconKey = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_NAME_MAX = 24;
export const CATEGORY_KINDS = ["out", "in", "save"] as const;

export const CATEGORY_MESSAGES = {
  nameEmpty: "Dê um nome para a categoria.",
  nameShort: "Use pelo menos 2 letras no nome.",
  nameLong: `Use no máximo ${CATEGORY_NAME_MAX} caracteres no nome.`,
  nameTaken: "Já existe uma categoria com esse nome.",
  icon: "Escolha um ícone da lista.",
  kind: "Escolha o tipo: saída, entrada ou guardado.",
  limit: "Limite inválido. Use um valor como 300,00 ou deixe vazio.",
  limitTooHigh: "Valor muito alto. Confira os zeros.",
  limitOnlyOut: "Só categorias de saída têm limite por mês.",
  notFound: "Não encontramos essa categoria. Ela pode ter sido excluída.",
  defaultLocked: "As categorias padrão não podem ser excluídas.",
} as const;

export const createCategorySchema = z
  .object({
    spaceId: idSchema,
    name: z
      .string({ error: CATEGORY_MESSAGES.nameEmpty })
      .trim()
      .min(1, { error: CATEGORY_MESSAGES.nameEmpty })
      .min(2, { error: CATEGORY_MESSAGES.nameShort })
      .max(CATEGORY_NAME_MAX, { error: CATEGORY_MESSAGES.nameLong }),
    icon: z.enum(CATEGORY_ICONS, { error: CATEGORY_MESSAGES.icon }),
    kind: z.enum(CATEGORY_KINDS, { error: CATEGORY_MESSAGES.kind }),
    /** Limite por mês (centavos) ou `null` para não ter limite. */
    limit: z
      .number({ error: CATEGORY_MESSAGES.limit })
      .int({ error: CATEGORY_MESSAGES.limit })
      .positive({ error: CATEGORY_MESSAGES.limit })
      .max(MAX_BUDGET_CENTS, { error: CATEGORY_MESSAGES.limitTooHigh })
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.limit !== null && value.kind !== "out") {
      ctx.addIssue({ code: "custom", path: ["limit"], message: CATEGORY_MESSAGES.limitOnlyOut });
    }
  });
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type CreateCategoryData = z.output<typeof createCategorySchema>;

export const categoryRefSchema = z.object({ spaceId: idSchema, id: idSchema });
export type CategoryRefInput = z.input<typeof categoryRefSchema>;
