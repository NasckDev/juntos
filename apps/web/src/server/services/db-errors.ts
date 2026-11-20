/** Código do Postgres para violação de índice único. */
const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 4;

/** O erro (ou alguma causa dele, como no `DrizzleQueryError`) é uma violação de índice único do Postgres? */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof current === "object" && current !== null; depth += 1) {
    if ("code" in current && current.code === UNIQUE_VIOLATION) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}
