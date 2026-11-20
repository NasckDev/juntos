"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

export interface CommandPaletteItem {
  id: string;
  label: string;
  /** Texto menor à direita ("Novembro 2026, R$ 86,00"). */
  hint?: string;
  icon?: ReactNode;
  /** Palavras extras para a busca. */
  keywords?: string[];
  /** Atalho mostrado à direita ("N"). */
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandPaletteGroup {
  heading: string;
  items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly CommandPaletteGroup[];
  /** Texto digitado, se a tela quiser buscar lançamentos no servidor. */
  search?: string;
  onSearchChange?: (search: string) => void;
  /** Liga Ctrl/⌘+K e "/" para abrir (padrão: sim). */
  enableShortcut?: boolean;
  placeholder?: string;
  emptyText?: string;
  /** Mostra "Buscando…" no lugar da lista vazia. */
  isLoading?: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Busca Ctrl/⌘+K: ações, páginas e lançamentos, com setas e Enter. Os itens chegam por props. */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  search,
  onSearchChange,
  enableShortcut = true,
  placeholder = "Buscar ações, páginas e lançamentos",
  emptyText = "Nada encontrado.",
  isLoading = false,
}: CommandPaletteProps) {
  useEffect(() => {
    if (!enableShortcut) return;
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      } else if (event.key === "/" && !mod && !open && !isTyping(event.target)) {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut, open, onOpenChange]);

  const inputProps = {
    ...(search === undefined ? {} : { value: search }),
    ...(onSearchChange ? { onValueChange: onSearchChange } : {}),
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(10,11,15,.42)] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-surface shadow-pop outline-none data-[state=open]:animate-pop-in",
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[1.25rem]",
            "lg:inset-x-auto lg:top-[12vh] lg:bottom-auto lg:left-1/2 lg:max-h-[70vh] lg:w-[min(38rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:rounded-panel",
          )}
        >
          <Dialog.Title className="sr-only">Buscar</Dialog.Title>
          <Command label="Buscar" loop className="flex min-h-0 flex-col">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search aria-hidden="true" className="size-5 shrink-0 text-muted" />
              <Command.Input
                placeholder={placeholder}
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                {...inputProps}
              />
              <Kbd className="hidden lg:inline-block">Esc</Kbd>
            </div>
            <Command.List className="pb-safe min-h-0 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-muted">
                {isLoading ? "Buscando…" : emptyText}
              </Command.Empty>
              {groups.map((group) =>
                group.items.length === 0 ? null : (
                  <Command.Group
                    key={group.heading}
                    heading={group.heading}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted"
                  >
                    {group.items.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`${item.id} ${item.label}`}
                        keywords={item.keywords ?? []}
                        onSelect={() => {
                          onOpenChange(false);
                          item.onSelect();
                        }}
                        className={cn(
                          "flex min-h-12 cursor-pointer items-center gap-3 rounded-field px-3 text-md lg:min-h-10",
                          "data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand-text [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
                        )}
                      >
                        {item.icon ? <span className="text-muted">{item.icon}</span> : null}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.hint ? <span className="hv num shrink-0 text-sm text-muted">{item.hint}</span> : null}
                        {item.shortcut ? <Kbd>{item.shortcut}</Kbd> : null}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ),
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
