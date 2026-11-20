import * as z from "zod";
import { idSchema } from "./common";

/** Mensagens do protótipo (`#file` change, `doImport`) e da validação do arquivo no servidor. */
export const IMPORT_MESSAGES = {
  notXlsx: "Não consegui ler esse arquivo. Confira se é uma planilha .xlsx.",
  tooBig: "A planilha passa de 4 MB. Escolha um arquivo menor.",
  missingFile: "Escolha uma planilha .xlsx para importar.",
  noSheets: "Não encontrei abas de meses (Janeiro a Dezembro) nem uma aba “Lançamentos” nesse arquivo.",
  selectOne: "Selecione pelo menos um lançamento.",
  gone: "Essa importação não está mais disponível. Escolha a planilha de novo.",
  year: "Escolha o ano da planilha.",
} as const;

/**
 * Limite do upload (especificação 5.7). A Vercel recusa corpo de requisição acima de 4,5 MB antes de chegar ao app;
 * com 4 MB, o arquivo mais a folga do formulário (`IMPORT_MULTIPART_OVERHEAD`) sempre cabem e a pessoa recebe a
 * mensagem `tooBig` em vez de um erro genérico da plataforma.
 */
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

/** Folga para o resto do formulário multipart (cabeçalhos das partes e o id do espaço). */
export const IMPORT_MULTIPART_OVERHEAD = 64 * 1024;

/** Limite de corpo das funções da Vercel (4,5 MB), em bytes, contado de forma conservadora. */
export const PLATFORM_BODY_LIMIT_BYTES = 4_500_000;

/** Ano da planilha mensal: o protótipo oferece de 5 anos atrás até o ano que vem. */
const yearSchema = z.number({ error: IMPORT_MESSAGES.year }).int().min(2000).max(2100);

export const IMPORT_DESTINATIONS = ["here", "new"] as const;
export type ImportDestination = (typeof IMPORT_DESTINATIONS)[number];

const batchRef = { spaceId: idSchema, batchId: idSchema };

export const reviewImportSchema = z.object({
  ...batchRef,
  year: yearSchema.nullable(),
  destination: z.enum(IMPORT_DESTINATIONS),
});
export type ReviewImportInput = z.input<typeof reviewImportSchema>;

export const confirmImportSchema = z.object({
  ...batchRef,
  /** Índices dos itens marcados na revisão. */
  selected: z
    .array(z.number().int().min(0), { error: IMPORT_MESSAGES.selectOne })
    .min(1, { error: IMPORT_MESSAGES.selectOne })
    .max(20_000),
  year: yearSchema.nullable(),
  destination: z.enum(IMPORT_DESTINATIONS),
  mode: z.enum(["add", "replace"]),
});
export type ConfirmImportInput = z.input<typeof confirmImportSchema>;
export type ConfirmImportData = z.output<typeof confirmImportSchema>;

export const cancelImportSchema = z.object(batchRef);
export type CancelImportInput = z.input<typeof cancelImportSchema>;
