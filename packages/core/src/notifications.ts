import { BUDGET_NOTIFY_PERCENT, spentByCategory } from "./budget.ts";
import { monthName, todayParts } from "./calendar.ts";
import { categoryById } from "./categories.ts";
import { formatBRL, formatBRL0 } from "./money.ts";
import { DUE_SOON_NOTIFY_DAYS, isDueSoon, isLate } from "./status.ts";
import type { Category, Cents, Goal, IsoDate, Member, Tx } from "./types.ts";

export type NoticeKind = "late" | "due" | "budget" | "goal" | "invite" | "auto";
export type NoticeTone = "warn" | "brand" | "out" | "in" | "muted";
export type NoticeIcon = "alert" | "cal" | "wallet" | "target" | "user" | "rep";
export type NoticeTarget = "lancamentos" | "planejar" | "ajustes";

export interface Notice {
  /** Chave estável: o mesmo aviso (mesmos itens) tem sempre a mesma chave. */
  readonly dedupeKey: string;
  readonly kind: NoticeKind;
  readonly tone: NoticeTone;
  readonly icon: NoticeIcon;
  readonly title: string;
  readonly body: string;
  readonly target: NoticeTarget;
}

export interface NoticePrefs {
  readonly late: boolean;
  readonly due: boolean;
  readonly budget: boolean;
  readonly goal: boolean;
  readonly people: boolean;
  readonly auto: boolean;
}

export const DEFAULT_NOTICE_PREFS: NoticePrefs = {
  late: true,
  due: true,
  budget: true,
  goal: true,
  people: true,
  auto: true,
};

export interface NoticesInput {
  readonly today: IsoDate;
  readonly txs: readonly Tx[];
  /** Limites mensais por categoria. */
  readonly budgets: Readonly<Record<string, Cents>>;
  readonly goals: readonly Goal[];
  /** Membros inativos são convites pendentes. */
  readonly members: readonly Member[];
  readonly categories: readonly Category[];
  readonly prefs: NoticePrefs;
  /** Lançamentos que as contas fixas acabaram de gerar no mês atual. */
  readonly launchedRecurring?: readonly Tx[];
}

const MAX_NAMES = 3;
const MAX_LAUNCHED_NAMES = 4;

function names(items: readonly Tx[]): string {
  const shown = items
    .slice(0, MAX_NAMES)
    .map((t) => t.description)
    .join(", ");
  return items.length > MAX_NAMES ? `${shown} e mais ${items.length - MAX_NAMES}` : shown;
}

function sum(items: readonly Tx[]): string {
  return formatBRL(items.reduce((acc, t) => acc + t.amount, 0));
}

function stableIds(items: readonly Tx[]): string {
  return items
    .map((t) => t.id)
    .sort()
    .join(",");
}

function lateNotice(input: NoticesInput): Notice | null {
  const now = todayParts(input.today);
  const late = input.txs.filter((t) => t.competence <= now.ym && isLate(t, input.today));
  const first = late[0];
  if (!first) return null;
  return {
    dedupeKey: `late-${stableIds(late)}`,
    kind: "late",
    tone: "warn",
    icon: "alert",
    title: late.length > 1 ? `${late.length} contas atrasadas, ${sum(late)}` : `${first.description} está atrasada`,
    body: late.length > 1 ? `${names(late)}.` : `Venceu no dia ${first.day}. Valor: ${formatBRL(first.amount)}.`,
    target: "lancamentos",
  };
}

function dueNotice(input: NoticesInput): Notice | null {
  const now = todayParts(input.today);
  const soon = input.txs.filter((t) => t.kind === "out" && isDueSoon(t, input.today, DUE_SOON_NOTIFY_DAYS));
  const first = soon[0];
  if (!first) return null;
  const lastDay = Math.max(...soon.map((t) => t.day));
  return {
    dedupeKey: `due-${stableIds(soon)}`,
    kind: "due",
    tone: "brand",
    icon: "cal",
    title:
      soon.length > 1
        ? `${soon.length} contas vencem até o dia ${lastDay}`
        : `${first.description}${first.day === now.day ? " vence hoje" : ` vence no dia ${first.day}`}`,
    body: soon.length > 1 ? `${names(soon)}. Total: ${sum(soon)}.` : `Valor: ${formatBRL(first.amount)}.`,
    target: "lancamentos",
  };
}

function budgetNotice(input: NoticesInput): Notice | null {
  const now = todayParts(input.today);
  const spent = spentByCategory(input.txs.filter((t) => t.competence === now.ym));
  const over = Object.entries(input.budgets).filter(
    ([id, limit]) => limit > 0 && (spent[id] ?? 0) * 100 >= limit * BUDGET_NOTIFY_PERCENT,
  );
  const first = over[0];
  if (!first) return null;
  const exceeded = over.some(([id, limit]) => (spent[id] ?? 0) > limit);
  const nameOf = (id: string): string => categoryById(id, input.categories).name;
  const [firstId, firstLimit] = first;
  return {
    dedupeKey: `bud-${over.map(([id]) => id).join("")}${now.ym}`,
    kind: "budget",
    tone: exceeded ? "out" : "warn",
    icon: "wallet",
    title:
      over.length > 1
        ? `${over.length} categorias no limite ou acima`
        : `${nameOf(firstId)}${(spent[firstId] ?? 0) > firstLimit ? " passou do limite" : " está perto do limite"}`,
    body: `${over.map(([id, limit]) => `${nameOf(id)}: ${formatBRL0(spent[id] ?? 0)} de ${formatBRL0(limit)}`).join("; ")}.`,
    target: "planejar",
  };
}

function goalNotices(input: NoticesInput): Notice[] {
  return input.goals
    .filter((g) => g.saved >= g.target)
    .map((g) => ({
      dedupeKey: `goal-${g.id}`,
      kind: "goal",
      tone: "in",
      icon: "target",
      title: `Meta alcançada: ${g.name}`,
      body: `Vocês juntaram ${formatBRL(g.target)}.`,
      target: "planejar",
    }));
}

function inviteNotices(input: NoticesInput): Notice[] {
  return input.members
    .filter((m) => !m.active)
    .map((m) => ({
      dedupeKey: `inv-${m.id}`,
      kind: "invite",
      tone: "muted",
      icon: "user",
      title: "Convite aguardando resposta",
      body: `${m.name} ainda não aceitou o convite.`,
      target: "ajustes",
    }));
}

function autoNotice(input: NoticesInput): Notice | null {
  const launched = input.launchedRecurring ?? [];
  if (launched.length === 0) return null;
  const now = todayParts(input.today);
  const shown = launched
    .slice(0, MAX_LAUNCHED_NAMES)
    .map((t) => t.description)
    .join(", ");
  const rest = launched.length > MAX_LAUNCHED_NAMES ? ` e mais ${launched.length - MAX_LAUNCHED_NAMES}` : "";
  return {
    dedupeKey: `auto-${now.ym}`,
    kind: "auto",
    tone: "brand",
    icon: "rep",
    title: `${launched.length}${launched.length > 1 ? " contas fixas lançadas em " : " conta fixa lançada em "}${monthName(now.ym).toLowerCase()}`,
    body: `${shown}${rest}. Confira se algum valor mudou.`,
    target: "lancamentos",
  };
}

/** Avisos ativos hoje, respeitando as preferências. A chave de deduplicação evita repetir o mesmo aviso. */
export function currentNotices(input: NoticesInput): Notice[] {
  const { prefs } = input;
  const found: (Notice | null)[] = [
    prefs.late ? lateNotice(input) : null,
    prefs.due ? dueNotice(input) : null,
    prefs.budget ? budgetNotice(input) : null,
    ...(prefs.goal ? goalNotices(input) : []),
    ...(prefs.people ? inviteNotices(input) : []),
    prefs.auto ? autoNotice(input) : null,
  ];
  return found.filter((n): n is Notice => n !== null);
}

/** Só os avisos cuja chave ainda não está no histórico. */
export function newNotices(notices: readonly Notice[], existingKeys: Iterable<string>): Notice[] {
  const seen = new Set(existingKeys);
  return notices.filter((n) => !seen.has(n.dedupeKey));
}
