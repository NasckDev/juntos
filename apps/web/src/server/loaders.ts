import { requireUser } from "./access";
import { readActiveSpaceId } from "./active-space";
import { getDb } from "./db";
import { env, isEmailEnabled, isGoogleEnabled, isPushEnabled } from "./env";
import { assertMember } from "./membership";
import {
  type InvitePreview,
  listMembers,
  type MemberView,
  getInvitePreview as previewInvite,
} from "./services/members";
import { getPreferences, type Preferences } from "./services/preferences";
import { listUserSpaces, type SpaceSummary } from "./services/spaces";
import { ensureUserSetup } from "./services/users";
import { getSession, type SessionUser } from "./session";
import { inviteTokenSchema } from "./validators/members";

/** Recursos opcionais ligados ou desligados pelas variáveis de ambiente (a tela explica o que falta). */
export interface Features {
  readonly google: boolean;
  readonly push: boolean;
  readonly email: boolean;
  /** Chave pública VAPID para `pushManager.subscribe` (nula se o push está desligado). */
  readonly vapidPublicKey: string | null;
}

export function getFeatures(): Features {
  const push = isPushEnabled();
  return {
    google: isGoogleEnabled(),
    push,
    email: isEmailEnabled(),
    vapidPublicKey: push ? (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null) : null,
  };
}

export interface AppContext {
  readonly user: SessionUser;
  readonly spaces: readonly SpaceSummary[];
  /** Espaço do cookie, se a pessoa ainda participa; senão, o primeiro. */
  readonly activeSpace: SpaceSummary;
  readonly preferences: Preferences;
  readonly features: Features;
}

/**
 * Tudo o que o layout autenticado precisa. Retorna `null` sem sessão (a página redireciona para `/entrar`).
 * Garante que a pessoa sempre tem pelo menos um espaço.
 */
export async function getAppContext(): Promise<AppContext | null> {
  const user = await getSession();
  if (!user) return null;
  const db = getDb();
  let spaces = await listUserSpaces(db, user.id);
  if (spaces.length === 0) {
    await ensureUserSetup(db, user.id);
    spaces = await listUserSpaces(db, user.id);
  }
  const wanted = await readActiveSpaceId();
  const activeSpace = spaces.find((space) => space.id === wanted) ?? spaces[0];
  if (!activeSpace) throw new Error("Usuário sem espaço depois de garantir o espaço padrão.");
  return {
    user,
    spaces,
    activeSpace,
    preferences: await getPreferences(db, user.id),
    features: getFeatures(),
  };
}

/** Pessoas do espaço para Ajustes > Pessoas e compartilhamento. Exige ser membro. */
export async function getSpaceMembers(spaceId: string): Promise<MemberView[] | null> {
  const user = await getSession();
  if (!user) return null;
  return listMembers(getDb(), user.id, spaceId);
}

/** Dados do convite para a página `/convite/[token]`, sem consumir o token. Não exige login. */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const parsed = inviteTokenSchema.safeParse(token);
  if (!parsed.success) return { status: "invalid" };
  return previewInvite(getDb(), parsed.data);
}

/** Papel da pessoa no espaço (para esconder botões de quem só vê). Lança `AccessError` se não participa. */
export async function getRoleIn(spaceId: string): Promise<SpaceSummary["role"]> {
  const user = await requireUser();
  return (await assertMember(getDb(), user.id, spaceId, "viewer")).role;
}
