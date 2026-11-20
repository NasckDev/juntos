/** Seções de Ajustes: cada uma é uma rota (`/ajustes`, `/ajustes/aparencia`...). Conta é a página inicial. */
export const AJUSTES_SECTIONS = [
  { slug: "conta", href: "/ajustes", label: "Conta", shortLabel: "Conta" },
  { slug: "aparencia", href: "/ajustes/aparencia", label: "Aparência", shortLabel: "Aparência" },
  { slug: "avisos", href: "/ajustes/avisos", label: "Avisos", shortLabel: "Avisos" },
  { slug: "pessoas", href: "/ajustes/pessoas", label: "Pessoas e compartilhamento", shortLabel: "Pessoas" },
  { slug: "dados", href: "/ajustes/dados", label: "Dados", shortLabel: "Dados" },
] as const;

export type AjustesSlug = (typeof AJUSTES_SECTIONS)[number]["slug"];

/**
 * Segmentos da URL depois de `/ajustes` para a seção. Vazio (ou "conta") é a Conta; qualquer outra coisa
 * que não seja uma seção conhecida devolve `null` (a página responde 404).
 */
export function resolveSection(segments: readonly string[] | undefined): AjustesSlug | null {
  if (!segments || segments.length === 0) return "conta";
  if (segments.length > 1) return null;
  return AJUSTES_SECTIONS.find((section) => section.slug === segments[0])?.slug ?? null;
}
