import { describe, expect, it } from "vitest";
import { computeDivision } from "../src/division.ts";
import { sumCents } from "../src/money.ts";
import type { Settlement } from "../src/types.ts";
import { member, tx } from "./fixtures/builders.ts";

const ana = member("ana", "Ana");
const bia = member("bia", "Bia");
const pending = member("cid", "Cid", false);

function paidBy(who: string | null, amount: number, extra: Parameters<typeof tx>[0] = {}) {
  return tx({ kind: "out", paid: true, paidBy: who, amount, ...extra });
}

function income(who: string, amount: number, paid = true) {
  return tx({ kind: "in", paid, paidBy: who, amount });
}

describe("computeDivision", () => {
  it("divide em partes iguais e diz quem deve a quem", () => {
    const d = computeDivision({ members: [ana, bia], txs: [paidBy("ana", 10000), paidBy("bia", 2000)], mode: "equal" });
    expect(d.total).toBe(12000);
    expect(d.people.map((p) => p.share)).toEqual([6000, 6000]);
    expect(d.moves).toEqual([{ from: "bia", to: "ana", amount: 4000 }]);
    expect(d.people.map((p) => p.balance)).toEqual([4000, -4000]);
  });

  it("centavos ímpares são divididos sem perder 1 centavo", () => {
    const d = computeDivision({ members: [ana, bia], txs: [paidBy("ana", 10001)], mode: "equal" });
    expect(sumCents(d.people.map((p) => p.share))).toBe(10001);
    expect(sumCents(d.people.map((p) => p.balance))).toBe(0);
  });

  it("três pessoas, valor que não divide: soma exata e quitação fecha em zero", () => {
    const cid = member("cid", "Cid");
    const d = computeDivision({
      members: [ana, bia, cid],
      txs: [paidBy("ana", 10000), paidBy("bia", 1), paidBy("cid", 1)],
      mode: "equal",
    });
    expect(sumCents(d.people.map((p) => p.share))).toBe(10002);
    expect(sumCents(d.moves.map((m) => m.amount))).toBe(
      d.people.filter((p) => p.balance > 0).reduce((a, p) => a + p.balance, 0),
    );
  });

  it("proporcional à renda usa só entradas recebidas", () => {
    const d = computeDivision({
      members: [ana, bia],
      txs: [income("ana", 600000), income("bia", 200000), income("bia", 900000, false), paidBy("ana", 100000)],
      mode: "income",
    });
    expect(d.mode).toBe("income");
    expect(d.people.map((p) => p.share)).toEqual([75000, 25000]);
    expect(d.people.map((p) => p.percent)).toEqual([0.75, 0.25]);
    expect(d.people.map((p) => p.income)).toEqual([600000, 200000]);
  });

  it("sem renda recebida cai para partes iguais", () => {
    const d = computeDivision({
      members: [ana, bia],
      txs: [income("ana", 600000, false), paidBy("ana", 10000)],
      mode: "income",
    });
    expect(d.mode).toBe("equal");
    expect(d.people.map((p) => p.share)).toEqual([5000, 5000]);
  });

  it("personalizado usa a porcentagem da primeira pessoa", () => {
    const d = computeDivision({ members: [ana, bia], txs: [paidBy("ana", 10000)], mode: "custom", customPct: 70 });
    expect(d.mode).toBe("custom");
    expect(d.people.map((p) => p.share)).toEqual([7000, 3000]);
  });

  it("personalizado sem porcentagem usa 50% e limita a 0 a 100", () => {
    const base = { members: [ana, bia], txs: [paidBy("ana", 10000)], mode: "custom" } as const;
    expect(computeDivision(base).people.map((p) => p.share)).toEqual([5000, 5000]);
    expect(computeDivision({ ...base, customPct: 150 }).people.map((p) => p.share)).toEqual([10000, 0]);
    expect(computeDivision({ ...base, customPct: -5 }).people.map((p) => p.share)).toEqual([0, 10000]);
  });

  it("personalizado só vale com 2 pessoas", () => {
    const cid = member("cid", "Cid");
    const d = computeDivision({ members: [ana, bia, cid], txs: [paidBy("ana", 9000)], mode: "custom", customPct: 70 });
    expect(d.mode).toBe("equal");
    expect(d.people.map((p) => p.share)).toEqual([3000, 3000, 3000]);
    const alone = computeDivision({ members: [ana], txs: [paidBy("ana", 100)], mode: "custom" });
    expect(alone.mode).toBe("equal");
  });

  it("só conta saídas pagas, não pessoais e com pagador; o resto fica de fora", () => {
    const semPagador = paidBy(null, 3000);
    const d = computeDivision({
      members: [ana, bia],
      txs: [
        paidBy("ana", 10000),
        paidBy("ana", 5000, { personal: true }),
        tx({ kind: "out", paid: false, paidBy: "ana", amount: 7000 }),
        tx({ kind: "save", paid: true, paidBy: "ana", amount: 400 }),
        semPagador,
        paidBy("zed", 800),
      ],
      mode: "equal",
    });
    expect(d.total).toBe(10000);
    expect(d.withoutPayer).toHaveLength(2);
    expect(d.withoutPayer).toContain(semPagador);
    expect(d.personalCount).toBe(1);
  });

  it("convites pendentes não entram na divisão", () => {
    const d = computeDivision({
      members: [ana, bia, pending],
      txs: [paidBy("ana", 10000), paidBy("cid", 500)],
      mode: "equal",
    });
    expect(d.people).toHaveLength(2);
    expect(d.withoutPayer).toHaveLength(1);
  });

  it("sem membros ativos devolve tudo zerado", () => {
    const d = computeDivision({ members: [pending], txs: [paidBy("cid", 500)], mode: "equal" });
    expect(d).toMatchObject({ total: 0, people: [], moves: [] });
  });

  it("acertos zeram a diferença", () => {
    const settlement: Settlement = {
      id: "s1",
      from: "bia",
      to: "ana",
      amount: 4000,
      periodStart: "2026-11",
      periodEnd: "2026-11",
    };
    const d = computeDivision({
      members: [ana, bia],
      txs: [paidBy("ana", 10000), paidBy("bia", 2000)],
      mode: "equal",
      settlements: [settlement],
    });
    expect(d.people.map((p) => p.balance)).toEqual([0, 0]);
    expect(d.moves).toEqual([]);
    expect(d.settlements).toEqual([settlement]);
  });

  it("acerto parcial deixa só o resto", () => {
    const settlement: Settlement = {
      id: "s1",
      from: "bia",
      to: "ana",
      amount: 1500,
      periodStart: "2026-11",
      periodEnd: "2026-11",
    };
    const d = computeDivision({
      members: [ana, bia],
      txs: [paidBy("ana", 10000)],
      mode: "equal",
      settlements: [settlement],
    });
    expect(d.moves).toEqual([{ from: "bia", to: "ana", amount: 3500 }]);
  });

  it("acerto de período vale para o período inteiro e só quando cabe no período exibido", () => {
    const wide: Settlement = {
      id: "s1",
      from: "bia",
      to: "ana",
      amount: 4000,
      periodStart: "2026-11",
      periodEnd: "2027-01",
    };
    const month: Settlement = {
      id: "s2",
      from: "bia",
      to: "ana",
      amount: 100,
      periodStart: "2026-12",
      periodEnd: "2026-12",
    };
    const base = {
      members: [ana, bia],
      txs: [paidBy("ana", 10000)],
      mode: "equal",
      settlements: [wide, month],
    } as const;
    const full = computeDivision({ ...base, period: { start: "2026-11", end: "2027-01" } });
    expect(full.settlements).toEqual([wide, month]);
    const onlyNov = computeDivision({ ...base, period: { start: "2026-11", end: "2026-11" } });
    expect(onlyNov.settlements).toEqual([]);
    const dec = computeDivision({ ...base, period: { start: "2026-11", end: "2026-12" } });
    expect(dec.settlements).toEqual([month]);
    const noPeriod = computeDivision(base);
    expect(noPeriod.settlements).toHaveLength(2);
  });

  it("quitação gulosa: o maior devedor paga ao maior credor", () => {
    const cid = member("cid", "Cid");
    const d = computeDivision({
      members: [ana, bia, cid],
      txs: [paidBy("ana", 9000), paidBy("bia", 3000)],
      mode: "equal",
    });
    expect(d.people.map((p) => p.balance)).toEqual([5000, -1000, -4000]);
    expect(d.moves).toEqual([
      { from: "cid", to: "ana", amount: 4000 },
      { from: "bia", to: "ana", amount: 1000 },
    ]);
  });

  it("um devedor e dois credores divide o pagamento", () => {
    const cid = member("cid", "Cid");
    const d = computeDivision({
      members: [ana, bia, cid],
      txs: [paidBy("ana", 6000), paidBy("bia", 6000)],
      mode: "equal",
    });
    expect(d.moves.reduce((a, m) => a + m.amount, 0)).toBe(4000);
    expect(d.moves.every((m) => m.from === "cid")).toBe(true);
    expect(d.moves).toHaveLength(2);
  });
});
