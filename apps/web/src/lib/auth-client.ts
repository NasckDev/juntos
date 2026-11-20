"use client";

import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { removePushSubscription } from "@/server/actions/push";
import { releaseThisDevice } from "./push-client";

/**
 * Cliente do Better Auth no navegador. Usa o mesmo domínio do app (`/api/auth`).
 * `authClient.useSession()` dá a sessão reativa para os componentes.
 */
export const authClient = createAuthClient({
  plugins: [anonymousClient()],
});

export type AuthResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

const GENERIC_SIGN_IN_ERROR = "Não foi possível entrar agora. Tente de novo em instantes.";

/**
 * Entra com o Google (redireciona para a tela do Google e volta para `callbackURL`).
 * Se a pessoa estiver como convidado, os dados dela passam para a conta Google.
 * Só chame se o servidor disser que o Google está ligado (`features.google`).
 */
export async function signInWithGoogle(
  callbackURL = "/inicio",
  errorCallbackURL = "/entrar?erro=google",
): Promise<AuthResult> {
  const { error } = await authClient.signIn.social({ provider: "google", callbackURL, errorCallbackURL });
  return error ? { ok: false, error: GENERIC_SIGN_IN_ERROR } : { ok: true };
}

/** Entra como convidado (conta anônima, sem e-mail). Pode virar conta Google depois. */
export async function signInAsGuest(): Promise<AuthResult> {
  const { error } = await authClient.signIn.anonymous();
  return error ? { ok: false, error: GENERIC_SIGN_IN_ERROR } : { ok: true };
}

/**
 * Avisos deste navegador não podem continuar chegando para a conta que saiu (ADR 0006): cancela a inscrição de
 * push daqui e apaga no servidor enquanto a sessão ainda vale. Se falhar, a saída segue mesmo assim.
 */
async function forgetPushOnThisDevice(): Promise<void> {
  const endpoint = await releaseThisDevice();
  if (!endpoint) return;
  try {
    await removePushSubscription({ endpoint });
  } catch {
    // Sem rede ou sessão já vencida: a inscrição local já foi cancelada; o servidor apaga no próximo envio (410).
  }
}

/** Sai da conta, removendo antes a inscrição de push deste navegador. Os dados continuam salvos no servidor. */
export async function signOut(): Promise<AuthResult> {
  await forgetPushOnThisDevice();
  const { error } = await authClient.signOut();
  return error ? { ok: false, error: "Não foi possível sair agora. Tente de novo." } : { ok: true };
}
