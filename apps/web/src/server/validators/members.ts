import * as z from "zod";
import { EMAIL_PATTERN, idSchema, MESSAGES, memberRoleSchema } from "./common";

export const inviteEmailSchema = z
  .string({ error: MESSAGES.missingInviteEmail })
  .trim()
  .min(1, { error: MESSAGES.missingInviteEmail })
  .max(254, { error: MESSAGES.invalidEmail })
  .regex(EMAIL_PATTERN, { error: MESSAGES.invalidEmail })
  .transform((email) => email.toLowerCase());

export const createInviteSchema = z.object({
  spaceId: idSchema,
  email: inviteEmailSchema,
  role: memberRoleSchema,
});
export type CreateInviteInput = z.input<typeof createInviteSchema>;

/** Token do link: 32 bytes em base64url (43 caracteres). */
export const inviteTokenSchema = z
  .string({ error: "Convite inválido." })
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, { error: "Convite inválido." });

export const acceptInviteSchema = z.object({ token: inviteTokenSchema });
export type AcceptInviteInput = z.input<typeof acceptInviteSchema>;

export const changeMemberRoleSchema = z.object({
  spaceId: idSchema,
  memberId: idSchema,
  role: memberRoleSchema,
});
export type ChangeMemberRoleInput = z.input<typeof changeMemberRoleSchema>;

export const removeMemberSchema = z.object({ spaceId: idSchema, memberId: idSchema });
export type RemoveMemberInput = z.input<typeof removeMemberSchema>;
