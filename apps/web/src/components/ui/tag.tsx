import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tagVariants = cva(
  "num inline-flex items-center gap-1 rounded-[0.35rem] px-1.5 py-px align-[1px] text-xs font-medium whitespace-nowrap",
  {
    variants: {
      kind: {
        neutral: "bg-surface3 text-muted",
        late: "bg-warn-soft text-warn",
        installment: "bg-surface3 text-muted",
        annual: "bg-save-soft text-save",
        personal: "bg-surface3 text-muted",
        ok: "bg-in-soft text-in",
        new: "bg-out-soft text-out",
      },
    },
    defaultVariants: { kind: "neutral" },
  },
);

export type TagProps =
  | { kind: "late" | "annual" | "personal"; children?: ReactNode; className?: string }
  | { kind: "installment"; current: number; total: number; className?: string }
  | { kind: "neutral" | "ok" | "new"; children: ReactNode; className?: string };

const DEFAULT_LABEL = { late: "Atrasado", annual: "Anual", personal: "Pessoal" } as const;

function tagText(props: TagProps): ReactNode {
  switch (props.kind) {
    case "installment":
      return `${props.current} de ${props.total}`;
    case "late":
    case "annual":
    case "personal":
      return props.children ?? DEFAULT_LABEL[props.kind];
    default:
      return props.children;
  }
}

/** Etiqueta curta ao lado do nome do lançamento: Atrasado, "5 de 54", Anual, Pessoal. */
export function Tag(props: TagProps) {
  const title = props.kind === "installment" ? `Parcela ${props.current} de ${props.total}` : undefined;
  return (
    <span className={cn(tagVariants({ kind: props.kind }), props.className)} title={title}>
      {title ? <span className="sr-only">Parcela </span> : null}
      {tagText(props)}
    </span>
  );
}
