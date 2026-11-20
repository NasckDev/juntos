"use client";

import { formatBRL } from "@juntos/core";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

export interface GoalCelebrationProps {
  readonly goal: { readonly name: string; readonly target: number } | null;
  readonly onClose: () => void;
}

/** Ilustração própria da meta alcançada: troféu com confete. Decorativa (o título e o texto dizem tudo). */
export function TrophyArt({ className }: { className?: string }) {
  const stroke = { stroke: "var(--ink)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" focusable="false" className={className} fill="none">
      <ellipse cx="64" cy="116" rx="36" ry="6" fill="var(--surface3)" />
      <path d="M40 24h48v26a24 24 0 0 1-48 0z" fill="var(--flow-paid)" {...stroke} />
      <path d="M40 32H26v8a14 14 0 0 0 14 14M88 32h14v8a14 14 0 0 1-14 14" {...stroke} />
      <path d="M64 74v18M50 104h28M54 92h20v12H54z" fill="var(--brand-soft)" {...stroke} />
      <path d="m64 34 3.6 7.4 8.2 1.2-6 5.7 1.5 8.1L64 53.6l-7.3 3.8 1.5-8.1-6-5.7 8.2-1.2z" fill="var(--surface)" />
      <circle cx="20" cy="16" r="3" fill="var(--flow-left)" />
      <circle cx="108" cy="14" r="3.5" fill="var(--brand)" />
      <rect x="10" y="62" width="7" height="7" rx="1.5" transform="rotate(20 13 65)" fill="var(--brand)" />
      <rect x="112" y="58" width="7" height="7" rx="1.5" transform="rotate(-18 115 61)" fill="var(--flow-left)" />
      <path d="M96 8l3 6M30 8l-3 7" {...stroke} strokeWidth={2} />
    </svg>
  );
}

/** "Meta alcançada!" (`celebra` do protótipo): janela com a ilustração, o valor juntado e o botão para seguir. */
export function GoalCelebration({ goal, onClose }: GoalCelebrationProps) {
  return (
    <Dialog.Root open={goal !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(10,11,15,.42)] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[1.25rem] bg-surface px-4 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-center shadow-pop outline-none data-[state=open]:animate-pop-in lg:inset-auto lg:top-1/2 lg:left-1/2 lg:w-[min(26rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-panel lg:p-8">
          <TrophyArt className="mx-auto mb-3 size-32" />
          <Dialog.Title className="text-xl font-semibold tracking-[-0.02em]">Meta alcançada!</Dialog.Title>
          <Dialog.Description className="mt-2 text-muted">
            {goal ? (
              <>
                Vocês juntaram <span className="hv num">{formatBRL(goal.target)}</span> para “{goal.name}”.
              </>
            ) : null}
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button className="mt-6" block>
              Continuar
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
