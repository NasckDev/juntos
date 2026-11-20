"use client";

import type { SplitMode } from "@juntos/core";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { setSplitMode } from "@/server/actions/split";
import { toastError } from "../financas/feedback";
import { useFinanceUi } from "../financas/finance-context";

/** Quanto esperar depois do último movimento do controle antes de salvar o percentual. */
const SLIDER_SAVE_DELAY_MS = 400;
const SLIDER_STEP = 5;

export interface SplitModeCardProps {
  readonly spaceId: string;
  /** Modo salvo no espaço (pode ser "income" e a divisão cair para "equal" por falta de renda). */
  readonly savedMode: SplitMode;
  /** Modo que a divisão usou de fato. */
  readonly mode: SplitMode;
  /** Parte (em %) da primeira pessoa no modo personalizado. */
  readonly pct: number;
  /** Pessoas, na ordem da divisão, com a fração (0 a 1) que cabe a cada uma. */
  readonly people: readonly { readonly name: string; readonly percent: number }[];
  /** "no mês" ou "no período", para os textos. */
  readonly periodWord: string;
}

const MODE_LABELS: Record<SplitMode, string> = {
  equal: "Partes iguais",
  income: "Proporcional à renda",
  custom: "Personalizado",
};

function describe(mode: SplitMode, people: SplitModeCardProps["people"], periodWord: string): string {
  if (mode === "income") {
    const shares = people.map((p) => `${p.name} ${Math.round(p.percent * 100)}%`).join(", ");
    return `Cada um paga na proporção do que recebeu ${periodWord}: ${shares}.`;
  }
  return `Cada pessoa fica com ${Math.round(100 / Math.max(people.length, 1))}% das despesas divididas.`;
}

/** "Como dividir": partes iguais, proporcional à renda e (só com 2 pessoas) personalizado, de 5 em 5. */
export function SplitModeCard({ spaceId, savedMode, mode, pct, people, periodWord }: SplitModeCardProps) {
  const { canEdit } = useFinanceUi();
  const group = useId();
  const sliderId = useId();
  const [, startTransition] = useTransition();
  const [shownMode, setShownMode] = useOptimistic(mode);
  const [shownPct, setShownPct] = useState(pct);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(pct);
  const modes: readonly SplitMode[] = people.length === 2 ? ["equal", "income", "custom"] : ["equal", "income"];
  const [first, second] = people;

  useEffect(() => {
    setShownPct(pct);
    latest.current = pct;
  }, [pct]);

  function save(next: SplitMode, nextPct?: number) {
    startTransition(async () => {
      setShownMode(next);
      const result = await setSplitMode({ spaceId, mode: next, ...(nextPct === undefined ? {} : { pct: nextPct }) });
      if (!result.ok) toastError(result.error);
    });
  }

  function flush() {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    save("custom", latest.current);
  }

  // Saindo da tela com o percentual ainda por salvar, salva antes de ir.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  function onSlide(value: number) {
    setShownPct(value);
    latest.current = value;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SLIDER_SAVE_DELAY_MS);
  }

  const fellBack = savedMode === "income" && mode === "equal";

  return (
    <Card aria-labelledby="como-dividir-t" className="lg:col-span-5">
      <CardHeader title="Como dividir" titleId="como-dividir-t" />
      <div role="radiogroup" aria-labelledby="como-dividir-t" className="flex flex-col gap-1">
        {modes.map((value) => (
          <label
            key={value}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-field px-3 font-medium",
              shownMode === value ? "bg-brand-soft text-brand-text" : "hover:bg-surface2",
              !canEdit && "opacity-70",
            )}
          >
            <input
              type="radio"
              name={group}
              value={value}
              checked={shownMode === value}
              disabled={!canEdit}
              onChange={() => save(value)}
              className="size-4 accent-brand"
            />
            {MODE_LABELS[value]}
          </label>
        ))}
      </div>
      {shownMode === "custom" && first && second ? (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor={sliderId} className="text-sm font-medium">
            {first.name} {shownPct}% e {second.name} {100 - shownPct}%
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={SLIDER_STEP}
            value={shownPct}
            disabled={!canEdit}
            onChange={(event) => onSlide(Number(event.target.value))}
            onBlur={flush}
            className="h-11 w-full accent-brand"
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{describe(shownMode, people, periodWord)}</p>
      )}
      {fellBack ? (
        <p className="mt-2 text-sm text-muted">Sem renda recebida {periodWord}, a divisão fica em partes iguais.</p>
      ) : null}
      {!canEdit ? <p className="mt-3 text-sm text-muted">Quem só vê o espaço não muda a forma de dividir.</p> : null}
    </Card>
  );
}
