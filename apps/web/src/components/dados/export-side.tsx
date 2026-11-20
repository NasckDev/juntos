"use client";

import { formatBRL0, ymLabel } from "@juntos/core";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/components/financas/feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HideValue } from "@/components/ui/hide-value";
import { cn } from "@/lib/cn";
import type { ExportSummary } from "@/server/services/export";
import { type ExportFormat, exportUrl } from "@/server/validators/export";
import type { ExportFilterState } from "./export-panel";

const FORMAT_LABEL: Record<ExportFormat, string> = { xlsx: "Excel", pdf: "PDF", csv: "CSV" };
const FAILED = "Não foi possível gerar o arquivo.";

export interface ExportSideProps {
  readonly spaceId: string;
  readonly format: ExportFormat;
  readonly filter: ExportFilterState;
  /** Erro do período ou dos tipos (mostrado aqui; o de mês invertido aparece embaixo do período). */
  readonly error: string | null;
  /** Os filtros não permitem exportar. */
  readonly blocked: boolean;
  readonly summary: ExportSummary | null;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly className?: string;
}

/** Nome do arquivo do `Content-Disposition` (`filename*` em UTF-8 tem prioridade). */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // Cai no `filename` simples logo abaixo.
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  } catch {
    // Resposta sem JSON: mensagem padrão.
  }
  return FAILED;
}

/** Baixa o arquivo gerado no servidor (sem sair da tela; erro vira aviso). */
async function download(url: string, fallbackName: string): Promise<void> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    toastError(await errorMessage(response));
    return;
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileNameFromDisposition(response.headers.get("content-disposition"), fallbackName);
  document.body.append(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 1500);
  toast("Arquivo salvo.");
}

/** Lateral da exportação: resumo ao vivo, o botão que baixa e a cópia de segurança. */
export function ExportSide({
  spaceId,
  format,
  filter,
  error,
  blocked,
  summary,
  loading,
  failed,
  className,
}: ExportSideProps) {
  const [busy, setBusy] = useState(false);
  const count = blocked ? 0 : (summary?.count ?? 0);
  const t = summary?.totals;
  const period = `${ymLabel(filter.from)}${filter.from !== filter.to ? ` a ${ymLabel(filter.to)}` : ""}`;
  const disabled = blocked || loading || busy || failed || count === 0;
  const stats = [
    { key: "in", label: "Entradas", value: t?.in ?? 0 },
    { key: "out", label: "Saídas", value: t?.out ?? 0 },
    { key: "save", label: "Guardado", value: t?.save ?? 0 },
    { key: "left", label: "Saldo", value: t?.left ?? 0 },
  ];

  async function run() {
    setBusy(true);
    try {
      await download(exportUrl(format, { spaceId, ...filter }), `Juntos.${format}`);
    } catch {
      toastError(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="exp-resumo-t" className={cn("flex flex-col", className)}>
      <h2 id="exp-resumo-t" className="text-lg font-semibold tracking-[-0.015em]">
        Resumo da exportação
      </h2>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-out">
          {error}
        </p>
      ) : null}
      <p className="mt-3" aria-live="polite">
        <span className="num text-[1.75rem] font-bold tracking-[-0.03em]">{loading ? "…" : count}</span>{" "}
        <span className="text-md">{count === 1 ? "lançamento" : "lançamentos"}</span>
      </p>
      <p className="text-sm text-muted">{period}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        {stats.map((stat) => (
          <div key={stat.key} className="min-w-0">
            <dt className="text-sm text-muted">{stat.label}</dt>
            <dd className="truncate font-semibold">
              <HideValue>{loading || blocked ? "—" : formatBRL0(stat.value)}</HideValue>
            </dd>
          </div>
        ))}
      </dl>
      <Button block className="mt-5" icon={<Download />} disabled={disabled} onClick={() => void run()}>
        {busy ? "Gerando…" : `Exportar ${FORMAT_LABEL[format]}`}
      </Button>
      {failed ? (
        <p className="mt-2 text-sm text-out">Não deu para calcular o resumo agora. Tente de novo em instantes.</p>
      ) : !blocked && !loading && count === 0 ? (
        <p className="mt-2 text-sm text-muted">Nenhum lançamento com esses filtros.</p>
      ) : null}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-semibold">Cópia de segurança</h3>
        <p className="mt-0.5 text-sm text-muted">Tudo o que está no app, em um arquivo para guardar.</p>
        <Button asChild variant="line" size="sm" className="mt-3">
          <a href="/api/conta/exportar" download>
            <Download aria-hidden="true" />
            Baixar cópia
          </a>
        </Button>
      </div>
    </Card>
  );
}
