import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: ReactNode;
  /** "Casa, novembro 2026". */
  subtitle?: ReactNode;
  /** Seletor de mês (`MonthPicker`). No celular ocupa a largura toda embaixo do título. */
  month?: ReactNode;
  /** Botões da página ("+ Entrada", "Exportar"). */
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho das telas: título e subtítulo à esquerda; seletor de mês e ações à direita no computador. */
export function PageHeader({ title, subtitle, month, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn("mb-5 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-6", className)}
    >
      <div className="min-w-0">
        <h1 className="text-title font-[650] tracking-[-0.03em] lg:text-[1.875rem]">{title}</h1>
        {subtitle ? <p className="mt-1 text-md text-muted lg:text-base">{subtitle}</p> : null}
      </div>
      {month || actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
          {month ? <div className="flex min-w-0 flex-1 lg:flex-none">{month}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
