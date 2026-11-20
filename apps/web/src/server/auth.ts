import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins/anonymous";
import { getDb } from "./db";
import { account, rateLimit, session, user, verification } from "./db/schema";
import { env, isGoogleEnabled } from "./env";
import { ensureUserSetup, linkGuestToAccount } from "./services/users";

/** Nome do convidado até a pessoa mudar em Ajustes > Conta (igual ao protótipo). */
export const GUEST_NAME = "Convidado";

const DAY = 24 * 60 * 60;

function createAuth() {
  const google =
    isGoogleEnabled() && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : null;
  return betterAuth({
    appName: "Juntos",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
      transaction: true,
    }),
    // Sem as variáveis do Google o provedor não existe: o botão não aparece (ver `isGoogleEnabled`).
    socialProviders: google
      ? {
          google: { ...google, prompt: "select_account" },
        }
      : {},
    user: {
      additionalFields: {
        avatar: { type: "string", required: false, input: false },
        deletionRequestedAt: { type: "date", required: false, input: false },
      },
    },
    session: {
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    rateLimit: {
      // Ligado em produção (padrão do Better Auth) e guardado no banco, no lugar do Upstash (ADR 0005).
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/anonymous": { window: 60, max: 5 },
        "/sign-in/social": { window: 60, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: "juntos",
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    databaseHooks: {
      user: {
        create: {
          // Toda conta nova (Google ou convidado) começa com um espaço "Casa" vazio e as preferências padrão.
          after: async (created) => {
            await ensureUserSetup(getDb(), created.id);
          },
        },
      },
    },
    plugins: [
      anonymous({
        generateName: () => GUEST_NAME,
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await linkGuestToAccount(getDb(), anonymousUser.user.id, newUser.user.id);
        },
      }),
      // Precisa ser o último: grava cookies quando uma Server Action chama a API do Better Auth.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const holder = globalThis as typeof globalThis & { __juntosAuth?: Auth | undefined };

/** Instância criada na primeira requisição (não na importação), para o build não abrir banco. */
export function getAuth(): Auth {
  if (!holder.__juntosAuth) holder.__juntosAuth = createAuth();
  return holder.__juntosAuth;
}
