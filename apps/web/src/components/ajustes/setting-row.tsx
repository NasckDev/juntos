import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SettingRowProps {
  title: ReactNode;
  description?: ReactNode;
  /** Botão ou controle à direita. */
  action?: ReactNode;
  className?: string;
}

/** Linha de Ajustes: título e explicação à esquerda, ação à direita (`conn` do protótipo). */
export function SettingRow({ title, description, action, className }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <b className="block font-semibold">{title}</b>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
