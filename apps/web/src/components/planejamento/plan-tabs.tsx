import Link from "next/link";
import { cn } from "@/lib/cn";
import { PLAN_TAB_LABELS, PLAN_TABS, type PlanTab } from "@/lib/planning";

/** Abas do Planejamento. São links (`?aba=`): cada aba carrega só os próprios dados e o "voltar" funciona. */
export function PlanTabs({ active }: { active: PlanTab }) {
  return (
    <nav aria-label="Seções do planejamento">
      <ul className="scrollbar-none -mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
        {PLAN_TABS.map((tab) => (
          <li key={tab} className="shrink-0">
            <Link
              href={tab === "orcamento" ? "/planejamento" : `/planejamento?aba=${tab}`}
              aria-current={tab === active ? "page" : undefined}
              className={cn(
                "-mb-px block border-b-2 border-transparent py-3 text-md font-medium whitespace-nowrap text-muted transition-colors lg:py-2.5",
                "hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink",
              )}
            >
              {PLAN_TAB_LABELS[tab]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
