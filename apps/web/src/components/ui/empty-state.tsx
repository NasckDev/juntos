import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type EmptyArt = "start" | "list" | "search" | "goal" | "chart" | "bell";

export interface EmptyStateProps {
  art: EmptyArt;
  title: string;
  /** O que fazer agora, em uma frase. */
  description?: ReactNode;
  /** Botão ou link com a próxima ação. */
  action?: ReactNode;
  size?: "md" | "sm";
  className?: string;
}

/** Tela ou bloco vazio: ilustração própria (cores do tema), título, explicação e a ação que resolve. */
export function EmptyState({ art, title, description, action, size = "md", className }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center text-center", size === "md" ? "px-4 py-10" : "px-3 py-6", className)}
    >
      <EmptyIllustration art={art} className={size === "md" ? "mb-5 h-28 w-36" : "mb-3 h-20 w-26"} />
      <p className={cn("font-semibold text-ink", size === "md" ? "text-lg" : "text-md")}>{title}</p>
      {description ? <p className="mt-1 max-w-[34ch] text-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Ilustrações em SVG com as cores do tema (claro e escuro). Decorativas. */
export function EmptyIllustration({ art, className }: { art: EmptyArt; className?: string }) {
  return (
    <svg viewBox="0 0 144 112" aria-hidden="true" focusable="false" className={className} fill="none">
      <ellipse cx="72" cy="100" rx="52" ry="7" fill="var(--surface3)" />
      {ART[art]}
    </svg>
  );
}

const stroke = { stroke: "var(--ink)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ART: Record<EmptyArt, ReactNode> = {
  start: (
    <>
      <path d="M34 56 72 26l38 30v40H34z" fill="var(--surface)" {...stroke} />
      <path d="M26 60 72 22l46 38" {...stroke} />
      <rect x="62" y="70" width="20" height="26" rx="3" fill="var(--brand-soft)" {...stroke} />
      <rect x="42" y="62" width="14" height="12" rx="2" fill="var(--brand-soft)" {...stroke} />
      <rect x="88" y="62" width="14" height="12" rx="2" fill="var(--brand-soft)" {...stroke} />
      <circle cx="114" cy="30" r="10" fill="var(--flow-left)" {...stroke} />
      <path d="M114 25v10M110 30h8" {...stroke} />
    </>
  ),
  list: (
    <>
      <path d="M40 14h56l8 8v74H40z" fill="var(--surface)" {...stroke} />
      <path d="M54 34h30M54 50h36M54 66h24" {...stroke} />
      <circle cx="47" cy="34" r="2" fill="var(--ink)" />
      <circle cx="47" cy="50" r="2" fill="var(--ink)" />
      <circle cx="47" cy="66" r="2" fill="var(--ink)" />
      <circle cx="104" cy="82" r="14" fill="var(--brand-soft)" {...stroke} />
      <path d="M104 75v14M97 82h14" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <rect x="28" y="22" width="64" height="70" rx="8" fill="var(--surface)" {...stroke} />
      <path d="M40 40h40M40 54h28M40 68h34" stroke="var(--line2)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="94" cy="62" r="18" fill="var(--brand-soft)" {...stroke} />
      <path d="m107 75 14 14" {...stroke} strokeWidth="4" />
    </>
  ),
  goal: (
    <>
      <circle cx="66" cy="60" r="34" fill="var(--surface)" {...stroke} />
      <circle cx="66" cy="60" r="22" fill="var(--brand-soft)" {...stroke} />
      <circle cx="66" cy="60" r="10" fill="var(--brand)" {...stroke} />
      <path d="M66 60 104 22" {...stroke} />
      <path d="m98 18 8 2 2 8-6 4-8-2z" fill="var(--flow-paid)" {...stroke} />
    </>
  ),
  chart: (
    <>
      <path d="M28 94h92" {...stroke} />
      <rect x="36" y="58" width="14" height="36" rx="3" fill="var(--flow-left)" {...stroke} />
      <rect x="58" y="38" width="14" height="56" rx="3" fill="var(--brand-soft)" {...stroke} />
      <rect x="80" y="66" width="14" height="28" rx="3" fill="var(--flow-paid)" {...stroke} />
      <rect x="102" y="48" width="14" height="46" rx="3" fill="var(--surface)" {...stroke} strokeDasharray="4 5" />
    </>
  ),
  bell: (
    <>
      <path d="M48 76V54a24 24 0 0 1 48 0v22l8 8H40z" fill="var(--surface)" {...stroke} />
      <path d="M64 92a8 8 0 0 0 16 0" {...stroke} />
      <path d="M72 22v8" {...stroke} />
      <circle cx="98" cy="36" r="9" fill="var(--flow-left)" {...stroke} />
      <path d="m94 36 3 3 5-6" {...stroke} />
    </>
  ),
};
