import { daysIn, todayParts, ymOf } from "../calendar.ts";
import { normalizeName } from "../duplicates.ts";
import type { NewTx } from "../recurrence.ts";
import type { IsoDate, Member, Tx, YearMonth } from "../types.ts";
import { type ImportItem, INSTALLMENT_PATTERN } from "./types.ts";

export type ImportMode = "add" | "replace";

export interface ReviewRow {
  readonly item: ImportItem;
  readonly competence: YearMonth;
  /** Já existe lançamento igual neste espaço. */
  readonly existing: boolean;
  /** Os que já existem vêm desmarcados. */
  readonly selected: boolean;
}

/**
 * Competência do item. Na planilha mensal o ano escolhido na revisão manda; na detalhada cada lançamento
 * mantém o ano da própria data (o protótipo juntava tudo no primeiro ano).
 */
export function resolveCompetence(item: ImportItem, year: number | null = null): YearMonth {
  return ymOf(item.source === "monthly" ? (year ?? item.year) : item.year, item.month);
}

function matchKey(competence: YearMonth, description: string, amount: number, kind: string): string {
  const name = normalizeName(description.replace(INSTALLMENT_PATTERN, ""));
  return `${competence}|${name}|${amount}|${kind}`;
}

/** Marca o que já existe (mesma competência, nome sem acento nem parcela, valor e tipo). */
export function markExisting(
  items: readonly ImportItem[],
  txs: readonly Tx[],
  options: { readonly year?: number | null } = {},
): ReviewRow[] {
  const known = new Set(txs.map((t) => matchKey(t.competence, t.description, t.amount, t.kind)));
  return items.map((item) => {
    const competence = resolveCompetence(item, options.year ?? null);
    const existing = known.has(matchKey(competence, item.description, item.amount, item.kind));
    return { item, competence, existing, selected: !existing };
  });
}

export interface ImportPlanOptions {
  /** Ano escolhido para a planilha mensal. */
  readonly year?: number | null;
  readonly mode: ImportMode;
  readonly today: IsoDate;
  /** Usado para ligar a coluna "Quem" ao membro, pelo nome. */
  readonly members?: readonly Member[];
}

export interface ImportPlan {
  readonly create: NewTx[];
  /** Meses tocados, em ordem. */
  readonly competences: YearMonth[];
  /** Meses cujos lançamentos atuais devem ser apagados antes de gravar (só no modo "replace"). */
  readonly replaceCompetences: YearMonth[];
}

function isPaid(item: ImportItem, competence: YearMonth, today: IsoDate): boolean {
  if (item.source === "detailed") return item.paid === true;
  const open = item.status === "" || item.status === "-";
  return competence < todayParts(today).ym ? item.status !== "-" : !open;
}

/** Transforma os itens escolhidos na revisão em lançamentos a gravar. */
export function planImport(items: readonly ImportItem[], options: ImportPlanOptions): ImportPlan {
  const members = options.members ?? [];
  const create = items.map((item): NewTx => {
    const competence = resolveCompetence(item, options.year ?? null);
    const who = normalizeName(item.whoName);
    const member = who ? members.find((m) => normalizeName(m.name) === who) : undefined;
    return {
      kind: item.kind,
      description: item.description,
      amount: item.amount,
      competence,
      day: Math.min(item.day, daysIn(competence)),
      categoryId: item.categoryId,
      paid: isPaid(item, competence, options.today),
      paymentMethod: item.paymentMethod,
      paidBy: member?.id ?? null,
      personal: false,
      note: item.note,
      recurrenceId: null,
      installment: item.installment,
      installmentsTotal: item.installmentsTotal,
      yearly: false,
    };
  });
  const competences = [...new Set(create.map((t) => t.competence))].sort();
  return { create, competences, replaceCompetences: options.mode === "replace" ? competences : [] };
}
