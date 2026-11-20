import { toast } from "sonner";
import { undo } from "@/server/actions/undo";

const UNDO_TOAST_MS = 15_000;

/**
 * Toast com "Desfazer" para ações que o servidor sabe reverter (`undo({ token })`, até 10 minutos).
 * `onRestored` roda depois que o servidor desfez (ex.: voltar para o espaço restaurado).
 */
export function toastWithUndo(message: string, token: string, onRestored?: () => Promise<void> | void): void {
  toast(message, {
    duration: UNDO_TOAST_MS,
    action: {
      label: "Desfazer",
      onClick: () => {
        void (async () => {
          const result = await undo({ token });
          if (!result.ok) return void toast.error(result.error);
          await onRestored?.();
          toast.success("Desfeito.");
        })();
      },
    },
  });
}
