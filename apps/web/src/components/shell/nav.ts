import { Bell, ChartColumn, Download, House, List, type LucideIcon, Settings, Target, Users } from "lucide-react";

export type NavKey =
  | "inicio"
  | "lancamentos"
  | "planejamento"
  | "divisao"
  | "relatorios"
  | "notificacoes"
  | "dados"
  | "ajustes";

export interface NavItem {
  key: NavKey;
  href: string;
  /** Nome na barra lateral. */
  label: string;
  /** Nome curto na barra inferior do celular (`SHORT` do protótipo). */
  short: string;
  icon: LucideIcon;
}

/** Os 5 destinos principais (barra lateral e barra inferior), na ordem do protótipo. */
export const MAIN_NAV: readonly NavItem[] = [
  { key: "inicio", href: "/inicio", label: "Início", short: "Início", icon: House },
  { key: "lancamentos", href: "/lancamentos", label: "Lançamentos", short: "Lançamentos", icon: List },
  { key: "planejamento", href: "/planejamento", label: "Planejamento", short: "Planejar", icon: Target },
  { key: "divisao", href: "/divisao", label: "Divisão de contas", short: "Divisão", icon: Users },
  { key: "relatorios", href: "/relatorios", label: "Relatórios", short: "Relatórios", icon: ChartColumn },
];

/** Itens de baixo da barra lateral (só no computador). */
export const SECONDARY_NAV: readonly NavItem[] = [
  { key: "notificacoes", href: "/notificacoes", label: "Notificações", short: "Avisos", icon: Bell },
  { key: "dados", href: "/dados", label: "Importar e exportar", short: "Dados", icon: Download },
  { key: "ajustes", href: "/ajustes", label: "Ajustes", short: "Ajustes", icon: Settings },
];
