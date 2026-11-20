import { todayInSaoPaulo } from "@juntos/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeView } from "@/components/financas/inicio/home-view";
import { parsePeriod } from "@/lib/finance";
import { loadAppContext, loadHomeData } from "@/server/finance-loaders";

export const metadata: Metadata = { title: "Início" };

type SearchParams = Promise<{ mes?: string | string[]; meses?: string | string[] }>;

export default async function InicioPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar?voltar=%2Finicio");
  const { mes, meses } = await searchParams;
  const period = parsePeriod(mes, meses, todayInSaoPaulo());
  const data = await loadHomeData(ctx.activeSpace.id, period);
  return <HomeView data={data} userName={ctx.user.name} spaceName={ctx.activeSpace.name} />;
}
