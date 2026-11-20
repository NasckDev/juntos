import { randomUUID } from "node:crypto";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { runMigrations } from "../db/migrate";
import { spaceMembers, user } from "../db/schema";
import { listUserSpaces, type SpaceSummary } from "../services/spaces";
import { ensureUserSetup } from "../services/users";

/** Aplica as migrações reais (pasta `apps/web/drizzle`) no PGlite em memória deste arquivo de teste. */
export async function migrateTestDb(): Promise<void> {
  await runMigrations(getDb(), path.resolve(import.meta.dirname, "../../../drizzle"));
}

export interface TestUser {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly isAnonymous: boolean;
  /** Espaço "Casa" criado no cadastro. */
  readonly home: SpaceSummary;
}

/** Cria um usuário como o Better Auth criaria e roda o mesmo provisionamento (Casa + preferências). */
export async function createTestUser(
  name: string,
  options: { readonly anonymous?: boolean; readonly createdAt?: Date } = {},
): Promise<TestUser> {
  const db = getDb();
  const id = randomUUID();
  const anonymous = options.anonymous ?? false;
  const email = anonymous
    ? `temp-${id}@anonymous.invalid`
    : `${name.toLowerCase().replace(/\W+/g, ".")}.${id.slice(0, 6)}@example.com`;
  await db.insert(user).values({
    id,
    name,
    email,
    isAnonymous: anonymous,
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
  });
  await ensureUserSetup(db, id);
  const [home] = await listUserSpaces(db, id);
  if (!home) throw new Error("Usuário de teste sem espaço.");
  return { id, name, email: anonymous ? null : email, isAnonymous: anonymous, home };
}

/** Coloca `userId` no espaço com o papel indicado, como se tivesse aceitado um convite. */
export async function addMember(spaceId: string, userId: string, role: "editor" | "viewer"): Promise<string> {
  const [row] = await getDb()
    .insert(spaceMembers)
    .values({ spaceId, userId, role, status: "active", joinedAt: new Date() })
    .returning({ id: spaceMembers.id });
  if (!row) throw new Error("Falha ao adicionar membro de teste.");
  return row.id;
}

export async function memberRow(memberId: string) {
  const [row] = await getDb().select().from(spaceMembers).where(eq(spaceMembers.id, memberId));
  return row;
}

/** Sessão simulada para as Server Actions nos testes (o módulo `session` é substituído com `vi.mock`). */
export function sessionOf(testUser: TestUser) {
  return {
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    isAnonymous: testUser.isAnonymous,
    avatar: null,
    image: null,
    deletionRequestedAt: null,
  };
}
