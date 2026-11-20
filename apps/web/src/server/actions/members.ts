"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../access";
import { writeActiveSpaceId } from "../active-space";
import { getDb } from "../db";
import { inviteEmail, sendEmail } from "../email";
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
 * Convida uma pessoa (só o dono). Devolve o link para copiar e mandar; com `RESEND_API_KEY`,
 * o convite também vai por e-mail. Se o e-mail falhar, o convite continua valendo pelo link.
 */
export async function createInvite(input: CreateInviteInput): Promise<ActionResult<InviteCreated>> {
  return runAction(createInviteSchema, input, async (data) => {
    const user = await requireUser();
    const invite = await members.createInvite(getDb(), { id: user.id, email: user.email }, data);
    const email = await sendEmail(
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
