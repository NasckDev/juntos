"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { updateProfile } from "@/server/actions/account";

export interface WelcomeSheetProps {
  userId: string;
  /** Verdadeiro quando a pessoa ainda não escolheu um nome (convidado com o nome padrão). Veja `needsWelcome`. */
  needsName: boolean;
}

const FORM_ID = "boas-vindas";

export function welcomeStorageKey(userId: string): string {
  return `juntos:boas-vindas:${userId}`;
}

function alreadySeen(userId: string): boolean {
  try {
    return localStorage.getItem(welcomeStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(userId: string): void {
  try {
    localStorage.setItem(welcomeStorageKey(userId), "1");
  } catch {
    // Sem localStorage, a folha pode voltar na próxima visita; não há o que fazer.
  }
}

/**
 * Primeira entrada: pergunta "Como podemos chamar você?". Toda conta começa vazia, então não há
 * escolha de dados de exemplo. Fechar sem responder também conta como visto (não insiste).
 */
export function WelcomeSheet({ userId, needsName }: WelcomeSheetProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (needsName && !alreadySeen(userId)) setOpen(true);
  }, [needsName, userId]);

  function close() {
    markSeen(userId);
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await updateProfile({ name });
    setSaving(false);
    if (!result.ok) return setError(result.fieldErrors?.name ?? result.error);
    close();
    toast.success("Prazer em conhecer você!");
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title="Bem-vindo ao Juntos"
      description="Uma pergunta rápida para começar."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Agora não
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon={saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : undefined}
            disabled={saving}
          >
            Começar
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={(event) => void submit(event)}>
        <Field label="Como podemos chamar você?" error={error} hint="Dá para mudar depois em Ajustes, na aba Conta.">
          <Input
            name="name"
            autoComplete="given-name"
            maxLength={40}
            placeholder="Seu nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </form>
    </ResponsiveSheet>
  );
}
