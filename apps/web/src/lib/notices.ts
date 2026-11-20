/** Filtros do histórico de avisos (chips do protótipo, `evCat`). Puro: usado na tela e no servidor. */
export const NOTICE_FILTERS = ["todas", "nao-lidas", "contas", "automaticos", "pessoas", "plano"] as const;
export type NoticeFilter = (typeof NOTICE_FILTERS)[number];

export const NOTICE_FILTER_LABELS: Readonly<Record<NoticeFilter, string>> = {
  todas: "Todas",
  "nao-lidas": "Não lidas",
  contas: "Contas",
  automaticos: "Lançamentos automáticos",
  pessoas: "Pessoas",
  plano: "Orçamento e metas",
};

/** `?filtro=` da URL; qualquer outra coisa é "todas". */
export function parseNoticeFilter(value: unknown): NoticeFilter {
  return NOTICE_FILTERS.find((filter) => filter === value) ?? "todas";
}
