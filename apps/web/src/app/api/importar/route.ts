import { todayInSaoPaulo } from "@juntos/core";
import { AccessError, accessErrorResponse, requireMember } from "@/server/access";
import { getDb } from "@/server/db";
import { DomainError } from "@/server/result";
import { createImportBatch } from "@/server/services/import";
import { checkUpload, readWorkbook } from "@/server/services/import-workbook";
import { idSchema } from "@/server/validators/common";
import { IMPORT_MESSAGES, IMPORT_MULTIPART_OVERHEAD, MAX_IMPORT_BYTES } from "@/server/validators/import";

export const dynamic = "force-dynamic";
// ExcelJS roda no Node.
export const runtime = "nodejs";
export const maxDuration = 60;

function fail(error: string, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

/**
 * Recebe a planilha (`multipart/form-data` com `file` e `spaceId`), confere o arquivo, lê com ExcelJS, passa
 * pelo core e guarda o lote para a revisão. Só quem edita o espaço importa.
 */
export async function POST(request: Request): Promise<Response> {
  // Defesa extra contra envio de outro site (além do cookie SameSite=Lax): a origem tem de ser a do app.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail("Origem não permitida.", 403);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_IMPORT_BYTES + IMPORT_MULTIPART_OVERHEAD) return fail(IMPORT_MESSAGES.tooBig, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(IMPORT_MESSAGES.missingFile, 400);
  }
  const spaceId = idSchema.safeParse(form.get("spaceId"));
  if (!spaceId.success) return fail(spaceId.error.issues[0]?.message ?? IMPORT_MESSAGES.missingFile, 400);
  const file = form.get("file");
  if (!(file instanceof File)) return fail(IMPORT_MESSAGES.missingFile, 400);

  try {
    const { user, membership } = await requireMember(spaceId.data, "editor");
    const early = checkUpload(file);
    if (early) return fail(early, early === IMPORT_MESSAGES.tooBig ? 413 : 415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const invalid = checkUpload(file, bytes);
    if (invalid) return fail(invalid, 415);

    let sheets: Awaited<ReturnType<typeof readWorkbook>>;
    try {
      sheets = await readWorkbook(bytes);
    } catch {
      return fail(IMPORT_MESSAGES.notXlsx, 415);
    }
    const batch = await createImportBatch(
      getDb(),
      { userId: user.id, memberId: membership.memberId },
      spaceId.data,
      file.name,
      sheets,
      todayInSaoPaulo(),
    );
    return Response.json({ ok: true, data: batch });
  } catch (error: unknown) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof DomainError) return fail(error.message, 422);
    console.error("Falha ao importar a planilha:", error);
    return fail("Não foi possível ler a planilha agora. Tente de novo em instantes.", 500);
  }
}
