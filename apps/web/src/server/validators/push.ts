import * as z from "zod";

const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/, { error: "Inscrição de notificação inválida." });

/** Formato de `PushSubscription.toJSON()` no navegador. */
export const savePushSubscriptionSchema = z.object({
  endpoint: z
    .url({ protocol: /^https$/, error: "Inscrição de notificação inválida." })
    .max(2048, { error: "Inscrição de notificação inválida." }),
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
