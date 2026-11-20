"use client";

import { useSyncExternalStore } from "react";

/** Mesmo ponto de troca da casca (barra lateral) e do ResponsiveSheet: `lg` do Tailwind, 1024 px. */
export const DESKTOP_QUERY = "(min-width: 64rem)";

/**
 * Lê uma media query no cliente. No servidor e na hidratação devolve `serverValue`
 * (padrão `false`: o app é mobile-first).
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
