import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";
import {
  enforceRateLimit,
  hashedPart,
  hitRateLimit,
  purgeStaleRateLimits,
  RATE_LIMIT_MESSAGE,
  RATE_RULES,
  RateLimitError,
  rateKey,
} from "./rate-limit";
import { migrateTestDb } from "./test/helpers";

beforeAll(async () => {
  await migrateTestDb();
});

const RULE = { name: "teste", limit: 3, windowMs: 60_000 } as const;
const T0 = new Date("2026-11-20T12:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("limite de tentativas", () => {
  it("conta por chave e recusa depois do limite, com a mensagem amigável", async () => {
    const key = rateKey(RULE, randomUUID());
    for (let i = 0; i < RULE.limit; i += 1) await enforceRateLimit(getDb(), RULE, key, at(i));
    const error = await enforceRateLimit(getDb(), RULE, key, at(10)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as Error).message).toBe(RATE_LIMIT_MESSAGE);
  });

  it("reinicia a contagem quando a janela passa", async () => {
    const key = rateKey(RULE, randomUUID());
    for (let i = 0; i < 5; i += 1) await hitRateLimit(getDb(), RULE, key, at(i));
    expect(await hitRateLimit(getDb(), RULE, key, at(RULE.windowMs + 1))).toBe(1);
    expect(await hitRateLimit(getDb(), RULE, key, at(RULE.windowMs + 2))).toBe(2);
  });

  it("chaves diferentes não se misturam", async () => {
    const a = rateKey(RULE, randomUUID());
    const b = rateKey(RULE, randomUUID());
    await hitRateLimit(getDb(), RULE, a, T0);
    await hitRateLimit(getDb(), RULE, a, T0);
    expect(await hitRateLimit(getDb(), RULE, b, T0)).toBe(1);
  });

  it("tentativas simultâneas não perdem contagem (upsert atômico)", async () => {
    const key = rateKey(RULE, randomUUID());
    const counts = await Promise.all(Array.from({ length: 8 }, () => hitRateLimit(getDb(), RULE, key, T0)));
    expect([...counts].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("dado pessoal entra na chave só como hash", () => {
    const key = rateKey(RATE_RULES.inviteRecipient, "u1", hashedPart(" Lu@Example.com "));
    expect(key).not.toContain("example");
    expect(key).toBe(rateKey(RATE_RULES.inviteRecipient, "u1", hashedPart("lu@example.com")));
  });

  it("a rotina diária apaga contadores velhos e mantém os recentes", async () => {
    const old = rateKey(RULE, randomUUID());
    const fresh = rateKey(RULE, randomUUID());
    await hitRateLimit(getDb(), RULE, old, new Date(T0.getTime() - 3 * 24 * 60 * 60 * 1000));
    await hitRateLimit(getDb(), RULE, fresh, T0);
    expect(await purgeStaleRateLimits(getDb(), T0)).toBeGreaterThanOrEqual(1);
    expect(await getDb().select().from(rateLimits).where(eq(rateLimits.key, old))).toHaveLength(0);
    expect(await getDb().select().from(rateLimits).where(eq(rateLimits.key, fresh))).toHaveLength(1);
  });
});
