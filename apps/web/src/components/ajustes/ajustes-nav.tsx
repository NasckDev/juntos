"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { AJUSTES_SECTIONS, type AjustesSlug } from "./sections";

/** Abas de Ajustes. São links (cada seção é uma página), então o "voltar" do navegador e os links diretos funcionam. */
export function AjustesNav({ active }: { active: AjustesSlug }) {
  return (
    <nav aria-label="Seções de Ajustes">
      <ul className="scrollbar-none -mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
        {AJUSTES_SECTIONS.map((section) => {
          const current = section.slug === active;
          return (
            <li key={section.slug} className="shrink-0">
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 border-transparent py-3 text-md font-medium whitespace-nowrap text-muted transition-colors lg:py-2.5",
                  "hover:text-ink aria-[current=page]:border-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink",
                )}
              >
                <span className="lg:hidden">{section.shortLabel}</span>
                <span className="hidden lg:inline">{section.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
