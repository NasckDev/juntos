import { and, eq, isNull, or } from "drizzle-orm";
import type { Database } from "../db";
import { budgets, categories, recurrences, transactions } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { CATEGORY_MESSAGES, type CreateCategoryData } from "../validators/categories";
import { isUniqueViolation } from "./db-errors";
import type { Actor } from "./transactions";

/** Tons das categorias novas, em rodízio (`hue` do protótipo, em `catf`). */
const HUES = [232, 42, 268, 140, 18, 330, 172, 205, 295] as const;

/** Categoria padrão que recebe o que estava numa categoria excluída: Outros (saída), Renda extra (entrada) ou Reserva. */
const FALLBACK_KEY = { out: "outros", in: "extra", save: "reserva" } as const;

/**
 * Cria uma categoria do espaço (e, se vier `limit`, o limite mensal) na mesma transação.
 * O nome não pode repetir o de outra categoria do mesmo tipo, padrão ou do espaço.
 */
export async function createCategory(db: Database, spaceId: string, data: CreateCategoryData): Promise<{ id: string }> {
  try {
    return await db.transaction(async (tx) => {
      const visible = await tx
        .select({ name: categories.name, spaceId: categories.spaceId })
        .from(categories)
        .where(and(eq(categories.kind, data.kind), or(isNull(categories.spaceId), eq(categories.spaceId, spaceId))));
      if (visible.some((row) => row.name.trim().toLowerCase() === data.name.toLowerCase())) {
        throw new DomainError(CATEGORY_MESSAGES.nameTaken, "name");
      }
      const ownCount = visible.filter((row) => row.spaceId !== null).length;
      const [row] = await tx
        .insert(categories)
        .values({
          spaceId,
          key: null,
          name: data.name,
          icon: data.icon,
          hue: HUES[ownCount % HUES.length] ?? HUES[0],
          kind: data.kind,
        })
        .returning({ id: categories.id });
      if (!row) throw new Error("Falha ao gravar a categoria.");
      if (data.limit !== null) {
        await tx.insert(budgets).values({ spaceId, categoryId: row.id, monthlyLimitCents: data.limit });
      }
      return { id: row.id };
    });
  } catch (error: unknown) {
    // Duas criações ao mesmo tempo com o mesmo nome: o índice único do banco segura a segunda.
    if (isUniqueViolation(error)) throw new DomainError(CATEGORY_MESSAGES.nameTaken, "name");
    throw error;
  }
}

/**
 * Exclui uma categoria criada pelo espaço. Lançamentos (inclusive os excluídos) e contas fixas passam para a
 * categoria padrão de reserva do mesmo tipo e o limite é removido. Devolve o token de "Desfazer" (10 minutos).
 * As categorias padrão são globais e não podem ser excluídas.
 */
export async function deleteCategory(
  db: Database,
  actor: Actor,
  spaceId: string,
  id: string,
): Promise<{ undo: UndoTokenInfo }> {
  return db.transaction(async (tx) => {
    const [category] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), or(isNull(categories.spaceId), eq(categories.spaceId, spaceId))));
    if (!category) throw new DomainError(CATEGORY_MESSAGES.notFound);
    if (category.spaceId === null) throw new DomainError(CATEGORY_MESSAGES.defaultLocked);

    const [fallback] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.spaceId), eq(categories.key, FALLBACK_KEY[category.kind])));
    if (!fallback) throw new Error("Categoria padrão de reserva não encontrada.");

    const movedTx = await tx
      .update(transactions)
      .set({ categoryId: fallback.id })
      .where(and(eq(transactions.spaceId, spaceId), eq(transactions.categoryId, id)))
      .returning({ id: transactions.id });
    const movedRec = await tx
      .update(recurrences)
      .set({ categoryId: fallback.id })
      .where(and(eq(recurrences.spaceId, spaceId), eq(recurrences.categoryId, id)))
      .returning({ id: recurrences.id });
    const [budget] = await tx
      .delete(budgets)
      .where(and(eq(budgets.spaceId, spaceId), eq(budgets.categoryId, id)))
      .returning({ limit: budgets.monthlyLimitCents });
    await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.spaceId, spaceId)));

    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: {
        type: "restore-category",
        category: {
          id: category.id,
          name: category.name,
          icon: category.icon,
          hue: category.hue,
          kind: category.kind,
          transactionIds: movedTx.map((row) => row.id),
          recurrenceIds: movedRec.map((row) => row.id),
          budgetCents: budget?.limit ?? null,
        },
      },
    });
    return { undo };
  });
}
