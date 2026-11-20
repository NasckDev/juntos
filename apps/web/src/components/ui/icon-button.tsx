import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { CountBadge } from "./count-badge";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Nome acessível obrigatório (o botão só tem ícone). Também vira a dica do mouse. */
  label: string;
  icon: ReactNode;
  /** Contador no canto (avisos). O número entra no nome acessível. */
  count?: number;
  size?: "sm" | "md";
  ref?: Ref<HTMLButtonElement>;
}

export function iconButtonLabel(label: string, count: number): string {
  if (count <= 0) return label;
  return `${label}, ${count} ${count === 1 ? "novo" : "novos"}`;
}

export function IconButton({ label, icon, count = 0, size = "md", className, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={iconButtonLabel(label, count)}
      title={label}
      className={cn(
        "hit relative inline-grid shrink-0 place-items-center rounded-field text-muted transition-colors",
        "hover:bg-surface3 hover:text-ink disabled:opacity-50",
        size === "md" ? "size-11 lg:size-9 [&_svg]:size-5" : "size-9 lg:size-8 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {icon}
      <CountBadge count={count} placement="dot" />
    </button>
  );
}
