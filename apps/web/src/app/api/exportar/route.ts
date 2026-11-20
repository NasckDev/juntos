import { todayInSaoPaulo } from "@juntos/core";
import { AccessError, accessErrorResponse, requireMember } from "@/server/access";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/result";
import { buildExport } from "@/server/services/export";
import { EXPORT_MESSAGES, exportParamsToInput, exportRequestSchema } from "@/server/validators/export";

export const dynamic = "force-dynamic";
// ExcelJS e jsPDF rodam no Node.
export const runtime = "nodejs";
export const maxDuration = 60;

/** `filename` em ASCII e `filename*` em UTF-8 (RFC 6266). */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Baixa a exportação (Excel no modelo da planilha, PDF ou CSV) com os filtros da URL. Quem só vê também exporta;
 * quem não é do espaço recebe 404.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = exportRequestSchema.safeParse(exportParamsToInput(new URL(request.url).searchParams));
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? EXPORT_MESSAGES.failed;
    return Response.json({ ok: false, error }, { status: 400 });
  }
  const { format, ...filter } = parsed.data;
  try {
    await requireMember(filter.spaceId, "viewer");
    const file = await buildExport(getDb(), format, filter, todayInSaoPaulo());
    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": contentDisposition(file.fileName),
        "Content-Length": String(file.body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof DomainError) return Response.json({ ok: false, error: error.message }, { status: 422 });
    console.error("Falha ao gerar a exportação:", error);
    return Response.json({ ok: false, error: EXPORT_MESSAGES.failed }, { status: 500 });
  }
}
