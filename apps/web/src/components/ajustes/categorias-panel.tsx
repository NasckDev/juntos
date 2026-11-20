"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Tag } from "@/components/ui/tag";
import { deleteCategory } from "@/server/actions/categories";
import { undo } from "@/server/actions/undo";
import type { CategoryView } from "@/server/services/finance-types";
import { CategoryIcon } from "../financas/category-icon";
import { toastError, toastWithUndo } from "../financas/feedback";
import { CategoryFormSheet } from "../planejamento/category-form-sheet";
import { ViewerNote } from "../planejamento/viewer-note";

const GROUPS = [
  { kind: "out", title: "Saídas" },
  { kind: "in", title: "Entradas" },
  { kind: "save", title: "Guardado" },
] as const;

export interface CategoriasPanelProps {
  readonly spaceId: string;
  readonly categories: readonly CategoryView[];
  readonly canEdit: boolean;
}

/** Aba Categorias de Ajustes (`vAjustes` do protótipo): as padrão (globais) e as do espaço, que se pode criar e excluir. */
export function CategoriasPanel({ spaceId, categories, canEdit }: CategoriasPanelProps) {
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete(category: CategoryView) {
    startTransition(async () => {
      const result = await deleteCategory({ spaceId, id: category.id });
      if (!result.ok) return toastError(result.error);
      toastWithUndo("Categoria excluída.", () => undo({ token: result.data.undo.token }));
    });
  }

  return (
    <>
      {canEdit ? null : <ViewerNote />}
      <Card aria-labelledby="cats-t" className="max-w-3xl">
        <CardHeader
          title="Suas categorias"
          titleId="cats-t"
          description="As padrão valem para todos os espaços. As suas aparecem só neste. Ao excluir uma sua, o que estava nela vai para “Outros”, “Renda extra” ou “Reserva”."
          action={
            canEdit ? (
              <Button variant="line" size="sm" icon={<Plus />} onClick={() => setCreating(true)}>
                Nova categoria
              </Button>
            ) : null
          }
        />
        {GROUPS.map(({ kind, title }) => (
          <section key={kind} aria-label={title} className="mt-4 first:mt-0">
            <h3 className="mb-1 text-sm font-semibold text-muted">{title}</h3>
            <ul>
              {categories
                .filter((category) => category.kind === kind)
                .map((category) => (
                  <li
                    key={category.id}
                    className="flex min-h-14 items-center gap-3 border-t border-line py-2 first:border-t-0"
                  >
                    <CategoryIcon icon={category.icon} hue={category.hue} />
                    <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
                    {category.key !== null ? (
                      <Tag kind="neutral">Padrão</Tag>
                    ) : canEdit ? (
                      <IconButton
                        label={`Excluir ${category.name}`}
                        icon={<Trash2 />}
                        disabled={pending}
                        onClick={() => handleDelete(category)}
                      />
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </Card>
      {creating ? <CategoryFormSheet open onOpenChange={setCreating} spaceId={spaceId} /> : null}
    </>
  );
}
