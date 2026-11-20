import { cn } from "@/lib/cn";

/** Marca do Juntos: dois anéis entrelaçados sobre a cor de destaque (acompanha a cor escolhida). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <circle cx="12.5" cy="16" r="5.6" fill="none" stroke="var(--brand-ink)" strokeWidth="2.6" />
      <circle cx="19.5" cy="16" r="5.6" fill="none" stroke="var(--brand-ink)" strokeWidth="2.6" opacity=".72" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-lg font-bold tracking-[-0.02em]", className)}>
      <LogoMark />
      Juntos
    </span>
  );
}
