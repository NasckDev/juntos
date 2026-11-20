import { cookies } from "next/headers";
import { env } from "./env";

/** Cookie com o id do espaço ativo (só aponta; o acesso é sempre conferido no servidor). */
export const ACTIVE_SPACE_COOKIE = "juntos-espaco";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export async function readActiveSpaceId(): Promise<string | null> {
  return (await cookies()).get(ACTIVE_SPACE_COOKIE)?.value ?? null;
}

export async function writeActiveSpaceId(spaceId: string): Promise<void> {
  (await cookies()).set(ACTIVE_SPACE_COOKIE, spaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}
