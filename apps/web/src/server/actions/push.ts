"use server";

import { headers } from "next/headers";
import { requireUser } from "../access";
import { getDb } from "../db";
import { isPushEnabled } from "../env";
import { removeSubscription, saveSubscription } from "../push";
import { type ActionResult, DomainError, runAction } from "../result";
import {
  type RemovePushSubscriptionInput,
  removePushSubscriptionSchema,
  type SavePushSubscriptionInput,
  savePushSubscriptionSchema,
} from "../validators/push";

const PUSH_DISABLED = "As notificações no aparelho ainda não foram configuradas neste servidor.";

/** Grava a inscrição deste aparelho (resultado de `pushManager.subscribe(...).toJSON()`). */
export async function savePushSubscription(input: SavePushSubscriptionInput): Promise<ActionResult<{ saved: true }>> {
  return runAction(savePushSubscriptionSchema, input, async (subscription) => {
    if (!isPushEnabled()) throw new DomainError(PUSH_DISABLED);
    const user = await requireUser();
    const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
    await saveSubscription(getDb(), user.id, subscription, userAgent);
    return { saved: true };
  });
}

/** Remove a inscrição deste aparelho (ao desligar as notificações). */
export async function removePushSubscription(
  input: RemovePushSubscriptionInput,
): Promise<ActionResult<{ removed: boolean }>> {
  return runAction(removePushSubscriptionSchema, input, async ({ endpoint }) => {
    const user = await requireUser();
    return { removed: await removeSubscription(getDb(), user.id, endpoint) };
  });
}
