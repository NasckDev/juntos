import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/financas/app-frame";
import { syncNoticesOnOpen } from "@/server/dados-loaders";
import { countMembers, countUnseenNotifications, loadAppContext, loadEntryFormData } from "@/server/finance-loaders";
import { needsWelcome } from "@/server/welcome";

/** Grupo autenticado: sem sessão vai para `/entrar`; com sessão, a casca ligada ao espaço ativo. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await loadAppContext();
  if (!ctx) redirect("/entrar");
  const { user, spaces, activeSpace, preferences } = ctx;
  // Avisos de agora entram no histórico antes de contar o sino (`syncEv` do protótipo).
  await syncNoticesOnOpen(activeSpace.id);
  const [counts, unreadCount, form] = await Promise.all([
    countMembers(spaces.map((space) => space.id)),
    countUnseenNotifications(activeSpace.id, user.id, preferences.notify),
    loadEntryFormData(activeSpace.id),
  ]);
  return (
    <AppFrame
      key={activeSpace.id}
      user={{
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        isGuest: user.isAnonymous,
        needsWelcome: needsWelcome(user),
      }}
      spaces={spaces.map((space) => ({ id: space.id, name: space.name, memberCount: counts[space.id] ?? 1 }))}
      activeSpaceId={activeSpace.id}
      unreadCount={unreadCount}
      preferences={preferences}
      form={form}
    >
      {children}
    </AppFrame>
  );
}
