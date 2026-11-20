"use client";

import { formatBRL, type IsoDate, type Kind, monthName, monthShort, todayParts, ymAdd, ymDiff } from "@juntos/core";
import { Pencil } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { categoryOf } from "@/lib/finance";
import type { CategoryView, RecurrenceView } from "@/server/services/finance-types";
import { CategoryIcon } from "../category-icon";
import { NewEntryButton } from "../controls";
import { useFinanceUi } from "../finance-context";

export interface FixedViewProps {
  readonly recurrences: readonly RecurrenceView[];
  readonly categories: readonly CategoryView[];
  readonly today: IsoDate;
}

const GROUPS: readonly { kind: Kind; title: string }[] = [
  { kind: "out", title: "Saídas fixas" },
  { kind: "in", title: "Entradas fixas" },
  { kind: "save", title: "Guardado" },
];

/** Valor por mês: contas anuais divididas por 12. */
function monthly(rec: RecurrenceView): number {
  return rec.frequency === "yearly" ? Math.round(rec.amount / 12) : rec.amount;
}

/** Contas fixas (`lFixas` do protótipo): resumo mensal, parcelamentos e as contas por tipo. */
export function FixedView({ recurrences, categories, today }: FixedViewProps) {
  const { openRecurrence } = useFinanceUi();
  const nowYm = todayParts(today).ym;

  if (recurrences.length === 0) {
    return (
      <Card>
        <EmptyState
          art="list"
          title="Nenhuma conta fixa"
          description="O app lança sozinho, todo mês ou todo ano, o que você marcar para repetir."
          action={<NewEntryButton repeat="monthly">Nova conta fixa</NewEntryButton>}
        />
      </Card>
    );
  }

  const active = recurrences.filter((rec) => !rec.paused);
  const sum = (kind: Kind) => active.filter((rec) => rec.kind === kind).reduce((acc, rec) => acc + monthly(rec), 0);
  const installments = recurrences.filter((rec) => rec.installmentsTotal !== null);

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
      <Card aria-label="Resumo das contas fixas" className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
          <Stat label="Entra por mês" value={formatBRL(sum("in"))} tone="in" />
          <Stat label="Sai por mês" value={formatBRL(sum("out"))} hint="Contas anuais divididas por 12" />
          <Stat label="Guarda por mês" value={formatBRL(sum("save"))} tone="save" />
          <Stat
            label="Livre por mês"
            value={formatBRL(sum("in") - sum("out") - sum("save"))}
            hint="Antes dos gastos variáveis"
          />
        </div>
      </Card>

      {installments.length > 0 ? (
        <Card aria-labelledby="parc-t" className="lg:col-span-12">
          <CardHeader title="Parcelamentos" titleId="parc-t" />
          <ul className="grid gap-5 lg:grid-cols-2 lg:gap-x-10">
            {installments.map((rec) => {
              const total = rec.installmentsTotal ?? 1;
              const done = Math.min(total, Math.max(ymDiff(rec.start, nowYm) + 1, 0));
              const category = categoryOf(categories, rec.categoryId);
              return (
                <li key={rec.id}>
                  <p className="mb-1.5 flex items-center gap-2">
                    <CategoryIcon icon={category.icon} hue={category.hue} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{rec.description}</span>
                    <span className="text-sm whitespace-nowrap text-muted">
                      {done} de {total}, até {monthShort(ymAdd(rec.start, total - 1))}
                    </span>
                  </p>
                  <Progress value={done} max={total} label={`${rec.description}, ${done} de ${total} parcelas`} />
                  <p className="mt-1 text-xs text-muted">
                    Pago <span className="hv num">{formatBRL(done * rec.amount)}</span>. Falta{" "}
                    <span className="hv num">{formatBRL((total - done) * rec.amount)}</span>.
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {GROUPS.map(({ kind, title }) => {
        const items = recurrences.filter((rec) => rec.kind === kind);
        if (items.length === 0) return null;
        return (
          <Card
            key={kind}
            aria-labelledby={`fixas-${kind}`}
            className={kind === "out" ? "lg:col-span-12" : "lg:col-span-6"}
          >
            <CardHeader
              title={title}
              titleId={`fixas-${kind}`}
              description={`${items.length} ${items.length > 1 ? "itens" : "item"}`}
            />
            <ul className={cn(kind === "out" && "lg:grid lg:grid-cols-2 lg:gap-x-10")}>
              {items.map((rec) => {
                const category = categoryOf(categories, rec.categoryId);
                const when =
                  rec.frequency === "yearly"
                    ? `Todo ano em ${monthName(rec.start).toLowerCase()}, dia ${rec.day}`
                    : `Todo dia ${rec.day}`;
                return (
                  <li
                    key={rec.id}
                    className={cn(
                      "flex min-h-14 items-center gap-3 border-t border-line py-2 first:border-t-0",
                      kind === "out" && "lg:[&:nth-child(2)]:border-t-0",
                    )}
                  >
                    <CategoryIcon icon={category.icon} hue={category.hue} />
                    <button
                      type="button"
                      onClick={() => openRecurrence(rec)}
                      className="min-w-0 flex-1 rounded-field py-1 text-left"
                    >
                      <span className={cn("block truncate font-medium", rec.paused && "text-muted")}>
                        {rec.description}
                        {rec.paused ? (
                          <Tag kind="late" className="ml-1.5">
                            Pausada
                          </Tag>
                        ) : null}
                        {rec.frequency === "yearly" ? <Tag kind="annual" className="ml-1.5" /> : null}
                        {rec.installmentsTotal ? (
                          <Tag kind="neutral" className="ml-1.5">
                            {rec.installmentsTotal} parcelas
                          </Tag>
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {when}
                        {rec.paymentMethod ? `, ${rec.paymentMethod}` : ""}
                      </span>
                    </button>
                    <span className="hv num shrink-0 font-semibold">{formatBRL(rec.amount)}</span>
                    <IconButton
                      label={`Editar ${rec.description}`}
                      icon={<Pencil />}
                      onClick={() => openRecurrence(rec)}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
