"use client";

import { type Cents, estimateBalance, formatBRL, parseMoney, simulatePayoff } from "@juntos/core";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Stat } from "@/components/ui/stat";
import type { SimulatorData } from "@/server/planning-loaders";
import { durationLabel, PayoffChart } from "./payoff-chart";

interface SimState {
  /** Id do parcelamento escolhido ("" = preencher à mão). */
  readonly source: string;
  readonly principal: Cents | null;
  /** Juros ao mês, em texto ("0,85"). */
  readonly rate: string;
  /** Parcelas que faltam, em texto. */
  readonly parcels: string;
  readonly extra: Cents | null;
}

const EMPTY: SimState = { source: "", principal: null, rate: "", parcels: "", extra: null };

/** "0,85" → 0,0085 (fração ao mês). Vazio ou ilegível = 0, como no protótipo. */
function monthlyRate(text: string): number {
  return (parseMoney(text) ?? 0) / 100 / 100;
}

/** "240" → 240; "12,5" fica 12,5 para o core recusar; vazio = 0. */
function parcelCount(text: string): number {
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

/** Simulador de quitação (`pSim` e `simOut` do protótipo), pela Tabela Price, com `simulatePayoff` do core. */
export function SimulatorView({ data }: { data: SimulatorData }) {
  const [state, setState] = useState<SimState>(EMPTY);
  const installment = data.installments.find((option) => option.id === state.source);

  /** Com um parcelamento escolhido, o saldo é estimado pela parcela, juros e parcelas que faltam. */
  function withEstimate(next: SimState): SimState {
    const option = data.installments.find((item) => item.id === next.source);
    if (!option) return next;
    const n = parcelCount(next.parcels);
    return { ...next, principal: n > 0 ? estimateBalance(option.amount, monthlyRate(next.rate), n) : null };
  }

  function chooseSource(id: string) {
    const option = data.installments.find((item) => item.id === id);
    if (!option) return setState((current) => ({ ...current, source: "" }));
    setState((current) => withEstimate({ ...current, source: id, parcels: String(option.left) }));
  }

  const result = simulatePayoff({
    principal: state.principal ?? 0,
    rate: monthlyRate(state.rate),
    n: parcelCount(state.parcels),
    extra: state.extra ?? 0,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
      <Card aria-labelledby="sim-form" className="lg:col-span-4">
        <CardHeader
          title="Seu financiamento"
          titleId="sim-form"
          description="Veja quanto de juros sai da conta ao adiantar parcelas."
        />
        <div className="flex flex-col gap-4">
          {data.installments.length > 0 ? (
            <Field label="Usar um parcelamento seu">
              <Select
                value={state.source}
                placeholder="Preencher à mão"
                options={data.installments.map((option) => ({
                  value: option.id,
                  label: `${option.description}: faltam ${option.left} de ${formatBRL(option.amount)}`,
                }))}
                onChange={(event) => chooseSource(event.target.value)}
              />
            </Field>
          ) : null}
          <Field
            label="Saldo devedor"
            hint={
              installment
                ? "Estimado pela parcela e pelos juros. Confira o valor exato no extrato do financiamento."
                : undefined
            }
          >
            <MoneyInput
              value={state.principal}
              placeholder="180.000,00"
              // Digitar o saldo à mão desliga o parcelamento escolhido (como no protótipo).
              onValueChange={(next) => setState((current) => ({ ...current, source: "", principal: next }))}
            />
          </Field>
          <Field label="Juros ao mês (%)">
            <Input
              inputMode="decimal"
              value={state.rate}
              placeholder="0,85"
              autoComplete="off"
              onChange={(event) => setState((current) => withEstimate({ ...current, rate: event.target.value }))}
            />
          </Field>
          <Field label="Parcelas que faltam">
            <Input
              inputMode="numeric"
              value={state.parcels}
              placeholder="240"
              autoComplete="off"
              onChange={(event) => setState((current) => withEstimate({ ...current, parcels: event.target.value }))}
            />
          </Field>
          <Field label="Valor extra por mês">
            <MoneyInput
              value={state.extra}
              placeholder="300,00"
              onValueChange={(next) => setState((current) => ({ ...current, extra: next }))}
            />
          </Field>
        </div>
      </Card>

      <Card aria-labelledby="sim-res" className="lg:col-span-8">
        <CardHeader title="Resultado" titleId="sim-res" />
        {result.ok ? (
          <>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Stat label="Parcela calculada" value={formatBRL(result.payment)} />
              <Stat
                label="Juros economizados"
                value={formatBRL(result.interestSaved)}
                tone="in"
                hint={`De ${formatBRL(result.baseline.interest)} para ${formatBRL(result.withExtra.interest)}`}
              />
              <Stat
                label="Tempo a menos"
                value={durationLabel(result.monthsSaved)}
                money={false}
                hint={`Quita em ${durationLabel(result.withExtra.months)}`}
              />
            </div>
            <div className="mt-6">
              <PayoffChart
                baseline={result.baseline}
                withExtra={result.withExtra}
                principal={state.principal ?? 0}
                extra={state.extra ?? 0}
              />
            </div>
            <p className="mt-4 text-xs text-muted">
              Cálculo pela Tabela Price, sem seguros e taxas. Use como estimativa e confirme com o banco.
            </p>
          </>
        ) : (
          <p
            role="status"
            className={result.error.startsWith("Preencha") ? "text-muted" : "text-sm font-semibold text-out"}
          >
            {result.error}
          </p>
        )}
      </Card>
    </div>
  );
}
