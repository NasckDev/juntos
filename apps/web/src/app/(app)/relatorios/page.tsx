import { todayInSaoPaulo } from "@juntos/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportView } from "@/components/relatorios/report-view";
import { parsePeriod } from "@/lib/finance";
import { loadAppContext } from "@/server/finance-loaders";
import { loadReportData } from "@/server/report-loaders";

export const metadata: Metadata = { title: "Relatórios" };

type SearchParams = Promise<{ mes?: string | string[]; meses?: string | string[] }>;

export default async function RelatoriosPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar?voltar=%2Frelatorios");
  const { mes, meses } = await searchParams;
  const period = parsePeriod(mes, meses, todayInSaoPaulo());
  const data = await loadReportData(ctx.activeSpace.id, period);
  return <ReportView data={data} spaceName={ctx.activeSpace.name} />;
}
