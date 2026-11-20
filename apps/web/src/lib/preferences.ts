/**
 * Preferências de aparência aplicadas no `<html>` (ver docs/06-design.md, 6.12).
 * O script anti-flash do layout lê o mesmo item do localStorage antes da primeira pintura.
 */

export const PREFS_STORAGE_KEY = "juntos:prefs";

/** "auto" segue o aparelho. É o mesmo valor guardado no banco (`user_preferences.theme`). */
export type ThemePref = "auto" | "light" | "dark";
export type FontPref = "menor" | "normal" | "grande" | "maior";
export type AccentKey =
  | "indigo"
  | "violeta"
  | "azul"
  | "petroleo"
  | "esmeralda"
  | "oliva"
  | "laranja"
  | "rosa"
  | "vinho"
  | "cafe"
  | "grafite";

export interface AppearancePrefs {
  theme: ThemePref;
  accent: AccentKey;
  font: FontPref;
  hide: boolean;
}

export const DEFAULT_PREFS: AppearancePrefs = { theme: "auto", accent: "indigo", font: "normal", hide: false };

/** As 11 cores de destaque (`ACC` do protótipo): nome e amostra. */
export const ACCENTS: readonly { key: AccentKey; label: string; swatch: string }[] = [
  { key: "indigo", label: "Índigo", swatch: "#4f46e5" },
  { key: "violeta", label: "Violeta", swatch: "#8039d0" },
  { key: "azul", label: "Azul", swatch: "#1563d6" },
  { key: "petroleo", label: "Petróleo", swatch: "#0f7585" },
  { key: "esmeralda", label: "Esmeralda", swatch: "#0a7f62" },
  { key: "oliva", label: "Oliva", swatch: "#586f2a" },
  { key: "laranja", label: "Laranja", swatch: "#bd4f0f" },
  { key: "rosa", label: "Rosa", swatch: "#bf2270" },
  { key: "vinho", label: "Vinho", swatch: "#ad2950" },
  { key: "cafe", label: "Café", swatch: "#7f5639" },
  { key: "grafite", label: "Grafite", swatch: "#434a60" },
];

/** Os 4 tamanhos de letra (`FONT` do protótipo). */
export const FONT_SIZES: readonly { key: FontPref; label: string }[] = [
  { key: "menor", label: "Menor" },
  { key: "normal", label: "Normal" },
  { key: "grande", label: "Grande" },
  { key: "maior", label: "Maior" },
];

/**
 * Lê o tema guardado no navegador. Aceita o valor antigo `"system"` (de antes de o tema se chamar `"auto"`)
 * e trata qualquer valor desconhecido como `"auto"`.
 */
export function normalizeTheme(value: unknown): ThemePref {
  return value === "light" || value === "dark" ? value : "auto";
}

/** Preferências do servidor (`getAppContext().preferences`) no formato do `<html>`. */
export function toAppearance(server: {
  theme: ThemePref;
  accent: AccentKey;
  fontSize: FontPref;
  hideValues: boolean;
}): AppearancePrefs {
  return { theme: server.theme, accent: server.accent, font: server.fontSize, hide: server.hideValues };
}

/** Aplica no `<html>` e guarda no localStorage para a próxima visita abrir sem piscar. */
export function applyPreferences(prefs: AppearancePrefs): void {
  const root = document.documentElement;
  if (prefs.theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", prefs.theme);
  root.setAttribute("data-accent", prefs.accent);
  root.setAttribute("data-font", prefs.font);
  if (prefs.hide) root.setAttribute("data-hide", "true");
  else root.removeAttribute("data-hide");
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sem localStorage (modo privado restrito): as preferências valem só nesta página.
  }
}
