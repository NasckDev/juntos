"use client";

import {
  type ExportStatus,
  type IsoDate,
  type Kind,
  todayParts,
  validateExportRange,
  type YearMonth,
  ymAdd,
  ymOf,
} from "@juntos/core";
import { type ReactNode, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { getExportSummary } from "@/server/actions/export";
import type { ExportDefaults } from "@/server/dados-loaders";
import type { ExportSummary } from "@/server/services/export";
import type { CategoryView, MemberOption } from "@/server/services/finance-types";
import type { ExportFormat } from "@/server/validators/export";
import { ExportSide } from "./export-side";
import { MonthYearField, yearOptions } from "./period-fields";

const FORMATS: readonly { value: ExportFormat; title: string; text: string }[] = [
  { value: "xlsx", title: "Excel no modelo da planilha", text: "Uma aba por mês, Visão Geral e Lançamentos" },
  { value: "pdf", title: "PDF para imprimir", text: "Relatório com totais, categorias e a lista" },
  { value: "csv", title: "CSV simples", text: "Uma linha por lançamento, abre em qualquer planilha" },
];
const KINDS: readonly { value: Kind; label: string }[] = [
  { value: "in", label: "Entradas" },
  { value: "out", label: "Saídas" },
  { value: "save", label: "Guardado" },
];
const STATUSES: readonly { value: ExportStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pagos ou recebidos" },
  { value: "open", label: "Em aberto" },
];
const SUMMARY_DEBOUNCE_MS = 250;

export interface ExportFilterState {
  readonly from: YearMonth;
  readonly to: YearMonth;
  readonly kinds: readonly Kind[];
  readonly status: ExportStatus;
  readonly who: string | null;
  readonly categoryIds: readonly string[];
}

export interface ExportPanelProps {
  readonly spaceId: string;
  readonly today: IsoDate;
  readonly defaults: ExportDefaults;
  readonly initialSummary: ExportSummary | null;
  readonly categories: readonly CategoryView[];
  readonly members: readonly MemberOption[];
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Resumo do servidor para os filtros atuais (com espera curta enquanto a pessoa mexe nos filtros). */
function useSummary(spaceId: string, filter: ExportFilterState, valid: boolean, initial: ExportSummary | null) {
  const key = JSON.stringify(filter);
  const [state, setState] = useState<{ key: string; summary: ExportSummary | null; failed: boolean }>({
    key,
    summary: initial,
    failed: false,
  });
  useEffect(() => {
    if (!valid || state.key === key) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void getExportSummary({
        spaceId,
        ...filter,
        kinds: [...filter.kinds],
        categoryIds: [...filter.categoryIds],
      }).then(
        (result) => {
          if (cancelled) return;
          setState(result.ok ? { key, summary: result.data, failed: false } : { key, summary: null, failed: true });
        },
        () => !cancelled && setState({ key, summary: null, failed: true }),
      );
    }, SUMMARY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [spaceId, key, valid, filter, state.key]);
  const fresh = state.key === key;
  return { summary: fresh ? state.summary : null, loading: valid && !fresh, failed: fresh && state.failed };
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-line pt-5 first:border-t-0 first:pt-0", className)}>
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.015em]">{title}</h2>
      {children}
    </section>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-sm font-medium text-muted">{label}</p>
      {/* biome-ignore lint/a11y/useSemanticElements: grupo de botões de alternar (chips), não um fieldset de formulário. */}
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

/** Exportar (`dExport`): formato, período de até 36 meses, filtros e o resumo ao vivo. */
export function ExportPanel({ spaceId, today, defaults, initialSummary, categories, members }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [filter, setFilter] = useState<ExportFilterState>(defaults);
  const nowYm = todayParts(today).ym;
  const year = Number(nowYm.slice(0, 4));
  const error = validateExportRange(filter);
  const { summary, loading, failed } = useSummary(spaceId, filter, error === null, initialSummary);
  const years = yearOptions(year, Number(filter.from.slice(0, 4)), Number(filter.to.slice(0, 4)));
  const update = (patch: Partial<ExportFilterState>) => setFilter((current) => ({ ...current, ...patch }));
  const reversed = filter.from > filter.to;

  const shortcuts: readonly { label: string; from: YearMonth; to: YearMonth }[] = [
    { label: "Este mês", from: nowYm, to: nowYm },
    { label: "Últimos 3 meses", from: ymAdd(nowYm, -2), to: nowYm },
    { label: "Este ano", from: ymOf(year, 1), to: ymOf(year, 12) },
    { label: "Ano passado", from: ymOf(year - 1, 1), to: ymOf(year - 1, 12) },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-start lg:gap-6">
      <Card className="lg:col-span-8">
        <div className="flex flex-col gap-6">
          <Section title="Formato">
            <div role="radiogroup" aria-label="Formato do arquivo" className="grid gap-2 sm:grid-cols-3">
              {FORMATS.map((option) => (
                <label key={option.value} className="relative block min-w-0 cursor-pointer">
                  <input
                    type="radio"
                    name="formato"
                    value={option.value}
                    checked={format === option.value}
                    onChange={() => setFormat(option.value)}
                    className="peer absolute inset-0 opacity-0"
                  />
                  <span
                    className={cn(
                      "block h-full rounded-field border border-line2 px-3.5 py-3 transition-colors",
                      "peer-hover:bg-surface2 peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
                      "peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:shadow-[0_0_0_1px_var(--brand)]",
                    )}
                  >
                    <b className="block font-semibold">{option.title}</b>
                    <small className="mt-0.5 block text-sm text-muted">{option.text}</small>
                  </span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Período">
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <MonthYearField
                label="De"
                which="inicial"
                value={filter.from}
                years={years}
                invalid={reversed}
                onChange={(from) => update({ from })}
              />
              <MonthYearField
                label="Até"
                which="final"
                value={filter.to}
                years={years}
                invalid={reversed}
                onChange={(to) => update({ to })}
              />
            </div>
            {reversed && error ? (
              <p role="alert" className="mt-2 text-sm font-medium text-out">
                {error}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {shortcuts.map((shortcut) => (
                <Chip
                  key={shortcut.label}
                  selected={filter.from === shortcut.from && filter.to === shortcut.to}
                  onClick={() => update({ from: shortcut.from, to: shortcut.to })}
                >
                  {shortcut.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">Até 36 meses por arquivo.</p>
          </Section>

          <Section title="Filtros">
            <p className="-mt-1 mb-4 text-sm text-muted">
              Deixe tudo marcado para exportar todos os lançamentos do período.
            </p>
            <ChipRow label="Tipos">
              {KINDS.map((kind) => (
                <Chip
                  key={kind.value}
                  selected={filter.kinds.includes(kind.value)}
                  onClick={() => update({ kinds: toggle(filter.kinds, kind.value) })}
                >
                  {kind.label}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label="Situação">
              {STATUSES.map((status) => (
                <Chip
                  key={status.value}
                  selected={filter.status === status.value}
                  onClick={() => update({ status: status.value })}
                >
                  {status.label}
                </Chip>
              ))}
            </ChipRow>
            {members.length > 1 ? (
              <ChipRow label="Quem">
                <Chip selected={filter.who === null} onClick={() => update({ who: null })}>
                  Todos
                </Chip>
                {members.map((member) => (
                  <Chip key={member.id} selected={filter.who === member.id} onClick={() => update({ who: member.id })}>
                    {member.name}
                  </Chip>
                ))}
              </ChipRow>
            ) : null}
            <ChipRow label="Categorias">
              <Chip selected={filter.categoryIds.length === 0} onClick={() => update({ categoryIds: [] })}>
                Todas
              </Chip>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  selected={filter.categoryIds.includes(category.id)}
                  onClick={() => update({ categoryIds: toggle(filter.categoryIds, category.id) })}
                >
                  {category.name}
                </Chip>
              ))}
            </ChipRow>
          </Section>
        </div>
      </Card>

      <ExportSide
        className="lg:sticky lg:top-6 lg:col-span-4"
        spaceId={spaceId}
        format={format}
        filter={filter}
        error={reversed ? null : error}
        blocked={error !== null}
        summary={summary}
        loading={loading}
        failed={failed}
      />
    </div>
  );
}
