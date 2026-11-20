"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import { IconButton } from "./icon-button";
import { DESKTOP_QUERY, useMediaQuery } from "./use-media-query";

export interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Botões de ação. Ficam fixos no rodapé (Cancelar à esquerda, ação principal à direita). */
  footer?: ReactNode;
  /** Elemento que abre o painel (opcional; pode abrir só pelo `open`). */
  trigger?: ReactNode;
  className?: string;
}

/**
 * Formulários e detalhes: painel lateral à direita no computador (Radix Dialog) e folha de baixo no celular (vaul).
 * Os dois prendem o foco, fecham com Esc e devolvem o foco a quem abriu.
 */
export function ResponsiveSheet(props: ResponsiveSheetProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  return isDesktop ? <SidePanel {...props} /> : <BottomSheet {...props} />;
}

function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  className,
}: ResponsiveSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(10,11,15,.42)] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(28rem,100vw)] flex-col border-l border-line bg-surface shadow-pop outline-none",
            "data-[state=closed]:animate-panel-out data-[state=open]:animate-panel-in",
            className,
          )}
        >
          <header className="flex items-start gap-3 border-b border-line px-6 py-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-xl font-semibold tracking-[-0.02em]">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Fechar" icon={<X />} className="-mt-1 -mr-2" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  className,
}: ResponsiveSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false} autoFocus>
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgba(10,11,15,.42)]" />
        <Drawer.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.25rem] bg-surface outline-none",
            className,
          )}
        >
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line2" />
          <header className="flex items-start gap-3 px-4 pt-3 pb-2">
            <div className="min-w-0 flex-1">
              <Drawer.Title className="text-xl font-semibold tracking-[-0.02em]">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-1 text-sm text-muted">{description}</Drawer.Description>
              ) : null}
            </div>
            <Drawer.Close asChild>
              <IconButton label="Fechar" icon={<X />} className="-mt-1 -mr-1" />
            </Drawer.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
          {footer ? (
            <footer className="pb-safe grid auto-cols-fr grid-flow-col gap-2 border-t border-line px-4 pt-3 [&>*]:mb-3">
              {footer}
            </footer>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
