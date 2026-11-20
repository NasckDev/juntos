"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs as RadixTabs } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tabs({ className, ...props }: ComponentProps<typeof RadixTabs.Root>) {
  return <RadixTabs.Root className={cn("min-w-0", className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn(
        "scrollbar-none -mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "-mb-px shrink-0 border-b-2 border-transparent py-3 text-md font-medium whitespace-nowrap text-muted transition-colors lg:py-2.5",
        "hover:text-ink data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn("pt-5 focus-visible:outline-none lg:pt-6", className)} {...props} />;
}

export interface UrlTabsProps<T extends string> {
  /** Nome do parâmetro na URL (`?aba=metas`). */
  param: string;
  values: readonly T[];
  defaultValue: T;
  children: ReactNode;
  className?: string;
}

/**
 * Abas com a escolhida guardada na URL (nuqs), para o "voltar" do navegador e links diretos funcionarem.
 * Precisa do `NuqsAdapter` no layout.
 */
export function UrlTabs<T extends string>({ param, values, defaultValue, children, className }: UrlTabsProps<T>) {
  const [value, setValue] = useQueryState(param, parseAsStringLiteral(values).withDefault(defaultValue));
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const match = values.find((v) => v === next);
        if (match) void setValue(match === defaultValue ? null : match);
      }}
      className={className}
    >
      {children}
    </Tabs>
  );
}
