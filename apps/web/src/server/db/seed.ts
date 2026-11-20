import { DEFAULT_CATEGORIES } from "@juntos/core";
import { sql } from "drizzle-orm";
import type { Executor } from "./index";
import { categories } from "./schema";

/**
 * Semeia (ou atualiza) as 13 categorias padrão do protótipo, globais (`space_id` nulo).
 * Idempotente: roda junto com as migrações em todo ambiente. Nenhum outro dado é semeado:
 * toda conta começa vazia (especificação 5.1).
 */
export async function seedDefaultCategories(db: Executor): Promise<number> {
  const rows = DEFAULT_CATEGORIES.map((category) => ({
    spaceId: null,
    key: category.id,
    name: category.name,
    icon: category.icon,
    hue: category.hue,
    kind: category.kind,
  }));
  await db
    .insert(categories)
    .values(rows)
    .onConflictDoUpdate({
      target: categories.key,
      targetWhere: sql`${categories.spaceId} is null`,
      set: {
        name: sql`excluded.name`,
        icon: sql`excluded.icon`,
        hue: sql`excluded.hue`,
        kind: sql`excluded.kind`,
      },
    });
  return rows.length;
}
