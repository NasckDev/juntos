import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../db";
import { categories, notifications, transactions } from "../db/schema";
import { DomainError } from "../result";
import { addMember, createTestUser, migrateTestDb, type TestUser } from "../test/helpers";
import { applyUndo } from "../undo";
import { createTransactionSchema, TX_MESSAGES } from "../validators/transactions";
import { materializeMonths } from "./month";
import { deleteRecurrence, setRecurrencePaused, updateRecurrence } from "./recurrences";
import { listRecurrences } from "./recurrences-read";
import {
  type Actor,
  createTransaction,
  deleteTransaction,
  duplicateTransaction,
  listTransactions,
  searchTransactions,
  setTransactionPaid,
  updateTransaction,
} from "./transactions";

const TODAY = "2026-11-20";

beforeAll(async () => {
  await migrateTestDb();
});

async function categoryId(key: string): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, key));
  if (!row) throw new Error(`Categoria ${key} não semeada.`);
  return row.id;
}

function actorOf(user: TestUser): Actor {
  return { userId: user.id, memberId: user.home.memberId };
}

type CreateInput = Parameters<typeof createTransactionSchema.parse>[0];

async function create(user: TestUser, patch: Partial<CreateInput> = {}) {
  const data = createTransactionSchema.parse({
    spaceId: user.home.id,
    kind: "out",
    amount: 12_000,
    description: "Internet",
    date: "2026-11-10",
    categoryId: await categoryId("contas"),
    paidBy: user.home.memberId,
    paid: false,
    paymentMethod: "Pix",
    note: "",
    personal: false,
    repeat: "none",
    installments: "",
    confirmDuplicate: false,
    ...patch,
  });
  return createTransaction(getDb(), actorOf(user), data, TODAY);
}

async function allRows(spaceId: string) {
  return getDb().select().from(transactions).where(eq(transactions.spaceId, spaceId));
}

describe("lançamentos", () => {
  it("cria, marca como pago, duplica e busca em todos os meses", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { id } = await create(rafa, { description: "Conta de luz", date: "2026-09-12", note: "bandeira vermelha" });

    await setTransactionPaid(db, actorOf(rafa), rafa.home.id, id, true, TODAY);
    const [saved] = await listTransactions(db, rafa.home.id, ["2026-09"]);
    expect(saved).toMatchObject({ id, description: "Conta de luz", amount: 12_000, day: 12, paid: true });

    const copy = await duplicateTransaction(db, actorOf(rafa), rafa.home.id, id);
    const list = await listTransactions(db, rafa.home.id, ["2026-09"]);
    expect(list.find((t) => t.id === copy.id)).toMatchObject({ description: "Conta de luz (cópia)", paid: false });

    const hits = await searchTransactions(db, rafa.home.id, "vermelha", 10);
    expect(hits.map((t) => t.id).sort()).toEqual([id, copy.id].sort());
    expect(await searchTransactions(db, rafa.home.id, "100%", 10)).toEqual([]);
  });

  it("pede confirmação para lançamento igual no mesmo dia e aceita ao confirmar", async () => {
    const rafa = await createTestUser("Rafa");
    await create(rafa, { description: "Mercado do mês", amount: 56_000 });
    const second = create(rafa, { description: "  mercado do MÊS ", amount: 56_000 });
    await expect(second).rejects.toThrow(DomainError);
    await expect(second).rejects.toMatchObject({ field: "description", message: TX_MESSAGES.duplicate });

    await create(rafa, { description: "Mercado do mês", amount: 56_000, confirmDuplicate: true });
    expect(await listTransactions(getDb(), rafa.home.id, ["2026-11"])).toHaveLength(2);
  });

  it("recusa categoria de outro tipo e pessoa de fora do espaço", async () => {
    const rafa = await createTestUser("Rafa");
    const lu = await createTestUser("Lu");
    await expect(create(rafa, { categoryId: await categoryId("salario") })).rejects.toMatchObject({
      field: "categoryId",
    });
    await expect(create(rafa, { paidBy: lu.home.memberId })).rejects.toMatchObject({ field: "paidBy" });
  });

  it("exclui com desfazer", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { id } = await create(rafa);
    const { undo } = await deleteTransaction(db, actorOf(rafa), rafa.home.id, id);
    expect(await listTransactions(db, rafa.home.id, ["2026-11"])).toEqual([]);

    await applyUndo(db, rafa.id, undo.token);
    expect((await listTransactions(db, rafa.home.id, ["2026-11"])).map((t) => t.id)).toEqual([id]);
  });

  it("não deixa mexer em lançamento de outro espaço", async () => {
    const rafa = await createTestUser("Rafa");
    const outsider = await createTestUser("Outra pessoa");
    const { id } = await create(rafa);
    await expect(
      setTransactionPaid(getDb(), actorOf(outsider), outsider.home.id, id, true, TODAY),
    ).rejects.toMatchObject({ message: TX_MESSAGES.notFound });
  });
});

describe("contas fixas", () => {
  it("cria a conta fixa e lança do início até o mês de hoje, com os meses passados pagos", async () => {
    const rafa = await createTestUser("Rafa");
    const created = await create(rafa, {
      kind: "in",
      description: "Salário",
      amount: 780_000,
      date: "2026-09-05",
      categoryId: await categoryId("salario"),
      paid: true,
      repeat: "monthly",
    });
    expect(created.recurrenceId).not.toBeNull();
    const list = await listTransactions(getDb(), rafa.home.id, ["2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(list.map((t) => [t.competence, t.paid])).toEqual([
      ["2026-09", true],
      ["2026-10", true],
      ["2026-11", true],
    ]);
  });

  it("materializa o mês de forma idempotente e não ressuscita o que a pessoa excluiu", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    await create(rafa, { description: "Aluguel", amount: 250_000, date: "2026-11-05", repeat: "monthly" });

    const first = await materializeMonths(db, rafa.home.id, ["2026-12", "2027-01"], TODAY);
    expect(first.map((t) => [t.competence, t.paid])).toEqual([
      ["2026-12", false],
      ["2027-01", false],
    ]);
    expect(await materializeMonths(db, rafa.home.id, ["2026-12", "2027-01"], TODAY)).toEqual([]);

    const december = first.find((t) => t.competence === "2026-12");
    if (!december) throw new Error("Dezembro não lançado.");
    await deleteTransaction(db, actorOf(rafa), rafa.home.id, december.id);
    expect(await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY)).toEqual([]);
    expect(await listTransactions(db, rafa.home.id, ["2026-12"])).toEqual([]);
    expect((await allRows(rafa.home.id)).filter((r) => r.competence === "2026-12-01")).toHaveLength(1);
  });

  it("registra uma vez o aviso de contas fixas lançadas no mês de hoje", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    await create(rafa, { description: "Internet", date: "2026-10-10", repeat: "monthly" });
    await create(rafa, { description: "Luz", date: "2026-10-12", repeat: "monthly", amount: 18_000 });
    // Os lançamentos de novembro foram criados junto com a conta; apague-os de verdade para simular a virada do mês.
    await db.delete(transactions).where(eq(transactions.competence, "2026-11-01"));
    const launched = await materializeMonths(db, rafa.home.id, ["2026-11"], TODAY);
    expect(launched).toHaveLength(2);
    await materializeMonths(db, rafa.home.id, ["2026-11"], TODAY);
    const notices = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.spaceId, rafa.home.id), eq(notifications.type, "auto")));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ dedupeKey: "auto-2026-11", title: "2 contas fixas lançadas em novembro" });
  });

  it("parcelada lança só até a última parcela", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    await create(rafa, {
      description: "Parcela da geladeira",
      date: "2026-11-15",
      repeat: "monthly",
      installments: "3",
      categoryId: await categoryId("outros"),
    });
    await materializeMonths(db, rafa.home.id, ["2026-12", "2027-01", "2027-02"], TODAY);
    const list = await listTransactions(db, rafa.home.id, ["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(list.map((t) => `${t.installment} de ${t.installmentsTotal}`)).toEqual(["1 de 3", "2 de 3", "3 de 3"]);
  });

  it('editar "neste e nos próximos" só muda o modelo e os futuros em aberto', async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { recurrenceId } = await create(rafa, {
      description: "Academia",
      amount: 11_000,
      date: "2026-10-10",
      repeat: "monthly",
      categoryId: await categoryId("saude"),
    });
    await materializeMonths(db, rafa.home.id, ["2026-12", "2027-01"], TODAY);
    const months = ["2026-10", "2026-11", "2026-12", "2027-01"];
    const before = await listTransactions(db, rafa.home.id, months);
    const [october, november, december, january] = before;
    if (!october || !november || !december || !january) throw new Error("Meses não lançados.");
    // Janeiro já pago (adiantado): fica como está.
    await setTransactionPaid(db, actorOf(rafa), rafa.home.id, january.id, true, TODAY);

    await updateTransaction(
      db,
      actorOf(rafa),
      {
        spaceId: rafa.home.id,
        id: november.id,
        kind: "out",
        amount: 13_000,
        description: "Academia nova",
        date: "2026-11-15",
        categoryId: november.categoryId,
        paidBy: november.paidBy,
        paid: false,
        paymentMethod: "Cartão",
        note: "",
        personal: false,
        scope: "next",
      },
      TODAY,
    );
    const after = new Map((await listTransactions(db, rafa.home.id, months)).map((t) => [t.id, t]));
    expect(after.get(october.id)).toMatchObject({ amount: 11_000, description: "Academia", day: 10 });
    expect(after.get(november.id)).toMatchObject({ amount: 13_000, description: "Academia nova", day: 15 });
    expect(after.get(december.id)).toMatchObject({ amount: 13_000, description: "Academia nova", day: 15 });
    expect(after.get(january.id)).toMatchObject({ amount: 11_000, description: "Academia", paid: true });
    const [model] = await listRecurrences(db, rafa.home.id);
    expect(model).toMatchObject({ id: recurrenceId, amount: 13_000, day: 15, paymentMethod: "Cartão" });
  });

  it('editar "só neste mês" não mexe no modelo', async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { id } = await create(rafa, { description: "Netflix", date: "2026-11-08", repeat: "monthly" });
    const [tx] = await listTransactions(db, rafa.home.id, ["2026-11"]);
    if (!tx) throw new Error("Sem lançamento.");
    await updateTransaction(
      db,
      actorOf(rafa),
      { ...tx, spaceId: rafa.home.id, id, amount: 4_490, date: "2026-11-08", scope: "one" },
      TODAY,
    );
    const [model] = await listRecurrences(db, rafa.home.id);
    expect(model?.amount).toBe(12_000);
    const created = await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY);
    expect(created[0]?.amount).toBe(12_000);
  });

  it("pausar apaga os futuros em aberto e retomar volta a lançar", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { recurrenceId } = await create(rafa, { description: "Spotify", date: "2026-11-08", repeat: "monthly" });
    if (!recurrenceId) throw new Error("Sem conta fixa.");
    await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY);

    await setRecurrencePaused(db, actorOf(rafa), rafa.home.id, recurrenceId, true, TODAY);
    expect(await listTransactions(db, rafa.home.id, ["2026-12"])).toEqual([]);
    expect(await listTransactions(db, rafa.home.id, ["2026-11"])).toHaveLength(1);
    expect(await materializeMonths(db, rafa.home.id, ["2026-12", "2027-01"], TODAY)).toEqual([]);

    await setRecurrencePaused(db, actorOf(rafa), rafa.home.id, recurrenceId, false, TODAY);
    expect(await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY)).toHaveLength(1);
  });

  it("editar a conta fixa vale do mês atual em diante, nos lançamentos em aberto", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { recurrenceId } = await create(rafa, { description: "Condomínio", date: "2026-10-25", repeat: "monthly" });
    if (!recurrenceId) throw new Error("Sem conta fixa.");
    await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY);
    await updateRecurrence(
      db,
      actorOf(rafa),
      {
        spaceId: rafa.home.id,
        id: recurrenceId,
        description: "Condomínio novo",
        amount: 50_000,
        day: 31,
        categoryId: await categoryId("moradia"),
      },
      TODAY,
    );
    const list = await listTransactions(db, rafa.home.id, ["2026-10", "2026-11", "2026-12"]);
    // Outubro já passou (nasceu pago) e fica; novembro (dia 25, em aberto) e dezembro mudam.
    expect(list.map((t) => [t.competence, t.amount, t.day])).toEqual([
      ["2026-10", 12_000, 25],
      ["2026-11", 50_000, 30],
      ["2026-12", 50_000, 31],
    ]);
  });

  it("excluir para de repetir, mantém o histórico e pode ser desfeito", async () => {
    const rafa = await createTestUser("Rafa");
    const db = getDb();
    const { recurrenceId } = await create(rafa, { description: "Seguro", date: "2026-10-05", repeat: "monthly" });
    if (!recurrenceId) throw new Error("Sem conta fixa.");
    await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY);

    const { undo } = await deleteRecurrence(db, actorOf(rafa), rafa.home.id, recurrenceId, TODAY);
    expect(await listRecurrences(db, rafa.home.id)).toEqual([]);
    const history = await listTransactions(db, rafa.home.id, ["2026-10", "2026-11", "2026-12"]);
    expect(history.map((t) => [t.competence, t.recurrenceId])).toEqual([
      ["2026-10", null],
      ["2026-11", null],
    ]);
    expect(await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY)).toEqual([]);

    await applyUndo(db, rafa.id, undo.token);
    expect(await listRecurrences(db, rafa.home.id)).toHaveLength(1);
    expect(await materializeMonths(db, rafa.home.id, ["2026-12"], TODAY)).toHaveLength(1);
  });

  it("aceita quem pagou entre os membros do espaço", async () => {
    const rafa = await createTestUser("Rafa");
    const lu = await createTestUser("Lu");
    const luMember = await addMember(rafa.home.id, lu.id, "editor");
    const { id } = await create(rafa, { paidBy: luMember });
    const [tx] = await listTransactions(getDb(), rafa.home.id, ["2026-11"]);
    expect(tx).toMatchObject({ id, paidBy: luMember });
  });
});

describe("validação do formulário", () => {
  const base = {
    spaceId: "00000000-0000-4000-8000-000000000000",
    kind: "out",
    amount: 100,
    description: "Luz",
    date: "2026-11-10",
    categoryId: "00000000-0000-4000-8000-000000000001",
    paidBy: null,
    paid: false,
    paymentMethod: "",
    note: "",
    personal: false,
    repeat: "none",
    installments: "",
    confirmDuplicate: false,
  } as const;

  function errorsOf(patch: Record<string, unknown>): Record<string, string> {
    const result = createTransactionSchema.safeParse({ ...base, ...patch });
    if (result.success) return {};
    const out: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (!(key in out)) out[key] = issue.message;
    }
    return out;
  }

  it("usa as mensagens do protótipo", () => {
    expect(errorsOf({ amount: null }).amount).toBe(TX_MESSAGES.amount);
    expect(errorsOf({ amount: 0 }).amount).toBe(TX_MESSAGES.amount);
    expect(errorsOf({ amount: 1_000_000_000 })).toEqual({});
    expect(errorsOf({ amount: 1_000_000_001 }).amount).toBe(TX_MESSAGES.amountTooHigh);
    expect(errorsOf({ description: "  " }).description).toBe(TX_MESSAGES.descriptionEmpty);
    expect(errorsOf({ description: "a" }).description).toBe(TX_MESSAGES.descriptionShort);
    expect(errorsOf({ date: "" }).date).toBe(TX_MESSAGES.date);
    expect(errorsOf({ date: "2026-02-31" }).date).toBe(TX_MESSAGES.date);
    expect(errorsOf({ date: "1999-12-31" }).date).toBe(TX_MESSAGES.year);
    expect(errorsOf({ date: "2101-01-01" }).date).toBe(TX_MESSAGES.year);
    expect(errorsOf({ repeat: "monthly", installments: "1" }).installments).toBe(TX_MESSAGES.installments);
    expect(errorsOf({ repeat: "monthly", installments: "481" }).installments).toBe(TX_MESSAGES.installments);
    expect(errorsOf({ repeat: "monthly", installments: "2.5" }).installments).toBe(TX_MESSAGES.installments);
    expect(errorsOf({ repeat: "monthly", installments: "480" })).toEqual({});
    expect(errorsOf({ repeat: "monthly", installments: "" })).toEqual({});
    expect(errorsOf({ repeat: "yearly", installments: "1" })).toEqual({});
  });
});
