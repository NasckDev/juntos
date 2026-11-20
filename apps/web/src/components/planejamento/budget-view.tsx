"use client";

import { formatBRL, formatBRL0, todayParts } from "@juntos/core";
import { Lightbulb, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { periodName } from "@/lib/finance";
import { type BudgetRow, budgetOverview, categoryListHref } from "@/lib/planning";
import { suggestBudgetLimits } from "@/server/actions/budgets";
import { undo } from "@/server/actions/undo";
import type { BudgetData } from "@/server/planning-loaders";
import { CategoryIcon } from "../financas/category-icon";
import { toastError, toastWithUndo } from "../financas/feedback";
import { useFinanceUi } from "../financas/finance-context";
import { BudgetLimitSheet } from "./budget-limit-sheet";
import { CategoryFormSheet } from "./category-form-sheet";
import { ViewerNote } from "./viewer-note";

const TONE_TEXT = { in: "text-in", warn: "text-warn", out: "text-out" } as const;

type Sheet = { readonly type: "limit"; readonly row: BudgetRow } | { readonly type: "category" } | null;

/** Orçamento (`pOrc` do protótipo): resumo do período, sugestão pela média e as categorias de saída com limite. */
export function BudgetView({ data }: { data: BudgetData }) {
  const { form, canEdit, openNewEntry } = useFinanceUi();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [suggesting, startSuggest] = useTransition();
  const { period } = data;
  const currentYm = todayParts(data.today).ym;
  const overview = budgetOverview(data.categories, data.budgets, data.txs, period.span);
  const name = periodName(period);

  function suggest() {
    startSuggest(async () => {
      const result = await suggestBudgetLimits({ spaceId: form.spaceId });
      if (!result.ok) return toastError(result.error);
      toastWithUndo("Limites sugeridos pela média de três meses.", () => undo({ token: result.data.undo.token }));
    });
  }

  return (
    <>
      {canEdit ? null : <ViewerNote />}
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <SummaryCard
          overview={overview}
          periodText={name}
          months={period.span}
          canEdit={canEdit}
          suggesting={suggesting}
          onSuggest={suggest}
        />
        <Card aria-labelledby="cat-t" className="lg:col-span-12">
          <CardHeader
            title="Categorias"
            titleId="cat-t"
            description="Toque no nome para ver os lançamentos."
            action={
              canEdit ? (
                <Button variant="line" size="sm" icon={<Plus />} onClick={() => setSheet({ type: "category" })}>
                  Nova categoria
                </Button>
              ) : null
            }
          />
          <ul>
            {overview.rows.map((row) => (
              <CategoryLine
                key={row.category.id}
                row={row}
                periodText={name}
                href={categoryListHref(row.category.id, period, currentYm)}
                canEdit={canEdit}
                onAdd={() => openNewEntry({ kind: "out", categoryId: row.category.id })}
                onLimit={() => setSheet({ type: "limit", row })}
              />
            ))}
          </ul>
        </Card>
      </div>
      {sheet?.type === "limit" ? (
        <BudgetLimitSheet
          key={sheet.row.category.id}
          open
          onOpenChange={(open) => (open ? undefined : setSheet(null))}
          spaceId={form.spaceId}
          category={sheet.row.category}
          current={sheet.row.monthly > 0 ? sheet.row.monthly : null}
        />
      ) : null}
      {sheet?.type === "category" ? (
        <CategoryFormSheet
          open
          onOpenChange={(open) => (open ? undefined : setSheet(null))}
          spaceId={form.spaceId}
          fixedKind="out"
        />
      ) : null}
    </>
  );
}

interface SummaryCardProps {
  readonly overview: ReturnType<typeof budgetOverview>;
  readonly periodText: string;
  readonly months: number;
  readonly canEdit: boolean;
  readonly suggesting: boolean;
  readonly onSuggest: () => void;
}

function SummaryCard({ overview, periodText, months, canEdit, suggesting, onSuggest }: SummaryCardProps) {
  if (overview.limited === 0) {
    return (
      <Card aria-labelledby="orc-resumo" className="lg:col-span-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="orc-resumo" className="text-lg font-semibold">
              Quanto vocês querem gastar em cada categoria?
            </h2>
            <p className="mt-1 text-muted">
              Defina um limite por mês. O app mostra quanto ainda dá para gastar e avisa quando chegar perto.
            </p>
          </div>
          {canEdit ? (
            <Button icon={<Lightbulb />} onClick={onSuggest} disabled={suggesting}>
              {suggesting ? "Calculando…" : "Sugerir pelos últimos 3 meses"}
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }
  const over = overview.totalSpent > overview.totalLimit;
  return (
    <Card aria-labelledby="orc-resumo" className="lg:col-span-12">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="orc-resumo" className="text-sm font-medium text-muted">
            Gasto em {periodText} nas categorias com limite
          </h2>
          <p className="mt-1 text-2xl font-[650] tracking-[-0.02em]">
            <span className="hv num">{formatBRL0(overview.totalSpent)}</span>{" "}
            <span className="text-base font-normal text-muted">
              de <span className="hv num">{formatBRL(overview.totalLimit)}</span>
            </span>
          </p>
        </div>
        <div className="sm:text-right">
          <b className={cn("hv num block text-lg", TONE_TEXT[overview.tone])}>
            {over
              ? `Passou ${formatBRL(overview.totalSpent - overview.totalLimit)}`
              : `Restam ${formatBRL(overview.totalLimit - overview.totalSpent)}`}
          </b>
          <small className="text-sm text-muted">
            {overview.limited} {overview.limited > 1 ? "categorias" : "categoria"} com limite
          </small>
        </div>
      </div>
      <Progress
        className="mt-4"
        size="md"
        value={overview.totalSpent}
        max={overview.totalLimit}
        tone="auto"
        label={`Orçamento do período, ${overview.percent}% do limite usado`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-muted">
          {months > 1
            ? `Limites mensais somados para os ${months} meses do período.`
            : "O sino avisa quando uma categoria chega a 90% do limite."}
        </p>
        {canEdit ? (
          <Button variant="link" size="sm" onClick={onSuggest} disabled={suggesting}>
            Recalcular pela média dos últimos 3 meses
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

interface CategoryLineProps {
  readonly row: BudgetRow;
  readonly periodText: string;
  readonly href: string;
  readonly canEdit: boolean;
  readonly onAdd: () => void;
  readonly onLimit: () => void;
}

function CategoryLine({ row, periodText, href, canEdit, onAdd, onLimit }: CategoryLineProps) {
  const { category } = row;
  const hasLimit = row.limit > 0;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0">
      <CategoryIcon icon={category.icon} hue={category.hue} />
      <div className="min-w-0 flex-1 basis-40">
        <Link href={href} className="block truncate rounded-field font-medium hover:underline">
          {category.name}
        </Link>
        {hasLimit ? (
          <Progress
            className="my-1.5 max-w-120"
            value={row.spent}
            max={row.limit}
            tone="auto"
            label={`${category.name}, ${row.percent}% do limite`}
          />
        ) : null}
        <small className="block text-sm text-muted">
          <span className="hv num">{formatBRL0(row.spent)}</span> gastos em {periodText}
          {hasLimit ? (
            <>
              {" "}
              de <span className="hv num">{formatBRL(row.limit)}</span>
            </>
          ) : (
            ", sem limite"
          )}
        </small>
      </div>
      {hasLimit ? (
        <span className={cn("hv num hidden text-sm font-semibold whitespace-nowrap sm:inline", TONE_TEXT[row.tone])}>
          {row.percent > 100
            ? `Passou ${formatBRL(row.spent - row.limit)}`
            : `Restam ${formatBRL(row.limit - row.spent)}`}
        </span>
      ) : null}
      {canEdit ? (
        <div className="ml-auto flex items-center gap-1 max-sm:w-full max-sm:justify-end">
          {hasLimit ? (
            <span className={cn("hv num mr-auto text-sm font-semibold sm:hidden", TONE_TEXT[row.tone])}>
              {row.percent > 100
                ? `Passou ${formatBRL0(row.spent - row.limit)}`
                : `Restam ${formatBRL0(row.limit - row.spent)}`}
            </span>
          ) : null}
          <IconButton label={`Lançar gasto em ${category.name}`} icon={<Plus />} onClick={onAdd} />
          <Button variant={hasLimit ? "ghost" : "line"} size="sm" onClick={onLimit}>
            {hasLimit ? "Editar limite" : "Definir limite"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
