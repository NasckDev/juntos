import * as z from "zod";
import { isAllowedPushEndpoint } from "../push-endpoints";

const INVALID_SUBSCRIPTION = "Inscrição de notificação inválida.";

const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/, { error: INVALID_SUBSCRIPTION });

/** Formato de `PushSubscription.toJSON()` no navegador. */
export const savePushSubscriptionSchema = z.object({
  /** Só serviços de push conhecidos, por HTTPS na porta padrão (ADR 0006: evita SSRF pelo envio). */
  endpoint: z
    .url({ protocol: /^https$/, error: INVALID_SUBSCRIPTION })
    .max(2048, { error: INVALID_SUBSCRIPTION })
    .refine(isAllowedPushEndpoint, { error: INVALID_SUBSCRIPTION }),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: base64url.max(256),
    auth: base64url.max(128),
  }),
});
export type SavePushSubscriptionInput = z.input<typeof savePushSubscriptionSchema>;

export const removePushSubscriptionSchema = z.object({
  endpoint: z.url({ error: "Inscrição de notificação inválida." }).max(2048),
});
export type RemovePushSubscriptionInput = z.input<typeof removePushSubscriptionSchema>;
