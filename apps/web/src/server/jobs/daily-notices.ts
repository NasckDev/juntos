import { type IsoDate, todayInSaoPaulo, todayParts } from "@juntos/core";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { notifications, recurrences, spaceMembers, spaces, transactions, user } from "../db/schema";
import { type EmailMessage, type EmailResult, escapeHtml } from "../email";
import { appUrl } from "../env";
import type { PushPayload, PushResult } from "../push";
import { enabledTypes, type StoredNotice, syncNotices } from "../services/notifications";
import { getPreferences } from "../services/preferences";

/*
 * Rotina diária dos avisos (especificação 5.7): para cada espaço com atividade, lança as contas fixas do mês de
 * hoje, leva os avisos do dia ao histórico (sem repetir a chave) e, para cada aviso NOVO, manda push para quem
 * ligou aquele tipo e, com e-mail configurado, um resumo por e-mail. Idempotente: na segunda execução do dia nenhum
 * aviso é novo, então nada é reenviado.
 */

export interface NoticeSenders {
  readonly sendPush: (db: Executor, userId: string, payload: PushPayload) => Promise<PushResult>;
  readonly sendEmail: (message: EmailMessage) => Promise<EmailResult>;
  /** E-mail configurado (`RESEND_API_KEY`). */
  readonly emailEnabled: boolean;
}

export interface DailyNoticesReport {
  readonly spaces: number;
  readonly notices: number;
  readonly pushes: number;
  readonly emails: number;
}

/** Espaços com algo a avisar: lançamentos, contas fixas ou convites pendentes. */
async function activeSpaces(db: Executor): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: spaces.id, name: spaces.name })
    .from(spaces)
    .where(
      and(
        isNull(spaces.deletedAt),
        sql`(
          exists (select 1 from ${transactions} where ${transactions.spaceId} = ${spaces.id} and ${transactions.deletedAt} is null)
          or exists (select 1 from ${recurrences} where ${recurrences.spaceId} = ${spaces.id} and ${recurrences.deletedAt} is null)
          or exists (select 1 from ${spaceMembers} where ${spaceMembers.spaceId} = ${spaces.id} and ${spaceMembers.status} = 'invited')
        )`,
      ),
    );
}

async function autoNotice(db: Executor, spaceId: string, today: IsoDate): Promise<StoredNotice | null> {
  const [row] = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      dedupeKey: notifications.dedupeKey,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
    })
    .from(notifications)
    .where(and(eq(notifications.spaceId, spaceId), eq(notifications.dedupeKey, `auto-${todayParts(today).ym}`)));
  return row ?? null;
}

interface Recipient {
  readonly userId: string;
  readonly email: string;
  readonly isAnonymous: boolean;
}

async function recipients(db: Executor, spaceId: string): Promise<Recipient[]> {
  return db
    .select({ userId: user.id, email: user.email, isAnonymous: user.isAnonymous })
    .from(spaceMembers)
    .innerJoin(user, eq(user.id, spaceMembers.userId))
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.status, "active"), ne(user.email, "")));
}

/** Resumo dos avisos novos do dia, em texto e HTML (valores já escapados). */
export function noticesEmail(input: {
  readonly to: string;
  readonly spaceName: string;
  readonly notices: readonly StoredNotice[];
  readonly baseUrl: string;
}): EmailMessage {
  const count = input.notices.length;
  const subject =
    count === 1
      ? `${input.notices[0]?.title ?? "Novo aviso"} · ${input.spaceName}`
      : `${count} avisos novos em “${input.spaceName}”`;
  const link = `${input.baseUrl}/notificacoes`;
  const text = [
    `Avisos de hoje em “${input.spaceName}”:`,
    "",
    ...input.notices.map((n) => `- ${n.title}${n.body ? `: ${n.body}` : ""}`),
    "",
    `Abra o Juntos para ver: ${link}`,
  ].join("\n");
  const items = input.notices
    .map((n) => `<li><strong>${escapeHtml(n.title)}</strong>${n.body ? `<br>${escapeHtml(n.body)}` : ""}</li>`)
    .join("");
  const html = `<p>Avisos de hoje em “${escapeHtml(input.spaceName)}”:</p><ul>${items}</ul><p><a href="${escapeHtml(
    link,
  )}">Abrir o Juntos</a></p>`;
  return { to: input.to, subject, text, html };
}

async function notifySpace(
  db: Database,
  space: { id: string; name: string },
  today: IsoDate,
  senders: NoticeSenders,
): Promise<{ notices: number; pushes: number; emails: number }> {
  const hadAuto = (await autoNotice(db, space.id, today)) !== null;
  // Lança as contas fixas do mês (que registram "N contas fixas lançadas") e leva os avisos ao histórico.
  const inserted = await syncNotices(db, space.id, today);
  const auto = hadAuto ? null : await autoNotice(db, space.id, today);
  const fresh = auto ? [auto, ...inserted] : inserted;
  if (fresh.length === 0) return { notices: 0, pushes: 0, emails: 0 };

  let pushes = 0;
  let emails = 0;
  for (const person of await recipients(db, space.id)) {
    const prefs = await getPreferences(db, person.userId);
    const types = new Set(enabledTypes(prefs.notify));
    const wanted = fresh.filter((notice) => types.has(notice.type));
    if (wanted.length === 0) continue;
    for (const notice of wanted) {
      const result = await senders.sendPush(db, person.userId, {
        title: notice.title,
        body: notice.body,
        href: notice.href ?? "/notificacoes",
        tag: notice.dedupeKey,
      });
      if (result.enabled) pushes += result.sent;
    }
    if (senders.emailEnabled && !person.isAnonymous) {
      const message = noticesEmail({ to: person.email, spaceName: space.name, notices: wanted, baseUrl: appUrl() });
      if ((await senders.sendEmail(message)).sent) emails += 1;
    }
  }
  return { notices: fresh.length, pushes, emails };
}

/**
 * Roda os avisos do dia em todos os espaços com atividade. A falha de um espaço não impede os outros; no fim, se
 * algum falhou, lança o erro para o relatório do cron mostrar.
 */
export async function runDailyNotices(
  context: { readonly db: Database; readonly now: Date },
  senders: NoticeSenders,
): Promise<DailyNoticesReport> {
  const today = todayInSaoPaulo(context.now);
  const list = await activeSpaces(context.db);
  const failures: string[] = [];
  let notices = 0;
  let pushes = 0;
  let emails = 0;
  for (const space of list) {
    try {
      const result = await notifySpace(context.db, space, today, senders);
      notices += result.notices;
      pushes += result.pushes;
      emails += result.emails;
    } catch (error: unknown) {
      console.error(`Avisos do dia falharam no espaço ${space.id}:`, error);
      failures.push(space.id);
    }
  }
  if (failures.length > 0) throw new Error(`Avisos do dia falharam em ${failures.length} espaço(s).`);
  return { spaces: list.length, notices, pushes, emails };
}
