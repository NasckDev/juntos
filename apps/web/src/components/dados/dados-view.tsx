"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DadosData } from "@/server/dados-loaders";
import { ExportPanel } from "./export-panel";
import { ImportReview } from "./import-review";
import { ImportStart } from "./import-start";

export const DADOS_TABS = ["exportar", "importar"] as const;
const TAB_PARSER = parseAsStringLiteral(DADOS_TABS).withDefault("exportar");

export interface DadosViewProps {
  readonly data: DadosData;
  readonly spaceId: string;
  readonly spaceName: string;
}

/** Importar e exportar (`vDados`): abas Exportar e Importar, com a aba na URL (`?aba=`). */
export function DadosView({ data, spaceId, spaceName }: DadosViewProps) {
  const [tab, setTab] = useQueryState("aba", TAB_PARSER.withOptions({ history: "push", scroll: false }));
  const canImport = data.role !== "viewer";

  return (
    <>
      <PageHeader
        title="Importar e exportar"
        subtitle={`Leve os dados de ${spaceName} para o Excel ou PDF, ou traga de uma planilha`}
      />
      <Tabs
        value={tab}
        onValueChange={(next) => {
          const match = DADOS_TABS.find((value) => value === next) ?? "exportar";
          void setTab(match === "exportar" ? null : match);
        }}
      >
        <TabsList aria-label="Importar ou exportar">
          <TabsTrigger value="exportar">Exportar</TabsTrigger>
          <TabsTrigger value="importar">{data.review ? "Importar (revisão)" : "Importar"}</TabsTrigger>
        </TabsList>
        <TabsContent value="exportar">
          <ExportPanel
            spaceId={spaceId}
            today={data.today}
            defaults={data.defaults}
            initialSummary={data.summary}
            categories={data.categories}
            members={data.members}
          />
        </TabsContent>
        <TabsContent value="importar">
          {data.review ? (
            <ImportReview
              key={data.review.pending.id}
              spaceId={spaceId}
              spaceName={spaceName}
              today={data.today}
              review={data.review}
              categories={data.categories}
            />
          ) : (
            <ImportStart spaceId={spaceId} canImport={canImport} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
