import { formatBRL, monthName, todayParts, ymLabel } from "@juntos/core";
import { CalendarDays, CircleCheck } from "lucide-react";
import { MonthBars } from "@/components/charts/month-bars";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import type { ProjectionData } from "@/server/planning-loaders";
import { NewEntryButton } from "../financas/controls";

/** Quantas mudanças aparecem em "O que muda no caminho" (`ch.slice(0, 5)` do protótipo). */
const CHANGES_SHOWN = 5;

/** Próximos meses (`pProj` do protótipo): estatísticas, barras com previsão hachurada, mudanças e tabela. */
export function ProjectionView({ data }: { data: ProjectionData }) {
  const { projection, changes, today, role } = data;
  const currentYm = todayParts(today).ym;

  if (!projection.hasData) {
    return (
      <Card>
        <EmptyState
          art="chart"
          title="Sem dados para projetar"
          description="A projeção usa as contas fixas, as parcelas e a média dos gastos variáveis."
          action={role === "viewer" ? null : <NewEntryButton repeat="monthly">Nova conta fixa</NewEntryButton>}
        />
      </Card>
    );
  }

  const { rows, tightest } = projection;
  const first = rows[0];
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
      <Card aria-label="Resumo dos próximos meses" className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
          <Stat
            label="Sobra prevista em 6 meses"
            value={formatBRL(projection.accumulated)}
            tone={projection.accumulated < 0 ? "out" : "ink"}
          />
          {tightest ? (
            <Stat
              label="Mês mais apertado"
              value={monthName(tightest.ym)}
              money={false}
              hint={`${formatBRL(tightest.left)} de sobra`}
            />
          ) : null}
          <Stat
            label="Gastos variáveis"
            value={formatBRL(projection.variableAverage)}
            hint="Média mensal dos últimos 3 meses"
          />
          {first ? (
            <Stat
              label="Contas fixas"
              value={formatBRL(first.fixed)}
              hint={`Em ${monthName(first.ym).toLowerCase()}`}
            />
          ) : null}
        </div>
      </Card>

      <Card aria-labelledby="prox-t" className="lg:col-span-7">
        <CardHeader title="Próximos 6 meses" titleId="prox-t" />
        <MonthBars
          title="Entradas e saídas previstas nos próximos 6 meses"
          currentYm={currentYm}
          rows={rows.map((row) => ({ ym: row.ym, income: row.in, outflow: row.out + row.save }))}
        />
      </Card>

      <Card aria-labelledby="muda-t" className="lg:col-span-5">
        <CardHeader title="O que muda no caminho" titleId="muda-t" />
        {changes.length === 0 ? (
          <p className="text-muted">Nenhuma parcela termina e nenhuma conta anual vence nos próximos meses.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {changes.slice(0, CHANGES_SHOWN).map((change) => {
              const Icon = change.icon === "check" ? CircleCheck : CalendarDays;
              return (
                <li key={`${change.title}-${change.monthsAhead}`} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={cn("mt-0.5 shrink-0", change.tone === "in" ? "text-in" : "text-warn")}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <b className="block font-semibold">{change.title}</b>
                    <p className="text-sm text-muted">{change.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="tab-t" className="lg:col-span-12">
        <CardHeader title="Mês a mês" titleId="tab-t" />
        <table className="num hidden w-full border-collapse text-md lg:table">
          <caption className="sr-only">Projeção dos próximos 6 meses</caption>
          <thead>
            <tr className="text-sm text-muted">
              <th scope="col" className="border-b border-line py-2 text-left font-semibold">
                Mês
              </th>
              {["Entra", "Contas lançadas", "Variáveis (média)", "Guarda", "Sobra prevista", "Acumulado"].map(
                (label) => (
                  <th key={label} scope="col" className="border-b border-line py-2 text-right font-semibold">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ym}>
                <th scope="row" className="border-b border-line py-3 text-left font-semibold">
                  {ymLabel(row.ym)}
                </th>
                <td className="hv border-b border-line py-3 text-right">{formatBRL(row.in)}</td>
                <td className="hv border-b border-line py-3 text-right">{formatBRL(row.fixed)}</td>
                <td className="hv border-b border-line py-3 text-right">{formatBRL(row.variable)}</td>
                <td className="hv border-b border-line py-3 text-right">{formatBRL(row.save)}</td>
                <td className={cn("hv border-b border-line py-3 text-right", row.left < 0 ? "text-out" : "text-in")}>
                  {formatBRL(row.left)}
                </td>
                <td className="hv border-b border-line py-3 text-right font-semibold">{formatBRL(row.accumulated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="flex flex-col lg:hidden">
          {rows.map((row) => (
            <li key={row.ym} className="border-t border-line py-4 first:border-t-0 first:pt-0">
              <p className="flex items-baseline justify-between gap-3">
                <b>{ymLabel(row.ym)}</b>
                <span className={cn("hv num font-semibold", row.left < 0 ? "text-out" : "text-in")}>
                  {formatBRL(row.left)}
                </span>
              </p>
              <dl className="mt-2 grid gap-y-1 text-sm">
                {[
                  ["Entra", row.in],
                  ["Contas lançadas", row.fixed],
                  ["Variáveis (média)", row.variable],
                  ["Guarda", row.save],
                  ["Acumulado", row.accumulated],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="hv num">{formatBRL(Number(value))}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Estimativa: considera o que já está lançado para cada mês e soma a média dos gastos que não são fixos.
        </p>
      </Card>
    </div>
  );
}
