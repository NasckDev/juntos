"use client";

import type { IsoDate, Kind } from "@juntos/core";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import type { Repeat } from "@/server/validators/transactions";
import { useFinanceUi } from "./finance-context";
import { usePeriod } from "./use-period";

/** Seletor de mês e período ligado à URL. */
export function PeriodPicker({ allowRange = true, className }: { allowRange?: boolean; className?: string }) {
  const { form } = useFinanceUi();
  const { period, currentYm, setPeriod } = usePeriod(form.today);
  return (
    <MonthPicker
      value={allowRange ? period : { start: period.start, span: 1 }}
      onChange={setPeriod}
      currentYm={currentYm}
      allowRange={allowRange}
      {...(className ? { className } : {})}
    />
  );
}

export interface NewEntryButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  kind?: Kind;
  repeat?: Repeat;
  date?: IsoDate;
  children: ReactNode;
  /** Sem ícone de "+" (os passos do Início têm o próprio desenho). */
  plain?: boolean;
}

/** Botão que abre o formulário de lançamento novo, já com tipo, repetição ou data. */
export function NewEntryButton({ kind, repeat, date, children, plain = false, ...props }: NewEntryButtonProps) {
  const { openNewEntry } = useFinanceUi();
  return (
    <Button
      icon={plain ? undefined : <Plus />}
      onClick={() =>
        openNewEntry({
          ...(kind ? { kind } : {}),
          ...(repeat ? { repeat } : {}),
          ...(date ? { date } : {}),
        })
      }
      {...props}
    >
      {children}
    </Button>
  );
}

export interface StartStepProps {
  step: number;
  title: string;
  text: string;
  kind: Kind;
}

/** Passo do estado vazio do Início que abre o formulário já como conta fixa. */
export function StartStep({ step, title, text, kind }: StartStepProps) {
  const { openNewEntry } = useFinanceUi();
  return (
    <button
      type="button"
      onClick={() => openNewEntry({ kind, repeat: "monthly" })}
      className="flex min-h-24 w-full items-start gap-3 rounded-panel border border-line bg-surface p-4 text-left transition-colors hover:border-line2 hover:bg-surface2"
    >
      <StepNumber step={step} />
      <span className="min-w-0">
        <b className="block font-semibold">{title}</b>
        <small className="mt-0.5 block text-sm text-muted">{text}</small>
      </span>
    </button>
  );
}

export function StepNumber({ step }: { step: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-text"
    >
      {step}
    </span>
  );
}
