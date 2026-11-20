"use client";

import { Info, LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Avatar, type AvatarKey, AvatarPicker } from "@/components/ui/avatar";
import { isAvatarKey } from "@/components/ui/avatar-art";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInWithGoogle, signOut } from "@/lib/auth-client";
import { cancelAccountDeletion, requestAccountDeletion, updateProfile } from "@/server/actions/account";
import { formatLongDate } from "./format-date";
import { SettingRow } from "./setting-row";

export interface ContaPanelProps {
  name: string;
  /** Nulo no convidado. */
  email: string | null;
  avatar: string | null;
  isGuest: boolean;
  googleEnabled: boolean;
  /** Voltou do Google com erro (`?erro=google`). */
  googleFailed?: boolean;
  /** Data (ISO) em que a conta será apagada, se a exclusão já foi pedida. */
  deleteAfter: string | null;
}

const GOOGLE_ERROR = "Não foi possível entrar com o Google. Tente de novo em instantes.";

/** Ajustes > Conta: nome, avatar, Google, baixar dados, sair e excluir a conta (carência de 30 dias). */
export function ContaPanel({
  name: initialName,
  email,
  avatar: initialAvatar,
  isGuest,
  googleEnabled,
  googleFailed = false,
  deleteAfter: initialDeleteAfter,
}: ContaPanelProps) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [avatar, setAvatar] = useState<AvatarKey | null>(isAvatarKey(initialAvatar) ? initialAvatar : null);
  const [deleteAfter, setDeleteAfter] = useState<string | null>(initialDeleteAfter);
  const [confirm, setConfirm] = useState<"signout" | "delete" | null>(null);
  const [busy, setBusy] = useState<"google" | "signout" | "deletion" | null>(null);
  const [error, setError] = useState<string | null>(googleFailed ? GOOGLE_ERROR : null);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingName(true);
    setNameError(null);
    const result = await updateProfile({ name });
    setSavingName(false);
    if (!result.ok) return setNameError(result.fieldErrors?.name ?? result.error);
    setSavedName(name.trim());
    setName(name.trim());
    toast.success("Dados salvos.");
  }

  async function pickAvatar(next: AvatarKey | null) {
    const previous = avatar;
    setAvatar(next);
    const result = await updateProfile({ avatar: next });
    if (!result.ok) {
      setAvatar(previous);
      toast.error(result.error);
    }
  }

  async function linkGoogle() {
    setBusy("google");
    setError(null);
    try {
      const result = await signInWithGoogle("/ajustes", "/ajustes?erro=google");
      if (!result.ok) throw new Error(result.error);
    } catch {
      setError(GOOGLE_ERROR);
      setBusy(null);
    }
  }

  async function leave() {
    setBusy("signout");
    const result = await signOut();
    if (!result.ok) {
      setBusy(null);
      return setError(result.error);
    }
    // Navegação completa: limpa o cache do app e a sessão em memória.
    window.location.assign("/entrar");
  }

  async function requestDeletion() {
    setBusy("deletion");
    const result = await requestAccountDeletion();
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    setDeleteAfter(result.data.deleteAfter.toISOString());
    toast("Exclusão agendada. Dá para desistir até a data.");
  }

  async function cancelDeletion() {
    setBusy("deletion");
    const result = await cancelAccountDeletion();
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    setDeleteAfter(null);
    toast.success("Exclusão cancelada. Sua conta continua como estava.");
  }

  const spinner = <LoaderCircle aria-hidden="true" className="animate-spin" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6">
      <Card>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={savedName} avatar={avatar} size="xl" />
          <div className="min-w-0">
            <b className="block truncate text-lg">{savedName}</b>
            <span className="text-sm text-muted">
              {isGuest ? "Conta de convidado, sem login" : `${email ?? ""}, login com Google`}
            </span>
          </div>
        </div>

        <form noValidate onSubmit={(event) => void saveName(event)} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={nameError}>
            <Input
              name="name"
              autoComplete="name"
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="E-mail"
            hint={
              isGuest ? "O convidado não tem e-mail. Entre com o Google para ter um." : "Vem da sua conta do Google."
            }
          >
            <Input name="email" readOnly value={email ?? ""} placeholder="Sem e-mail" />
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              icon={savingName ? spinner : undefined}
              disabled={savingName || name.trim() === savedName}
            >
              Salvar
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 text-md font-semibold">Avatar</h3>
          <AvatarPicker name={savedName} value={avatar} onValueChange={(next) => void pickAvatar(next)} />
        </div>
      </Card>

      <Card>
        {deleteAfter ? (
          <div role="status" className="mb-4 rounded-field bg-out-soft p-4 text-sm text-out">
            <b className="block">Sua conta será apagada em {formatLongDate(deleteAfter)}.</b>
            <span className="mt-1 block">Até lá, dá para desistir.</span>
            <Button
              variant="line"
              size="sm"
              className="mt-3"
              icon={busy === "deletion" ? spinner : undefined}
              disabled={busy !== null}
              onClick={() => void cancelDeletion()}
            >
              Cancelar exclusão
            </Button>
          </div>
        ) : null}

        {isGuest ? (
          googleEnabled ? (
            <SettingRow
              title="Entrar com Google"
              description="Guarda seus dados na sua conta e deixa entrar de outro aparelho."
              action={
                <Button
                  size="sm"
                  icon={busy === "google" ? spinner : undefined}
                  disabled={busy !== null}
                  onClick={() => void linkGoogle()}
                >
                  Entrar
                </Button>
              }
            />
          ) : (
            <p className="mb-4 flex gap-2.5 rounded-field bg-surface2 p-3.5 text-sm text-muted">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>O login com Google ainda não foi configurado neste ambiente.</span>
            </p>
          )
        ) : null}

        <SettingRow
          title="Baixar meus dados"
          description="Um arquivo com tudo o que você lançou."
          action={
            <Button asChild variant="ghost" size="sm">
              <a href="/api/conta/exportar" download>
                Baixar
              </a>
            </Button>
          }
        />
        <SettingRow
          title="Sair da conta"
          description={isGuest ? "Sem o Google, você não consegue voltar a estes dados." : "Os dados continuam salvos."}
          action={
            <Button
              variant="line"
              size="sm"
              disabled={busy !== null}
              onClick={() => (isGuest ? setConfirm("signout") : void leave())}
            >
              Sair
            </Button>
          }
        />
        {deleteAfter ? null : (
          <SettingRow
            title="Excluir conta"
            description="Apaga seus dados depois de 30 dias. Até lá, dá para desistir."
            action={
              <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => setConfirm("delete")}>
                Excluir
              </Button>
            }
          />
        )}
        {error ? (
          <p role="alert" className="mt-4 rounded-field bg-out-soft p-3 text-sm font-medium text-out">
            {error}
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirm === "signout"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Sair como convidado?"
        description="Sem uma conta do Google, você não consegue voltar a estes dados. Entre com o Google antes se quiser guardá-los."
        confirmLabel="Sair mesmo assim"
        tone="danger"
        onConfirm={() => void leave()}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Excluir sua conta?"
        description="Em 30 dias, sua conta e os espaços em que só você participa serão apagados de vez. Nos espaços compartilhados, a posse passa para outra pessoa. Até lá, você pode desistir aqui em Ajustes."
        confirmLabel="Agendar exclusão"
        tone="danger"
        onConfirm={() => void requestDeletion()}
      />
    </div>
  );
}
