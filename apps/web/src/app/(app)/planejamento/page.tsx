import { periodLabel, todayInSaoPaulo } from "@juntos/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PeriodPicker } from "@/components/financas/controls";
import { BudgetView } from "@/components/planejamento/budget-view";
import { GoalsView, NewGoalButton } from "@/components/planejamento/goals-view";
import { PlanTabs } from "@/components/planejamento/plan-tabs";
import { ProjectionView } from "@/components/planejamento/projection-view";
import { SimulatorView } from "@/components/planejamento/simulator-view";
import { PageHeader } from "@/components/shell/page-header";
import { parsePeriod } from "@/lib/finance";
import { parsePlanTab } from "@/lib/planning";
import { loadAppContext } from "@/server/finance-loaders";
import { loadBudgetData, loadGoalsData, loadProjectionData, loadSimulatorData } from "@/server/planning-loaders";

export const metadata: Metadata = { title: "Planejamento" };

type SearchParams = Promise<{ aba?: string | string[]; mes?: string | string[]; meses?: string | string[] }>;

const SUBTITLES = {
  orcamento: "Limites, metas e o que esperar dos próximos meses",
  metas: "Quanto falta para cada meta e quando vocês chegam lá",
  proximos: "O que esperar dos próximos 6 meses",
  simulador: "Quanto de juros dá para economizar adiantando parcelas",
} as const;

export default async function PlanejamentoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = parsePlanTab(Array.isArray(params.aba) ? params.aba[0] : params.aba);
  const ctx = await loadAppContext();
  if (!ctx)
    redirect(
      `/entrar?voltar=${encodeURIComponent(tab === "orcamento" ? "/planejamento" : `/planejamento?aba=${tab}`)}`,
    );
  const spaceId = ctx.activeSpace.id;
  const period = parsePeriod(params.mes, params.meses, todayInSaoPaulo());

  return (
    <>
      <PageHeader
        title="Planejamento"
        subtitle={
          tab === "orcamento" ? `${periodLabel(period.start, period.span)} em ${ctx.activeSpace.name}` : SUBTITLES[tab]
        }
        month={tab === "orcamento" ? <PeriodPicker /> : undefined}
        actions={tab === "metas" ? <NewGoalButton /> : undefined}
      />
      <PlanTabs active={tab} />
      <div className="pt-5 lg:pt-6">
        {tab === "orcamento" ? <BudgetView data={await loadBudgetData(spaceId, period)} /> : null}
        {tab === "metas" ? <GoalsView data={await loadGoalsData(spaceId)} /> : null}
        {tab === "proximos" ? <ProjectionView data={await loadProjectionData(spaceId)} /> : null}
        {tab === "simulador" ? <SimulatorView data={await loadSimulatorData(spaceId)} /> : null}
      </div>
    </>
  );
}
