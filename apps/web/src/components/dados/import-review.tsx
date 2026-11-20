"use client";

import { formatBRL0, type ImportItem, type IsoDate, resolveCompetence, type YearMonth, ymLabel } from "@juntos/core";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toastError, toastWithUndo } from "@/components/financas/feedback";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HideValue } from "@/components/ui/hide-value";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { categoryOf } from "@/lib/finance";
import { cancelImport, confirmImport, reviewImport } from "@/server/actions/import";
import { undo } from "@/server/actions/undo";
import type { ImportReviewData } from "@/server/dados-loaders";
import type { CategoryView } from "@/server/services/finance-types";
import type { ImportDestination } from "@/server/validators/import";
import { yearOptions } from "./period-fields";
import { RadioCards } from "./radio-cards";

const KIND_LABEL = { in: "Entrada", out: "Saída", save: "Guardado" } as const;

export interface ImportReviewProps {
  readonly spaceId: string;
  readonly spaceName: string;
  readonly today: IsoDate;
  readonly review: ImportReviewData;
  readonly categories: readonly CategoryView[];
}

interface MonthGroup {
  readonly ym: YearMonth;
  readonly indexes: readonly number[];
}

function groupByMonth(items: readonly ImportItem[], year: number | null): MonthGroup[] {
  const map = new Map<YearMonth, number[]>();
  items.forEach((item, index) => {
    const ym = resolveCompetence(item, year);
    map.set(ym, [...(map.get(ym) ?? []), index]);
  });
  return [...map].sort(([a], [b]) => a.localeCompare(b)).map(([ym, indexes]) => ({ ym, indexes }));
}

/** "Já existe" do servidor para o ano e o destino escolhidos (a primeira resposta vem pronta da página). */
function useExisting(
  spaceId: string,
  batchId: string,
  year: number | null,
  destination: ImportDestination,
  initial: readonly boolean[],
  initialKey: string,
) {
  const key = `${year ?? ""}|${destination}`;
  const [state, setState] = useState({ key: initialKey, existing: initial });
  useEffect(() => {
    if (state.key === key) return;
    let cancelled = false;
    void reviewImport({ spaceId, batchId, year, destination }).then((result) => {
      if (cancelled) return;
      if (!result.ok) return toastError(result.error);
      setState({ key, existing: result.data.existing });
    });
    return () => {
      cancelled = true;
    };
  }, [spaceId, batchId, year, destination, key, state.key]);
  return state.existing;
}

/** Revisão linha a linha antes de importar (`dImport` com lote). */
export function ImportReview({ spaceId, spaceName, today, review, categories }: ImportReviewProps) {
  const router = useRouter();
  const { pending } = review;
  const monthly = pending.source === "monthly";
  const [year, setYear] = useState<number | null>(monthly ? pending.year : null);
  const [destination, setDestination] = useState<ImportDestination>("here");
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [selected, setSelected] = useState<ReadonlySet<number>>(
    () => new Set(pending.items.flatMap((_, i) => (review.existing[i] ? [] : [i]))),
  );
  const [saving, startSaving] = useTransition();
  const existing = useExisting(
    spaceId,
    pending.id,
    year,
    destination,
    review.existing,
    `${monthly ? pending.year : ""}|here`,
  );

  const groups = groupByMonth(pending.items, monthly ? year : null);
  const chosen = pending.items.filter((_, i) => selected.has(i));
  const totals = { in: 0, out: 0, save: 0 };
  for (const item of chosen) totals[item.kind] += item.amount;
  const existingCount = existing.filter(Boolean).length;
  const allSelected = selected.size === pending.items.length;
  const thisYear = Number(today.slice(0, 4));
  const years = yearOptions(thisYear, pending.year).filter((y) => y <= thisYear + 1);

  function setMany(indexes: readonly number[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const i of indexes) {
        if (on) next.add(i);
        else next.delete(i);
      }
      return next;
    });
  }

  function submit() {
    if (chosen.length === 0) return toastError("Selecione pelo menos um lançamento.");
    startSaving(async () => {
      const result = await confirmImport({
        spaceId,
        batchId: pending.id,
        selected: [...selected].sort((a, b) => a - b),
        year,
        destination,
        mode,
      });
      if (!result.ok) return toastError(result.error);
      const { count, undo: token, openMonth } = result.data;
      toastWithUndo(count === 1 ? "1 lançamento importado." : `${count} lançamentos importados.`, () =>
        undo({ token: token.token }),
      );
      router.push(`/lancamentos?mes=${openMonth}`);
    });
  }

  function cancel() {
    startSaving(async () => {
      const result = await cancelImport({ spaceId, batchId: pending.id });
      if (!result.ok) return toastError(result.error);
      router.refresh();
    });
  }

  const stats = [
    { key: "in", label: "Entradas", value: <HideValue>{formatBRL0(totals.in)}</HideValue> },
    { key: "out", label: "Saídas", value: <HideValue>{formatBRL0(totals.out)}</HideValue> },
    { key: "save", label: "Guardado", value: <HideValue>{formatBRL0(totals.save)}</HideValue> },
    { key: "months", label: "Meses", value: <span className="num">{groups.length}</span> },
  ];

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="grid gap-4 lg:grid-cols-12 lg:items-start lg:gap-6"
    >
      <Card aria-labelledby="imp-rev-t" className="lg:col-span-8">
        <header className="mb-1">
          <h2 id="imp-rev-t" className="text-lg font-semibold tracking-[-0.015em]">
            Revise antes de importar
          </h2>
          <p className="truncate text-sm text-muted">{pending.fileName}</p>
        </header>
        <p className="mt-3 text-sm text-muted">
          Desmarque o que não quer trazer.
          {existingCount > 0
            ? ` ${existingCount} ${existingCount > 1 ? "lançamentos já existem" : "lançamento já existe"} neste espaço e ${
                existingCount > 1 ? "vieram desmarcados" : "veio desmarcado"
              }.`
            : ""}
        </p>
        <div className="mt-4 flex min-h-11 items-center gap-3 border-b border-line pb-3">
          <label className="flex cursor-pointer items-center gap-2.5 font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setMany(
                  pending.items.map((_, i) => i),
                  event.target.checked,
                )
              }
              className="size-5 accent-[var(--brand)]"
            />
            Selecionar todos
          </label>
          <span className="ml-auto text-sm text-muted" aria-live="polite">
            {selected.size} de {pending.items.length} selecionados
          </span>
        </div>

        <div className="flex flex-col">
          {groups.map((group) => {
            const on = group.indexes.filter((i) => selected.has(i)).length;
            const label = ymLabel(group.ym);
            return (
              <section key={group.ym} aria-label={label} className="mt-4">
                <div className="flex min-h-10 items-center gap-2.5 rounded-field bg-surface2 px-3">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${label}`}
                    checked={on === group.indexes.length}
                    onChange={(event) => setMany(group.indexes, event.target.checked)}
                    className="size-4.5 accent-[var(--brand)]"
                  />
                  <h3 className="font-semibold">{label}</h3>
                  <span className="ml-auto text-sm text-muted">
                    {on} de {group.indexes.length}
                  </span>
                </div>
                <ul>
                  {group.indexes.map((index) => {
                    const item = pending.items[index];
                    if (!item) return null;
                    const checked = selected.has(index);
                    const category = categoryOf(categories, item.categoryId);
                    return (
                      <li key={index} className="border-b border-line last:border-b-0">
                        <label
                          className={cn(
                            "flex min-h-14 cursor-pointer items-center gap-3 px-1 py-2.5 transition-colors hover:bg-surface2 lg:px-3",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => setMany([index], event.target.checked)}
                            className="size-5 shrink-0 accent-[var(--brand)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
                              <span className={cn("min-w-0 break-words", !checked && "font-normal text-muted")}>
                                {item.description}
                              </span>
                              {existing[index] ? <Tag kind="late">Já existe</Tag> : null}
                            </span>
                            <small className="block text-sm text-muted">
                              {KIND_LABEL[item.kind]} · {category.name}
                              {item.installmentsTotal !== null
                                ? ` · ${item.installment ?? 0} de ${item.installmentsTotal}`
                                : ""}
                            </small>
                          </span>
                          <Amount
                            cents={item.amount}
                            kind={item.kind}
                            className={cn("shrink-0 text-right", !checked && "font-medium text-muted")}
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </Card>

      <Card aria-labelledby="imp-op-t" className="flex flex-col gap-5 lg:sticky lg:top-6 lg:col-span-4">
        <div>
          <h2 id="imp-op-t" className="text-lg font-semibold tracking-[-0.015em]">
            Importação
          </h2>
          <p className="mt-2">
            <span className="num text-[1.75rem] font-bold tracking-[-0.03em]">{chosen.length}</span>{" "}
            <span className="text-md">{chosen.length === 1 ? "lançamento" : "lançamentos"}</span>
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
            {stats.map((stat) => (
              <div key={stat.key} className="min-w-0">
                <dt className="text-sm text-muted">{stat.label}</dt>
                <dd className="truncate font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {monthly ? (
          <div>
            <label htmlFor="ano-planilha" className="mb-1.5 block text-sm font-medium">
              Ano da planilha
            </label>
            <Select
              id="ano-planilha"
              value={String(year ?? pending.year)}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
        ) : null}

        <RadioCards
          legend="Para onde vão os dados"
          name="destino"
          value={destination}
          onChange={setDestination}
          options={[
            { value: "here", label: `Neste espaço (${spaceName})` },
            { value: "new", label: "Em um espaço novo" },
          ]}
        />
        {destination === "here" ? (
          <RadioCards
            legend="Meses que já têm lançamentos"
            name="modo"
            value={mode}
            onChange={setMode}
            options={[
              { value: "add", label: "Manter e somar os selecionados" },
              { value: "replace", label: "Substituir pelo que está na planilha" },
            ]}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Button type="submit" block disabled={saving || chosen.length === 0}>
            {saving ? "Importando…" : `Importar ${chosen.length} ${chosen.length === 1 ? "lançamento" : "lançamentos"}`}
          </Button>
          <Button type="button" variant="ghost" block disabled={saving} onClick={cancel}>
            Cancelar
          </Button>
          <p className="text-sm text-muted">Dá para desfazer logo depois de importar.</p>
        </div>
      </Card>
    </form>
  );
}
