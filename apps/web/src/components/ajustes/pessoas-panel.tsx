"use client";

import { Check, Copy, LoaderCircle, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tag } from "@/components/ui/tag";
import { changeMemberRole, createInvite, type InviteCreated, removeMember } from "@/server/actions/members";
import type { MemberView } from "@/server/services/members";
import { formatLongDate } from "./format-date";
import { SpaceSettings } from "./space-settings";

export interface PessoasPanelProps {
  space: { id: string; name: string; role: "owner" | "editor" | "viewer" };
  members: readonly MemberView[];
  /** Quantos espaços a pessoa tem (não dá para excluir o último). */
  spaceCount: number;
}

const ROLE_OPTIONS = [
  { value: "editor", label: "Pode editar" },
  { value: "viewer", label: "Só vê" },
] as const;

type EditableRole = (typeof ROLE_OPTIONS)[number]["value"];

function roleLabel(role: MemberView["role"]): string {
  return role === "owner" ? "Dono" : role === "editor" ? "Pode editar" : "Só vê";
}

function InviteResult({ invite }: { invite: InviteCreated }) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      input.current?.select();
      toast("Não foi possível copiar sozinho. O link está selecionado: copie com Ctrl+C.");
    }
  }

  return (
    <div role="status" className="mt-4 rounded-field bg-brand-soft p-4">
      <b className="block text-brand-text">Convite criado para {invite.email}</b>
      <p className="mt-1 text-sm text-muted">
        {invite.emailSent ? "Também enviamos o link por e-mail. " : "Copie o link e envie para a pessoa. "}
        Ele vale até {formatLongDate(invite.expiresAt.toISOString())} e só pode ser usado uma vez.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          ref={input}
          readOnly
          value={invite.inviteUrl}
          aria-label="Link do convite"
          onFocus={(e) => e.target.select()}
        />
        <Button variant="line" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

/** Ajustes > Pessoas e compartilhamento: membros, papéis, convite por e-mail e configurações do espaço. */
export function PessoasPanel({ space, members: initialMembers, spaceCount }: PessoasPanelProps) {
  const isOwner = space.role === "owner";
  const [members, setMembers] = useState<readonly MemberView[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("editor");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState<InviteCreated | null>(null);
  const [toRemove, setToRemove] = useState<MemberView | null>(null);

  useEffect(() => setMembers(initialMembers), [initialMembers]);

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true);
    setEmailError(null);
    setInvite(null);
    const result = await createInvite({ spaceId: space.id, email, role });
    setInviting(false);
    if (!result.ok) return setEmailError(result.fieldErrors?.email ?? result.error);
    setInvite(result.data);
    setEmail("");
  }

  async function setMemberRole(member: MemberView, next: EditableRole) {
    const previous = members;
    setMembers(members.map((m) => (m.id === member.id ? { ...m, role: next } : m)));
    const result = await changeMemberRole({ spaceId: space.id, memberId: member.id, role: next });
    if (!result.ok) {
      setMembers(previous);
      toast.error(result.error);
    }
  }

  async function remove(member: MemberView) {
    const result = await removeMember({ spaceId: space.id, memberId: member.id });
    if (!result.ok) return void toast.error(result.error);
    setMembers((list) => list.filter((m) => m.id !== member.id));
    toast(member.status === "invited" ? "Convite cancelado." : "Pessoa removida do espaço.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6">
      <Card>
        <CardHeader title={`Pessoas em “${space.name}”`} />
        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0">
              <Avatar name={member.name} avatar={member.avatar} size="md" decorative />
              <div className="min-w-0 flex-1">
                <b className="block truncate font-semibold">
                  {member.name}
                  {member.isYou ? " (você)" : ""}
                </b>
                {member.status === "invited" ? (
                  <small className="block text-sm text-muted">
                    Convite enviado, aguardando resposta
                    {member.inviteExpiresAt
                      ? ` · vale até ${formatLongDate(member.inviteExpiresAt.toISOString())}`
                      : ""}
                  </small>
                ) : member.email ? (
                  <small className="block truncate text-sm text-muted">{member.email}</small>
                ) : null}
              </div>
              {member.role === "owner" ? (
                <Tag kind="neutral">Dono</Tag>
              ) : isOwner ? (
                <>
                  <Select
                    aria-label={`Permissão de ${member.name}`}
                    className="w-36"
                    options={ROLE_OPTIONS}
                    value={member.role}
                    onChange={(event) => void setMemberRole(member, event.target.value as EditableRole)}
                  />
                  <IconButton
                    label={`${member.status === "invited" ? "Cancelar convite de" : "Remover"} ${member.name}`}
                    icon={<X />}
                    onClick={() => (member.status === "invited" ? void remove(member) : setToRemove(member))}
                  />
                </>
              ) : (
                <Tag kind="neutral">{roleLabel(member.role)}</Tag>
              )}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <form noValidate onSubmit={(event) => void submitInvite(event)} className="mt-5 border-t border-line pt-5">
            <h3 className="mb-3 text-md font-semibold">Convidar pessoa</h3>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Field label="E-mail" error={emailError}>
                <Input
                  type="email"
                  name="email"
                  autoComplete="off"
                  placeholder="nome@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Permissão">
                <Select
                  name="role"
                  options={ROLE_OPTIONS}
                  value={role}
                  onChange={(event) => setRole(event.target.value as EditableRole)}
                />
              </Field>
            </div>
            <Button
              type="submit"
              className="mt-4"
              icon={inviting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : undefined}
              disabled={inviting}
            >
              Criar convite
            </Button>
            {invite ? <InviteResult invite={invite} /> : null}
          </form>
        ) : (
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            Só o dono do espaço convida pessoas e muda permissões.
          </p>
        )}
      </Card>

      <SpaceSettings space={space} spaceCount={spaceCount} />

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={`Remover ${toRemove?.name ?? "a pessoa"}?`}
        description={`A pessoa perde o acesso a “${space.name}”. Os lançamentos que ela pagou continuam na divisão.`}
        confirmLabel="Remover do espaço"
        tone="danger"
        onConfirm={() => {
          if (toRemove) void remove(toRemove);
        }}
      />
    </div>
  );
}
