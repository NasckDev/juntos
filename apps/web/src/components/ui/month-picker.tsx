"use client";

import {
  MAX_SCREEN_SPAN,
  MONTH_NAMES,
  parseYearMonth,
  periodLabel,
  type YearMonth,
  ymAdd,
  ymDiff,
  ymOf,
} from "@juntos/core";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { Chip } from "./chip";
import { IconButton } from "./icon-button";
import { Segmented } from "./segmented";
import { DESKTOP_QUERY, useMediaQuery } from "./use-media-query";

export interface MonthPeriod {
  /** Primeiro mês, "2026-11". */
  start: YearMonth;
  /** Quantos meses (1 a 3). */
  span: number;
}

export interface MonthPickerProps {
  value: MonthPeriod;
  onChange: (next: MonthPeriod) => void;
  /** Mês de hoje (America/Sao_Paulo), vindo de fora. */
  currentYm: YearMonth;
  /** Liga o modo Período (até 3 meses). Telas como Calendário usam um mês só. */
  allowRange?: boolean;
  className?: string;
}

type Mode = "one" | "range";
const COLUMNS = 3;
const MODE_OPTIONS = [
  { value: "one", label: "Um mês" },
  { value: "range", label: "Período" },
] as const;

/**
 * Seletor de mês e período do protótipo (`mpHtml`): grade de meses, troca de ano, até 3 meses, "Mês atual".
 * No computador a grade abre num popover; no celular, numa folha de baixo (cabe inteira na tela).
 */
export function MonthPicker({ value, onChange, currentYm, allowRange = false, className }: MonthPickerProps) {
  const span = allowRange ? Math.min(Math.max(value.span, 1), MAX_SCREEN_SPAN) : 1;
  const isRange = span > 1;
  const isCurrent = value.start === currentYm && span === 1;
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const [open, setOpen] = useState(false);
  const dialogLabel = allowRange ? "Escolher mês ou período" : "Escolher mês";

  function shift(direction: 1 | -1) {
    onChange({ start: ymAdd(value.start, direction * span), span });
  }

  const trigger = (
    <button
      type="button"
      title={dialogLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={isDesktop ? undefined : () => setOpen(true)}
      className="hit flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 px-2 font-semibold whitespace-nowrap lg:min-w-[9.5rem]"
    >
      <span className="truncate">{periodLabel(value.start, span)}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
    </button>
  );

  const grid = (
    <MonthGrid
      value={{ start: value.start, span }}
      currentYm={currentYm}
      allowRange={allowRange}
      onPick={(next) => {
        onChange(next);
        setOpen(false);
      }}
      onClose={() => setOpen(false)}
    />
  );

  const bar = (
    <div className="flex h-11 min-w-0 flex-1 items-center rounded-field border border-line2 bg-surface lg:h-10 lg:flex-none">
      <IconButton
        label={isRange ? "Período anterior" : "Mês anterior"}
        icon={<ChevronLeft />}
        onClick={() => shift(-1)}
        className="lg:size-[2.375rem]"
      />
      {isDesktop ? <Popover.Trigger asChild>{trigger}</Popover.Trigger> : trigger}
      <IconButton
        label={isRange ? "Próximo período" : "Próximo mês"}
        icon={<ChevronRight />}
        onClick={() => shift(1)}
        className="lg:size-[2.375rem]"
      />
    </div>
  );

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2 lg:flex-none", className)}>
      {isCurrent ? null : (
        // No celular o "Voltar para o mês atual" fica dentro da folha, para o mês caber inteiro na barra.
        <Button
          variant="line"
          size="sm"
          className="hidden h-11 sm:inline-flex lg:h-10"
          onClick={() => onChange({ start: currentYm, span: 1 })}
        >
          Mês atual
        </Button>
      )}
      {isDesktop ? (
        <Popover.Root open={open} onOpenChange={setOpen}>
          {bar}
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={6}
              collisionPadding={16}
              aria-label={dialogLabel}
              className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-3 shadow-pop outline-none data-[state=open]:animate-pop-in"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              {grid}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <>
          {bar}
          <Drawer.Root open={open} onOpenChange={setOpen} autoFocus>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgba(10,11,15,.42)]" />
              <Drawer.Content
                aria-describedby={undefined}
                className="pb-safe fixed inset-x-0 bottom-0 z-50 rounded-t-[1.25rem] bg-surface px-4 pt-2.5 outline-none"
              >
                <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line2" />
                <Drawer.Title className="mb-3 text-lg font-semibold">{dialogLabel}</Drawer.Title>
                <div className="pb-4">{grid}</div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </>
      )}
    </div>
  );
}

interface MonthGridProps {
  value: MonthPeriod;
  currentYm: YearMonth;
  allowRange: boolean;
  onPick: (next: MonthPeriod) => void;
  onClose: () => void;
}

function MonthGrid({ value, currentYm, allowRange, onPick, onClose }: MonthGridProps) {
  const end = ymAdd(value.start, value.span - 1);
  const [year, setYear] = useState(() => parseYearMonth(end).year);
  const [mode, setMode] = useState<Mode>(value.span > 1 ? "range" : "one");
  const [first, setFirst] = useState<YearMonth | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(() => parseYearMonth(end).month - 1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const initialFocus = useRef(focusIndex);

  // Ao abrir, o foco vai para o mês escolhido; as setas andam a partir dele.
  useEffect(() => {
    buttons.current[initialFocus.current]?.focus();
  }, []);

  function focusMonth(index: number) {
    setFocusIndex(index);
    buttons.current[index]?.focus();
  }

  function pick(ym: YearMonth) {
    if (mode === "one") {
      onPick({ start: ym, span: 1 });
      return;
    }
    if (!first) {
      setFirst(ym);
      setMessage(null);
      return;
    }
    const a = ym < first ? ym : first;
    const z = ym < first ? first : ym;
    const months = ymDiff(a, z) + 1;
    if (months > MAX_SCREEN_SPAN) {
      setFirst(ym);
      setMessage("Escolha no máximo 3 meses. Comece de novo a partir deste.");
      return;
    }
    onPick({ start: a, span: months });
  }

  function onGridKey(event: KeyboardEvent<HTMLFieldSetElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLUMNS, ArrowDown: COLUMNS };
    let next: number | null = null;
    const delta = moves[event.key];
    if (delta !== undefined) next = focusIndex + delta;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 11;
    if (next === null) return;
    event.preventDefault();
    if (next < 0) {
      setYear((y) => y - 1);
      next += 12;
    } else if (next > 11) {
      setYear((y) => y + 1);
      next -= 12;
    }
    focusMonth(next);
  }

  const hint =
    mode === "range"
      ? first
        ? "Agora toque no último mês (até 3 no total)."
        : "Toque no primeiro e no último mês, até 3 meses."
      : null;

  return (
    <div>
      {allowRange ? (
        <Segmented
          label="Tipo de seleção"
          options={MODE_OPTIONS}
          value={mode}
          size="sm"
          onValueChange={(next) => {
            setMode(next);
            setFirst(null);
            setMessage(null);
          }}
          className="mb-3"
        />
      ) : null}
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Ano anterior" icon={<ChevronLeft />} size="sm" onClick={() => setYear((y) => y - 1)} />
        <p className="num font-semibold" aria-live="polite">
          {year}
        </p>
        <IconButton label="Próximo ano" icon={<ChevronRight />} size="sm" onClick={() => setYear((y) => y + 1)} />
      </div>
      {hint ? <p className="mb-2 text-xs text-muted">{hint}</p> : null}
      <fieldset className="m-0 grid min-w-0 grid-cols-3 gap-1 border-0 p-0" onKeyDown={onGridKey}>
        <legend className="sr-only">Meses de {year}</legend>
        {MONTH_NAMES.map((name, i) => {
          const ym = ymOf(year, i + 1);
          const selected = first ? ym === first : ym === value.start || ym === end;
          const inside = !first && ym > value.start && ym < end;
          const isNow = ym === currentYm;
          return (
            <button
              key={name}
              ref={(node) => {
                buttons.current[i] = node;
              }}
              type="button"
              tabIndex={i === focusIndex ? 0 : -1}
              aria-pressed={selected || inside}
              aria-label={`${name} de ${year}${isNow ? ", mês atual" : ""}`}
              onClick={() => pick(ym)}
              onFocus={() => setFocusIndex(i)}
              className={cn(
                "relative h-11 rounded-[0.55rem] text-sm font-medium transition-colors lg:h-10",
                "hover:bg-surface3",
                inside && "bg-brand-soft text-brand-text hover:bg-brand-soft",
                selected && "bg-brand font-semibold text-brand-ink hover:bg-brand",
              )}
            >
              {name.slice(0, 3)}
              {isNow ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full",
                    selected ? "bg-brand-ink" : "bg-brand",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </fieldset>
      {message ? (
        <p role="status" className="mt-2 text-xs font-medium text-warn">
          {message}
        </p>
      ) : null}
      {mode === "range" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip onClick={() => onPick({ start: ymAdd(currentYm, -2), span: 3 })}>Últimos 3 meses</Chip>
          <Chip onClick={() => onPick({ start: currentYm, span: 3 })}>Próximos 3 meses</Chip>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <Button variant="link" size="sm" onClick={() => onPick({ start: currentYm, span: 1 })}>
          Voltar para o mês atual
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
