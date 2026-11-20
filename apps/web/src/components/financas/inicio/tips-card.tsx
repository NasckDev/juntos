import type { Tip, TipIcon, TipTone } from "@juntos/core";
import { CalendarDays, ChartLine, type LucideIcon, Repeat, TriangleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const ICON: Record<TipIcon, LucideIcon> = { alert: TriangleAlert, chart: ChartLine, cal: CalendarDays, rep: Repeat };
const TONE: Record<TipTone, string> = {
  out: "bg-out-soft text-out",
  warn: "bg-warn-soft text-warn",
  in: "bg-in-soft text-in",
  save: "bg-save-soft text-save",
  muted: "bg-surface3 text-muted",
};

/** "Vale saber" (`tips` do core): até 3 dicas sobre o mês. */
export function TipsCard({
  tips,
  about,
  className,
}: {
  tips: readonly Tip[];
  about: string | null;
  className?: string;
}) {
  return (
    <Card aria-labelledby="dicas-t" className={className}>
      <CardHeader title="Vale saber" titleId="dicas-t" description={about ? `sobre ${about}` : undefined} />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tips.map((tip) => {
          const Icon = ICON[tip.icon];
          return (
            <li key={tip.title} className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className={cn("grid size-9 shrink-0 place-items-center rounded-[0.6rem]", TONE[tip.tone])}
              >
                <Icon className="size-[1.125rem]" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{tip.title}</p>
                <p className="mt-0.5 text-sm text-muted">{tip.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
