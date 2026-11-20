"use client";

import { formatBRL, type IsoDate, isLate, monthShort, totals } from "@juntos/core";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { byDayThenName, categoryOf } from "@/lib/finance";
import { searchTransactions } from "@/server/actions/transactions";
import type { CategoryView, MemberOption, TxView } from "@/server/services/finance-types";
import { SEARCH_LIMIT_MAX, SEARCH_MIN } from "@/server/validators/transactions";
import { CategoryIcon } from "../category-icon";
import { NewEntryButton } from "../controls";
import { useFinanceUi } from "../finance-context";
import { PaidToggle, TxLine, TxTags, TxValue } from "../tx-row";

const FILTERS = ["todos", "pend", "in", "out", "save"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  todos: "Todos",
  pend: "Em aberto",
  in: "Entradas",
  out: "Saídas",
  save: "Guardado",
};
const SORTS = ["dia", "valor", "nome"] as const;
const SORT_OPTIONS = [
  { value: "dia", label: "Por situação e dia" },
  { value: "valor", label: "Maior valor" },
  { value: "nome", label: "Nome" },
] as const;
const DEBOUNCE_MS = 250;

const LIST_PARAMS = {
  q: parseAsString.withDefault(""),
  todos: parseAsBoolean.withDefault(false),
  cat: parseAsString.withDefault(""),
  ordem: parseAsStringLiteral(SORTS).withDefault("dia"),
  filtro: parseAsStringLiteral(FILTERS).withDefault("todos"),
};

export interface ListViewProps {
  readonly txs: readonly TxView[];
  readonly categories: readonly CategoryView[];
  readonly members: readonly MemberOption[];
  readonly today: IsoDate;
  readonly hasData: boolean;
  /** O período tem mais de um mês (mostra o mês em cada linha). */
  readonly multiMonth: boolean;
}

interface Group {
  readonly key: string;
  readonly title: string;
  readonly items: readonly TxView[];
}

function useGlobalSearch(spaceId: string, query: string, enabled: boolean) {
  const [state, setState] = useState<{ query: string; items: readonly TxView[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchTransactions({ spaceId, query, limit: SEARCH_LIMIT_MAX }).then((result) => {
        if (!cancelled) setState({ query, items: result.ok ? result.data : [] });
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [spaceId, query, enabled]);
  return enabled && state?.query === query ? state.items : null;
}

/** Lista do período (`lLista`/`listHtml` do protótipo): busca, filtros, grupos por situação e totais. */
export function ListView({ txs, categories, members, today, hasData, multiMonth }: ListViewProps) {
  const { form } = useFinanceUi();
  const [params, setParams] = useQueryStates(LIST_PARAMS, { history: "replace", scroll: false });
  const query = params.q.trim();
  const global = params.todos && query.length >= SEARCH_MIN;
  const found = useGlobalSearch(form.spaceId, query, global);
  const source = global ? (found ?? []) : txs;
  const needle = query.toLowerCase();

  let list = source.filter((tx) => {
    if (params.filtro === "pend" && tx.paid) return false;
    if (params.filtro !== "todos" && params.filtro !== "pend" && tx.kind !== params.filtro) return false;
    if (params.cat && tx.categoryId !== params.cat) return false;
    return !needle || `${tx.description} ${tx.note}`.toLowerCase().includes(needle);
  });
  if (params.ordem === "valor") list = [...list].sort((a, b) => b.amount - a.amount);
  else if (params.ordem === "nome") list = [...list].sort((a, b) => a.description.localeCompare(b.description));
  else list = [...list].sort(byDayThenName);
  if (global) list = [...list].sort((a, b) => b.competence.localeCompare(a.competence) || a.day - b.day);

  const showMonth = multiMonth || global;
  const groups: Group[] =
    params.ordem === "dia"
      ? [
          { key: "late", title: "Atrasados", items: list.filter((tx) => isLate(tx, today)) },
          { key: "open", title: "Em aberto", items: list.filter((tx) => !tx.paid && !isLate(tx, today)) },
          { key: "done", title: "Concluídos", items: list.filter((tx) => tx.paid) },
        ].filter((group) => group.items.length > 0)
      : [{ key: "all", title: "", items: list }];
  const sum = totals(list);
  const memberName = (id: string | null) => members.find((member) => member.id === id)?.name ?? "—";
  const searching = global && found === null;

  return (
    <Card pad="none" className="max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="busca-lista">
            Buscar
          </label>
          <Input
            id="busca-lista"
            type="search"
            placeholder="Buscar por nome ou observação"
            value={params.q}
            onChange={(event) => void setParams({ q: event.target.value || null })}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm whitespace-nowrap lg:min-h-10">
          <input
            type="checkbox"
            checked={params.todos}
            onChange={(event) => void setParams({ todos: event.target.checked || null })}
            className="size-4 accent-[var(--brand)]"
          />
          Buscar em todos os meses
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
          <Select
            aria-label="Categoria"
            value={params.cat}
            placeholder="Todas as categorias"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            onChange={(event) => void setParams({ cat: event.target.value || null })}
            className="lg:w-52"
          />
          <Select
            aria-label="Ordenar"
            value={params.ordem}
            options={SORT_OPTIONS}
            onChange={(event) => {
              const ordem = SORTS.find((sort) => sort === event.target.value) ?? "dia";
              void setParams({ ordem: ordem === "dia" ? null : ordem });
            }}
            className="lg:w-48"
          />
        </div>
      </div>
      <div className="scrollbar-none -mx-4 mt-3 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((filter) => (
          <Chip
            key={filter}
            selected={params.filtro === filter}
            onClick={() => void setParams({ filtro: filter === "todos" ? null : filter })}
          >
            {FILTER_LABELS[filter]}
          </Chip>
        ))}
      </div>

      {searching ? (
        <p role="status" className="py-8 text-center text-muted">
          Buscando…
        </p>
      ) : list.length === 0 ? (
        hasData ? (
          <EmptyState
            art="search"
            title="Nada por aqui"
            description="Nenhum lançamento com esses filtros neste mês."
            action={<NewEntryButton>Novo lançamento</NewEntryButton>}
          />
        ) : (
          <EmptyState
            art="list"
            title="Nenhum lançamento ainda"
            description="Comece pelo salário ou por uma conta do mês."
            action={<NewEntryButton>Novo lançamento</NewEntryButton>}
          />
        )
      ) : (
        <>
          <DesktopTable
            groups={groups}
            categories={categories}
            today={today}
            memberName={memberName}
            showMonth={showMonth}
          />
          <div className="lg:hidden">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.title || "Lançamentos"}>
                {group.title ? <GroupTitle group={group} /> : null}
                <ul>
                  {group.items.map((tx) => (
                    <TxLine key={tx.id} tx={tx} categories={categories} today={today} showMonth={showMonth} withNote />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            {list.length} {list.length === 1 ? "lançamento" : "lançamentos"}. Entradas{" "}
            <span className="hv num">{formatBRL(sum.in)}</span>, saídas{" "}
            <span className="hv num">{formatBRL(sum.out)}</span>, guardado{" "}
            <span className="hv num">{formatBRL(sum.save)}</span>.
          </p>
        </>
      )}
    </Card>
  );
}

function groupTotal(group: Group): number {
  return group.items.reduce((acc, tx) => acc + tx.amount, 0);
}

function GroupTitle({ group }: { group: Group }) {
  return (
    <h3 className="mt-4 flex items-center justify-between border-b border-line pb-1.5 text-sm font-semibold text-muted first:mt-0">
      <span>
        {group.title} ({group.items.length})
      </span>
      <span className="hv num">{formatBRL(groupTotal(group))}</span>
    </h3>
  );
}

interface DesktopTableProps {
  groups: readonly Group[];
  categories: readonly CategoryView[];
  today: IsoDate;
  memberName: (id: string | null) => string;
  showMonth: boolean;
}

/** Tabela do computador: pago, lançamento, dia, quem, pago com e valor. */
function DesktopTable({ groups, categories, today, memberName, showMonth }: DesktopTableProps) {
  const { openEditEntry } = useFinanceUi();
  return (
    <table className="hidden w-full table-fixed border-collapse lg:table">
      <caption className="sr-only">Lançamentos</caption>
      <colgroup>
        <col className="w-11" />
        <col />
        <col className="w-20" />
        <col className="w-32" />
        <col className="w-36" />
        <col className="w-36" />
      </colgroup>
      <thead>
        <tr className="border-b border-line text-left text-xs font-medium text-muted">
          <th scope="col" className="pb-2">
            <span className="sr-only">Pago</span>
          </th>
          <th scope="col" className="pb-2 font-medium">
            Lançamento
          </th>
          <th scope="col" className="pb-2 font-medium">
            Dia
          </th>
          <th scope="col" className="pb-2 font-medium">
            Quem
          </th>
          <th scope="col" className="pb-2 font-medium">
            Pago com
          </th>
          <th scope="col" className="pb-2 text-right font-medium">
            Valor
          </th>
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.key}>
          {group.title ? (
            <tr>
              <th scope="colgroup" colSpan={5} className="pt-5 pb-1.5 text-left text-sm font-semibold text-muted">
                {group.title} ({group.items.length})
              </th>
              <td className="hv num pt-5 pb-1.5 text-right text-sm font-semibold text-muted">
                {formatBRL(groupTotal(group))}
              </td>
            </tr>
          ) : null}
          {group.items.map((tx) => {
            const category = categoryOf(categories, tx.categoryId);
            return (
              <tr key={tx.id} className="h-14 border-t border-line transition-colors hover:bg-surface2">
                <td className="pl-2">
                  <PaidToggle tx={tx} />
                </td>
                <td className="min-w-0 pr-3">
                  <button
                    type="button"
                    onClick={() => openEditEntry(tx)}
                    className="flex w-full min-w-0 items-center gap-3 rounded-field py-1.5 text-left"
                  >
                    <CategoryIcon icon={category.icon} hue={category.hue} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-medium", tx.paid && "text-muted")}>
                        {tx.description}
                        <TxTags tx={tx} today={today} />
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {showMonth ? `${monthShort(tx.competence)}, ` : ""}
                        {category.name}
                        {tx.note ? `. Obs.: ${tx.note}` : ""}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="num text-sm text-muted">Dia {tx.day}</td>
                <td className="truncate pr-2 text-sm text-muted">{memberName(tx.paidBy)}</td>
                <td className="truncate pr-2 text-sm text-muted">{tx.paymentMethod || "—"}</td>
                <td className="pr-2 text-right">
                  <TxValue tx={tx} />
                </td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}
