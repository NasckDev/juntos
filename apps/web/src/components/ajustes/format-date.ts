const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

/** "20 de novembro de 2026", sempre no fuso de São Paulo (igual no servidor e no navegador). */
export function formatLongDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}
