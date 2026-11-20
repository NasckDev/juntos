import { eq } from "drizzle-orm";
import type { Executor } from "../db";
import { DEFAULT_NOTIFY, type NotifyPreferences, userPreferences } from "../db/schema";

export type Preferences = Omit<typeof userPreferences.$inferSelect, "userId" | "updatedAt" | "whatsappE164">;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "auto",
  accent: "indigo",
  fontSize: "normal",
  hideValues: false,
  notify: DEFAULT_NOTIFY,
};

export interface PreferencesPatch {
  readonly theme?: Preferences["theme"] | undefined;
  readonly accent?: Preferences["accent"] | undefined;
  readonly fontSize?: Preferences["fontSize"] | undefined;
  readonly hideValues?: boolean | undefined;
  readonly notify?: { readonly [K in keyof NotifyPreferences]?: boolean | undefined } | undefined;
}

function pick(row: typeof userPreferences.$inferSelect): Preferences {
  return {
    theme: row.theme,
    accent: row.accent,
    fontSize: row.fontSize,
    hideValues: row.hideValues,
    notify: { ...DEFAULT_NOTIFY, ...row.notify },
  };
}

export async function getPreferences(db: Executor, userId: string): Promise<Preferences> {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  return row ? pick(row) : DEFAULT_PREFERENCES;
}

/** Atualização parcial; os tipos de aviso são mesclados com os atuais. */
export async function updatePreferences(db: Executor, userId: string, patch: PreferencesPatch): Promise<Preferences> {
  const current = await getPreferences(db, userId);
  const next: Preferences = {
    theme: patch.theme ?? current.theme,
    accent: patch.accent ?? current.accent,
    fontSize: patch.fontSize ?? current.fontSize,
    hideValues: patch.hideValues ?? current.hideValues,
    notify: mergeNotify(current.notify, patch.notify),
  };
  const values = { ...next, updatedAt: new Date() };
  const [row] = await db
    .insert(userPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userPreferences.userId, set: values })
    .returning();
  if (!row) throw new Error("Falha ao salvar as preferências.");
  return pick(row);
}

function mergeNotify(current: NotifyPreferences, patch: PreferencesPatch["notify"]): NotifyPreferences {
  if (!patch) return current;
  return {
    late: patch.late ?? current.late,
    due: patch.due ?? current.due,
    budget: patch.budget ?? current.budget,
    goal: patch.goal ?? current.goal,
    auto: patch.auto ?? current.auto,
    people: patch.people ?? current.people,
  };
}
