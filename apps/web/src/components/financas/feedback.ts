"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/server/result";

/** Quanto tempo o toast com "Desfazer" fica na tela (6,5 s, como no protótipo). */
const UNDO_TOAST_MS = 6500;
/** Um aviso de ação por vez (como no protótipo): o novo substitui o anterior. */
const ACTION_TOAST_ID = "juntos-acao";

/** Mensagem de erro do servidor num toast. */
export function toastError(message: string): void {
  toast.error(message);
}

/**
 * Toast com "Desfazer" (`act` do protótipo). `undo` roda a ação inversa no servidor; deu certo, avisa
 * "Ação desfeita."; deu errado, mostra o motivo.
 */
export function toastWithUndo(message: string, undo: (() => Promise<ActionResult<unknown>>) | null): void {
  if (!undo) {
    toast(message, { id: ACTION_TOAST_ID, action: undefined });
    return;
  }
  toast(message, {
    id: ACTION_TOAST_ID,
    duration: UNDO_TOAST_MS,
    action: {
      label: "Desfazer",
      onClick: () => {
        void undo().then(
          (result) =>
            result.ok ? toast("Ação desfeita.", { id: ACTION_TOAST_ID, action: undefined }) : toastError(result.error),
          () => toastError("Não foi possível desfazer agora. Tente de novo."),
        );
      },
    },
  });
}
