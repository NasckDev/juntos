import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const cardVariants = cva("min-w-0", {
  variants: {
    tone: {
      panel: "rounded-panel border border-line bg-surface",
      hero: "rounded-hero bg-hero text-hero-ink",
      flat: "rounded-panel bg-surface3/70",
    },
    pad: { none: "", md: "p-5 lg:p-6", sm: "p-4" },
  },
  defaultVariants: { tone: "panel", pad: "md" },
});

export interface CardProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof cardVariants> {
  /** `section` com `aria-labelledby` vira uma região nomeada. */
  as?: "section" | "div" | "article";
}

/** Painel no chão: borda fina, sem sombra. `tone="hero"` é o resumo do mês (um por tela). */
export function Card({ as: Tag = "section", tone, pad, className, ...props }: CardProps) {
  return <Tag className={cn(cardVariants({ tone, pad }), className)} {...props} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  /** id do título, para o `aria-labelledby` do card. */
  titleId?: string;
  description?: ReactNode;
  /** Link ou botão à direita ("Ver todos"). */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, titleId, description, action, className }: CardHeaderProps) {
  return (
    <header className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
