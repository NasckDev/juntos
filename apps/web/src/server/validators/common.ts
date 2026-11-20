import * as z from "zod";

/** Mesma expressão do protótipo (`EMAIL`). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export const MESSAGES = {
  invalidEmail: "E-mail inválido. Confira, como nome@example.com.",
  missingInviteEmail: "Digite o e-mail da pessoa.",
  ownEmail: "Esse é o seu próprio e-mail.",
  alreadyMember: "Essa pessoa já está neste espaço ou já foi convidada.",
  spaceNameShort: "Dê um nome com pelo menos 2 letras.",
  spaceNameLong: "Use no máximo 30 caracteres no nome.",
  spaceNameTaken: "Você já tem um espaço com esse nome.",
  spaceNameTakenOther: "Você já tem outro espaço com esse nome.",
  profileNameShort: "Digite seu nome, com pelo menos 2 letras.",
  profileNameLong: "Use no máximo 40 caracteres no nome.",
  invalidId: "Não encontramos esse item.",
} as const;

export const idSchema = z.uuid({ error: MESSAGES.invalidId });

export const spaceIdSchema = z.object({ spaceId: idSchema });

/** Papéis que podem ser dados por convite ou na troca de permissão ("Pode editar" ou "Só vê"). */
export const memberRoleSchema = z.enum(["editor", "viewer"], { error: "Escolha a permissão: pode editar ou só vê." });
