import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { recurrences, spaceMembers, spaces, transactions } from "../db/schema";
import type { EmailMessage } from "../email";
import type { PushPayload } from "../push";
import { updatePreferences } from "../services/preferences";
import { categoryId, insertTxs } from "../test/finance-fixtures";
import { addMember, createTestUser, migrateTestDb, type TestUser } from "../test/helpers";
import { type NoticeSenders, noticesEmail, runDailyNotices } from "./daily-notices";

/** 20/11/2026, meio-dia em São Paulo. */
const NOW = new Date("2026-11-20T15:00:00Z");

beforeAll(async () => {
  await migrateTestDb();
});

interface Sent {
  readonly pushes: { userId: string; payload: PushPayload }[];
  readonly emails: EmailMessage[];
}

/** Envio de push e e-mail substituídos por gravadores (o teste não usa rede). */
function recorder(emailEnabled = true): { senders: NoticeSenders; sent: Sent } {
  const sent: Sent = { pushes: [], emails: [] };
  return {
    sent,
    senders: {
      emailEnabled,
      sendPush: async (_db, userId, payload) => {
        sent.pushes.push({ userId, payload });
        return { enabled: true, sent: 1, removed: 0, failed: 0 };
      },
      sendEmail: async (message) => {
        sent.emails.push(message);
        return { sent: true };
      },
    },
  };
}

/** Só este espaço participa da rotina (os de outros testes ficam excluídos). */
async function isolate(keep: string): Promise<void> {
  const all = await getDb().select({ id: spaces.id }).from(spaces);
  for (const space of all) {
    if (space.id !== keep) await getDb().update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, space.id));
  }
}

async function seedSpace(owner: TestUser): Promise<void> {
  await insertTxs(owner.home.id, owner.id, [
    { description: "Luz", amount: 18_000, competence: "2026-10", day: 15, category: "contas" },
  ]);
  await getDb()
    .insert(recurrences)
    .values({
      spaceId: owner.home.id,
      kind: "out",
      description: "Aluguel",
      amountCents: 150_000,
      categoryId: await categoryId("moradia"),
      frequency: "monthly",
      day: 22,
      startCompetence: "2026-09-01",
      createdBy: owner.id,
      updatedBy: owner.id,
    });
}

describe("rotina diária de avisos", () => {
  it("lança as contas fixas do mês, avisa só o que é novo e não reenvia na segunda execução", async () => {
    const owner = await createTestUser("Rafa");
    const partner = await createTestUser("Lu");
    await addMember(owner.home.id, partner.id, "editor");
    await seedSpace(owner);
    await isolate(owner.home.id);
    // Lu desligou os avisos de contas atrasadas.
    await updatePreferences(getDb(), partner.id, { notify: { late: false } });

    const { senders, sent } = recorder();
    const report = await runDailyNotices({ db: getDb(), now: NOW }, senders);

    const launched = await getDb().select().from(transactions).where(eq(transactions.description, "Aluguel"));
    expect(launched.map((t) => t.competence)).toContain("2026-11-01");
    expect(report).toMatchObject({ spaces: 1 });
    const titlesFor = (userId: string) =>
      sent.pushes
        .filter((p) => p.userId === userId)
        .map((p) => p.payload.title)
        .sort();
    expect(titlesFor(owner.id)).toEqual(
      ["1 conta fixa lançada em novembro", "Aluguel vence no dia 22", "Luz está atrasada"].sort(),
    );
    expect(titlesFor(partner.id)).toEqual(["1 conta fixa lançada em novembro", "Aluguel vence no dia 22"].sort());
    expect(sent.pushes.every((p) => p.payload.href?.startsWith("/"))).toBe(true);
    expect(sent.emails.map((e) => e.to).sort()).toEqual([owner.email, partner.email].sort());
    expect(sent.emails.find((e) => e.to === owner.email)?.subject).toBe("3 avisos novos em “Casa”");

    const again = recorder();
    const second = await runDailyNotices({ db: getDb(), now: NOW }, again.senders);
    expect(second.notices).toBe(0);
    expect(again.sent.pushes).toEqual([]);
    expect(again.sent.emails).toEqual([]);
  });

  it("sem e-mail configurado, só push; convidado sem e-mail não recebe e-mail", async () => {
    const guest = await createTestUser("Convidado", { anonymous: true });
    await getDb()
      .insert(spaceMembers)
      .values({ spaceId: guest.home.id, invitedEmail: "lu@example.com", role: "editor", status: "invited" });
    await isolate(guest.home.id);
    const off = recorder(false);
    await runDailyNotices({ db: getDb(), now: NOW }, off.senders);
    expect(off.sent.pushes.map((p) => p.payload.title)).toEqual(["Convite aguardando resposta"]);
    expect(off.sent.emails).toEqual([]);
  });

  it("o e-mail escapa o HTML dos nomes", () => {
    const message = noticesEmail({
      to: "rafa@example.com",
      spaceName: "<Casa>",
      baseUrl: "https://juntos.example.com",
      notices: [
        { id: "1", type: "late", dedupeKey: "late-1", title: "<b>Luz</b>", body: "Valor", href: "/lancamentos" },
      ],
    });
    expect(message.subject).toBe("<b>Luz</b> · <Casa>");
    expect(message.html).toContain("&lt;b&gt;Luz&lt;/b&gt;");
    expect(message.html).not.toContain("<b>Luz</b>");
    expect(message.text).toContain("https://juntos.example.com/notificacoes");
  });
});
