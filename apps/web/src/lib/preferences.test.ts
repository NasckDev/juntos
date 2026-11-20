import { describe, expect, it } from "vitest";
import { applyPreferences, DEFAULT_PREFS, normalizeTheme, PREFS_STORAGE_KEY } from "./preferences";

describe("tema", () => {
  it("o padrão é 'auto', o mesmo valor do banco", () => {
    expect(DEFAULT_PREFS.theme).toBe("auto");
  });

  it("aceita o 'system' antigo do localStorage como 'auto'", () => {
    expect(normalizeTheme("system")).toBe("auto");
    expect(normalizeTheme("auto")).toBe("auto");
    expect(normalizeTheme(undefined)).toBe("auto");
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
  });

  it("'auto' não escreve data-theme e fica guardado como 'auto'", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    applyPreferences({ ...DEFAULT_PREFS, theme: "auto" });
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? "{}")).toMatchObject({ theme: "auto" });
  });
});
