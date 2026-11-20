"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteSpace, renameSpace, switchSpace } from "@/server/actions/spaces";
import { toastWithUndo } from "./undo-toast";

export interface SpaceSettingsProps {
  space: { id: string; name: string; role: "owner" | "editor" | "viewer" };
  spaceCount: number;
}

/** Renomear e excluir o espaço (só o dono). Excluir tem "Desfazer" por 10 minutos. */
export function SpaceSettings({ space, spaceCount }: SpaceSettingsProps) {
  const isOwner = space.role === "owner";
  const [name, setName] = useState(space.name);
  const [savedName, setSavedName] = useState(space.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await renameSpace({ spaceId: space.id, name });
    setSaving(false);
    if (!result.ok) return setError(result.fieldErrors?.name ?? result.error);
    setSavedName(result.data.name);
    setName(result.data.name);
    toast.success("Espaço atualizado.");
  }

  async function remove() {
    setDeleting(true);
    const deletedId = space.id;
    const result = await deleteSpace({ spaceId: deletedId });
    setDeleting(false);
    if (!result.ok) return void toast.error(result.error);
    toastWithUndo("Espaço excluído.", result.data.undo.token, async () => {
      await switchSpace({ spaceId: deletedId });
    });
  }

  if (!isOwner) {
    return (
      <Card>
        <CardHeader title="Este espaço" />
        <p className="text-sm text-muted">Só o dono pode renomear ou excluir o espaço.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Este espaço" />
      <form noValidate onSubmit={(event) => void save(event)}>
        <Field label="Nome" error={error}>
          <Input name="name" maxLength={30} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="submit"
            icon={saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : undefined}
            disabled={saving || name.trim() === savedName}
          >
            Salvar
          </Button>
          <Button variant="danger" disabled={deleting || spaceCount < 2} onClick={() => void remove()}>
            Excluir espaço
          </Button>
        </div>
        {spaceCount < 2 ? (
          <p className="mt-3 text-sm text-muted">
            Você precisa ter pelo menos um espaço. Crie outro antes de excluir este.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">Dá para desfazer a exclusão por 10 minutos.</p>
        )}
      </form>
    </Card>
  );
}
