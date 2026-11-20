import { todayInSaoPaulo } from "@juntos/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DivisionView } from "@/components/divisao/division-view";
import { parsePeriod } from "@/lib/finance";
import { loadDivisionData } from "@/server/division-loaders";
import { loadAppContext } from "@/server/finance-loaders";

export const metadata: Metadata = { title: "Divisão de contas" };

type SearchParams = Promise<{ mes?: string | string[]; meses?: string | string[] }>;

export default async function DivisaoPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar?voltar=%2Fdivisao");
  const { mes, meses } = await searchParams;
  const period = parsePeriod(mes, meses, todayInSaoPaulo());
  const data = await loadDivisionData(ctx.activeSpace.id, period);
  return <DivisionView data={data} />;
}
