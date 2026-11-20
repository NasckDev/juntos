import {
  type ExportStatus,
  type IsoDate,
  isYearMonth,
  type Kind,
  type Notice,
  type Role,
  todayInSaoPaulo,
  type YearMonth,
  ymOf,
} from "@juntos/core";
import type { NoticeFilter } from "@/lib/notices";
import { requireMember } from "./access";
import { getDb } from "./db";
import type { NotifyPreferences } from "./db/schema";
import { listActiveMembers } from "./finance-loaders";
import { listCategories } from "./services/categories-read";
import { type ExportSummary, summarizeExport } from "./services/export";
import type { CategoryView, MemberOption } from "./services/finance-types";
import { findPendingImport, type PendingImport, reviewExisting } from "./services/import";
import {
  computeNotices,
  type History,
  listHistory,
  syncNotices,
  TARGET_HREF,
  toNoticePrefs,
} from "./services/notifications";

/*
 * Leitura das telas Importar e exportar (`/dados`) e Notificações (`/notificacoes`). Toda leitura confere que a
 * pessoa participa do espaço (`requireMember`, papel mínimo "viewer").
 */

export interface ExportDefaults {
  readonly from: YearMonth;
  readonly to: YearMonth;
  readonly kinds: readonly Kind[];
  readonly status: ExportStatus;
  readonly who: string | null;
  readonly categoryIds: readonly string[];
}

/** Período inicial: `?de=` e `?ate=` (vindos de Relatórios) ou o ano de hoje inteiro (`expInit`). */
export function exportDefaults(de: unknown, ate: unknown, today: IsoDate): ExportDefaults {
  const year = Number(today.slice(0, 4));
  const from = typeof de === "string" && isYearMonth(de) ? de : ymOf(year, 1);
  const to = typeof ate === "string" && isYearMonth(ate) ? ate : ymOf(year, 12);
  return { from, to, kinds: ["in", "out", "save"], status: "all", who: null, categoryIds: [] };
}

export interface ImportReviewData {
  readonly pending: PendingImport;
  /** "Já existe" de cada item, para o ano da planilha e este espaço. */
  readonly existing: readonly boolean[];
}

export interface DadosData {
  readonly today: IsoDate;
  readonly role: Role;
  readonly categories: readonly CategoryView[];
  readonly members: readonly MemberOption[];
  readonly defaults: ExportDefaults;
  /** Resumo do período inicial (ou `null` se o período da URL é inválido: a tela mostra o erro). */
  readonly summary: ExportSummary | null;
  readonly review: ImportReviewData | null;
}

export async function loadDadosData(spaceId: string, defaults: ExportDefaults): Promise<DadosData> {
  const { user, membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  const [categories, members, pending] = await Promise.all([
    listCategories(db, spaceId),
    listActiveMembers(spaceId, user.id),
    membership.role === "viewer" ? Promise.resolve(null) : findPendingImport(db, spaceId, user.id),
  ]);
  const summary =
    defaults.from <= defaults.to
      ? await summarizeExport(
          db,
          { spaceId, ...defaults, categoryIds: [...defaults.categoryIds], kinds: [...defaults.kinds] },
          today,
          membership.role,
        )
      : null;
  const review = pending
    ? { pending, existing: await reviewExisting(db, spaceId, pending, pending.year, "here") }
    : null;
  return { today, role: membership.role, categories, members, defaults, summary, review };
}

export interface CurrentNotice extends Notice {
  /** Tela para onde o aviso leva (botão "Ver"). */
  readonly href: string;
}

export interface NotificationsData {
  readonly current: readonly CurrentNotice[];
  readonly history: History;
}

export async function loadNotificationsData(
  spaceId: string,
  prefs: NotifyPreferences,
  filter: NoticeFilter,
): Promise<NotificationsData> {
  const { user } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  await syncNotices(db, spaceId, today);
  const [current, history] = await Promise.all([
    computeNotices(db, spaceId, today, toNoticePrefs(prefs)),
    listHistory(db, spaceId, user.id, prefs, filter),
  ]);
  return { current: current.map((notice) => ({ ...notice, href: TARGET_HREF[notice.target] })), history };
}

/**
 * Ao abrir o app (layout autenticado): os avisos de agora entram no histórico, sem repetir. Uma falha aqui não
 * derruba a tela (o contador continua com o que já está guardado), mas fica registrada no log do servidor.
 */
export async function syncNoticesOnOpen(spaceId: string): Promise<void> {
  try {
    await requireMember(spaceId, "viewer");
    await syncNotices(getDb(), spaceId, todayInSaoPaulo());
  } catch (error: unknown) {
    console.error("Falha ao sincronizar os avisos do espaço:", error);
  }
}
