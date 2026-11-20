import { todayInSaoPaulo } from "@juntos/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DadosView } from "@/components/dados/dados-view";
import { exportDefaults, loadDadosData } from "@/server/dados-loaders";
import { loadAppContext } from "@/server/finance-loaders";

export const metadata: Metadata = { title: "Importar e exportar" };

type SearchParams = Promise<{ aba?: string | string[]; de?: string | string[]; ate?: string | string[] }>;

/** Importar e exportar (`vDados` do protótipo). Relatórios abre com `?aba=exportar&de=AAAA-01&ate=AAAA-12`. */
export default async function DadosPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar?voltar=%2Fdados");
  const { de, ate } = await searchParams;
  const data = await loadDadosData(ctx.activeSpace.id, exportDefaults(de, ate, todayInSaoPaulo()));
  return <DadosView data={data} spaceId={ctx.activeSpace.id} spaceName={ctx.activeSpace.name} />;
}
