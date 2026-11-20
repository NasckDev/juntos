"use client";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

/** Atalhos de teclado (`A.keys` do protótipo). */
const SHORTCUTS = [
  { keys: ["N"], label: "Novo lançamento" },
  { keys: ["/"], label: "Buscar lançamentos" },
  { keys: ["Ctrl", "K"], label: "Buscar ações, páginas e lançamentos" },
  { keys: ["←", "→"], label: "Mês anterior e próximo" },
  { keys: ["?"], label: "Mostrar esta lista" },
  { keys: ["Esc"], label: "Fechar janelas" },
] as const;

export function ShortcutsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Atalhos de teclado"
      footer={
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      }
    >
      <dl className="flex flex-col">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="flex min-h-12 items-center gap-4 border-t border-line first:border-t-0">
            <dt className="flex w-24 shrink-0 gap-1">
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dt>
            <dd className="m-0">{shortcut.label}</dd>
          </div>
        ))}
      </dl>
    </ResponsiveSheet>
  );
}
