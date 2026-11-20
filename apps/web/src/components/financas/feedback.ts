"use client";

import { type Action, type ToastT, toast } from "sonner";
import type { ActionResult } from "@/server/result";

/** Duração do aviso simples (a mesma padrão do sonner). */
const ACTION_TOAST_MS = 4000;
/** Quanto tempo o toast com "Desfazer" fica na tela (6,5 s, como no protótipo). */
const UNDO_TOAST_MS = 6500;

/*
 * Um aviso de ação por vez (como no protótipo): enquanto o aviso anterior está na tela, o novo toma o lugar dele
 * (mesmo id, sem dois toasts empilhados). Quando o anterior já saiu ou está saindo (fechado, expirado ou depois de
 * tocar na ação), o novo ganha um id próprio: atualizar pelo mesmo id um toast em animação de saída fazia o aviso
 * novo sumir junto com ele (ex.: "Acerto desfeito." não aparecia).
 */
let liveActionToast: string | number | null = null;

function forget(shown: ToastT): void {
  if (liveActionToast === shown.id) liveActionToast = null;
}

function showActionToast(message: string, duration: number, action?: Action): void {
  liveActionToast = toast(message, {
    ...(liveActionToast === null ? {} : { id: liveActionToast }),
    duration,
    // `undefined` também apaga o "Desfazer" do aviso anterior quando este toma o lugar dele.
    action,
    onDismiss: forget,
    onAutoClose: forget,
  });
}

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
    showActionToast(message, ACTION_TOAST_MS);
    return;
  }
  showActionToast(message, UNDO_TOAST_MS, {
    label: "Desfazer",
    onClick: () => {
      // Tocar na ação fecha o toast sem passar por `onDismiss`: o próximo aviso precisa de um toast novo.
      liveActionToast = null;
      void undo().then(
        (result) => (result.ok ? showActionToast("Ação desfeita.", ACTION_TOAST_MS) : toastError(result.error)),
        () => toastError("Não foi possível desfazer agora. Tente de novo."),
      );
    },
  });
}
