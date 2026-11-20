"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, DomainError, runAction } from "../result";
import * as service from "../services/notifications";
import { idSchema, spaceIdSchema } from "../validators/common";

/*
 * Central de notificações. Qualquer membro (inclusive quem só vê) marca os próprios avisos como vistos e lidos.
 */

const noticeRefSchema = z.object({ spaceId: idSchema, id: idSchema });

function refresh(): void {
  revalidatePath("/", "layout");
}

/** Abrir a central: tudo visto (o contador do sino zera). */
export async function markNotificationsSeen(input: z.input<typeof spaceIdSchema>): Promise<ActionResult<number>> {
  return runAction(spaceIdSchema, input, async ({ spaceId }) => {
    const { user } = await requireMember(spaceId, "viewer");
    const changed = await service.markSeen(getDb(), spaceId, user.id);
    if (changed > 0) refresh();
    return changed;
  });
}

/** "Marcar todas como lidas". */
export async function markAllNotificationsRead(input: z.input<typeof spaceIdSchema>): Promise<ActionResult<number>> {
  return runAction(spaceIdSchema, input, async ({ spaceId }) => {
    const { user } = await requireMember(spaceId, "viewer");
    const changed = await service.markAllRead(getDb(), spaceId, user.id);
    refresh();
    return changed;
  });
}

/** Abrir um aviso: marca como lido e devolve para onde ele leva. */
export async function openNotification(
  input: z.input<typeof noticeRefSchema>,
): Promise<ActionResult<{ href: string | null }>> {
  return runAction(noticeRefSchema, input, async ({ spaceId, id }) => {
    const { user } = await requireMember(spaceId, "viewer");
    const result = await service.markRead(getDb(), spaceId, user.id, id);
    if (!result) throw new DomainError("Esse aviso não existe mais.");
    refresh();
    return result;
  });
}
