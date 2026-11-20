import type { NoticeIcon as CoreIcon, NoticeTone } from "@juntos/core";
import { CalendarClock, type LucideIcon, Repeat, Target, TriangleAlert, Upload, UserPlus, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NotificationType } from "@/server/db/schema/notifications";

export type IconName = CoreIcon | "up";

const ICONS: Record<IconName, LucideIcon> = {
  alert: TriangleAlert,
  cal: CalendarClock,
  wallet: Wallet,
  target: Target,
  user: UserPlus,
  rep: Repeat,
  up: Upload,
};

const TONES: Record<NoticeTone, string> = {
  warn: "bg-warn-soft text-warn",
  brand: "bg-brand-soft text-brand-text",
  out: "bg-out-soft text-out",
  in: "bg-in-soft text-in",
  muted: "bg-surface3 text-muted",
};

/** Ícone e cor de cada tipo guardado no histórico (os mesmos do aviso ativo; importação usa "up"). */
export const TYPE_LOOK: Readonly<Record<NotificationType, { icon: IconName; tone: NoticeTone }>> = {
  late: { icon: "alert", tone: "warn" },
  due: { icon: "cal", tone: "brand" },
  budget: { icon: "wallet", tone: "warn" },
  goal: { icon: "target", tone: "in" },
  invite: { icon: "user", tone: "muted" },
  auto: { icon: "rep", tone: "brand" },
  import: { icon: "up", tone: "brand" },
};

/** O ícone redondo do aviso (`nic` do protótipo). Decorativo: o texto do aviso diz tudo. */
export function NoticeIcon({ icon, tone, className }: { icon: IconName; tone: NoticeTone; className?: string }) {
  const Icon = ICONS[icon];
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-10 shrink-0 place-items-center rounded-full lg:size-9", TONES[tone], className)}
    >
      <Icon className="size-[1.125rem]" />
    </span>
  );
}
