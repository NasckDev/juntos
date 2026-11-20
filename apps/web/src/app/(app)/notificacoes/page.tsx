import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationsView } from "@/components/notificacoes/notifications-view";
import { parseNoticeFilter } from "@/lib/notices";
import { loadNotificationsData } from "@/server/dados-loaders";
import { loadAppContext } from "@/server/finance-loaders";

export const metadata: Metadata = { title: "Notificações" };

type SearchParams = Promise<{ filtro?: string | string[] }>;

/** Central de notificações (`vAvisos` do protótipo). */
export default async function NotificacoesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar?voltar=%2Fnotificacoes");
  const filter = parseNoticeFilter((await searchParams).filtro);
  const data = await loadNotificationsData(ctx.activeSpace.id, ctx.preferences.notify, filter);
  return (
    <NotificationsView
      spaceId={ctx.activeSpace.id}
      spaceName={ctx.activeSpace.name}
      data={data}
      filter={filter}
      now={new Date().toISOString()}
    />
  );
}
