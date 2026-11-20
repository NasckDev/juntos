import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface HideValueProps {
  children: ReactNode;
  className?: string;
}

/**
 * Envolve qualquer valor em dinheiro. Com "esconder valores" ligado (`data-hide="true"` no `<html>`)
 * o valor fica desfocado, sem mudar o layout.
 */
export function HideValue({ children, className }: HideValueProps) {
  return <span className={cn("hv num", className)}>{children}</span>;
}
