import {
  applyForward,
  findDuplicate,
  type IsoDate,
  type Kind,
  materialize,
  monthsBetween,
  todayParts,
  type YearMonth,
  ymDiff,
} from "@juntos/core";
import { and, asc, desc, eq, getTableColumns, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { recurrences, spaceMembers, transactions } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import {
  type CreateTransactionData,
  parseInstallments,
  splitDate,
  TX_MESSAGES,
  type UpdateTransactionData,
} from "../validators/transactions";
import { assertCategory } from "./categories-read";
import type { DescriptionMemory, TxView } from "./finance-types";
import { recurrenceToCore } from "./recurrences-read";

/** Quem faz a ação (já conferido com `requireMember`). */
export interface Actor {
  readonly userId: string;
  /** Membro da pessoa no espaço (padrão de "quem pagou"). */
  readonly memberId: string;
}

type TxRow = typeof transactions.$inferSelect;

/** "2026-11" → "2026-11-01" (competência guardada como data no dia 1). */
export function competenceDate(ym: YearMonth): string {
  return `${ym}-01`;
}

/** Linha do banco → formato do core. `recurrenceAlive` falso solta o lançamento da conta fixa excluída. */
export function toTxView(row: TxRow, recurrenceAlive = row.recurrenceId !== null): TxView {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    amount: row.amountCents,
    competence: row.competence.slice(0, 7),
    day: row.day,
    categoryId: row.categoryId,
    paid: row.paid,
    paymentMethod: row.paymentMethod,
    paidBy: row.paidBy,
    personal: row.personal,
    note: row.note,
    recurrenceId: recurrenceAlive ? row.recurrenceId : null,
    installment: row.installmentNumber,
    installmentsTotal: row.installmentsTotal,
    yearly: row.yearly,
  };
}

/** Lançamentos com a informação de a conta fixa ainda existir. */
function selectTx(db: Executor) {
  return db
    .select({ tx: getTableColumns(transactions), alive: sql<boolean>`${recurrences.id} is not null` })
    .from(transactions)
    .leftJoin(recurrences, and(eq(recurrences.id, transactions.recurrenceId), isNull(recurrences.deletedAt)));
}

/** Lançamentos (não excluídos) dos meses informados, por mês, dia e nome. */
export async function listTransactions(db: Executor, spaceId: string, months: readonly YearMonth[]): Promise<TxView[]> {
  if (months.length === 0) return [];
  const rows = await selectTx(db)
    .where(
      and(
        eq(transactions.spaceId, spaceId),
        isNull(transactions.deletedAt),
        inArray(transactions.competence, months.map(competenceDate)),
      ),
    )
    .orderBy(asc(transactions.competence), asc(transactions.day), asc(transactions.description));
  return rows.map((row) => toTxView(row.tx, row.alive));
}

/** O espaço já tem algum lançamento? (Início mostra os primeiros passos quando não tem.) */
export async function hasTransactions(db: Executor, spaceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)))
    .limit(1);
  return row !== undefined;
}

async function findTransaction(db: Executor, spaceId: string, id: string): Promise<{ row: TxRow; alive: boolean }> {
  const [found] = await selectTx(db)
    .where(and(eq(transactions.id, id), eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)))
    .limit(1);
  if (!found) throw new DomainError(TX_MESSAGES.notFound);
  return { row: found.tx, alive: found.alive };
}

/**
 * "Quem pagou" precisa ser membro ativo do espaço. Na edição, aceita também quem já estava no lançamento
 * (pessoa que saiu do espaço continua no histórico).
 */
async function assertPayer(
  db: Executor,
  spaceId: string,
  paidBy: string | null,
  keep: string | null = null,
): Promise<void> {
  if (paidBy === null || paidBy === keep) return;
  const [row] = await db
    .select({ id: spaceMembers.id })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.id, paidBy), eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.status, "active")))
    .limit(1);
  if (!row) throw new DomainError(TX_MESSAGES.paidBy, "paidBy");
}

function personalFor(kind: Kind, personal: boolean): boolean {
  return kind === "out" && personal;
}

export interface CreatedTransaction {
  readonly id: string;
  readonly recurrenceId: string | null;
  readonly competence: YearMonth;
}

/**
 * Novo lançamento. Com "Repetir", cria a conta fixa e já lança do mês escolhido até o mês de hoje
 * (meses passados nascem pagos, regra do core); o primeiro lançamento fica com o "já foi pago" e a observação
 * do formulário. Os meses seguintes são lançados quando forem abertos.
 */
export async function createTransaction(
  db: Database,
  actor: Actor,
  data: CreateTransactionData,
  today: IsoDate,
): Promise<CreatedTransaction> {
  const { competence, day } = splitDate(data.date);
  await assertCategory(db, data.spaceId, data.categoryId, data.kind);
  await assertPayer(db, data.spaceId, data.paidBy);
  const personal = personalFor(data.kind, data.personal);

  if (data.repeat === "none") {
    if (!data.confirmDuplicate) {
      const sameMonth = await listTransactions(db, data.spaceId, [competence]);
      const candidate = { description: data.description, amount: data.amount, kind: data.kind, competence, day };
      if (findDuplicate(candidate, sameMonth)) throw new DomainError(TX_MESSAGES.duplicate, "description");
    }
    const [row] = await db
      .insert(transactions)
      .values({
        spaceId: data.spaceId,
        kind: data.kind,
        description: data.description,
        amountCents: data.amount,
        competence: competenceDate(competence),
        day,
        categoryId: data.categoryId,
        paid: data.paid,
        paidAt: data.paid ? today : null,
        paymentMethod: data.paymentMethod,
        paidBy: data.paidBy,
        personal,
        note: data.note,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning({ id: transactions.id });
    if (!row) throw new Error("Falha ao gravar o lançamento.");
    return { id: row.id, recurrenceId: null, competence };
  }

  const installments = data.repeat === "monthly" ? parseInstallments(data.installments) : null;
  return db.transaction(async (tx) => {
    const [rec] = await tx
      .insert(recurrences)
      .values({
        spaceId: data.spaceId,
        kind: data.kind,
        description: data.description,
        amountCents: data.amount,
        categoryId: data.categoryId,
        frequency: data.repeat === "yearly" ? "yearly" : "monthly",
        day,
        startCompetence: competenceDate(competence),
        installmentsTotal: typeof installments === "number" ? installments : null,
        paymentMethod: data.paymentMethod,
        paidBy: data.paidBy,
        personal,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();
    if (!rec) throw new Error("Falha ao gravar a conta fixa.");
    const model = recurrenceToCore(rec);
    const nowYm = todayParts(today).ym;
    // Do mês escolhido até o mês de hoje (só o próprio mês, se ele for no futuro).
    const months = monthsBetween(competence, ymDiff(competence, nowYm) > 0 ? nowYm : competence);
    const values = months.flatMap((ym) => {
      const generated = materialize(model, ym, today);
      if (!generated) return [];
      const first = ym === competence;
      const paid = first ? data.paid : generated.paid;
      return [
        {
          spaceId: data.spaceId,
          kind: generated.kind,
          description: generated.description,
          amountCents: generated.amount,
          competence: competenceDate(ym),
          day: generated.day,
          categoryId: generated.categoryId,
          paid,
          paidAt: paid ? (first ? today : `${ym}-${String(generated.day).padStart(2, "0")}`) : null,
          paymentMethod: generated.paymentMethod,
          paidBy: generated.paidBy,
          personal: generated.personal,
          note: first ? data.note : "",
          recurrenceId: rec.id,
          installmentNumber: generated.installment,
          installmentsTotal: generated.installmentsTotal,
          yearly: generated.yearly,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      ];
    });
    const inserted = await tx
      .insert(transactions)
      .values(values)
      .returning({ id: transactions.id, competence: transactions.competence });
    const first = inserted.find((row) => row.competence === competenceDate(competence));
    if (!first) throw new Error("Falha ao lançar o primeiro mês da conta fixa.");
    return { id: first.id, recurrenceId: rec.id, competence };
  });
}

/**
 * Edita um lançamento. Em lançamento de conta fixa com escopo "neste e nos próximos", muda também o modelo e os
 * lançamentos futuros ainda em aberto (`applyForward` do core); os pagos e os de meses anteriores ficam como estão.
 */
export async function updateTransaction(
  db: Database,
  actor: Actor,
  data: UpdateTransactionData,
  today: IsoDate,
): Promise<{ id: string; competence: YearMonth }> {
  const { row, alive } = await findTransaction(db, data.spaceId, data.id);
  const { competence, day } = splitDate(data.date);
  await assertCategory(db, data.spaceId, data.categoryId, data.kind);
  await assertPayer(db, data.spaceId, data.paidBy, row.paidBy);
  const oldCompetence = row.competence.slice(0, 7);
  const personal = personalFor(data.kind, data.personal);

  if (row.recurrenceId && competence !== oldCompetence) {
    const [taken] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.recurrenceId, row.recurrenceId),
          eq(transactions.competence, competenceDate(competence)),
          ne(transactions.id, row.id),
        ),
      )
      .limit(1);
    if (taken) throw new DomainError(TX_MESSAGES.recurringMonthTaken, "date");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({
        kind: data.kind,
        description: data.description,
        amountCents: data.amount,
        competence: competenceDate(competence),
        day,
        categoryId: data.categoryId,
        paid: data.paid,
        paidAt: data.paid ? (row.paid ? row.paidAt : today) : null,
        paymentMethod: data.paymentMethod,
        paidBy: data.paidBy,
        personal,
        note: data.note,
        updatedBy: actor.userId,
      })
      .where(and(eq(transactions.id, row.id), eq(transactions.spaceId, data.spaceId)));

    if (data.scope !== "next" || !alive || !row.recurrenceId) return;
    const [rec] = await tx
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.id, row.recurrenceId), eq(recurrences.spaceId, data.spaceId)));
    if (!rec) return;
    const siblings = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.recurrenceId, rec.id),
          eq(transactions.spaceId, data.spaceId),
          isNull(transactions.deletedAt),
          ne(transactions.id, row.id),
        ),
      );
    const changes = {
      description: data.description,
      amount: data.amount,
      day,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod,
      paidBy: data.paidBy,
      personal,
    };
    const before = siblings.map((sibling) => toTxView(sibling));
    const result = applyForward(recurrenceToCore(rec), before, oldCompetence, changes);
    await tx
      .update(recurrences)
      .set({
        description: result.recurrence.description,
        amountCents: result.recurrence.amount,
        day: result.recurrence.day,
        categoryId: result.recurrence.categoryId,
        paymentMethod: result.recurrence.paymentMethod,
        paidBy: result.recurrence.paidBy,
        personal: result.recurrence.personal,
        updatedBy: actor.userId,
      })
      .where(eq(recurrences.id, rec.id));
    for (const [index, next] of result.txs.entries()) {
      if (next === before[index]) continue;
      await tx
        .update(transactions)
        .set({
          description: next.description,
          amountCents: next.amount,
          day: next.day,
          categoryId: next.categoryId,
          paymentMethod: next.paymentMethod,
          paidBy: next.paidBy,
          personal: next.personal,
          updatedBy: actor.userId,
        })
        .where(eq(transactions.id, next.id));
    }
  });
  return { id: row.id, competence };
}

/** Marca como pago/recebido ou volta para em aberto. */
export async function setTransactionPaid(
  db: Executor,
  actor: Actor,
  spaceId: string,
  id: string,
  paid: boolean,
  today: IsoDate,
): Promise<{ id: string; paid: boolean }> {
  const rows = await db
    .update(transactions)
    .set({ paid, paidAt: paid ? today : null, updatedBy: actor.userId })
    .where(and(eq(transactions.id, id), eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)))
    .returning({ id: transactions.id });
  if (rows.length === 0) throw new DomainError(TX_MESSAGES.notFound);
  return { id, paid };
}

/** Cópia em aberto, solta da conta fixa, com "(cópia)" no nome (`A.dup` do protótipo). */
export async function duplicateTransaction(
  db: Executor,
  actor: Actor,
  spaceId: string,
  id: string,
): Promise<{ id: string; competence: YearMonth }> {
  const { row } = await findTransaction(db, spaceId, id);
  const [copy] = await db
    .insert(transactions)
    .values({
      spaceId,
      kind: row.kind,
      description: `${row.description} (cópia)`,
      amountCents: row.amountCents,
      competence: row.competence,
      day: row.day,
      categoryId: row.categoryId,
      paid: false,
      paidAt: null,
      paymentMethod: row.paymentMethod,
      paidBy: row.paidBy,
      personal: row.personal,
      note: row.note,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    })
    .returning({ id: transactions.id });
  if (!copy) throw new Error("Falha ao duplicar o lançamento.");
  return { id: copy.id, competence: row.competence.slice(0, 7) };
}

/**
 * Exclusão com "Desfazer" (10 minutos): soft delete. O lançamento de conta fixa excluído continua no banco,
 * então a materialização do mês não o recria.
 */
export async function deleteTransaction(
  db: Database,
  actor: Actor,
  spaceId: string,
  id: string,
): Promise<{ undo: UndoTokenInfo }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(transactions)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(and(eq(transactions.id, id), eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id });
    if (rows.length === 0) throw new DomainError(TX_MESSAGES.notFound);
    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: { type: "restore", entity: "transactions", ids: [id] },
    });
    return { undo };
  });
}

/**
 * "Desfazer" de um lançamento recém-criado: tira o lançamento e, se ele criou uma conta fixa, tira também a conta
 * e todos os lançamentos dela (soft delete).
 */
export async function discardCreatedTransaction(
  db: Database,
  actor: Actor,
  spaceId: string,
  id: string,
  recurrenceId: string | null,
): Promise<{ removed: number }> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const removed = await tx
      .update(transactions)
      .set({ deletedAt: now, updatedBy: actor.userId })
      .where(
        and(
          eq(transactions.spaceId, spaceId),
          isNull(transactions.deletedAt),
          recurrenceId
            ? or(eq(transactions.id, id), eq(transactions.recurrenceId, recurrenceId))
            : eq(transactions.id, id),
        ),
      )
      .returning({ id: transactions.id });
    if (recurrenceId) {
      await tx
        .update(recurrences)
        .set({ deletedAt: now, updatedBy: actor.userId })
        .where(and(eq(recurrences.id, recurrenceId), eq(recurrences.spaceId, spaceId), isNull(recurrences.deletedAt)));
    }
    if (removed.length === 0) throw new DomainError(TX_MESSAGES.notFound);
    return { removed: removed.length };
  });
}

/** Escapa `%`, `_` e `\` para o `ilike` procurar o texto literal. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Busca por nome ou observação em todos os meses (mais recentes primeiro). */
export async function searchTransactions(
  db: Executor,
  spaceId: string,
  query: string,
  limit: number,
): Promise<TxView[]> {
  const pattern = likePattern(query.trim());
  const rows = await selectTx(db)
    .where(
      and(
        eq(transactions.spaceId, spaceId),
        isNull(transactions.deletedAt),
        or(ilike(transactions.description, pattern), ilike(transactions.note, pattern)),
      ),
    )
    .orderBy(desc(transactions.competence), asc(transactions.day), asc(transactions.description))
    .limit(limit);
  return rows.map((row) => toTxView(row.tx, row.alive));
}

/** Quantos nomes o formulário lembra (o protótipo usa os últimos 80 na lista de sugestões). */
export const MEMORY_LIMIT = 200;

/**
 * O último lançamento de cada nome (por tipo), para o formulário sugerir nomes e repetir categoria, valor,
 * forma de pagamento e pessoa ao digitar um nome já usado.
 */
export async function loadDescriptionMemories(db: Executor, spaceId: string): Promise<DescriptionMemory[]> {
  const lowerName = sql`lower(${transactions.description})`;
  const rows = await db
    .selectDistinctOn([transactions.kind, lowerName], {
      kind: transactions.kind,
      description: transactions.description,
      amount: transactions.amountCents,
      categoryId: transactions.categoryId,
      paymentMethod: transactions.paymentMethod,
      paidBy: transactions.paidBy,
      competence: transactions.competence,
      day: transactions.day,
    })
    .from(transactions)
    .where(and(eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)))
    .orderBy(
      transactions.kind,
      lowerName,
      desc(transactions.competence),
      desc(transactions.day),
      desc(transactions.createdAt),
    );
  return rows
    .sort((a, b) => b.competence.localeCompare(a.competence) || b.day - a.day)
    .slice(0, MEMORY_LIMIT)
    .map(({ competence: _competence, day: _day, ...memory }) => memory);
}

/** Formas de pagamento já usadas, das mais recentes (até 12, como no protótipo). */
export async function loadPaymentMethods(db: Executor, spaceId: string): Promise<string[]> {
  const rows = await db
    .select({ method: transactions.paymentMethod })
    .from(transactions)
    .where(and(eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt), ne(transactions.paymentMethod, "")))
    .groupBy(transactions.paymentMethod)
    .orderBy(desc(sql`max(${transactions.createdAt})`))
    .limit(12);
  return rows.map((row) => row.method);
}
