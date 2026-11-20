import { env, isEmailEnabled } from "./env";

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export type EmailResult = { readonly sent: true } | { readonly sent: false; readonly reason: "disabled" | "failed" };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/**
 * Envia e-mail pela API HTTP da Resend. Sem `RESEND_API_KEY`, o recurso está desligado e a função
 * diz isso (`reason: "disabled"`): convites e avisos continuam no app e no push.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!isEmailEnabled() || !env.RESEND_API_KEY || !env.EMAIL_FROM) return { sent: false, reason: "disabled" };
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("Falha ao enviar e-mail pela Resend:", response.status, await response.text());
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (error: unknown) {
    console.error("Falha ao enviar e-mail pela Resend:", error);
    return { sent: false, reason: "failed" };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function inviteEmail(input: {
  readonly to: string;
  readonly inviterName: string;
  readonly spaceName: string;
  readonly inviteUrl: string;
}): EmailMessage {
  const subject = `${input.inviterName} convidou você para “${input.spaceName}” no Juntos`;
  const text = [
    `${input.inviterName} convidou você para acompanhar as contas de “${input.spaceName}” no Juntos.`,
    "",
    `Abra o link para aceitar: ${input.inviteUrl}`,
    "",
    "O convite vale por 7 dias e só pode ser usado uma vez.",
  ].join("\n");
  const html = `<p>${escapeHtml(input.inviterName)} convidou você para acompanhar as contas de “${escapeHtml(
    input.spaceName,
  )}” no Juntos.</p><p><a href="${escapeHtml(input.inviteUrl)}">Aceitar o convite</a></p><p>O convite vale por 7 dias e só pode ser usado uma vez.</p>`;
  return { to: input.to, subject, text, html };
}

export function deletionRequestedEmail(input: { readonly to: string; readonly deleteAfter: Date }): EmailMessage {
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(
    input.deleteAfter,
  );
  const subject = "Pedido de exclusão da sua conta no Juntos";
  const text = [
    "Recebemos o pedido para excluir a sua conta no Juntos.",
    `Ela será apagada de vez em ${date}. Até lá, é só entrar no app e cancelar em Ajustes > Conta.`,
  ].join("\n");
  const html = `<p>Recebemos o pedido para excluir a sua conta no Juntos.</p><p>Ela será apagada de vez em ${escapeHtml(
    date,
  )}. Até lá, é só entrar no app e cancelar em Ajustes &gt; Conta.</p>`;
  return { to: input.to, subject, text, html };
}
