"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../access";
import { writeActiveSpaceId } from "../active-space";
import { getDb } from "../db";
import { inviteEmail, sendEmail } from "../email";
import { enforceRateLimit, enforceUserRateLimit, hashedPart, RATE_RULES, rateKey } from "../rate-limit";
import { type ActionResult, runAction } from "../result";
import * as members from "../services/members";
import {
  type AcceptInviteInput,
  acceptInviteSchema,
  type ChangeMemberRoleInput,
  type CreateInviteInput,
  changeMemberRoleSchema,
  createInviteSchema,
  type RemoveMemberInput,
  removeMemberSchema,
} from "../validators/members";

export interface InviteCreated extends members.CreatedInvite {
  /** `true` se o convite também foi por e-mail (Resend configurada e envio aceito). */
  readonly emailSent: boolean;
}

/**
 * Convida uma pessoa (só o dono). Devolve o link para copiar e mandar. O e-mail com o convite só sai de conta
 * com login Google (com `RESEND_API_KEY`): convidado anônimo não dispara e-mail para ninguém, para o app não
 * virar relay de spam (ADR 0006). Se o e-mail falhar, o convite continua valendo pelo link.
 * Limites: 20 convites por dia por pessoa e 5 por destinatário por dia.
 */
export async function createInvite(input: CreateInviteInput): Promise<ActionResult<InviteCreated>> {
  return runAction(createInviteSchema, input, async (data) => {
    const user = await requireUser();
    const db = getDb();
    await enforceUserRateLimit(db, RATE_RULES.inviteCreate, user.id);
    const recipientKey = rateKey(RATE_RULES.inviteRecipient, user.id, hashedPart(data.email));
    await enforceRateLimit(db, RATE_RULES.inviteRecipient, recipientKey);
    const invite = await members.createInvite(db, { id: user.id, email: user.email }, data);
    const email = user.isAnonymous
      ? { sent: false as const }
      : await sendEmail(
          inviteEmail({
            to: invite.email,
            inviterName: user.name,
            spaceName: invite.spaceName,
            inviteUrl: invite.inviteUrl,
          }),
        );
    revalidatePath("/", "layout");
    return { ...invite, emailSent: email.sent };
  });
}

/** Aceita o convite do link `/convite/[token]` e deixa o espaço ativo. */
export async function acceptInvite(input: AcceptInviteInput): Promise<ActionResult<members.AcceptedInvite>> {
  return runAction(acceptInviteSchema, input, async ({ token }) => {
    const user = await requireUser();
    const accepted = await members.acceptInvite(getDb(), { id: user.id, name: user.name }, token);
    await writeActiveSpaceId(accepted.spaceId);
    revalidatePath("/", "layout");
    return accepted;
  });
}

/** "Pode editar" ou "Só vê" (só o dono). */
export async function changeMemberRole(input: ChangeMemberRoleInput): Promise<ActionResult<{ memberId: string }>> {
  return runAction(changeMemberRoleSchema, input, async (data) => {
    const user = await requireUser();
    await members.changeMemberRole(getDb(), user.id, data);
    revalidatePath("/", "layout");
    return { memberId: data.memberId };
  });
}

/** Remove a pessoa ou cancela o convite pendente (só o dono). */
export async function removeMember(input: RemoveMemberInput): Promise<ActionResult<{ memberId: string }>> {
  return runAction(removeMemberSchema, input, async (data) => {
    const user = await requireUser();
    await members.removeMember(getDb(), user.id, data);
    revalidatePath("/", "layout");
    return { memberId: data.memberId };
  });
}
