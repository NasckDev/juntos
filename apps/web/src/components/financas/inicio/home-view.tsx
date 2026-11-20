import {
  byCategory,
  DUE_SOON_HOME_DAYS,
  dailyBalance,
  delta,
  deltaLabel,
  formatBRL,
  formatBRL0,
  isLate,
  monthName,
  periodLabel,
  receivedSoFar,
  tips,
  todayParts,
  totals,
} from "@juntos/core";
import { Upload } from "lucide-react";
import Link from "next/link";
import { DailyBalance } from "@/components/charts/daily-balance";
import { Donut } from "@/components/charts/donut";
import { FlowBar } from "@/components/charts/flow-bar";
import { MonthBars } from "@/components/charts/month-bars";
import { PageHeader } from "@/components/shell/page-header";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import {
  categoryColor,
  categoryOf,
  firstName,
  greeting,
  periodMonthsOf,
  periodName,
  withCoreCategoryIds,
} from "@/lib/finance";
import type { HomeData } from "@/server/finance-loaders";
import type { TxView } from "@/server/services/finance-types";
import { NewEntryButton, PeriodPicker, StartStep, StepNumber } from "../controls";
import { UpcomingLine } from "../tx-row";
import { BudgetsCard, GoalsCard } from "./plan-cards";
import { TipsCard } from "./tips-card";

export interface HomeViewProps {
  readonly data: HomeData;
  readonly userName: string;
  readonly spaceName: string;
}

/** Texto principal do resumo (`vGeral` do protótipo). */
function leadText(range: boolean, left: number, ym: string, nowYm: string, name: string): string {
  if (range) return `${left >= 0 ? "Sobra em " : "Falta em "}${name}`;
  if (ym < nowYm) return `${left >= 0 ? "Sobrou em " : "Faltou em "}${name}`;
  if (ym > nowYm) return `Previsão para ${name}`;
  return `${left >= 0 ? "Deve sobrar até o fim de " : "Deve faltar até o fim de "}${name}`;
}

/** Atrasados e o que vence logo (até 7 dias no mês de hoje), no máximo 6. */
function upcoming(txs: readonly TxView[], today: string, current: boolean): TxView[] {
  const now = todayParts(today);
  const late = txs.filter((t) => isLate(t, today));
  const soon = txs.filter((t) => !t.paid && !isLate(t, today) && (!current || t.day <= now.day + DUE_SOON_HOME_DAYS));
  return [...late, ...soon].slice(0, 6);
}

export function HomeView({ data, userName, spaceName }: HomeViewProps) {
  const { period, today, txs, previousTxs, categories } = data;
  const nowYm = todayParts(today).ym;
  const range = period.span > 1;
  const months = periodMonthsOf(period);
  const lastYm = months[months.length - 1] ?? period.start;
  const current = !range && period.start === nowYm;
  const header = (
    <PageHeader
      title={`${greeting()}, ${firstName(userName)}`}
      subtitle={`${spaceName}, ${periodLabel(period.start, period.span).toLowerCase()}`}
      month={<PeriodPicker />}
      actions={
        <>
          <NewEntryButton kind="in" variant="line" className="hidden lg:inline-flex">
            Entrada
          </NewEntryButton>
          <NewEntryButton kind="out" className="hidden lg:inline-flex">
            Saída
          </NewEntryButton>
        </>
      }
    />
  );

  if (!data.hasData) {
    return (
      <>
        {header}
        <Card aria-labelledby="comece-t" className="lg:p-8">
          <h2 id="comece-t" className="sr-only">
            Comece por aqui
          </h2>
          <EmptyState
            art="start"
            title="Este espaço ainda está vazio"
            description="Três passos deixam tudo pronto. Leva uns cinco minutos."
            className="pt-2"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <StartStep step={1} kind="in" title="Lance o que entra" text="Salário e outras rendas de todo mês." />
            <StartStep step={2} kind="out" title="Lance as contas fixas" text="Aluguel, luz, internet, parcelas." />
            <Link
              href="/dados?aba=importar"
              className="flex min-h-24 w-full items-start gap-3 rounded-panel border border-line bg-surface p-4 text-left transition-colors hover:border-line2 hover:bg-surface2"
            >
              <StepNumber step={3} />
              <span className="min-w-0">
                <b className="block font-semibold">Ou traga sua planilha</b>
                <small className="mt-0.5 block text-sm text-muted">Importe um Excel com uma aba por mês.</small>
              </span>
              <Upload aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted" />
            </Link>
          </div>
        </Card>
      </>
    );
  }

  const t = totals(txs);
  const pt = totals(previousTxs);
  const name = periodName(period);
  const soFar = receivedSoFar(txs);
  const sub = current
    ? null
    : t.in
      ? `${Math.round(((t.out + t.save) / t.in) * 100)}% do que entrou teve destino`
      : "Nenhuma entrada lançada neste mês";
  const stats = [
    { key: "in", label: "Entrou", value: t.in, hint: deltaLabel(delta(t.in, pt.in), period.start, range) },
    { key: "out", label: "Saiu", value: t.out, hint: deltaLabel(delta(t.out, pt.out), period.start, range) },
    { key: "save", label: "Guardado", value: t.save, hint: deltaLabel(delta(t.save, pt.save), period.start, range) },
  ] as const;
  const bills = upcoming(txs, today, current);
  const billsTitle = current ? "Próximos vencimentos" : range ? "Em aberto no período" : "Em aberto neste mês";
  const tipList = tips({
    ym: lastYm,
    txs: withCoreCategoryIds(categories, [...previousTxs, ...txs]),
    recurrences: data.recurrences,
  });
  const parts = byCategory(txs, "out").map((part) => {
    const category = categoryOf(categories, part.categoryId);
    return { id: part.categoryId, label: category.name, value: part.total, color: categoryColor(category) };
  });
  const cut = period.start < nowYm ? Number.POSITIVE_INFINITY : period.start > nowYm ? 0 : todayParts(today).day;
  const daily = dailyBalance(txs, period.start).map((point) => point.balance);

  return (
    <>
      {header}
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <Card tone="hero" aria-labelledby="resumo-t" className="p-6 lg:col-span-8 lg:flex lg:flex-col lg:p-8">
          <h2 id="resumo-t" className="text-md font-medium text-hero-mute">
            {leadText(range, t.left, period.start, nowYm, name)}
          </h2>
          <p className="mt-2">
            <Amount cents={Math.abs(t.left)} size="display" />
          </p>
          <p className="mt-2 text-md text-hero-mute">
            {sub ?? (
              <>
                Até hoje entrou <b className="hv num font-semibold text-hero-ink">{formatBRL0(soFar.received)}</b> e
                saiu <b className="hv num font-semibold text-hero-ink">{formatBRL0(soFar.spent)}</b>
              </>
            )}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-hero-line pt-5 lg:hidden">
            {stats.map((stat) => (
              <div key={stat.key} className="min-w-0">
                <dt className="text-sm text-hero-mute">{stat.label}</dt>
                <dd className="hv num truncate font-semibold">{formatBRL0(stat.value)}</dd>
              </div>
            ))}
          </dl>
          <FlowBar
            tone="hero"
            paid={t.outPaid}
            due={t.outDue}
            saved={t.save}
            left={t.left}
            className="mt-6 lg:mt-auto lg:pt-8"
          />
        </Card>

        <Card
          aria-label={range ? "Totais do período" : "Totais do mês"}
          className="hidden lg:col-span-4 lg:flex lg:flex-col lg:justify-center lg:gap-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="flex items-start gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 size-2.5 shrink-0 rounded-full",
                  stat.key === "in" ? "bg-in" : stat.key === "out" ? "bg-out" : "bg-save",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{stat.label}</p>
                {stat.hint ? <p className="text-xs text-muted">{stat.hint}</p> : null}
              </div>
              <p className="hv num text-xl font-[650] tracking-[-0.02em]">{formatBRL(stat.value)}</p>
            </div>
          ))}
        </Card>

        <Card aria-labelledby="venc-t" className="lg:col-span-6">
          <CardHeader
            title={billsTitle}
            titleId="venc-t"
            action={
              <Button asChild variant="link" size="sm">
                <Link href="/lancamentos">Ver todos</Link>
              </Button>
            }
          />
          {bills.length > 0 ? (
            <ul>
              {bills.map((tx) => (
                <UpcomingLine key={tx.id} tx={tx} categories={categories} today={today} />
              ))}
            </ul>
          ) : (
            <p className="text-muted">Nada vence nos próximos dias. Tudo em ordem.</p>
          )}
        </Card>

        <Card aria-labelledby="onde-t" className="lg:col-span-6">
          <CardHeader
            title="Para onde foi o dinheiro"
            titleId="onde-t"
            action={
              <Button asChild variant="link" size="sm">
                <Link href="/relatorios">Relatórios</Link>
              </Button>
            }
          />
          {parts.length > 0 ? <Donut parts={parts} /> : <p className="text-muted">Sem saídas neste mês.</p>}
        </Card>

        <Card aria-labelledby="saldo-t" className="lg:col-span-8">
          {range ? (
            <>
              <CardHeader title="Mês a mês no período" titleId="saldo-t" />
              <MonthBars
                rows={months.map((ym) => {
                  const month = totals(txs.filter((tx) => tx.competence === ym));
                  return { ym, income: month.in, outflow: month.out + month.save };
                })}
                currentYm={nowYm}
                title={`Entradas e saídas de ${name}`}
              />
            </>
          ) : (
            <>
              <CardHeader title="Saldo do mês, dia a dia" titleId="saldo-t" />
              <DailyBalance points={daily} todayDay={Math.min(cut, daily.length - 1)} monthLabel={name} />
            </>
          )}
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-4 lg:row-span-2 lg:gap-6">
          <BudgetsCard budgets={data.budgets} categories={categories} txs={txs} months={period.span} />
          <GoalsCard goals={data.goals} />
        </div>

        {tipList.length > 0 ? (
          <TipsCard tips={tipList} about={range ? monthName(lastYm).toLowerCase() : null} className="lg:col-span-8" />
        ) : null}
      </div>
    </>
  );
}
