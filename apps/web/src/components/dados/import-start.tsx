"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { toastError } from "@/components/financas/feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IMPORT_MESSAGES, MAX_IMPORT_BYTES } from "@/server/validators/import";

const XLSX_ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const VIEWER_MESSAGE = "Você não tem permissão para fazer isso neste espaço.";
const UPLOAD_FAILED = "Não foi possível ler a planilha agora. Tente de novo em instantes.";

export interface ImportStartProps {
  readonly spaceId: string;
  readonly canImport: boolean;
}

/** Mensagem de erro da resposta do upload. */
async function uploadError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  } catch {
    // Sem JSON (ex.: limite do servidor): mensagem padrão.
  }
  return response.status === 413 ? IMPORT_MESSAGES.tooBig : UPLOAD_FAILED;
}

/** Importar, antes de escolher o arquivo (`dImport` sem lote): explica os formatos e abre o seletor. */
export function ImportStart({ spaceId, canImport }: ImportStartProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return toastError(IMPORT_MESSAGES.notXlsx);
    if (file.size > MAX_IMPORT_BYTES) return toastError(IMPORT_MESSAGES.tooBig);
    setReading(true);
    try {
      const body = new FormData();
      body.set("spaceId", spaceId);
      body.set("file", file);
      const response = await fetch("/api/importar", { method: "POST", body, credentials: "same-origin" });
      if (!response.ok) {
        toastError(await uploadError(response));
        return;
      }
      router.refresh();
    } catch {
      toastError(UPLOAD_FAILED);
    } finally {
      setReading(false);
    }
  }

  return (
    <Card className="lg:py-12">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-full bg-brand-soft text-brand-text" aria-hidden="true">
          <FileSpreadsheet className="size-8" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-[-0.015em]">Traga uma planilha para o app</h2>
        <p className="mt-1.5 text-muted">
          Funciona com a planilha de vocês (uma aba por mês, com Renda mensal, Despesas mensais e Economia mensal) e com
          arquivos exportados pelo Juntos. Antes de importar, você revisa linha por linha.
        </p>
        <input
          ref={input}
          type="file"
          accept={XLSX_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="arquivo-importacao"
          onChange={(event) => void onFile(event)}
        />
        <Button
          className="mt-6"
          icon={<Upload />}
          disabled={reading}
          onClick={() => (canImport ? input.current?.click() : toastError(VIEWER_MESSAGE))}
        >
          {reading ? "Lendo a planilha…" : "Escolher planilha (.xlsx)"}
        </Button>
        <p className="mt-3 text-sm text-muted">Arquivo .xlsx de até 4 MB.</p>
        {reading ? (
          <p role="status" className="sr-only">
            Lendo a planilha…
          </p>
        ) : null}
      </div>
    </Card>
  );
}
