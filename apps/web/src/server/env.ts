import * as z from "zod";

/**
 * Variáveis de ambiente do servidor, validadas uma vez na inicialização.
 *
 * Regras:
 * - Em produção, `BETTER_AUTH_SECRET` e `DATABASE_URL` são obrigatórias: sem elas o app não sobe.
 * - As opcionais desligam o recurso de forma explícita (`isGoogleEnabled`, `isPushEnabled`, `isEmailEnabled`),
 *   nunca em silêncio: a tela consulta essas funções para explicar o que está desligado.
 */

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalText.pipe(z.url({ message: "DATABASE_URL precisa ser uma URL postgres válida." }).optional()),
  BETTER_AUTH_SECRET: optionalText.pipe(
    z.string().min(32, { message: "BETTER_AUTH_SECRET precisa de pelo menos 32 caracteres." }).optional(),
  ),
  BETTER_AUTH_URL: optionalText.pipe(z.url({ message: "BETTER_AUTH_URL precisa ser uma URL." }).optional()),
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  CRON_SECRET: optionalText.pipe(
    z.string().min(16, { message: "CRON_SECRET precisa de pelo menos 16 caracteres." }).optional(),
  ),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalText,
  VAPID_PRIVATE_KEY: optionalText,
  VAPID_SUBJECT: optionalText.pipe(
    z
      .string()
      .regex(/^(mailto:|https:\/\/)/, { message: "VAPID_SUBJECT deve começar com mailto: ou https://." })
      .optional(),
  ),
  RESEND_API_KEY: optionalText,
  EMAIL_FROM: optionalText,
  /** Definidas pela própria Vercel; usadas só para montar links quando BETTER_AUTH_URL não existe. */
  VERCEL_PROJECT_PRODUCTION_URL: optionalText,
  VERCEL_URL: optionalText,
});

export type ServerEnv = z.infer<typeof schema>;

export class EnvError extends Error {
  override readonly name = "EnvError";
}

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new EnvError(`Variáveis de ambiente inválidas:\n${details}`);
  }
  const env = result.data;
  // Durante o `next build` (sem tráfego), os segredos de execução não são exigidos; no servidor, sim.
  const isBuildPhase = source.NEXT_PHASE === "phase-production-build";
  if (env.NODE_ENV === "production" && !isBuildPhase) {
    const missing = (["BETTER_AUTH_SECRET", "DATABASE_URL"] as const).filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new EnvError(
        `Em produção, defina ${missing.join(" e ")}. Veja apps/web/.env.example e o passo a passo de produção.`,
      );
    }
  }
  const googlePair = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET].filter(Boolean).length;
  if (googlePair === 1) {
    throw new EnvError("Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET juntos (ou nenhum dos dois).");
  }
  const vapid = [env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT].filter(Boolean).length;
  if (vapid > 0 && vapid < 3) {
    throw new EnvError(
      "Notificações push precisam de NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT juntos.",
    );
  }
  if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
    throw new EnvError("Com RESEND_API_KEY, defina também EMAIL_FROM (ex.: Juntos <avisos@seu-dominio>).");
  }
  return env;
}

export const env: ServerEnv = parseEnv(process.env);

export function isGoogleEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function isPushEnabled(): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

export function isEmailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function isCronEnabled(): boolean {
  return Boolean(env.CRON_SECRET);
}

/** Endereço público do app, usado em links de convite e no Better Auth. */
export function appUrl(): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3010";
}
