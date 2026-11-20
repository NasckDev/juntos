import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token aleatório de 32 bytes, em base64url (vai no link; nunca é guardado). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Comparação em tempo constante (compara os hashes para não vazar o tamanho). */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right) && a.length === b.length;
}
