import type { Role } from "@juntos/core";
import {
  type IsoDate,
  type Projection,
  periodMonths,
  projectMonths,
  type Recurrence,
  remainingInstallments,
  todayInSaoPaulo,
  todayParts,
  type UpcomingChange,
  upcomingChanges,
  ymAdd,
} from "@juntos/core";
import { type Period, periodMonthsOf } from "@/lib/finance";
import { requireMember } from "./access";
import { getDb } from "./db";
import { listBudgets } from "./services/budgets";
import { listCategories } from "./services/categories-read";
import type { BudgetLine, CategoryView, GoalView, RecurrenceView, TxView } from "./services/finance-types";
import { listGoals } from "./services/goals";
import { materializeMonths } from "./services/month";
import { listRecurrences } from "./services/recurrences-read";
import { listTransactions } from "./services/transactions";

/*
 * Leitura das abas do Planejamento (Server Components). Como nas outras telas, toda leitura confere que a pessoa
 * participa do espaço (`requireMember`, papel mínimo "viewer") e filtra pelo `space_id`.
 */

export interface BudgetData {
  readonly today: IsoDate;
  readonly period: Period;
  readonly role: Role;
  readonly categories: readonly CategoryView[];
  readonly budgets: readonly BudgetLine[];
  readonly txs: readonly TxView[];
}

/** Orçamento: gasto do período (lança antes as contas fixas que faltam), categorias e limites. */
export async function loadBudgetData(spaceId: string, period: Period): Promise<BudgetData> {
  const { membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  const months = periodMonthsOf(period);
  await materializeMonths(db, spaceId, months, today);
  const [categories, budgets, txs] = await Promise.all([
    listCategories(db, spaceId),
    listBudgets(db, spaceId),
    listTransactions(db, spaceId, months),
  ]);
  return { today, period, role: membership.role, categories, budgets, txs };
}

export interface GoalsData {
  readonly today: IsoDate;
  readonly role: Role;
  readonly goals: readonly GoalView[];
}

export async function loadGoalsData(spaceId: string): Promise<GoalsData> {
  const { membership } = await requireMember(spaceId, "viewer");
  return { today: todayInSaoPaulo(), role: membership.role, goals: await listGoals(getDb(), spaceId) };
}

export interface ProjectionData {
  readonly today: IsoDate;
  readonly role: Role;
  readonly projection: Projection;
  readonly changes: readonly UpcomingChange[];
}

/** Meses do passado usados na média dos gastos variáveis. */
const LOOKBACK = 3;

/** Próximos meses: o que já está lançado (3 meses atrás até 6 à frente), as contas fixas e a média dos variáveis. */
export async function loadProjectionData(spaceId: string): Promise<ProjectionData> {
  const { membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  const nowYm = todayParts(today).ym;
  const [txs, recurrences] = await Promise.all([
    listTransactions(db, spaceId, periodMonths(ymAdd(nowYm, -LOOKBACK), LOOKBACK + 7)),
    listRecurrences(db, spaceId),
  ]);
  const models: Recurrence[] = recurrences;
  return {
    today,
    role: membership.role,
    projection: projectMonths({ txs, recurrences: models, today }),
    changes: upcomingChanges(models, today),
  };
}

export interface InstallmentOption {
  readonly id: string;
  readonly description: string;
  /** Valor da parcela. */
  readonly amount: number;
  /** Parcelas que faltam. */
  readonly left: number;
}

export interface SimulatorData {
  readonly installments: readonly InstallmentOption[];
}

/** Simulador: os parcelamentos de saída em andamento, para partir de um deles. */
export async function loadSimulatorData(spaceId: string): Promise<SimulatorData> {
  await requireMember(spaceId, "viewer");
  const today = todayInSaoPaulo();
  const nowYm = todayParts(today).ym;
  const recurrences: readonly RecurrenceView[] = await listRecurrences(getDb(), spaceId);
  return {
    installments: recurrences
      .filter((rec) => rec.kind === "out" && !rec.paused && rec.installmentsTotal !== null)
      .map((rec) => ({
        id: rec.id,
        description: rec.description,
        amount: rec.amount,
        left: remainingInstallments(rec, nowYm),
      }))
      .filter((option) => option.left > 0),
  };
}
