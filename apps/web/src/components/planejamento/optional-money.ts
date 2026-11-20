import { type Cents, formatMoneyInput, parseMoney } from "@juntos/core";

/** Texto digitado + valor lido: distingue campo vazio (opcional) de texto que não é número (erro). */
export interface MoneyDraft {
  readonly raw: string;
  readonly cents: Cents | null;
}

export const EMPTY_MONEY: MoneyDraft = { raw: "", cents: null };

export function moneyDraftOf(cents: Cents | null): MoneyDraft {
  return cents === null ? EMPTY_MONEY : { raw: formatMoneyInput(cents), cents };
}

export function moneyDraftFromText(raw: string): MoneyDraft {
  return { raw, cents: parseMoney(raw) };
}

/** Preenchido com algo que não é número (ex.: "abc"). */
export function isInvalidMoney(draft: MoneyDraft): boolean {
  return draft.raw.trim() !== "" && draft.cents === null;
}

/** Vazio = `null`; número = centavos. Chame só depois de checar `isInvalidMoney`. */
export function moneyOrNull(draft: MoneyDraft): Cents | null {
  return draft.cents;
}
