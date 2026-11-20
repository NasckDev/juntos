import { describe, expect, it } from "vitest";
import { AVATAR_IDS } from "@/components/ui/avatar-art";
import { zodFailure } from "../result";
import { createInviteSchema, inviteTokenSchema } from "./members";
import { updatePreferencesSchema, updateProfileSchema } from "./preferences";
import { savePushSubscriptionSchema } from "./push";
import { createSpaceSchema, renameSpaceSchema } from "./spaces";
import { undoSchema } from "./undo";

const SPACE_ID = "6f1c2b9e-1d3a-4c55-9a0e-2b7f5d8c9e10";

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }): string | undefined {
  return result.error?.issues[0]?.message;
}

describe("convite", () => {
  it("normaliza o e-mail para minúsculas e aceita os dois papéis", () => {
    const parsed = createInviteSchema.parse({ spaceId: SPACE_ID, email: "  Lu@Example.COM ", role: "viewer" });
    expect(parsed).toEqual({ spaceId: SPACE_ID, email: "lu@example.com", role: "viewer" });
  });

  it("usa as mensagens do protótipo", () => {
    expect(firstMessage(createInviteSchema.safeParse({ spaceId: SPACE_ID, email: "  ", role: "editor" }))).toBe(
      "Digite o e-mail da pessoa.",
    );
    expect(firstMessage(createInviteSchema.safeParse({ spaceId: SPACE_ID, email: "lu@exemplo", role: "editor" }))).toBe(
      "E-mail inválido. Confira, como nome@example.com.",
    );
  });

  it("não deixa convidar alguém como dono", () => {
    expect(createInviteSchema.safeParse({ spaceId: SPACE_ID, email: "lu@example.com", role: "owner" }).success).toBe(
      false,
    );
  });

  it("aceita só tokens de 32 bytes em base64url", () => {
    const token = Buffer.alloc(32, 1).toString("base64url");
    expect(inviteTokenSchema.safeParse(token).success).toBe(true);
    expect(inviteTokenSchema.safeParse(`${token}x`).success).toBe(false);
    expect(inviteTokenSchema.safeParse("../../etc/passwd").success).toBe(false);
  });
});

describe("espaço", () => {
  it("exige ao menos 2 letras e no máximo 30", () => {
    expect(firstMessage(createSpaceSchema.safeParse({ name: " a " }))).toBe("Dê um nome com pelo menos 2 letras.");
    expect(createSpaceSchema.safeParse({ name: "x".repeat(31) }).success).toBe(false);
    expect(createSpaceSchema.parse({ name: "  Viagem  " })).toEqual({ name: "Viagem" });
  });

  it("recusa id que não é uuid", () => {
    expect(renameSpaceSchema.safeParse({ spaceId: "1 or 1=1", name: "Casa" }).success).toBe(false);
  });

  it("vira fieldErrors no formato das ações", () => {
    const parsed = createSpaceSchema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(zodFailure(parsed.error)).toEqual({
      ok: false,
      error: "Dê um nome com pelo menos 2 letras.",
      fieldErrors: { name: "Dê um nome com pelo menos 2 letras." },
    });
  });
});

describe("preferências e perfil", () => {
  it("aceita atualização parcial com os valores do protótipo", () => {
    expect(updatePreferencesSchema.parse({ accent: "petroleo", notify: { late: false } })).toEqual({
      accent: "petroleo",
      notify: { late: false },
    });
  });

  it("recusa cor, tema ou campo desconhecido", () => {
    expect(updatePreferencesSchema.safeParse({ accent: "roxo" }).success).toBe(false);
    expect(updatePreferencesSchema.safeParse({ theme: "system" }).success).toBe(false);
    expect(updatePreferencesSchema.safeParse({ admin: true }).success).toBe(false);
    expect(updatePreferencesSchema.safeParse({}).success).toBe(false);
  });

  it("perfil: nome com 2 a 40 letras e avatar de qualquer um dos 32 desenhos ou nulo", () => {
    expect(firstMessage(updateProfileSchema.safeParse({ name: "R" }))).toBe(
      "Digite seu nome, com pelo menos 2 letras.",
    );
    expect(updateProfileSchema.parse({ name: " Rafa ", avatar: "a3" })).toEqual({ name: "Rafa", avatar: "a3" });
    expect(updateProfileSchema.parse({ avatar: null })).toEqual({ avatar: null });
    expect(AVATAR_IDS).toHaveLength(32);
    for (const id of AVATAR_IDS) expect(updateProfileSchema.safeParse({ avatar: id }).success).toBe(true);
    expect(updateProfileSchema.parse({ avatar: "b3" })).toEqual({ avatar: "b3" });
    expect(updateProfileSchema.parse({ avatar: "c8" })).toEqual({ avatar: "c8" });
    expect(updateProfileSchema.parse({ avatar: "a16" })).toEqual({ avatar: "a16" });
    expect(updateProfileSchema.safeParse({ avatar: "a17" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ avatar: "data:image/png;base64,AAAA" }).success).toBe(false);
  });
});

describe("push e desfazer", () => {
  it("inscrição precisa de endpoint https de um serviço de push conhecido e chaves em base64url", () => {
    const valid = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      expirationTime: null,
      keys: { p256dh: "BOr6x_y-z", auth: "q1w2e3" },
    };
    expect(savePushSubscriptionSchema.safeParse(valid).success).toBe(true);
    expect(savePushSubscriptionSchema.safeParse({ ...valid, endpoint: "http://fcm.googleapis.com/x" }).success).toBe(
      false,
    );
    for (const endpoint of [
      "https://push.example.com/send/abc",
      "https://127.0.0.1/send",
      "https://localhost/send",
      "https://fcm.googleapis.com:8443/send",
      "https://169.254.169.254/latest/meta-data",
    ]) {
      expect(savePushSubscriptionSchema.safeParse({ ...valid, endpoint }).success).toBe(false);
    }
    expect(savePushSubscriptionSchema.safeParse({ ...valid, keys: { p256dh: "<script>", auth: "x" } }).success).toBe(
      false,
    );
  });

  it("token de desfazer é uuid", () => {
    expect(undoSchema.safeParse({ token: SPACE_ID }).success).toBe(true);
    expect(firstMessage(undoSchema.safeParse({ token: "abc" }))).toBe("Não dá mais para desfazer.");
  });
});
