"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Period } from "@/lib/finance";
import { registerSettlement, unsettle } from "@/server/actions/settlements";
import { undo } from "@/server/actions/undo";
import { toastError, toastWithUndo } from "../financas/feedback";
import { useFinanceUi } from "../financas/finance-context";

/** "Registrar acerto": o servidor refaz a conta do período e grava os movimentos; o toast tem "Desfazer". */
export function RegisterSettlementButton({ spaceId, period }: { spaceId: string; period: Period }) {
  const { canEdit } = useFinanceUi();
  const [pending, startTransition] = useTransition();
  if (!canEdit) return null;

  function register() {
    startTransition(async () => {
      const result = await registerSettlement({ spaceId, start: period.start, span: period.span });
      if (!result.ok) return toastError(result.error);
      const ids = [...result.data.ids];
      toastWithUndo("Acerto registrado.", () => unsettle({ spaceId, ids }));
    });
  }

  return (
    <Button variant="line" icon={<Check />} disabled={pending} onClick={register}>
      Registrar acerto
    </Button>
  );
}

/** "Desfazer" de um acerto da lista; o toast permite voltar atrás por 10 minutos. */
export function UnsettleButton({ spaceId, id, label }: { spaceId: string; id: string; label: string }) {
  const { canEdit } = useFinanceUi();
  const [pending, startTransition] = useTransition();
  if (!canEdit) return null;

  function remove() {
    startTransition(async () => {
      const result = await unsettle({ spaceId, ids: [id] });
      if (!result.ok) return toastError(result.error);
      const { token } = result.data.undo;
      toastWithUndo("Acerto desfeito.", () => undo({ token }));
    });
  }

  return (
    <Button variant="ghost" size="sm" aria-label={`Desfazer acerto: ${label}`} disabled={pending} onClick={remove}>
      Desfazer
    </Button>
  );
}
