import { DEFAULT_CATEGORIES, type Kind } from "@juntos/core";
import { and, eq, isNull, or } from "drizzle-orm";
import type { Executor } from "../db";
import { categories } from "../db/schema";
import { DomainError } from "../result";
import { TX_MESSAGES } from "../validators/transactions";
import type { CategoryView } from "./finance-types";

const DEFAULT_ORDER = new Map(DEFAULT_CATEGORIES.map((category, index) => [category.id, index]));

/** Categorias visíveis no espaço: as padrão (globais, na ordem do protótipo) e as criadas pelo espaço. */
export async function listCategories(db: Executor, spaceId: string): Promise<CategoryView[]> {
  const rows = await db
    .select({
      id: categories.id,
      key: categories.key,
      name: categories.name,
      icon: categories.icon,
      hue: categories.hue,
      kind: categories.kind,
      createdAt: categories.createdAt,
    })
    .from(categories)
    .where(or(isNull(categories.spaceId), eq(categories.spaceId, spaceId)));
  const rank = (row: (typeof rows)[number]) =>
    row.key === null ? DEFAULT_CATEGORIES.length : (DEFAULT_ORDER.get(row.key) ?? DEFAULT_CATEGORIES.length);
  return rows
    .sort((a, b) => rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime())
    .map(({ createdAt: _createdAt, ...category }) => category);
}

/** A categoria existe neste espaço (padrão ou do espaço) e é do tipo do lançamento; senão, erro no campo. */
export async function assertCategory(db: Executor, spaceId: string, categoryId: string, kind: Kind): Promise<void> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.kind, kind),
        or(isNull(categories.spaceId), eq(categories.spaceId, spaceId)),
      ),
    )
    .limit(1);
  if (!row) throw new DomainError(TX_MESSAGES.category, "categoryId");
}
