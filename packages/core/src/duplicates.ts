import type { Tx } from "./types.ts";

export type DuplicateCandidate = Pick<Tx, "description" | "amount" | "kind" | "competence" | "day">;

/** Nome comparável: sem acentos, minúsculo, espaços colapsados. */
export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Lançamento igual ao candidato: mesmo nome (normalizado), valor, tipo, competência e dia.
 * `ignoreId` evita que a edição de um lançamento se acuse como duplicado de si mesmo.
 */
export function findDuplicate(
  candidate: DuplicateCandidate,
  txs: readonly Tx[],
  ignoreId: string | null = null,
): Tx | null {
  const wanted = normalizeName(candidate.description);
  return (
    txs.find(
      (t) =>
        t.id !== ignoreId &&
        t.competence === candidate.competence &&
        t.day === candidate.day &&
        t.kind === candidate.kind &&
        t.amount === candidate.amount &&
        normalizeName(t.description) === wanted,
    ) ?? null
  );
}
