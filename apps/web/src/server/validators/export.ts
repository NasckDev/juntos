import { type ExportFilter, isYearMonth, type Kind, validateExportRange, type YearMonth } from "@juntos/core";
import * as z from "zod";
import { idSchema } from "./common";

export const EXPORT_FORMATS = ["xlsx", "pdf", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_STATUSES = ["all", "paid", "open"] as const;
const KIND_VALUES = ["in", "out", "save"] as const;
/** Mais categorias que isso numa URL não é uso normal (padrão + do espaço). */
const MAX_CATEGORIES = 200;

export const EXPORT_MESSAGES = {
  format: "Escolha o formato: Excel, PDF ou CSV.",
  month: "Escolha um mês válido.",
  empty: "Nenhum lançamento com esses filtros.",
  failed: "Não foi possível gerar o arquivo.",
} as const;

const yearMonthSchema = z.custom<YearMonth>((value) => typeof value === "string" && isYearMonth(value), {
  error: EXPORT_MESSAGES.month,
});

/** Filtros da exportação (os mesmos do protótipo: período, tipo, situação, quem e categorias). */
const filterObject = z.object({
  spaceId: idSchema,
  from: yearMonthSchema,
  to: yearMonthSchema,
  kinds: z.array(z.enum(KIND_VALUES)).max(KIND_VALUES.length),
  status: z.enum(EXPORT_STATUSES),
  /** Id do membro (`paidBy`); nulo = todos. */
  who: idSchema.nullable(),
  categoryIds: z.array(idSchema).max(MAX_CATEGORIES),
});

function checkRange(value: FilterShape, ctx: z.RefinementCtx): void {
  const message = validateExportRange(toCoreFilter(value));
  if (message) ctx.addIssue({ code: "custom", message, path: ["from"] });
}

export const exportFilterSchema = filterObject.superRefine(checkRange);

export type ExportFilterInput = z.input<typeof exportFilterSchema>;
export type ExportFilterData = z.output<typeof exportFilterSchema>;

export const exportRequestSchema = filterObject
  .extend({ format: z.enum(EXPORT_FORMATS, { error: EXPORT_MESSAGES.format }) })
  .superRefine(checkRange);
export type ExportRequestData = z.output<typeof exportRequestSchema>;

interface FilterShape {
  readonly from: YearMonth;
  readonly to: YearMonth;
  readonly kinds: readonly Kind[];
  readonly status: ExportFilter["status"];
  readonly who: string | null;
  readonly categoryIds: readonly string[];
}

/** Filtro no formato do core (sem o espaço). */
export function toCoreFilter(value: FilterShape): ExportFilter {
  return {
    from: value.from,
    to: value.to,
    kinds: [...new Set(value.kinds)],
    status: value.status,
    who: value.who,
    categoryIds: [...new Set(value.categoryIds)],
  };
}

const list = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

/**
 * Lê os filtros da URL do download (`/api/exportar?espaco=…&formato=xlsx&de=2026-01&ate=2026-12&tipos=in,out,save
 * &situacao=all&quem=&categorias=`). Ausente = padrão do protótipo (todos os tipos, todas as situações e pessoas).
 */
export function exportParamsToInput(params: URLSearchParams): Record<string, unknown> {
  const kinds = params.get("tipos");
  return {
    spaceId: params.get("espaco") ?? "",
    format: params.get("formato") ?? "",
    from: params.get("de") ?? "",
    to: params.get("ate") ?? "",
    kinds: kinds === null ? [...KIND_VALUES] : list(kinds),
    status: params.get("situacao") || "all",
    who: params.get("quem") || null,
    categoryIds: list(params.get("categorias")),
  };
}

/** O contrário de {@link exportParamsToInput}: a URL do botão "Exportar". */
export function exportUrl(format: ExportFormat, filter: FilterShape & { readonly spaceId: string }): string {
  const params = new URLSearchParams({
    espaco: filter.spaceId,
    formato: format,
    de: filter.from,
    ate: filter.to,
    tipos: filter.kinds.join(","),
    situacao: filter.status,
  });
  if (filter.who) params.set("quem", filter.who);
  if (filter.categoryIds.length > 0) params.set("categorias", filter.categoryIds.join(","));
  return `/api/exportar?${params.toString()}`;
}
