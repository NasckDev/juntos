import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-block min-w-6 rounded-[0.3rem] border border-line2 bg-surface px-1.5 py-1 text-center font-sans text-micro font-semibold text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
