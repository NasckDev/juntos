import { todayInSaoPaulo, ymAdd } from "@juntos/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LancamentosView } from "@/components/financas/lancamentos/lancamentos-view";
import { parsePeriod } from "@/lib/finance";
import { loadAppContext, loadLancamentosData } from "@/server/finance-loaders";

export const metadata: Metadata = { title: "Lançamentos" };

type SearchParams = Promise<{ mes?: string | string[]; meses?: string | string[]; aba?: string | string[] }>;

export default async function LancamentosPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar?voltar=%2Flancamentos");
  const { mes, meses, aba } = await searchParams;
  const period = parsePeriod(mes, meses, todayInSaoPaulo());
  // O calendário é sempre de um mês: com um período na URL, abre o último mês dele.
  if (aba === "calendario" && period.span > 1) {
    redirect(`/lancamentos?aba=calendario&mes=${ymAdd(period.start, period.span - 1)}`);
  }
  const data = await loadLancamentosData(ctx.activeSpace.id, period);
  return <LancamentosView data={data} spaceName={ctx.activeSpace.name} />;
}
