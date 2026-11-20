import { type IsoDate, previousPeriod, type Role, todayInSaoPaulo, ymOf } from "@juntos/core";
import { type Period, periodMonthsOf } from "@/lib/finance";
import { requireMember } from "./access";
import { getDb } from "./db";
import { listCategories } from "./services/categories-read";
import type { CategoryView, TxView } from "./services/finance-types";
import { materializeMonths } from "./services/month";
import { listTransactions } from "./services/transactions";

/*
 * Leitura da tela Relatórios (Server Component): o ano do mês selecionado, o período escolhido e o anterior.
 * Abrir o ano lança antes as contas fixas que faltam nos 12 meses (idempotente), como o protótipo faz ao
 * montar a previsão dos meses que ainda não chegaram.
 */

export interface ReportData {
  readonly today: IsoDate;
  readonly period: Period;
  /** Ano do primeiro mês do período, "2026". */
  readonly year: string;
  readonly role: Role;
  /** Todos os lançamentos do ano (barras, categorias do ano e tabela). */
  readonly yearTxs: readonly TxView[];
  /** Lançamentos do período escolhido (resumo, maiores saídas, "Pago com"). */
  readonly txs: readonly TxView[];
  /** Período anterior de mesmo tamanho (variações). */
  readonly previousTxs: readonly TxView[];
  readonly categories: readonly CategoryView[];
}

export async function loadReportData(spaceId: string, period: Period): Promise<ReportData> {
  const { membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  const year = Number(period.start.slice(0, 4));
  const yearMonths = Array.from({ length: 12 }, (_, i) => ymOf(year, i + 1));
  const months = periodMonthsOf(period);
  const previous = previousPeriod(period.start, period.span);
  await materializeMonths(db, spaceId, [...yearMonths, ...previous, ...months], today);

  const wanted = [...new Set([...yearMonths, ...previous, ...months])];
  const [all, categories] = await Promise.all([listTransactions(db, spaceId, wanted), listCategories(db, spaceId)]);
  const inMonths = (list: readonly string[]) => all.filter((tx) => list.includes(tx.competence));
  return {
    today,
    period,
    year: String(year),
    role: membership.role,
    yearTxs: inMonths(yearMonths),
    txs: inMonths(months),
    previousTxs: inMonths(previous),
    categories,
  };
}
