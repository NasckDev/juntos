"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  /** Texto do botão de ação: diga o que acontece ("Excluir conta fixa"), nunca "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` para ações sem desfazer. */
  tone?: "primary" | "danger";
  onConfirm: () => void;
}

/**
 * Confirmação só para o que não tem desfazer (excluir conta, sair do espaço).
 * O resto usa o toast com "Desfazer", como no protótipo.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "primary",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-[rgba(10,11,15,.42)] data-[state=open]:animate-fade-in" />
        <AlertDialog.Content
          className={cn(
            "fixed z-50 bg-surface shadow-pop outline-none data-[state=open]:animate-pop-in",
            "inset-x-0 bottom-0 rounded-t-[1.25rem] px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
            "lg:inset-auto lg:top-1/2 lg:left-1/2 lg:w-[min(26rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-panel lg:p-6",
          )}
        >
          <AlertDialog.Title className="text-xl font-semibold tracking-[-0.02em]">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-muted">{description}</AlertDialog.Description>
          <div className="mt-6 grid grid-cols-2 gap-2 lg:flex lg:justify-end">
            <AlertDialog.Cancel className={buttonVariants({ variant: "ghost" })}>{cancelLabel}</AlertDialog.Cancel>
            <AlertDialog.Action
              className={buttonVariants({ variant: tone === "danger" ? "danger" : "primary" })}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
