"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireUser } from "../access";
import { getDb } from "../db";
import { deletionRequestedEmail, sendEmail } from "../email";
import { type ActionResult, runAction } from "../result";
import * as account from "../services/account";
import { type Preferences, updatePreferences as savePreferences } from "../services/preferences";
import {
  type UpdatePreferencesInput,
  type UpdateProfileInput,
  updatePreferencesSchema,
  updateProfileSchema,
} from "../validators/preferences";

const noInput = z.undefined().or(z.object({}).strict());

/** Tema, cor, letra, esconder valores e tipos de aviso (atualização parcial). */
export async function updatePreferences(input: UpdatePreferencesInput): Promise<ActionResult<Preferences>> {
  return runAction(updatePreferencesSchema, input, async (patch) => {
    const user = await requireUser();
    const saved = await savePreferences(getDb(), user.id, patch);
    revalidatePath("/", "layout");
    return saved;
  });
}

/** Nome e avatar (um dos `AVATAR_IDS`, ou `null` para as iniciais). */
export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult<{ saved: true }>> {
  return runAction(updateProfileSchema, input, async (patch) => {
    const user = await requireUser();
    await account.updateProfile(getDb(), user.id, patch);
    revalidatePath("/", "layout");
    return { saved: true };
  });
}

/**
 * Pede a exclusão da conta: carência de 30 dias, depois a rotina diária apaga tudo.
 * Com e-mail configurado, a pessoa (com login Google) recebe a confirmação.
 */
export async function requestAccountDeletion(): Promise<ActionResult<account.DeletionSchedule>> {
  return runAction(noInput, undefined, async () => {
    const user = await requireUser();
    const schedule = await account.requestAccountDeletion(getDb(), user.id);
    if (user.email) await sendEmail(deletionRequestedEmail({ to: user.email, deleteAfter: schedule.deleteAfter }));
    revalidatePath("/", "layout");
    return schedule;
  });
}

/** Desiste da exclusão durante a carência. */
export async function cancelAccountDeletion(): Promise<ActionResult<{ canceled: true }>> {
  return runAction(noInput, undefined, async () => {
    const user = await requireUser();
    await account.cancelAccountDeletion(getDb(), user.id);
    revalidatePath("/", "layout");
    return { canceled: true };
  });
}
