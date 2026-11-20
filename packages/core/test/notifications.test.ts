import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "../src/categories.ts";
import { formatBRL, formatBRL0 } from "../src/money.ts";
import { currentNotices, DEFAULT_NOTICE_PREFS, type NoticesInput, newNotices } from "../src/notifications.ts";
import { goal, member, tx } from "./fixtures/builders.ts";

const BASE: NoticesInput = {
  today: "2026-11-19",
  txs: [],
  budgets: {},
  goals: [],
  members: [],
  categories: DEFAULT_CATEGORIES,
  prefs: DEFAULT_NOTICE_PREFS,
};

function notices(overrides: Partial<NoticesInput>) {
  return currentNotices({ ...BASE, ...overrides });
}

describe("avisos de contas atrasadas", () => {
  it("avisa de uma conta atrasada", () => {
    const [n] = notices({ txs: [tx({ id: "a", description: "Luz", day: 5, amount: 18000 })] });
    expect(n).toMatchObject({
      kind: "late",
      tone: "warn",
      icon: "alert",
      target: "lancamentos",
      title: "Luz está atrasada",
      body: `Venceu no dia 5. Valor: ${formatBRL(18000)}.`,
    });
  });

  it("junta várias, com mês anterior, e resume os nomes", () => {
    const txs = ["Luz", "Água", "Gás", "Internet"].map((description, i) =>
      tx({ id: `l${i}`, description, day: 5, amount: 1000, competence: i === 0 ? "2026-10" : "2026-11" }),
    );
    const [n] = notices({ txs });
    expect(n?.title).toBe(`4 contas atrasadas, ${formatBRL(4000)}`);
    expect(n?.body).toBe("Luz, Água, Gás e mais 1.");
  });

  it("a chave é estável e independe da ordem", () => {
    const a = tx({ id: "a", day: 1 });
    const b = tx({ id: "b", day: 2 });
    expect(notices({ txs: [a, b] })[0]?.dedupeKey).toBe(notices({ txs: [b, a] })[0]?.dedupeKey);
    expect(notices({ txs: [a, b] })[0]?.dedupeKey).toBe("late-a,b");
  });

  it("não avisa de mês futuro, pago ou entrada", () => {
    const txs = [tx({ competence: "2026-12", day: 1 }), tx({ day: 1, paid: true }), tx({ day: 1, kind: "in" })];
    expect(notices({ txs })).toEqual([]);
  });
});

describe("avisos de vencimento", () => {
  it("vence hoje e vence no dia", () => {
    expect(notices({ txs: [tx({ description: "Luz", day: 19, amount: 18000 })] })[0]).toMatchObject({
      kind: "due",
      tone: "brand",
      title: "Luz vence hoje",
      body: `Valor: ${formatBRL(18000)}.`,
    });
    expect(notices({ txs: [tx({ description: "Luz", day: 21 })] })[0]?.title).toBe("Luz vence no dia 21");
  });

  it("junta várias até o dia mais distante e ignora guardado e fora da janela", () => {
    const txs = [
      tx({ id: "a", description: "Luz", day: 20, amount: 1000 }),
      tx({ id: "b", description: "Água", day: 22, amount: 2000 }),
      tx({ id: "c", kind: "save", day: 20 }),
      tx({ id: "d", day: 23 }),
    ];
    const [n] = notices({ txs });
    expect(n?.title).toBe("2 contas vencem até o dia 22");
    expect(n?.body).toBe(`Luz, Água. Total: ${formatBRL(3000)}.`);
    expect(n?.dedupeKey).toBe("due-a,b");
  });
});

describe("avisos de orçamento", () => {
  const spend = (categoryId: string, amount: number) => tx({ categoryId, amount, day: 25 });

  it("perto do limite (90%) e passou do limite", () => {
    const near = notices({ txs: [spend("mercado", 90000)], budgets: { mercado: 100000 } })[0];
    expect(near).toMatchObject({
      kind: "budget",
      tone: "warn",
      target: "planejar",
      title: "Mercado está perto do limite",
    });
    expect(near?.dedupeKey).toBe("bud-mercado2026-11");
    const over = notices({ txs: [spend("mercado", 100001)], budgets: { mercado: 100000 } })[0];
    expect(over).toMatchObject({ tone: "out", title: "Mercado passou do limite" });
  });

  it("abaixo de 90%, sem limite ou de outro mês não avisa", () => {
    const txs = [
      spend("mercado", 89999),
      spend("lazer", 5000),
      tx({ categoryId: "mercado", amount: 99999, competence: "2026-10", paid: true }),
    ];
    expect(notices({ txs, budgets: { mercado: 100000, lazer: 0 } })).toEqual([]);
  });

  it("várias categorias viram um aviso só, com valores sem centavos", () => {
    const [n] = notices({
      txs: [spend("mercado", 95000), spend("lazer", 60000)],
      budgets: { mercado: 100000, lazer: 50000 },
    });
    expect(n?.title).toBe("2 categorias no limite ou acima");
    expect(n?.tone).toBe("out");
    expect(n?.body).toBe(
      `Mercado: ${formatBRL0(95000)} de ${formatBRL0(100000)}; Lazer: ${formatBRL0(60000)} de ${formatBRL0(50000)}.`,
    );
  });

  it("categoria desconhecida cai em Outros", () => {
    const [n] = notices({ txs: [spend("zzz", 1000)], budgets: { zzz: 1000 } });
    expect(n?.title).toBe("Outros está perto do limite");
  });
});

describe("metas, convites e contas fixas lançadas", () => {
  it("avisa de meta alcançada", () => {
    const [n] = notices({ goals: [goal({ saved: 100000 }), goal({ id: "g2", saved: 1 })] });
    expect(n).toMatchObject({
      kind: "goal",
      tone: "in",
      dedupeKey: "goal-g1",
      title: "Meta alcançada: Viagem",
      body: `Vocês juntaram ${formatBRL(100000)}.`,
    });
  });

  it("avisa de convite pendente", () => {
    const [n] = notices({ members: [member("a", "Ana"), member("c", "carol@example.com", false)] });
    expect(n).toMatchObject({
      kind: "invite",
      tone: "muted",
      target: "ajustes",
      dedupeKey: "inv-c",
      title: "Convite aguardando resposta",
      body: "carol@example.com ainda não aceitou o convite.",
    });
  });

  it("avisa das contas fixas lançadas no mês", () => {
    const one = notices({ launchedRecurring: [tx({ description: "Luz" })] })[0];
    expect(one).toMatchObject({ kind: "auto", dedupeKey: "auto-2026-11", title: "1 conta fixa lançada em novembro" });
    const many = ["A", "B", "C", "D", "E"].map((description) => tx({ description }));
    const [n] = notices({ launchedRecurring: many });
    expect(n?.title).toBe("5 contas fixas lançadas em novembro");
    expect(n?.body).toBe("A, B, C, D e mais 1. Confira se algum valor mudou.");
    expect(notices({ launchedRecurring: [] })).toEqual([]);
  });
});

describe("preferências e deduplicação", () => {
  it("cada preferência desliga o seu aviso", () => {
    const input: Partial<NoticesInput> = {
      txs: [tx({ id: "l", day: 1 }), tx({ id: "d", day: 20 }), tx({ categoryId: "mercado", amount: 99999, day: 25 })],
      budgets: { mercado: 100000 },
      goals: [goal({ saved: 100000 })],
      members: [member("c", "Cid", false)],
      launchedRecurring: [tx({})],
    };
    expect(notices(input).map((n) => n.kind)).toEqual(["late", "due", "budget", "goal", "invite", "auto"]);
    const off = { late: false, due: false, budget: false, goal: false, people: false, auto: false };
    expect(notices({ ...input, prefs: off })).toEqual([]);
    expect(notices({ ...input, prefs: { ...DEFAULT_NOTICE_PREFS, late: false } }).map((n) => n.kind)).not.toContain(
      "late",
    );
  });

  it("newNotices descarta as chaves que já estão no histórico", () => {
    const all = notices({ goals: [goal({ saved: 100000 })], members: [member("c", "Cid", false)] });
    expect(newNotices(all, ["goal-g1"]).map((n) => n.dedupeKey)).toEqual(["inv-c"]);
    expect(newNotices(all, new Set())).toHaveLength(2);
  });
});
