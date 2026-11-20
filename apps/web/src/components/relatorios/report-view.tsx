import {
  byCategory,
  delta,
  deltaLabel,
  formatBRL,
  monthName,
  periodLabel,
  todayParts,
  totals,
  type YearMonth,
  ymOf,
} from "@juntos/core";
import { Download } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { categoryColor, categoryOf, periodMonthsOf, periodName } from "@/lib/finance";
import type { ReportData } from "@/server/report-loaders";
import type { CategoryView, TxView } from "@/server/services/finance-types";
import { CategoryIcon } from "../financas/category-icon";
import { NewEntryButton, PeriodPicker } from "../financas/controls";
import { YearBars } from "./year-bars";

const TOP_OUTFLOWS = 5;
const NO_METHOD = "Não informado";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Categoria de saída que mais subiu sobre o período anterior (só vale se já tinha gasto antes). */
function biggestRise(
  txs: readonly TxView[],
  previous: readonly TxView[],
  categories: readonly CategoryView[],
): { category: CategoryView; rise: number } | null {
  const before = new Map(byCategory(previous, "out").map((c) => [c.categoryId, c.total]));
  let best: { category: CategoryView; rise: number } | null = null;
  for (const { categoryId, total } of byCategory(txs, "out")) {
    const prior = before.get(categoryId);
    if (!prior) continue;
    const rise = total - prior;
    if (rise > 0 && (!best || rise > best.rise)) best = { category: categoryOf(categories, categoryId), rise };
  }
  return best;
}

function paymentMethods(txs: readonly TxView[]): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.kind !== "out") continue;
    const key = tx.paymentMethod.trim() || NO_METHOD;
    map.set(key, (map.get(key) ?? 0) + tx.amount);
  }
  return [...map].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

function MonthLink({ ym }: { ym: YearMonth }) {
  return (
    <Link href={`/lancamentos?mes=${ym}`} className="font-medium text-brand-text underline-offset-4 hover:underline">
      {monthName(ym)}
    </Link>
  );
}

function MiniTotals({ entered, spent, saved }: { entered: number; spent: number; saved: number }) {
  return (
    <dl className="mt-1 grid grid-cols-3 gap-2 text-sm font-normal text-muted">
      {[
        ["Entrou", entered],
        ["Saiu", spent],
        ["Guardou", saved],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt>{label}</dt>
          <dd className="hv num truncate text-ink">{formatBRL(Number(value))}</dd>
        </div>
      ))}
    </dl>
  );
}

function Signed({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={className}>
      {cents < 0 ? "− " : ""}
      {formatBRL(Math.abs(cents))}
    </span>
  );
}

/** Relatórios (`vRel` do protótipo): o ano do mês escolhido, com o resumo do período em destaque. */
export function ReportView({ data, spaceName }: { data: ReportData; spaceName: string }) {
  const { period, year, yearTxs, txs, previousTxs, categories, today } = data;
  const range = period.span > 1;
  const nowYm = todayParts(today).ym;
  const months = periodMonthsOf(period);
  const exportHref = `/dados?aba=exportar&de=${year}-01&ate=${year}-12`;
  const header = (
    <PageHeader
      title="Relatórios"
      subtitle={`${year} em ${spaceName}`}
      month={<PeriodPicker />}
      actions={
        yearTxs.length > 0 ? (
          <Button asChild variant="line" icon={<Download />} className="hidden lg:inline-flex">
            <Link href={exportHref}>Exportar o ano</Link>
          </Button>
        ) : undefined
      }
    />
  );

  if (yearTxs.length === 0) {
    return (
      <>
        {header}
        <Card aria-label={`Sem lançamentos em ${year}`}>
          <EmptyState
            art="chart"
            title={`Sem lançamentos em ${year}`}
            description="Os relatórios aparecem assim que houver entradas e saídas."
            action={<NewEntryButton>Novo lançamento</NewEntryButton>}
          />
        </Card>
      </>
    );
  }

  const rows = Array.from({ length: 12 }, (_, i) => {
    const ym = ymOf(Number(year), i + 1);
    return { ym, ...totals(yearTxs.filter((tx) => tx.competence === ym)) };
  });
  const yearTotal = totals(yearTxs);
  const t = totals(txs);
  const prev = totals(previousTxs);
  const name = periodName(period);
  const top = txs
    .filter((tx) => tx.kind === "out")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_OUTFLOWS);
  const biggest = top[0];
  const rise = biggestRise(txs, previousTxs, categories);
  const yearCategories = byCategory(yearTxs, "out");
  const biggestCategory = yearCategories[0]?.total ?? 1;
  const methods = paymentMethods(txs);
  const periodText = range ? "no período" : "no mês";
  const free = t.in ? Math.max(Math.round(((t.save + Math.max(t.left, 0)) / t.in) * 100), 0) : 0;

  return (
    <>
      {header}
      <Button asChild variant="line" block icon={<Download />} className="mb-4 lg:hidden">
        <Link href={exportHref}>Exportar o ano</Link>
      </Button>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <Card aria-labelledby="resumo-t" className="lg:col-span-12">
          <CardHeader
            title={`Resumo de ${name}`}
            titleId="resumo-t"
            description={periodLabel(period.start, period.span)}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4 lg:gap-6">
            <Stat
              label={t.left >= 0 ? "Sobrou" : "Faltou"}
              value={formatBRL(Math.abs(t.left))}
              tone={t.left < 0 ? "out" : "ink"}
              hint={deltaLabel(delta(t.left, prev.left), period.start, range)}
            />
            <Stat label="Guardado ou livre" value={`${free}%`} money={false} hint={`Do que entrou ${periodText}`} />
            <Stat
              label="Maior saída"
              money={false}
              value={<span className="block truncate">{biggest ? biggest.description : "—"}</span>}
              hint={biggest ? <span className="hv num">{formatBRL(biggest.amount)}</span> : undefined}
            />
            <Stat
              label="Categoria que mais subiu"
              money={false}
              value={<span className="block truncate">{rise ? rise.category.name : "Nenhuma"}</span>}
              hint={
                rise ? (
                  <>
                    <span className="hv num">+ {formatBRL(rise.rise)}</span> sobre o {range ? "período" : "mês"}{" "}
                    anterior
                  </>
                ) : (
                  `Comparado ao ${range ? "período" : "mês"} anterior`
                )
              }
            />
          </div>
        </Card>

        <Card aria-labelledby="meses-t" className="lg:col-span-8">
          <CardHeader title={`Entradas e saídas, mês a mês em ${year}`} titleId="meses-t" />
          <YearBars
            rows={rows.map((r) => ({ ym: r.ym, income: r.in, outflow: r.out + r.save }))}
            currentYm={nowYm}
            selected={months}
            title={`Entradas e saídas por mês em ${year}`}
          />
        </Card>

        <Card aria-labelledby="maiores-t" className="lg:col-span-4">
          <CardHeader title={`Maiores saídas de ${name}`} titleId="maiores-t" />
          {top.length > 0 ? (
            <ul>
              {top.map((tx) => {
                const category = categoryOf(categories, tx.categoryId);
                return (
                  <li key={tx.id} className="flex min-h-14 items-center gap-3 border-t border-line first:border-t-0">
                    <CategoryIcon icon={category.icon} hue={category.hue} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{tx.description}</span>
                    <span className="hv num shrink-0 font-semibold">− {formatBRL(tx.amount)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">Sem saídas {range ? "no período" : "neste mês"}.</p>
          )}
        </Card>

        <Card aria-labelledby="categorias-t" className="lg:col-span-7">
          <CardHeader title={`Categorias em ${year}`} titleId="categorias-t" />
          {yearCategories.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {yearCategories.map(({ categoryId, total }) => {
                const category = categoryOf(categories, categoryId);
                return (
                  <li key={categoryId}>
                    <p className="mb-1.5 flex items-center gap-2">
                      <CategoryIcon icon={category.icon} hue={category.hue} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                      <span className="hv num font-semibold">{formatBRL(total)}</span>
                      <span className="num w-11 text-right text-sm text-muted">{percent(total, yearTotal.out)}%</span>
                    </p>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface3">
                      <i
                        className="block h-full rounded-full"
                        style={{ width: `${(total / biggestCategory) * 100}%`, background: categoryColor(category) }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">Sem saídas neste ano.</p>
          )}
        </Card>

        <Card aria-labelledby="pago-com-t" className="self-start lg:col-span-5">
          <CardHeader title={`Pago com, em ${name}`} titleId="pago-com-t" />
          {methods.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {methods.map((method) => (
                <li key={method.name}>
                  <p className="mb-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{method.name}</span>
                    <span className="hv num font-semibold">{formatBRL(method.total)}</span>
                  </p>
                  <Progress
                    value={method.total}
                    max={methods[0]?.total ?? 1}
                    label={`${method.name}, ${formatBRL(method.total)}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Sem saídas {range ? "no período" : "neste mês"}.</p>
          )}
        </Card>

        <Card aria-labelledby="tabela-t" className="lg:col-span-12">
          <CardHeader title={`Tabela de ${year}`} titleId="tabela-t" />
          <table className="num hidden w-full text-right lg:table">
            <caption className="sr-only">Entradas, saídas, guardado e sobra de cada mês de {year}</caption>
            <thead>
              <tr className="text-sm text-muted">
                <th scope="col" className="pb-2 text-left font-medium">
                  Mês
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Entrou
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Saiu
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Guardou
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Sobrou
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ym} className="border-t border-line">
                  <th scope="row" className="h-11 text-left font-normal">
                    <MonthLink ym={row.ym} />
                  </th>
                  <td className="hv">{formatBRL(row.in)}</td>
                  <td className="hv">{formatBRL(row.out)}</td>
                  <td className="hv">{formatBRL(row.save)}</td>
                  <td className="font-semibold">
                    <Signed cents={row.left} className={`hv ${row.left < 0 ? "text-out" : "text-in"}`} />
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-line2 font-semibold">
                <th scope="row" className="h-11 text-left">
                  Ano
                </th>
                <td className="hv">{formatBRL(yearTotal.in)}</td>
                <td className="hv">{formatBRL(yearTotal.out)}</td>
                <td className="hv">{formatBRL(yearTotal.save)}</td>
                <td>
                  <Signed cents={yearTotal.left} className="hv" />
                </td>
              </tr>
            </tbody>
          </table>
          <ul className="lg:hidden">
            {rows.map((row) => (
              <li key={row.ym} className="border-t border-line py-3 first:border-t-0">
                <p className="flex items-baseline justify-between gap-3">
                  <MonthLink ym={row.ym} />
                  <span className={`hv num font-semibold ${row.left < 0 ? "text-out" : "text-in"}`}>
                    {row.left < 0 ? "Faltou " : "Sobrou "}
                    <Signed cents={row.left} />
                  </span>
                </p>
                <MiniTotals entered={row.in} spent={row.out} saved={row.save} />
              </li>
            ))}
            <li className="border-t-2 border-line2 pt-3 font-semibold">
              <p className="flex items-baseline justify-between gap-3">
                <span>Ano</span>
                <span className="hv num">
                  {yearTotal.left < 0 ? "Faltou " : "Sobrou "}
                  <Signed cents={yearTotal.left} />
                </span>
              </p>
              <MiniTotals entered={yearTotal.in} spent={yearTotal.out} saved={yearTotal.save} />
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
