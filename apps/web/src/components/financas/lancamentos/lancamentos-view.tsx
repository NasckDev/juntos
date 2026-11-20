"use client";

import { periodLabel, ymAdd } from "@juntos/core";
import { Download, Upload } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LancamentosData } from "@/server/finance-loaders";
import { NewEntryButton, PeriodPicker } from "../controls";
import { useFinanceUi } from "../finance-context";
import { usePeriod } from "../use-period";
import { CalendarView } from "./calendar-view";
import { FixedView } from "./fixed-view";
import { ListView } from "./list-view";

export const LANCAMENTOS_TABS = ["lista", "calendario", "fixas"] as const;
export type LancamentosTab = (typeof LANCAMENTOS_TABS)[number];

const TAB_PARSER = parseAsStringLiteral(LANCAMENTOS_TABS).withDefault("lista");

/** Lançamentos (`vLanc` do protótipo): abas Lista, Calendário e Contas fixas, com a aba na URL (`?aba=`). */
export function LancamentosView({ data, spaceName }: { data: LancamentosData; spaceName: string }) {
  const { form } = useFinanceUi();
  const { setPeriod } = usePeriod(form.today);
  const [tab, setTab] = useQueryState("aba", TAB_PARSER.withOptions({ history: "push", scroll: false }));
  const { period } = data;
  const lastYm = ymAdd(period.start, period.span - 1);

  function changeTab(next: string) {
    const match = LANCAMENTOS_TABS.find((value) => value === next) ?? "lista";
    void setTab(match === "lista" ? null : match);
    // O calendário é sempre de um mês: o último do período.
    if (match === "calendario" && period.span > 1) setPeriod({ start: lastYm, span: 1 });
  }

  return (
    <>
      <PageHeader
        title="Lançamentos"
        subtitle={`${periodLabel(period.start, tab === "lista" ? period.span : 1)} em ${spaceName}`}
        month={tab === "fixas" ? undefined : <PeriodPicker allowRange={tab === "lista"} />}
        actions={
          <>
            <Button asChild variant="line" className="hidden lg:inline-flex">
              <Link href="/dados?aba=importar">
                <Upload aria-hidden="true" />
                Importar
              </Link>
            </Button>
            <Button asChild variant="line" className="hidden lg:inline-flex">
              <Link href="/dados?aba=exportar">
                <Download aria-hidden="true" />
                Exportar
              </Link>
            </Button>
            <NewEntryButton
              className="hidden lg:inline-flex"
              {...(tab === "fixas" ? { repeat: "monthly" as const } : {})}
            >
              {tab === "fixas" ? "Nova conta fixa" : "Novo lançamento"}
            </NewEntryButton>
          </>
        }
      />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList aria-label="Ver lançamentos como">
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="fixas">Contas fixas</TabsTrigger>
        </TabsList>
        <TabsContent value="lista">
          <ListView
            txs={data.txs}
            categories={data.categories}
            members={data.members}
            today={data.today}
            hasData={data.hasData}
            multiMonth={period.span > 1}
          />
        </TabsContent>
        <TabsContent value="calendario">
          <CalendarView key={lastYm} ym={lastYm} txs={data.txs} categories={data.categories} today={data.today} />
        </TabsContent>
        <TabsContent value="fixas">
          <FixedView recurrences={data.recurrences} categories={data.categories} today={data.today} />
        </TabsContent>
      </Tabs>
    </>
  );
}
