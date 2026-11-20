import { cn } from "@/lib/cn";

export interface CountBadgeProps {
  count: number;
  /** Acima disso mostra "99+". */
  max?: number;
  /** "dot" fica no canto de um botão de ícone; "inline" fica ao lado de um texto. */
  placement?: "dot" | "inline";
  className?: string;
}

/** Contador vermelho. É decorativo: quem usa diz o número no nome acessível do controle. */
export function CountBadge({ count, max = 99, placement = "inline", className }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "num inline-grid h-5 min-w-5 place-items-center rounded-full bg-out px-1.5 text-micro font-bold text-white",
        placement === "dot" && "absolute -top-0.5 -right-0.5 shadow-[0_0_0_2px_var(--side)]",
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
