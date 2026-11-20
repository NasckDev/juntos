import { formatBRL, periodLabel } from "@juntos/core";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat, type StatTone } from "@/components/ui/stat";
import { Tag } from "@/components/ui/tag";
import { periodName } from "@/lib/finance";
import type { DivisionData, DivisionMember } from "@/server/division-loaders";
import { PeriodPicker } from "../financas/controls";
import { RegisterSettlementButton, UnsettleButton } from "./settlement-actions";
import { SplitModeCard } from "./split-mode-card";
import { TxPickList } from "./tx-pick-list";

const SETTLED_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});
/** Quantos lançamentos cada lista mostra antes de mandar para Lançamentos. */
const PAID_LIST_MAX = 7;
const WITHOUT_PAYER_MAX = 8;

function Money({ cents }: { cents: number }) {
  return <span className="hv num whitespace-nowrap">{formatBRL(cents)}</span>;
}

/** Divisão de contas (`vDiv` do protótipo), com a conta do core sobre os dados reais do período. */
export function DivisionView({ data }: { data: DivisionData }) {
  const { period, division, members, settlements, config, categories, spaceId } = data;
  const range = period.span > 1;
  const periodWord = range ? "no período" : "no mês";
  const name = periodName(period);
  const byId = new Map<string, DivisionMember>(members.map((member) => [member.id, member]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "Alguém";
  const header = (withPeriod: boolean) => (
    <PageHeader
      title="Divisão de contas"
      subtitle={`Quem pagou o quê em ${name} e quanto falta acertar`}
      {...(withPeriod ? { month: <PeriodPicker /> } : {})}
    />
  );

  if (members.length < 2) {
    return (
      <>
        {header(false)}
        <Card aria-label="Este espaço só tem você">
          <EmptyState
            art="start"
            title="Este espaço só tem você"
            description="Convide quem divide as contas para ver quanto cada um pagou e quem deve a quem."
            action={
              <Button asChild icon={<Plus />}>
                <Link href="/ajustes/pessoas">Convidar pessoa</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const personal = division.personalCount;
  const withoutPayer = division.withoutPayer;

  return (
    <>
      {header(true)}
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-4 lg:col-span-7 lg:gap-6">
          <Card tone="hero" aria-labelledby="veredito-t" className="p-6 lg:p-8">
            <h2 id="veredito-t" className="text-md font-medium text-hero-mute">
              Acerto de {name}
            </h2>
            <div className="mt-2 text-2xl leading-snug font-[650] tracking-[-0.02em] lg:text-[1.75rem]">
              {division.moves.length > 0 ? (
                division.moves.map((move) => (
                  <p key={`${move.from}-${move.to}`}>
                    {nameOf(move.from)} deve <Money cents={move.amount} /> a {nameOf(move.to)}
                  </p>
                ))
              ) : (
                <p>{division.total > 0 ? `Tudo acertado ${periodWord}` : "Nenhuma despesa dividida ainda"}</p>
              )}
            </div>
            <p className="mt-3 text-md text-hero-mute">
              Conta as saídas já pagas, fora os gastos marcados como pessoais
              {personal > 0 ? ` (${personal} ${periodWord})` : ""}. Total dividido: <Money cents={division.total} />.
            </p>
            {division.moves.length > 0 ? (
              <div className="mt-5">
                <RegisterSettlementButton spaceId={spaceId} period={period} />
              </div>
            ) : null}
          </Card>

          {settlements.length > 0 ? (
            <Card aria-labelledby="acertos-t">
              <CardHeader title="Acertos registrados" titleId="acertos-t" />
              <ul>
                {settlements.map((s) => {
                  const text = `${nameOf(s.from)} pagou ${formatBRL(s.amount)} a ${nameOf(s.to)}`;
                  return (
                    <li
                      key={s.id}
                      className="flex min-h-14 items-center gap-3 border-t border-line py-2 first:border-t-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {nameOf(s.from)} pagou <Money cents={s.amount} /> a {nameOf(s.to)}
                        </p>
                        <p className="text-sm text-muted">
                          Registrado em {SETTLED_DATE.format(new Date(s.settledAt))}
                          {s.periodStart === s.periodEnd
                            ? ""
                            : `, vale para ${periodLabel(s.periodStart, 1)} a ${periodLabel(s.periodEnd, 1)}`}
                        </p>
                      </div>
                      <UnsettleButton spaceId={spaceId} id={s.id} label={text} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>

        <SplitModeCard
          spaceId={spaceId}
          savedMode={config.mode}
          mode={division.mode}
          pct={config.pct}
          people={division.people.map((p) => ({ name: p.name, percent: p.percent }))}
          periodWord={periodWord}
        />

        <section aria-label="Cada pessoa" className="grid gap-4 lg:col-span-12 lg:grid-cols-2 lg:gap-6">
          {division.people.map((person) => {
            const member = byId.get(person.memberId);
            const tone: StatTone = person.balance > 0 ? "in" : person.balance < 0 ? "out" : "ink";
            return (
              <Card key={person.memberId} aria-labelledby={`pessoa-${person.memberId}`}>
                <div className="mb-4 flex items-center gap-3">
                  <Avatar name={person.name} avatar={member?.avatar} size="md" decorative />
                  <h2 id={`pessoa-${person.memberId}`} className="min-w-0 flex-1 truncate text-lg font-semibold">
                    {person.name}
                    {member?.isYou ? " (você)" : ""}
                  </h2>
                  <Tag kind="neutral">{Math.round(person.percent * 100)}%</Tag>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Pagou" value={formatBRL(person.paid)} />
                  <Stat label="Parte justa" value={formatBRL(person.share)} />
                  <Stat
                    label={person.balance >= 0 ? "A receber" : "A pagar"}
                    value={formatBRL(Math.abs(person.balance))}
                    tone={tone}
                  />
                </div>
              </Card>
            );
          })}
        </section>

        {withoutPayer.length > 0 ? (
          <Card aria-labelledby="sem-pagador-t" className="lg:col-span-12">
            <CardHeader
              title="Sem quem pagou"
              titleId="sem-pagador-t"
              description={`${withoutPayer.length} ${withoutPayer.length === 1 ? "ficou" : "ficaram"} fora da conta`}
            />
            <TxPickList txs={withoutPayer.slice(0, WITHOUT_PAYER_MAX)} categories={categories} showMonth={range} />
            {withoutPayer.length > WITHOUT_PAYER_MAX ? (
              <p className="mt-2 text-sm text-muted">
                E mais {withoutPayer.length - WITHOUT_PAYER_MAX}.{" "}
                <Link href={`/lancamentos?mes=${period.start}`} className="text-brand-text underline">
                  Veja todos em Lançamentos
                </Link>
                .
              </p>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              Abra o lançamento e escolha quem pagou para ele entrar na divisão.
            </p>
          </Card>
        ) : null}

        {division.people.map((person) => {
          const items = [...person.items].sort((a, b) => b.amount - a.amount);
          return (
            <Card key={person.memberId} aria-labelledby={`pagou-${person.memberId}`} className="lg:col-span-6">
              <CardHeader
                title={`${person.name} pagou`}
                titleId={`pagou-${person.memberId}`}
                description={`${items.length} ${items.length === 1 ? "lançamento" : "lançamentos"}`}
              />
              {items.length > 0 ? (
                <>
                  <TxPickList txs={items.slice(0, PAID_LIST_MAX)} categories={categories} showMonth={range} />
                  {items.length > PAID_LIST_MAX ? (
                    <p className="mt-2 text-sm text-muted">
                      E mais {items.length - PAID_LIST_MAX}. Veja todos em Lançamentos.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted">Nada pago {periodWord}.</p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
