"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/cn";
import { createSpace, switchSpace } from "@/server/actions/spaces";

export interface SpacesSheetSpace {
  id: string;
  name: string;
  /** Pessoas ativas no espaço; sem o número, o subtítulo não aparece. */
  memberCount?: number;
}

export interface SpacesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Espaços de que a pessoa participa (`getAppContext().spaces`). */
  spaces: readonly SpacesSheetSpace[];
  /** Espaço atual (`getAppContext().activeSpace.id`): aparece marcado. */
  activeSpaceId: string;
}

const FORM_ID = "criar-espaco";

function subtitle(count: number | undefined): string | null {
  if (count === undefined) return null;
  return count > 1 ? `${count} pessoas` : "Privado, só você";
}

/** "Seus espaços" (`wsDlg` do protótipo): trocar de espaço e criar um novo. */
export function SpacesSheet({ open, onOpenChange, spaces, activeSpaceId }: SpacesSheetProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function choose(spaceId: string) {
    if (spaceId === activeSpaceId) return onOpenChange(false);
    setPendingId(spaceId);
    const result = await switchSpace({ spaceId });
    setPendingId(null);
    if (!result.ok) return void toast.error(result.error);
    onOpenChange(false);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const result = await createSpace({ name });
    setCreating(false);
    if (!result.ok) return setError(result.fieldErrors?.name ?? result.error);
    setName("");
    onOpenChange(false);
    toast.success("Espaço criado.");
    router.push("/inicio");
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Seus espaços"
      description="Cada espaço tem suas contas, metas e pessoas."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon={creating ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : undefined}
            disabled={creating}
          >
            Criar espaço
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {spaces.map((space) => {
          const active = space.id === activeSpaceId;
          const sub = subtitle(space.memberCount);
          return (
            <li key={space.id}>
              <button
                type="button"
                aria-current={active}
                disabled={pendingId !== null}
                onClick={() => void choose(space.id)}
                className={cn(
                  "hit flex w-full items-center gap-3 rounded-field p-3 text-left shadow-[inset_0_0_0_1px_var(--line2)] transition-shadow",
                  "hover:bg-surface2 aria-[current=true]:bg-brand-soft aria-[current=true]:shadow-[inset_0_0_0_2px_var(--brand)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-[0.6rem] bg-brand font-bold text-brand-ink"
                >
                  {space.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{space.name}</b>
                  {sub ? <span className="block text-sm text-muted">{sub}</span> : null}
                </span>
                {pendingId === space.id ? (
                  <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-muted" />
                ) : active ? (
                  <>
                    <Check aria-hidden="true" className="size-5 text-brand-text" />
                    <span className="sr-only">Espaço atual</span>
                  </>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <form id={FORM_ID} noValidate onSubmit={(event) => void create(event)} className="mt-6">
        <Field label="Criar um espaço novo" error={error}>
          <Input
            name="name"
            maxLength={30}
            placeholder="Ex.: reforma, viagem"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </form>
    </ResponsiveSheet>
  );
}
