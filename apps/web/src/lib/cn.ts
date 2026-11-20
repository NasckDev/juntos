import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Tamanhos de letra e raios próprios do tema (globals.css), para o tailwind-merge não confundi-los com cores.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["md", "title", "display", "micro"],
      radius: ["field", "panel", "hero"],
    },
  },
});

/** Junta classes condicionais e resolve conflitos do Tailwind (a última vence). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
