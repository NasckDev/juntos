import { cn } from "@/lib/cn";

/** Bloco de carregamento. Use dentro de um contêiner com `aria-busy="true"` e um texto para leitor de tela. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface3", className)} />;
}
