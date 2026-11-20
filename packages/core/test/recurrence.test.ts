import { describe, expect, it } from "vitest";
import {
  applyForward,
  deleteEffects,
  materialize,
  missingForMonth,
  occursIn,
  pauseEffects,
  resumeEffects,
} from "../src/recurrence.ts";
import type { Tx } from "../src/types.ts";
import { rec, tx } from "./fixtures/builders.ts";

const TODAY = "2026-11-19";

function withIds(list: ReturnType<typeof missingForMonth>): Tx[] {
  return list.map((t, i) => ({ ...t, id: `n${i}-${t.recurrenceId}-${t.competence}` }));
}

describe("occursIn", () => {
  it("não ocorre antes do início", () => {
    expect(occursIn(rec({ start: "2026-05" }), "2026-04")).toBe(false);
    expect(occursIn(rec({ start: "2026-05" }), "2026-05")).toBe(true);
  });

  it("conta mensal sem fim ocorre sempre", () => {
    expect(occursIn(rec(), "2030-07")).toBe(true);
  });

  it("última parcela ocorre; a seguinte não", () => {
    const r = rec({ start: "2026-01", installmentsTotal: 3 });
    expect(occursIn(r, "2026-03")).toBe(true);
    expect(occursIn(r, "2026-04")).toBe(false);
  });

  it("conta anual cai no mês de aniversário e não cai nos outros", () => {
    const r = rec({ frequency: "yearly", start: "2026-03" });
    expect(occursIn(r, "2026-03")).toBe(true);
    expect(occursIn(r, "2026-04")).toBe(false);
    expect(occursIn(r, "2027-03")).toBe(true);
    expect(occursIn(r, "2026-02")).toBe(false);
  });

  it("conta pausada não ocorre", () => {
    expect(occursIn(rec({ paused: true }), "2026-11")).toBe(false);
  });
});

describe("materialize", () => {
  it("devolve null quando não cai no mês", () => {
    expect(materialize(rec({ paused: true }), "2026-11", TODAY)).toBeNull();
  });

  it("ajusta o dia 31 para o fim de fevereiro, inclusive em ano bissexto", () => {
    expect(materialize(rec({ day: 31, start: "2026-01" }), "2026-02", TODAY)?.day).toBe(28);
    expect(materialize(rec({ day: 31, start: "2028-01" }), "2028-02", "2028-01-01")?.day).toBe(29);
  });

  it("meses passados já nascem pagos; futuros, não", () => {
    expect(materialize(rec(), "2026-10", TODAY)?.paid).toBe(true);
    expect(materialize(rec(), "2026-12", TODAY)?.paid).toBe(false);
  });

  it("no mês de hoje, o dia de hoje e os anteriores nascem pagos", () => {
    expect(materialize(rec({ day: 19 }), "2026-11", TODAY)?.paid).toBe(true);
    expect(materialize(rec({ day: 20 }), "2026-11", TODAY)?.paid).toBe(false);
  });

  it("numera a parcela e marca contas anuais", () => {
    const parcela = materialize(rec({ start: "2026-09", installmentsTotal: 5 }), "2026-11", TODAY);
    expect(parcela?.installment).toBe(3);
    expect(parcela?.installmentsTotal).toBe(5);
    const anual = materialize(rec({ frequency: "yearly", start: "2025-11" }), "2026-11", TODAY);
    expect(anual?.yearly).toBe(true);
    expect(anual?.installment).toBeNull();
    expect(anual?.recurrenceId).toBe("r1");
  });
});

describe("missingForMonth", () => {
  it("é idempotente: rodar duas vezes não duplica", () => {
    const recs = [rec(), rec({ id: "r2", description: "Luz", start: "2026-01" })];
    const first = missingForMonth(recs, [], "2026-11", TODAY);
    expect(first).toHaveLength(2);
    const second = missingForMonth(recs, withIds(first), "2026-11", TODAY);
    expect(second).toEqual([]);
  });

  it("só gera o que falta e ignora pausadas e fora do mês", () => {
    const recs = [rec(), rec({ id: "r2" }), rec({ id: "r3", paused: true }), rec({ id: "r4", start: "2027-01" })];
    const existing = [tx({ recurrenceId: "r1", competence: "2026-11" })];
    const created = missingForMonth(recs, existing, "2026-11", TODAY);
    expect(created.map((t) => t.recurrenceId)).toEqual(["r2"]);
  });

  it("lançamento de outro mês não conta como existente", () => {
    const existing = [tx({ recurrenceId: "r1", competence: "2026-10" })];
    expect(missingForMonth([rec()], existing, "2026-11", TODAY)).toHaveLength(1);
  });
});

describe("applyForward (neste e nos próximos)", () => {
  const model = rec();
  const oct = tx({ id: "oct", recurrenceId: "r1", competence: "2026-10", paid: true, amount: 12000 });
  const nov = tx({ id: "nov", recurrenceId: "r1", competence: "2026-11", paid: false, amount: 12000 });
  const dec = tx({ id: "dec", recurrenceId: "r1", competence: "2026-12", paid: false, amount: 12000, day: 31 });
  const jan = tx({ id: "jan", recurrenceId: "r1", competence: "2027-01", paid: true, amount: 12000 });
  const other = tx({ id: "other", recurrenceId: "r9", competence: "2026-12", paid: false, amount: 5 });
  const feb = tx({ id: "feb", recurrenceId: "r1", competence: "2027-02", paid: false, amount: 12000 });
  const all = [oct, nov, dec, jan, other, feb];

  it("só altera futuros em aberto da mesma conta", () => {
    const result = applyForward(model, all, "2026-11", { amount: 15000, day: 31, description: "Internet fibra" });
    const byId = new Map(result.txs.map((t) => [t.id, t]));
    expect(result.recurrence.amount).toBe(15000);
    expect(byId.get("oct")).toBe(oct);
    expect(byId.get("nov")).toBe(nov);
    expect(byId.get("jan")).toBe(jan);
    expect(byId.get("other")).toBe(other);
    expect(byId.get("dec")?.amount).toBe(15000);
    expect(byId.get("dec")?.description).toBe("Internet fibra");
    expect(byId.get("feb")?.day).toBe(28);
  });

  it("repassa categoria, forma de pagamento, pagador e pessoal", () => {
    const result = applyForward(model, all, "2026-11", {
      categoryId: "saude",
      paymentMethod: "Boleto",
      paidBy: "m1",
      personal: true,
    });
    const dec2 = result.txs.find((t) => t.id === "dec");
    expect(dec2).toMatchObject({ categoryId: "saude", paymentMethod: "Boleto", paidBy: "m1", personal: true });
    expect(dec2?.amount).toBe(12000);
  });

  it("não muta os originais", () => {
    const before = JSON.stringify(all);
    applyForward(model, all, "2026-11", { amount: 1 });
    expect(JSON.stringify(all)).toBe(before);
  });
});

describe("pausar, retomar e excluir", () => {
  const model = rec();
  const txs = [
    tx({ id: "past", recurrenceId: "r1", competence: "2026-10", paid: true }),
    tx({ id: "now", recurrenceId: "r1", competence: "2026-11", paid: false }),
    tx({ id: "future", recurrenceId: "r1", competence: "2026-12", paid: false }),
    tx({ id: "futurePaid", recurrenceId: "r1", competence: "2027-01", paid: true }),
    tx({ id: "other", recurrenceId: "r2", competence: "2026-12", paid: false }),
  ];

  it("pausar apaga só os futuros em aberto (meses depois do atual)", () => {
    const effects = pauseEffects(model, txs, TODAY);
    expect(effects.recurrence.paused).toBe(true);
    expect(effects.removeIds).toEqual(["future"]);
  });

  it("retomar recria nos meses futuros abertos que ainda não têm lançamento", () => {
    const paused = rec({ paused: true });
    const remaining = txs.filter((t) => t.id !== "future");
    const effects = resumeEffects(paused, remaining, TODAY, ["2026-10", "2026-11", "2026-12", "2026-12", "2027-01"]);
    expect(effects.recurrence.paused).toBe(false);
    expect(effects.create.map((t) => t.competence)).toEqual(["2026-12"]);
  });

  it("excluir remove os futuros em aberto e desliga o histórico do modelo", () => {
    const effects = deleteEffects(model, txs, TODAY);
    expect(effects.removeIds).toEqual(["future"]);
    expect(effects.detachIds).toEqual(["past", "now", "futurePaid"]);
  });
});
