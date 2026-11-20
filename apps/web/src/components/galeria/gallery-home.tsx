"use client";

import { type Cents, formatBRL, formatBRL0, type YearMonth, ymAdd } from "@juntos/core";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { DailyBalance } from "@/components/charts/daily-balance";
import { Donut, type DonutPart } from "@/components/charts/donut";
import { FlowBar } from "@/components/charts/flow-bar";
import { MonthBars } from "@/components/charts/month-bars";
import { PageHeader } from "@/components/shell/page-header";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type MonthPeriod, MonthPicker } from "@/components/ui/month-picker";
import { Progress } from "@/components/ui/progress";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";

/*
 * Exemplo de composição do Início (só para a galeria de desenvolvimento). Os números são inventados e servem
 * para revisar o layout; o app real nunca mostra dados de exemplo.
 */

export const DEMO_YM: YearMonth = "2026-11";
const R = (reais: number): Cents => Math.round(reais * 100);

const BILLS = [
  { id: "1", day: 20, name: "MEI", cat: "Outros", hue: 220, value: R(86), tag: { kind: "personal" } as const },
  {
    id: "2",
    day: 20,
    name: "Parcela do carro",
    cat: "Transporte",
    hue: 18,
    value: R(790),
    tag: { kind: "installment", current: 5, total: 54 } as const,
  },
  { id: "3", day: 21, name: "Presente de casamento", cat: "Lazer", hue: 300, value: R(150), tag: null },
  {
    id: "4",
    day: 25,
    name: "Apê: entrada",
    cat: "Moradia",
    hue: 232,
    value: R(1900),
    tag: { kind: "installment", current: 6, total: 60 } as const,
  },
  { id: "5", day: 25, name: "Garagem", cat: "Moradia", hue: 232, value: R(200), tag: null },
] as const;

export const DEMO_PARTS: DonutPart[] = [
  { id: "cartoes", label: "Cartões", value: R(4092), color: "hsl(268 52% 56%)" },
  { id: "moradia", label: "Moradia", value: R(3990), color: "hsl(232 52% 56%)" },
  { id: "transporte", label: "Transporte", value: R(1070), color: "hsl(18 52% 56%)" },
  { id: "mercado", label: "Mercado", value: R(800), color: "hsl(140 52% 46%)" },
  { id: "contas", label: "Contas da casa", value: R(408), color: "hsl(45 62% 50%)" },
  { id: "saude", label: "Saúde", value: R(530), color: "hsl(160 52% 46%)" },
  { id: "lazer", label: "Lazer", value: R(545), color: "hsl(300 52% 56%)" },
];

export function demoDailyPoints(): Cents[] {
  const moves: Record<number, number> = {
    1: -2400,
    3: -570,
    5: 5200,
    6: 7800,
    9: -900,
    12: -180,
    15: -2100,
    20: -876,
    21: -150,
    25: -4100,
    28: 3100,
    30: -1400,
  };
  const out: Cents[] = [0];
  let acc = 0;
  for (let d = 1; d <= 30; d += 1) {
    acc += R(moves[d] ?? -60);
    out.push(acc);
  }
  return out;
}

export const DEMO_BARS = Array.from({ length: 12 }, (_, i) => {
  const ym = ymAdd("2026-01", i);
  return { ym, income: R(13000 + (i % 4) * 900 + (i === 10 ? 2600 : 0)), outflow: R(6800 + i * 420) };
});

const BUDGETS = [
  { name: "Cartões", spent: R(4092), limit: R(3600) },
  { name: "Assinaturas", spent: R(109), limit: R(100) },
  { name: "Mercado", spent: R(800), limit: R(900) },
];

const GOALS = [
  { name: "Reserva de emergência", saved: R(6200), target: R(15000) },
  { name: "Viagem de fim de ano", saved: R(2900), target: R(4000) },
];

function DateBlock({ day }: { day: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 flex-col items-center justify-center rounded-[0.7rem] bg-surface2 leading-none"
    >
      <b className="num text-md font-bold">{day}</b>
      <small className="mt-0.5 text-micro text-muted">nov</small>
    </span>
  );
}

function BillRow({ bill }: { bill: (typeof BILLS)[number] }) {
  const [paid, setPaid] = useState(false);
  return (
    <li className="flex min-h-16 items-center gap-3 border-t border-line py-2.5 first:border-t-0">
      <DateBlock day={bill.day} />
      <div className="min-w-0 flex-1">
        <p className="min-w-0 font-medium">
          <span className={cn(paid && "text-muted line-through")}>{bill.name}</span>
          {bill.tag ? <Tag {...bill.tag} className="ml-1.5" /> : null}
        </p>
        <p className="text-sm text-muted">
          Dia {bill.day}, {bill.cat}
        </p>
      </div>
      <Amount cents={bill.value} kind="out" className="text-md" />
      <button
        type="button"
        aria-pressed={paid}
        aria-label={paid ? `${bill.name}: pago. Marcar como não pago` : `Marcar ${bill.name} como pago`}
        onClick={() => setPaid((p) => !p)}
        className="hit grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-line2 text-transparent transition-colors hover:border-in aria-pressed:border-in aria-pressed:bg-in aria-pressed:text-white"
      >
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
      </button>
    </li>
  );
}

export function GalleryHome() {
  const [period, setPeriod] = useState<MonthPeriod>({ start: DEMO_YM, span: 1 });
  return (
    <div>
      <PageHeader
        title="Boa noite, Rafa"
        subtitle="Casa, novembro 2026"
        month={<MonthPicker value={period} onChange={setPeriod} currentYm={DEMO_YM} allowRange />}
        actions={
          <>
            <Button variant="line" icon={<Plus />} className="hidden lg:inline-flex">
              Entrada
            </Button>
            <Button icon={<Plus />} className="hidden lg:inline-flex">
              Saída
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <Card tone="hero" aria-labelledby="resumo-t" className="p-6 lg:col-span-8 lg:flex lg:flex-col lg:p-8">
          <h2 id="resumo-t" className="text-md font-medium text-hero-mute">
            Deve sobrar até o fim de novembro
          </h2>
          <p className="mt-2">
            <Amount cents={R(4265)} size="display" />
          </p>
          <p className="mt-2 text-md text-hero-mute">
            Até hoje entrou <b className="hv num font-semibold text-hero-ink">{formatBRL0(R(13000))}</b> e saiu{" "}
            <b className="hv num font-semibold text-hero-ink">{formatBRL0(R(6819))}</b>
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-hero-line pt-5 lg:hidden">
            {[
              ["Entrou", R(16100)],
              ["Saiu", R(11435)],
              ["Guardado", R(400)],
            ].map(([label, v]) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-hero-mute">{label}</dt>
                <dd className="hv num truncate font-semibold">{formatBRL0(v as number)}</dd>
              </div>
            ))}
          </dl>
          <FlowBar
            tone="hero"
            paid={R(6419)}
            due={R(5016)}
            saved={R(400)}
            left={R(4265)}
            className="mt-6 lg:mt-auto lg:pt-8"
          />
        </Card>

        <Card
          aria-label="Totais do mês"
          className="hidden lg:col-span-4 lg:flex lg:flex-col lg:justify-center lg:gap-4"
        >
          {[
            ["Entrou", R(16100), "4% acima de outubro", "in"],
            ["Saiu", R(11435), "3% acima de outubro", "out"],
            ["Guardado", R(400), "igual a outubro", "save"],
          ].map(([label, v, hint, kind]) => (
            <div
              key={label as string}
              className="flex items-start gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 size-2.5 shrink-0 rounded-full",
                  kind === "in" ? "bg-in" : kind === "out" ? "bg-out" : "bg-save",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted">{hint}</p>
              </div>
              <p className="hv num text-xl font-[650] tracking-[-0.02em]">{formatBRL(v as number)}</p>
            </div>
          ))}
        </Card>

        <Card aria-labelledby="venc-t" className="lg:col-span-6">
          <CardHeader
            title="Próximos vencimentos"
            titleId="venc-t"
            action={
              <Button variant="link" size="sm">
                Ver todos
              </Button>
            }
          />
          <ul>
            {BILLS.map((b) => (
              <BillRow key={b.id} bill={b} />
            ))}
          </ul>
        </Card>

        <Card aria-labelledby="onde-t" className="lg:col-span-6">
          <CardHeader
            title="Para onde foi o dinheiro"
            titleId="onde-t"
            action={
              <Button variant="link" size="sm">
                Relatórios
              </Button>
            }
          />
          <Donut parts={DEMO_PARTS} />
        </Card>

        <Card aria-labelledby="saldo-t" className="lg:col-span-8">
          <CardHeader title="Saldo do mês, dia a dia" titleId="saldo-t" />
          <DailyBalance points={demoDailyPoints()} todayDay={20} monthLabel="novembro" />
        </Card>

        <Card aria-labelledby="orc-t" className="lg:col-span-4">
          <CardHeader
            title="Orçamento"
            titleId="orc-t"
            action={
              <Button variant="link" size="sm">
                Abrir
              </Button>
            }
          />
          <ul className="flex flex-col gap-4">
            {BUDGETS.map((b) => {
              const pct = Math.round((b.spent / b.limit) * 100);
              const over = b.spent > b.limit;
              return (
                <li key={b.name}>
                  <p className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{b.name}</span>
                    <span
                      className={cn(
                        "hv num text-sm font-bold",
                        over ? "text-out" : pct >= 85 ? "text-warn" : "text-in",
                      )}
                    >
                      {over ? `Passou ${formatBRL0(b.spent - b.limit)}` : `Restam ${formatBRL0(b.limit - b.spent)}`}
                    </span>
                  </p>
                  <Progress value={b.spent} max={b.limit} tone="auto" label={`${b.name}, ${pct}% do limite`} />
                </li>
              );
            })}
          </ul>
          <h3 className="mt-6 mb-3 border-t border-line pt-5 font-semibold">Metas</h3>
          <ul className="flex flex-col gap-4">
            {GOALS.map((g) => {
              const pct = Math.round((g.saved / g.target) * 100);
              return (
                <li key={g.name}>
                  <p className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{g.name}</span>
                    <span className="num text-sm text-muted">{pct}%</span>
                  </p>
                  <Progress value={g.saved} max={g.target} label={`${g.name}, ${pct}% guardado`} />
                  <p className="mt-1 text-xs text-muted">
                    <span className="hv num">{formatBRL(g.saved)}</span> de{" "}
                    <span className="hv num">{formatBRL(g.target)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card aria-labelledby="barras-t" className="lg:col-span-12">
          <CardHeader title="Entradas e saídas, mês a mês em 2026" titleId="barras-t" />
          <MonthBars
            rows={DEMO_BARS}
            currentYm={DEMO_YM}
            selected={period.start}
            onSelect={(ym) => setPeriod({ start: ym, span: 1 })}
            title="Entradas e saídas, mês a mês em 2026"
          />
        </Card>
      </div>
    </div>
  );
}
