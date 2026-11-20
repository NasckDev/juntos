import type { SplitMode } from "@juntos/core";
import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "../db";
import { spaceMembers, spaces, user } from "../db/schema";
import { DomainError } from "../result";
import { SPLIT_MESSAGES } from "../validators/settlements";
import type { SetSplitInput } from "../validators/split";

/** Pessoa ativa do espaço, para a divisão. */
export interface SplitMember {
  /** Id do membro (`space_members.id`), o mesmo de "quem pagou" e dos acertos. */
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly avatar: string | null;
}

export interface SplitConfig {
  readonly mode: SplitMode;
  /** Parte (em %) da primeira pessoa no modo personalizado. */
  readonly pct: number;
}

/**
 * Pessoas ativas na ordem em que entraram no espaço. A ordem não depende de quem olha: no modo personalizado,
 * "a primeira pessoa" tem de ser a mesma para todos os membros.
 */
export async function listSplitMembers(db: Executor, spaceId: string): Promise<SplitMember[]> {
  const rows = await db
    .select({ id: spaceMembers.id, userId: user.id, name: user.name, avatar: user.avatar })
    .from(spaceMembers)
    .innerJoin(user, eq(user.id, spaceMembers.userId))
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.status, "active")))
    .orderBy(asc(spaceMembers.joinedAt), asc(spaceMembers.createdAt), asc(spaceMembers.id));
  return rows;
}

/** Modo de divisão e percentual salvos no espaço. */
export async function getSplitConfig(db: Executor, spaceId: string): Promise<SplitConfig> {
  const [row] = await db
    .select({ mode: spaces.splitMode, pct: spaces.splitPct })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  return row ?? { mode: "equal", pct: 50 };
}

/**
 * Salva o modo de divisão do espaço (`spaces.split_mode` e `split_pct`). O personalizado só vale com duas
 * pessoas; sem `pct`, mantém o percentual que já estava salvo. Quem confere o papel é a ação.
 */
export async function setSplitConfig(db: Executor, spaceId: string, input: SetSplitInput): Promise<SplitConfig> {
  if (input.mode === "custom") {
    const members = await listSplitMembers(db, spaceId);
    if (members.length !== 2) throw new DomainError(SPLIT_MESSAGES.customNeedsTwo);
  }
  const [row] = await db
    .update(spaces)
    .set({ splitMode: input.mode, ...(input.pct === undefined ? {} : { splitPct: input.pct }) })
    .where(eq(spaces.id, spaceId))
    .returning({ mode: spaces.splitMode, pct: spaces.splitPct });
  if (!row) throw new DomainError("Não encontramos esse espaço.");
  return row;
}
