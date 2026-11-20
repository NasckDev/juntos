"use client";

import { Check, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toastError } from "@/components/financas/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { NOTICE_FILTER_LABELS, NOTICE_FILTERS, type NoticeFilter } from "@/lib/notices";
import { markAllNotificationsRead, markNotificationsSeen, openNotification } from "@/server/actions/notifications";
import type { NotificationsData } from "@/server/dados-loaders";
import type { HistoryItem } from "@/server/services/notifications";
import { NoticeIcon, TYPE_LOOK } from "./notice-icon";
import { dayLabel, relativeTime } from "./time";

export interface NotificationsViewProps {
  readonly spaceId: string;
  readonly spaceName: string;
  readonly data: NotificationsData;
  readonly filter: NoticeFilter;
  /** "Agora" do servidor (ISO), para os rótulos de tempo saírem iguais no servidor e no navegador. */
  readonly now: string;
}

/** Só caminhos internos do app. */
function isInternal(href: string | null): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
}

function groupByDay(items: readonly HistoryItem[], now: string): { label: string; items: HistoryItem[] }[] {
  const groups: { label: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** Central de notificações (`vAvisos`): avisos de agora e o histórico por dia, com filtros. */
export function NotificationsView({ spaceId, spaceName, data, filter, now }: NotificationsViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { current, history } = data;

  // Abrir a central marca tudo como visto: o contador do sino zera.
  useEffect(() => {
    if (history.unseen > 0) void markNotificationsSeen({ spaceId });
  }, [spaceId, history.unseen]);

  function choose(next: NoticeFilter) {
    startTransition(() => {
      router.replace(next === "todas" ? "/notificacoes" : `/notificacoes?filtro=${next}`, { scroll: false });
    });
  }

  function open(item: HistoryItem) {
    startTransition(async () => {
      const result = await openNotification({ spaceId, id: item.id });
      if (!result.ok) return toastError(result.error);
      if (isInternal(result.data.href)) router.push(result.data.href);
    });
  }

  function readAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead({ spaceId });
      if (!result.ok) toastError(result.error);
    });
  }

  const groups = groupByDay(history.items, now);

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle={`Contas, lançamentos automáticos, pessoas e metas de ${spaceName}`}
        actions={
          <>
            <Button
              variant="line"
              icon={<Check />}
              disabled={history.unread === 0 || pending}
              onClick={readAll}
              className="max-lg:px-3 max-lg:text-sm"
            >
              Marcar todas como lidas
            </Button>
            <Button asChild variant="ghost" className="max-lg:px-3 max-lg:text-sm">
              <Link href="/ajustes/avisos">
                <Settings aria-hidden="true" />
                Configurar
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex max-w-3xl flex-col gap-4 lg:gap-6">
        {current.length > 0 ? (
          <Card aria-labelledby="atencao-t">
            <header className="mb-2">
              <h2 id="atencao-t" className="text-lg font-semibold tracking-[-0.015em]">
                Precisa da sua atenção
              </h2>
              <p className="text-sm text-muted">
                {current.length} {current.length > 1 ? "avisos" : "aviso"} agora
              </p>
            </header>
            <ul>
              {current.map((notice) => (
                <li
                  key={notice.dedupeKey}
                  className="flex items-center gap-3 border-b border-line py-3 last:border-b-0 last:pb-0"
                >
                  <NoticeIcon icon={notice.icon} tone={notice.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{notice.title}</p>
                    <p className="text-sm break-words text-muted">{notice.body}</p>
                  </div>
                  <Button asChild variant="line" size="sm">
                    <Link href={notice.href} aria-label={`Ver: ${notice.title}`}>
                      Ver
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card aria-labelledby="historico-t">
          <header className="mb-4">
            <h2 id="historico-t" className="text-lg font-semibold tracking-[-0.015em]">
              Histórico
            </h2>
            <p className="text-sm text-muted">Os últimos 200 avisos ficam guardados</p>
          </header>
          {/* biome-ignore lint/a11y/useSemanticElements: grupo de botões de filtro (chips), não um fieldset. */}
          <div
            role="group"
            aria-label="Filtrar notificações"
            className="scrollbar-none -mx-5 mb-2 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0"
          >
            {NOTICE_FILTERS.map((option) => (
              <Chip key={option} selected={filter === option} onClick={() => choose(option)}>
                {NOTICE_FILTER_LABELS[option]}
                {option === "nao-lidas" && history.unread > 0 ? ` (${history.unread})` : ""}
              </Chip>
            ))}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              art="bell"
              size="sm"
              title="Nada por aqui"
              description={
                filter === "todas"
                  ? "Os avisos aparecem aqui e ficam guardados no histórico."
                  : "Nenhuma notificação com esse filtro."
              }
            />
          ) : (
            <div className={cn("transition-opacity", pending && "opacity-70")}>
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label} className="mt-3">
                  <h3 className="py-2 text-sm font-semibold text-muted">{group.label}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <HistoryRow item={item} now={now} onOpen={() => open(item)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function HistoryRow({ item, now, onOpen }: { item: HistoryItem; now: string; onOpen: () => void }) {
  const look = TYPE_LOOK[item.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-field px-2 py-3 text-left transition-colors hover:bg-surface2",
        !item.read && "bg-brand-soft/40",
      )}
    >
      <NoticeIcon icon={look.icon} tone={look.tone} />
      <span className="min-w-0 flex-1">
        <span className={cn("block", item.read ? "font-medium" : "font-semibold")}>{item.title}</span>
        {item.body ? <span className="block text-sm break-words text-muted">{item.body}</span> : null}
        <span className="mt-0.5 block text-xs text-muted">{relativeTime(item.createdAt, now)}</span>
      </span>
      {item.read ? null : (
        <span className="mt-2 flex shrink-0 items-center">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
          <span className="sr-only">Não lida</span>
        </span>
      )}
    </button>
  );
}
