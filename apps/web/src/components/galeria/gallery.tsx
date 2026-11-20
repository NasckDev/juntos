"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import {
  ACCENTS,
  type AppearancePrefs,
  applyPreferences,
  DEFAULT_PREFS,
  FONT_SIZES,
  type FontPref,
  normalizeTheme,
  type ThemePref,
} from "@/lib/preferences";
import { GalleryHome } from "./gallery-home";
import {
  AvatarsSection,
  ChartsSection,
  ControlsSection,
  DataSection,
  FormsSection,
  OverlaysSection,
  StatesSection,
} from "./gallery-sections";

const THEMES = [
  { value: "auto", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
] as const satisfies readonly { value: ThemePref; label: string }[];

const FONT_OPTIONS = FONT_SIZES.map((f) => ({ value: f.key, label: f.label }));

function readInitialPrefs(): AppearancePrefs {
  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  return {
    theme: normalizeTheme(theme),
    accent: (ACCENTS.find((a) => a.key === root.getAttribute("data-accent"))?.key ??
      "indigo") as AppearancePrefs["accent"],
    font: (FONT_SIZES.find((f) => f.key === root.getAttribute("data-font"))?.key ?? "normal") as FontPref,
    hide: root.getAttribute("data-hide") === "true",
  };
}

/** Galeria do design system, dentro da casca real, para revisão visual (só em desenvolvimento). */
export function Gallery() {
  const [prefs, setPrefs] = useState<AppearancePrefs>(DEFAULT_PREFS);

  // O script anti-flash já aplicou as preferências no <html>; a galeria só lê o estado depois de hidratar.
  useEffect(() => setPrefs(readInitialPrefs()), []);

  function update(patch: Partial<AppearancePrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyPreferences(next);
  }

  return (
    <AppShell
      user={{ name: "Rafa Souza", avatar: "a1" }}
      space={{ id: "casa", name: "Casa", memberCount: 2 }}
      active="inicio"
      unreadCount={2}
      hideValues={prefs.hide}
      onToggleHideValues={() => update({ hide: !prefs.hide })}
      onNewEntry={() => undefined}
      onSearch={() => undefined}
      onOpenSpaces={() => undefined}
    >
      <Card tone="flat" aria-label="Aparência da galeria" className="mb-8">
        <p className="mb-4 text-sm text-muted">
          Galeria do design system (só em desenvolvimento). Os números do exemplo são inventados para revisar o layout.
        </p>
        <div className="grid gap-5 lg:grid-cols-[auto_auto_1fr] lg:items-start lg:gap-8">
          <div>
            <p className="mb-2 text-sm font-medium">Tema</p>
            <Segmented label="Tema" options={THEMES} value={prefs.theme} onValueChange={(theme) => update({ theme })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Tamanho da letra</p>
            <Segmented
              label="Tamanho da letra"
              options={FONT_OPTIONS}
              value={prefs.font}
              onValueChange={(font) => update({ font })}
            />
          </div>
          <Switch
            checked={prefs.hide}
            onCheckedChange={(hide) => update({ hide })}
            label="Esconder valores"
            description="Desfoca os valores em toda a tela"
          />
          <fieldset className="lg:col-span-3">
            <legend className="mb-2 text-sm font-medium">Cor de destaque</legend>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={prefs.accent === a.key}
                  aria-label={a.label}
                  title={a.label}
                  onClick={() => update({ accent: a.key })}
                  className={cn(
                    "hit grid size-9 place-items-center rounded-full text-white",
                    "aria-pressed:shadow-[0_0_0_2px_var(--surface2),0_0_0_4px_var(--ink)]",
                  )}
                  style={{ background: a.swatch }}
                >
                  {prefs.accent === a.key ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : null}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <GalleryHome />
      <ControlsSection />
      <FormsSection />
      <DataSection />
      <ChartsSection />
      <StatesSection />
      <OverlaysSection />
      <AvatarsSection />
    </AppShell>
  );
}
