import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/server/cron-auth";
import { getDb } from "@/server/db";
import { spaceMembers, spaces, user } from "@/server/db/schema";
import { addMember, createTestUser, migrateTestDb } from "@/server/test/helpers";
import { GET } from "./route";

const SECRET = "segredo-de-teste-do-cron-123456";
const URL_CRON = "http://localhost:3010/api/cron/diario";

beforeAll(async () => {
  await migrateTestDb();
});

describe("proteção da rotina diária", () => {
  it("recusa sem Authorization", async () => {
    const response = await GET(new Request(URL_CRON));
    expect(response.status).toBe(401);
  });

  it("recusa segredo errado, sem Bearer ou com prefixo do segredo", async () => {
    for (const authorization of ["Bearer errado", SECRET, `Bearer ${SECRET.slice(0, -1)}`, `bearer ${SECRET}`]) {
      const response = await GET(new Request(URL_CRON, { headers: { authorization } }));
      expect(response.status).toBe(401);
    }
  });

  it("sem CRON_SECRET configurado, nada passa", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
  });

  it("com o segredo certo, roda os jobs e devolve o relatório", async () => {
    const response = await GET(new Request(URL_CRON, { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; jobs: { name: string; ok: boolean }[] };
    expect(body.ok).toBe(true);
    expect(body.jobs.map((job) => job.name)).toEqual([
      "excluir-contas-com-carencia-vencida",
      "excluir-convidados-parados",
      "limpar-convites-vencidos",
      "limpar-tokens-de-desfazer",
    ]);
  });
});

describe("jobs de exclusão", () => {
  it("apaga conta com carência vencida e passa o espaço compartilhado para quem fica", async () => {
    const db = getDb();
    const leaving = await createTestUser("Rafa");
    const staying = await createTestUser("Lu");
    const sharedMember = await addMember(leaving.home.id, staying.id, "editor");
    const recent = await createTestUser("Ana");
    await db
      .update(user)
      .set({ deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) })
      .where(eq(user.id, leaving.id));
    await db.update(user).set({ deletionRequestedAt: new Date() }).where(eq(user.id, recent.id));

    const response = await GET(new Request(URL_CRON, { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(200);

    expect(await db.select().from(user).where(eq(user.id, leaving.id))).toHaveLength(0);
    expect(await db.select().from(user).where(eq(user.id, recent.id))).toHaveLength(1);
    const [heir] = await db.select().from(spaceMembers).where(eq(spaceMembers.id, sharedMember));
    expect(heir?.role).toBe("owner");
    expect(await db.select().from(spaces).where(eq(spaces.id, leaving.home.id))).toHaveLength(1);
  });

  it("apaga convidado parado há mais de 30 dias e o espaço só dele", async () => {
    const db = getDb();
    const idle = await createTestUser("Convidado", {
      anonymous: true,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    const fresh = await createTestUser("Convidado", { anonymous: true });

    const response = await GET(new Request(URL_CRON, { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(200);

    expect(await db.select().from(user).where(eq(user.id, idle.id))).toHaveLength(0);
    expect(await db.select().from(spaces).where(eq(spaces.id, idle.home.id))).toHaveLength(0);
    expect(await db.select().from(user).where(eq(user.id, fresh.id))).toHaveLength(1);
  });
});
