import { isRealDate, type YearMonth } from "@juntos/core";
import * as z from "zod";
import { idSchema } from "./common";

/*
 * Validação dos lançamentos. Usada no servidor (Server Actions) e no formulário do cliente (erro na hora, embaixo
 * do campo), por isso só depende do zod e do core. Mensagens iguais às do protótipo (`submit #txf`).
 */

export const TX_KINDS = ["out", "in", "save"] as const;

/** Valor máximo de um lançamento: R$ 10 milhões (o protótipo recusa acima de 1e7 reais). */
export const MAX_AMOUNT_CENTS = 1_000_000_000;
export const DESCRIPTION_MAX = 60;
export const PAYMENT_METHOD_MAX = 30;
export const NOTE_MAX = 80;
export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 480;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export const TX_MESSAGES = {
  amount: "Digite um valor maior que zero, como 120,50.",
  amountTooHigh: "Valor muito alto. Confira se não sobrou um zero.",
  descriptionEmpty: "Escreva uma descrição, como “conta de luz”.",
  descriptionShort: "Use pelo menos 2 letras na descrição.",
  descriptionLong: `Use no máximo ${DESCRIPTION_MAX} caracteres na descrição.`,
  date: "Escolha a data do lançamento.",
  year: "Confira o ano da data.",
  installments: "Parcelas: use um número inteiro de 2 a 480, ou deixe vazio.",
  duplicate: "Já existe um lançamento igual nesse dia. Toque em Salvar de novo para lançar mesmo assim.",
  category: "Escolha uma categoria da lista.",
  paidBy: "Escolha uma pessoa deste espaço.",
  paymentMethodLong: `Use no máximo ${PAYMENT_METHOD_MAX} caracteres em “Pago com”.`,
  noteLong: `Use no máximo ${NOTE_MAX} caracteres na observação.`,
  notFound: "Não encontramos esse lançamento. Ele pode ter sido excluído.",
  recurringMonthTaken: "Essa conta fixa já tem um lançamento nesse mês. Escolha uma data em outro mês.",
} as const;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-20" → competência "2026-11" e dia 20. Supõe uma data já validada. */
export function splitDate(date: string): { competence: YearMonth; day: number } {
  const m = DATE.exec(date);
  if (!m) throw new RangeError(`Data inválida: ${date}`);
  return { competence: `${m[1]}-${m[2]}`, day: Number(m[3]) };
}

export const amountSchema = z
  .number({ error: TX_MESSAGES.amount })
  .int({ error: TX_MESSAGES.amount })
  .positive({ error: TX_MESSAGES.amount })
  .max(MAX_AMOUNT_CENTS, { error: TX_MESSAGES.amountTooHigh });

export const descriptionSchema = z
  .string({ error: TX_MESSAGES.descriptionEmpty })
  .trim()
  .min(1, { error: TX_MESSAGES.descriptionEmpty })
  .min(2, { error: TX_MESSAGES.descriptionShort })
  .max(DESCRIPTION_MAX, { error: TX_MESSAGES.descriptionLong });

export const dateSchema = z
  .string({ error: TX_MESSAGES.date })
  .trim()
  .superRefine((value, ctx) => {
    const m = DATE.exec(value);
    if (!m || !isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))) {
      ctx.addIssue({ code: "custom", message: TX_MESSAGES.date });
      return;
    }
    const year = Number(m[1]);
    if (year < MIN_YEAR || year > MAX_YEAR) ctx.addIssue({ code: "custom", message: TX_MESSAGES.year });
  });

const fields = {
  spaceId: idSchema,
  kind: z.enum(TX_KINDS, { error: "Escolha o tipo: saída, entrada ou guardar." }),
  amount: amountSchema,
  description: descriptionSchema,
  date: dateSchema,
  categoryId: z.uuid({ error: TX_MESSAGES.category }),
  /** Membro que pagou ou recebeu; `null` = "Não informar". */
  paidBy: z.uuid({ error: TX_MESSAGES.paidBy }).nullable(),
  paid: z.boolean(),
  paymentMethod: z.string().trim().max(PAYMENT_METHOD_MAX, { error: TX_MESSAGES.paymentMethodLong }),
  note: z.string().trim().max(NOTE_MAX, { error: TX_MESSAGES.noteLong }),
  /** Gasto pessoal (fica fora da divisão). Só vale para saídas. */
  personal: z.boolean(),
};

export const REPEAT_OPTIONS = ["none", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEAT_OPTIONS)[number];

/** Parcelas digitadas: vazio = sem fim; senão, inteiro de 2 a 480 escrito só com dígitos. */
export function parseInstallments(text: string): number | null | "invalid" {
  const raw = text.trim();
  if (raw === "") return null;
  if (!/^\d+$/.test(raw)) return "invalid";
  const n = Number(raw);
  return n >= MIN_INSTALLMENTS && n <= MAX_INSTALLMENTS ? n : "invalid";
}

export const createTransactionSchema = z
  .object({
    ...fields,
    repeat: z.enum(REPEAT_OPTIONS),
    /** Texto do campo "Parcelas" (só conta com repetição mensal). */
    installments: z.string(),
    /** A pessoa viu o aviso de lançamento igual e tocou em Salvar de novo. */
    confirmDuplicate: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.repeat === "monthly" && parseInstallments(value.installments) === "invalid") {
      ctx.addIssue({ code: "custom", path: ["installments"], message: TX_MESSAGES.installments });
    }
  });
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransactionData = z.output<typeof createTransactionSchema>;

export const EDIT_SCOPES = ["one", "next"] as const;
export type EditScope = (typeof EDIT_SCOPES)[number];

export const updateTransactionSchema = z.object({
  ...fields,
  id: idSchema,
  /** Lançamento de conta fixa: "só neste mês" ou "neste e nos próximos". */
  scope: z.enum(EDIT_SCOPES),
});
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
export type UpdateTransactionData = z.output<typeof updateTransactionSchema>;

export const transactionRefSchema = z.object({ spaceId: idSchema, id: idSchema });
export type TransactionRefInput = z.input<typeof transactionRefSchema>;

export const discardCreatedSchema = z.object({ spaceId: idSchema, id: idSchema, recurrenceId: idSchema.nullable() });
export type DiscardCreatedInput = z.input<typeof discardCreatedSchema>;

export const setPaidSchema = z.object({ spaceId: idSchema, id: idSchema, paid: z.boolean() });
export type SetPaidInput = z.input<typeof setPaidSchema>;

export const SEARCH_MIN = 2;
export const SEARCH_LIMIT_MAX = 200;

export const searchTransactionsSchema = z.object({
  spaceId: idSchema,
  query: z
    .string()
    .trim()
    .min(SEARCH_MIN, { error: "Digite pelo menos 2 letras para buscar." })
    .max(DESCRIPTION_MAX, { error: "Busca muito longa." }),
  limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).default(50),
});
export type SearchTransactionsInput = z.input<typeof searchTransactionsSchema>;
