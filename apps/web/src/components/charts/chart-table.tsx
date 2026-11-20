import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChartTableProps {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  /** `details`: "Ver em tabela" visível para todos; `hidden`: só para leitores de tela. */
  mode?: "details" | "hidden";
  className?: string;
}

/** Tabela alternativa de um gráfico, com os mesmos números. A primeira coluna é o cabeçalho da linha. */
export function ChartTable({ caption, columns, rows, mode = "details", className }: ChartTableProps) {
  const table = (
    <table className="num w-full border-collapse text-sm">
      <caption className={mode === "hidden" ? undefined : "sr-only"}>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={cn("border-b border-line py-2 font-semibold text-muted", i === 0 ? "text-left" : "text-right")}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas de uma tabela estática, sem reordenação
          <tr key={r}>
            {row.map((cell, i) =>
              i === 0 ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: células na ordem das colunas
                <th key={i} scope="row" className="border-b border-line py-2 text-left font-medium">
                  {cell}
                </th>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: células na ordem das colunas
                <td key={i} className="hv border-b border-line py-2 text-right">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (mode === "hidden") return <div className={cn("sr-only", className)}>{table}</div>;
  return (
    <details className={cn("group mt-3", className)}>
      <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md text-sm font-semibold text-brand-text hover:underline">
        <span className="group-open:hidden">Ver em tabela</span>
        <span className="hidden group-open:inline">Esconder tabela</span>
      </summary>
      <div className="mt-2 overflow-x-auto">{table}</div>
    </details>
  );
}
