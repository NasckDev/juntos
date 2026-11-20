"use client";

import { Check } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import {
  ACCENTS,
  type AppearancePrefs,
  applyPreferences,
  FONT_SIZES,
  type FontPref,
  type ThemePref,
} from "@/lib/preferences";
import { updatePreferences } from "@/server/actions/account";
import type { UpdatePreferencesInput } from "@/server/validators/preferences";

/** Prévia de cada tema (`th` do protótipo): fundo, destaque e duas superfícies. */
const THEME_OPTIONS: readonly { value: ThemePref; label: string; background: string; side: string; main: string }[] = [
  {
    value: "auto",
    label: "Automático",
    background: "linear-gradient(90deg,#f3f4f7 50%,#0d1017 50%)",
    side: "#ffffff",
    main: "#1b202b",
  },
  { value: "light", label: "Claro", background: "#f3f4f7", side: "#ffffff", main: "#ffffff" },
  { value: "dark", label: "Escuro", background: "#0d1017", side: "#1b202b", main: "#1b202b" },
];

const SAVE_ERROR = "Não foi possível salvar agora. Tente de novo.";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="text-md font-semibold">{title}</h3>
      {description ? <p className="mt-0.5 mb-4 text-sm text-muted">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

/**
 * Aparência: tema, cor de destaque, tamanho da letra e esconder valores. Aplica na hora no `<html>`
 * (e no localStorage que o script anti-flash lê) e salva no servidor; se salvar falhar, desfaz.
 */
export function AparenciaPanel({ initial }: { initial: AppearancePrefs }) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(initial);

  // Em outro aparelho, o localStorage pode estar vazio ou antigo: o servidor é a fonte da verdade.
  useEffect(() => {
    applyPreferences(initial);
  }, [initial]);

  async function change(patch: Partial<AppearancePrefs>, server: UpdatePreferencesInput) {
    const previous = prefs;
    const next = { ...previous, ...patch };
    setPrefs(next);
    applyPreferences(next);
    const result = await updatePreferences(server);
    if (!result.ok) {
      setPrefs(previous);
      applyPreferences(previous);
      toast.error(result.error || SAVE_ERROR);
    }
  }

  return (
    <Card className="max-w-3xl">
      <Section title="Tema" description="Automático segue a configuração do seu aparelho.">
        <fieldset className="m-0 grid max-w-md min-w-0 grid-cols-3 gap-3 border-0 p-0">
          <legend className="sr-only">Tema</legend>
          {THEME_OPTIONS.map((option) => {
            const selected = prefs.theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => void change({ theme: option.value }, { theme: option.value })}
                className={cn(
                  "hit flex flex-col gap-2 rounded-field p-2 text-center text-sm font-medium shadow-[inset_0_0_0_1px_var(--line2)] transition-shadow",
                  "hover:bg-surface2 aria-pressed:font-semibold aria-pressed:shadow-[inset_0_0_0_2px_var(--brand)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 gap-1 rounded-[0.5rem] p-1.5"
                  style={{ background: option.background }}
                >
                  <i className="w-1/5 rounded-[0.25rem] bg-brand" />
                  <i className="flex-1 rounded-[0.25rem]" style={{ background: option.side }} />
                  <i className="flex-1 rounded-[0.25rem]" style={{ background: option.main }} />
                </span>
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </Section>

      <Section
        title="Cor de destaque"
        description="Usada em botões, seleções e gráficos. Verde e vermelho continuam reservados para entradas e saídas."
      >
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-3 border-0 p-0">
          <legend className="sr-only">Cor de destaque</legend>
          {ACCENTS.map((accent) => {
            const selected = prefs.accent === accent.key;
            return (
              <button
                key={accent.key}
                type="button"
                aria-pressed={selected}
                aria-label={accent.label}
                title={accent.label}
                onClick={() => void change({ accent: accent.key }, { accent: accent.key })}
                style={{ background: accent.swatch }}
                className={cn(
                  "hit grid size-10 place-items-center rounded-full text-white transition-shadow lg:size-9",
                  "aria-pressed:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--ink)]",
                )}
              >
                {selected ? <Check aria-hidden="true" className="size-5" strokeWidth={3} /> : null}
              </button>
            );
          })}
        </fieldset>
      </Section>

      <Section title="Tamanho da letra" description="Aumente se estiver difícil de ler.">
        <Segmented<FontPref>
          label="Tamanho da letra"
          className="max-w-md"
          options={FONT_SIZES.map((font) => ({ value: font.key, label: font.label }))}
          value={prefs.font}
          onValueChange={(font) => void change({ font }, { fontSize: font })}
        />
      </Section>

      <Section title="Valores">
        <Switch
          label="Esconder valores"
          description="Desfoca os valores na tela. Útil em lugares públicos. O botão do olho, no alto, faz o mesmo."
          checked={prefs.hide}
          onCheckedChange={(hide) => void change({ hide }, { hideValues: hide })}
        />
      </Section>
    </Card>
  );
}
