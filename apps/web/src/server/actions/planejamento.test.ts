import { todayInSaoPaulo, todayParts, ymAdd } from "@juntos/core";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../session";

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
vi.mock("../session", () => ({ getSession: async () => sessionState.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

const { createTransaction } = await import("./transactions");
const { setBudget, suggestBudgetLimits } = await import("./budgets");
const { createCategory, deleteCategory } = await import("./categories");
const { createGoal, deleteGoal, depositToGoal, updateGoal } = await import("./goals");
const { undo } = await import("./undo");
const { getDb } = await import("../db");
const { budgets, categories, goalDeposits, goals, recurrences, transactions } = await import("../db/schema");
const { listBudgets } = await import("../services/budgets");
const { listGoals } = await import("../services/goals");
const { loadBudgetData, loadGoalsData } = await import("../planning-loaders");
const { addMember, createTestUser, migrateTestDb, sessionOf } = await import("../test/helpers");
const { BUDGET_MESSAGES } = await import("../validators/budgets");
const { CATEGORY_MESSAGES } = await import("../validators/categories");
const { GOAL_MESSAGES } = await import("../validators/goals");
const { GOAL_NAME_CLASH_MESSAGE } = await import("../undo");

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

const NO_PERMISSION = { ok: false, error: "Você não tem permissão para fazer isso neste espaço." };

async function categoryId(key: string): Promise<string> {
  const [row] = await getDb().select({ id: categories.id }).from(categories).where(eq(categories.key, key));
  if (!row) throw new Error(`Categoria ${key} não semeada.`);
  return row.id;
}

async function addOut(spaceId: string, amount: number, date: string, category: string, description = "Gasto") {
  const result = await createTransaction({
    spaceId,
    kind: "out",
    amount,
    description,
    date,
    categoryId: await categoryId(category),
    paidBy: null,
    paid: true,
    paymentMethod: "",
    note: "",
    personal: false,
    repeat: "none",
    installments: "",
    confirmDuplicate: false,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe("limites do orçamento", () => {
  it("define, edita e remove o limite; só aceita categoria de saída", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const mercado = await categoryId("mercado");

    expect(unwrap(await setBudget({ spaceId: rafa.home.id, categoryId: mercado, limit: 80_000 }))).toEqual({
      categoryId: mercado,
      limit: 80_000,
    });
    await setBudget({ spaceId: rafa.home.id, categoryId: mercado, limit: 90_000 });
    expect(await listBudgets(getDb(), rafa.home.id)).toEqual([{ categoryId: mercado, monthlyLimit: 90_000 }]);

    await setBudget({ spaceId: rafa.home.id, categoryId: mercado, limit: null });
    expect(await listBudgets(getDb(), rafa.home.id)).toEqual([]);

    const salario = await categoryId("salario");
    const wrongKind = await setBudget({ spaceId: rafa.home.id, categoryId: salario, limit: 10_000 });
    expect(wrongKind.ok).toBe(false);
    expect((await setBudget({ spaceId: rafa.home.id, categoryId: mercado, limit: 0 })).ok).toBe(false);
  });

  it("quem só vê lê o orçamento, mas não muda limite, sugestão, categoria nem meta", async () => {
    const rafa = await createTestUser("Rafa");
    const carol = await createTestUser("Carol");
    await addMember(rafa.home.id, carol.id, "viewer");
    sessionState.current = sessionOf(carol);
    const mercado = await categoryId("mercado");

    expect(await setBudget({ spaceId: rafa.home.id, categoryId: mercado, limit: 1_000 })).toEqual(NO_PERMISSION);
    expect(await suggestBudgetLimits({ spaceId: rafa.home.id })).toEqual(NO_PERMISSION);
    expect(
      await createCategory({ spaceId: rafa.home.id, name: "Pets", icon: "caixa", kind: "out", limit: null }),
    ).toEqual(NO_PERMISSION);
    expect(
      await createGoal({
        spaceId: rafa.home.id,
        name: "Viagem",
        icon: "viagem",
        target: 100_000,
        saved: 0,
        monthly: 0,
      }),
    ).toEqual(NO_PERMISSION);

    const data = await loadBudgetData(rafa.home.id, { start: todayParts(todayInSaoPaulo()).ym, span: 1 });
    expect(data.role).toBe("viewer");
    const stranger = await createTestUser("Fulano");
    sessionState.current = sessionOf(stranger);
    await expect(loadGoalsData(rafa.home.id)).rejects.toThrow();
  });

  it("sugere pela média dos 3 meses anteriores, arredondando para cima de R$ 50, e desfaz", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const nowYm = todayParts(todayInSaoPaulo()).ym;
    const mercado = await categoryId("mercado");
    const lazer = await categoryId("lazer");

    const empty = await suggestBudgetLimits({ spaceId: rafa.home.id });
    expect(empty).toEqual({ ok: false, error: BUDGET_MESSAGES.noHistory });

    await addOut(rafa.home.id, 30_000, `${ymAdd(nowYm, -1)}-10`, "mercado");
    await addOut(rafa.home.id, 60_000, `${ymAdd(nowYm, -2)}-10`, "mercado");
    await addOut(rafa.home.id, 10_000, `${ymAdd(nowYm, -3)}-10`, "lazer");
    await setBudget({ spaceId: rafa.home.id, categoryId: lazer, limit: 99_900 });

    const suggested = unwrap(await suggestBudgetLimits({ spaceId: rafa.home.id }));
    expect(suggested.applied).toBe(2);
    const after = Object.fromEntries(
      (await listBudgets(getDb(), rafa.home.id)).map((b) => [b.categoryId, b.monthlyLimit]),
    );
    // mercado: 900,00 / 3 = 300,00 (já redondo); lazer: 100,00 / 3 = 33,33 → R$ 50,00
    expect(after).toEqual({ [mercado]: 30_000, [lazer]: 5_000 });

    unwrap(await undo({ token: suggested.undo.token }));
    const restored = Object.fromEntries(
      (await listBudgets(getDb(), rafa.home.id)).map((b) => [b.categoryId, b.monthlyLimit]),
    );
    expect(restored).toEqual({ [lazer]: 99_900 });
  });
});

describe("categorias", () => {
  it("cria com limite, recusa nome repetido e só deixa excluir as personalizadas", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const created = unwrap(
      await createCategory({ spaceId: rafa.home.id, name: "Pets", icon: "caixa", kind: "out", limit: 25_000 }),
    );
    expect(await listBudgets(getDb(), rafa.home.id)).toEqual([{ categoryId: created.id, monthlyLimit: 25_000 }]);

    const same = await createCategory({
      spaceId: rafa.home.id,
      name: " pets ",
      icon: "lazer",
      kind: "out",
      limit: null,
    });
    expect(same).toEqual({
      ok: false,
      error: CATEGORY_MESSAGES.nameTaken,
      fieldErrors: { name: CATEGORY_MESSAGES.nameTaken },
    });
    const sameAsDefault = await createCategory({
      spaceId: rafa.home.id,
      name: "Mercado",
      icon: "lazer",
      kind: "out",
      limit: null,
    });
    expect(sameAsDefault.ok).toBe(false);
    const incomeWithLimit = await createCategory({
      spaceId: rafa.home.id,
      name: "Bicos",
      icon: "dinheiro",
      kind: "in",
      limit: 1_000,
    });
    expect(incomeWithLimit.ok).toBe(false);

    const locked = await deleteCategory({ spaceId: rafa.home.id, id: await categoryId("mercado") });
    expect(locked).toEqual({ ok: false, error: CATEGORY_MESSAGES.defaultLocked });
  });

  it("excluir manda lançamentos e contas fixas para a categoria de reserva, tira o limite e desfaz", async () => {
    const rafa = await createTestUser("Rafa");
    const outra = await createTestUser("Outra");
    sessionState.current = sessionOf(rafa);
    const nowYm = todayParts(todayInSaoPaulo()).ym;
    const pets = unwrap(
      await createCategory({ spaceId: rafa.home.id, name: "Pets", icon: "caixa", kind: "out", limit: 25_000 }),
    ).id;
    const outros = await categoryId("outros");

    const single = await addOut(rafa.home.id, 4_000, `${nowYm}-05`, "outros", "Ração");
    await getDb().update(transactions).set({ categoryId: pets }).where(eq(transactions.id, single.id));
    const fixed = unwrap(
      await createTransaction({
        spaceId: rafa.home.id,
        kind: "out",
        amount: 9_000,
        description: "Plano pet",
        date: `${nowYm}-08`,
        categoryId: pets,
        paidBy: null,
        paid: false,
        paymentMethod: "",
        note: "",
        personal: false,
        repeat: "monthly",
        installments: "",
        confirmDuplicate: false,
      }),
    );

    // Outro espaço não pode excluir a categoria deste.
    sessionState.current = sessionOf(outra);
    expect((await deleteCategory({ spaceId: outra.home.id, id: pets })).ok).toBe(false);

    sessionState.current = sessionOf(rafa);
    const deleted = unwrap(await deleteCategory({ spaceId: rafa.home.id, id: pets }));
    const db = getDb();
    expect(await db.select().from(categories).where(eq(categories.id, pets))).toHaveLength(0);
    expect(await listBudgets(db, rafa.home.id)).toEqual([]);
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, single.id));
    expect(tx?.categoryId).toBe(outros);
    const [rec] = await db
      .select()
      .from(recurrences)
      .where(eq(recurrences.id, fixed.recurrenceId ?? ""));
    expect(rec?.categoryId).toBe(outros);

    unwrap(await undo({ token: deleted.undo.token }));
    const [back] = await db.select().from(transactions).where(eq(transactions.id, single.id));
    expect(back?.categoryId).toBe(pets);
    const [backRec] = await db
      .select()
      .from(recurrences)
      .where(eq(recurrences.id, fixed.recurrenceId ?? ""));
    expect(backRec?.categoryId).toBe(pets);
    expect(await listBudgets(db, rafa.home.id)).toEqual([{ categoryId: pets, monthlyLimit: 25_000 }]);
    // O que não era dessa categoria continua onde estava.
    expect(
      await db
        .select()
        .from(budgets)
        .where(and(eq(budgets.spaceId, outra.home.id))),
    ).toHaveLength(0);
  });
});

describe("metas", () => {
  it("cria com o já guardado como lançamento Guardado e recusa nome repetido", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const created = unwrap(
      await createGoal({
        spaceId: rafa.home.id,
        name: "Viagem",
        icon: "viagem",
        target: 500_000,
        saved: 120_000,
        monthly: 50_000,
      }),
    );
    expect(created.transactionId).not.toBeNull();
    const [goal] = await listGoals(getDb(), rafa.home.id);
    expect(goal).toMatchObject({ name: "Viagem", target: 500_000, saved: 120_000, monthly: 50_000 });
    const [tx] = await getDb()
      .select()
      .from(transactions)
      .where(eq(transactions.id, created.transactionId ?? ""));
    expect(tx).toMatchObject({ kind: "save", paid: true, amountCents: 120_000, description: "Meta: Viagem" });

    const repeated = await createGoal({
      spaceId: rafa.home.id,
      name: " viagem ",
      icon: "alvo",
      target: 100_000,
      saved: 0,
      monthly: 0,
    });
    expect(repeated).toMatchObject({ ok: false, fieldErrors: { name: GOAL_MESSAGES.nameTaken } });
    const over = await createGoal({
      spaceId: rafa.home.id,
      name: "Carro",
      icon: "carro",
      target: 100_000,
      saved: 200_000,
      monthly: 0,
    });
    expect(over).toMatchObject({ ok: false, fieldErrors: { saved: GOAL_MESSAGES.savedOverTarget } });
  });

  it("depósito cria o lançamento Guardado e nunca passa do que falta, nem em duas chamadas ao mesmo tempo", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const { id } = unwrap(
      await createGoal({
        spaceId: rafa.home.id,
        name: "Reserva",
        icon: "reserva",
        target: 100_000,
        saved: 0,
        monthly: 0,
      }),
    );

    const first = unwrap(await depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 30_000 }));
    expect(first).toMatchObject({ saved: 30_000, reached: false });
    const [deposit] = await getDb().select().from(goalDeposits).where(eq(goalDeposits.goalId, id));
    const [tx] = await getDb()
      .select()
      .from(transactions)
      .where(eq(transactions.id, deposit?.transactionId ?? ""));
    expect(tx).toMatchObject({ kind: "save", paid: true, amountCents: 30_000 });

    const tooMuch = await depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 80_000 });
    expect(tooMuch).toMatchObject({ ok: false });
    if (!tooMuch.ok) expect(tooMuch.error).toContain("Faltam só");

    const [a, b] = await Promise.all([
      depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 50_000 }),
      depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 50_000 }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const [final] = await listGoals(getDb(), rafa.home.id);
    expect(final).toMatchObject({ saved: 80_000 });

    const last = unwrap(await depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 20_000 }));
    expect(last).toMatchObject({ saved: 100_000, reached: true });
    expect((await depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 100 })).ok).toBe(false);
  });

  it("edita, não deixa a meta ficar menor que o guardado, exclui e desfaz; quem só vê não deposita", async () => {
    const rafa = await createTestUser("Rafa");
    const carol = await createTestUser("Carol");
    await addMember(rafa.home.id, carol.id, "viewer");
    sessionState.current = sessionOf(rafa);
    const { id } = unwrap(
      await createGoal({
        spaceId: rafa.home.id,
        name: "Casa",
        icon: "casa",
        target: 100_000,
        saved: 40_000,
        monthly: 0,
      }),
    );
    unwrap(
      await updateGoal({
        spaceId: rafa.home.id,
        id,
        name: "Casa nova",
        icon: "casa",
        target: 200_000,
        monthly: 10_000,
      }),
    );
    expect(await listGoals(getDb(), rafa.home.id)).toMatchObject([
      { name: "Casa nova", target: 200_000, monthly: 10_000 },
    ]);
    const small = await updateGoal({
      spaceId: rafa.home.id,
      id,
      name: "Casa nova",
      icon: "casa",
      target: 30_000,
      monthly: 0,
    });
    expect(small).toMatchObject({ ok: false, fieldErrors: { target: GOAL_MESSAGES.savedOverTarget } });

    sessionState.current = sessionOf(carol);
    expect(await depositToGoal({ spaceId: rafa.home.id, goalId: id, amount: 1_000 })).toEqual(NO_PERMISSION);
    expect(await deleteGoal({ spaceId: rafa.home.id, id })).toEqual(NO_PERMISSION);

    sessionState.current = sessionOf(rafa);
    const deleted = unwrap(await deleteGoal({ spaceId: rafa.home.id, id }));
    expect(await listGoals(getDb(), rafa.home.id)).toEqual([]);
    unwrap(await undo({ token: deleted.undo.token }));
    expect(await listGoals(getDb(), rafa.home.id)).toHaveLength(1);
  });

  it("o banco também barra nome repetido; meta excluída libera o nome e o desfazer avisa se ele foi reusado", async () => {
    const rafa = await createTestUser("Rafa");
    sessionState.current = sessionOf(rafa);
    const goal = { spaceId: rafa.home.id, icon: "viagem", target: 100_000, saved: 0, monthly: 0 } as const;
    const { id } = unwrap(await createGoal({ ...goal, name: "Viagem" }));

    // Mesmo sem passar pelo serviço (dois pedidos ao mesmo tempo), o índice único parcial segura o nome repetido.
    await expect(
      getDb().insert(goals).values({ spaceId: rafa.home.id, name: "VIAGEM", targetCents: 1_000 }),
    ).rejects.toThrow();
    // Dois pedidos juntos: um grava, o outro recebe a mensagem amigável.
    const [a, b] = await Promise.all([createGoal({ ...goal, name: "Carro" }), createGoal({ ...goal, name: "carro" })]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ fieldErrors: { name: GOAL_MESSAGES.nameTaken } });

    // Excluída, a meta não prende o nome; desfazer depois que outra usou o nome explica o que fazer.
    const deleted = unwrap(await deleteGoal({ spaceId: rafa.home.id, id }));
    unwrap(await createGoal({ ...goal, name: "viagem" }));
    expect(await undo({ token: deleted.undo.token })).toEqual({ ok: false, error: GOAL_NAME_CLASH_MESSAGE });
    expect((await listGoals(getDb(), rafa.home.id)).map((g) => g.name.toLowerCase()).sort()).toEqual([
      "carro",
      "viagem",
    ]);
  });
});
