import { todayInSaoPaulo } from "@juntos/core";
import { AccessError, accessErrorResponse, requireMember } from "@/server/access";
import { getDb } from "@/server/db";
import { readBodyWithLimit } from "@/server/http-body";
import { enforceUserRateLimit, RATE_RULES, RateLimitError } from "@/server/rate-limit";
import { DomainError } from "@/server/result";
import { createImportBatch } from "@/server/services/import";
import { checkUpload, readWorkbook } from "@/server/services/import-workbook";
import { inspectZip, type ZipProblem } from "@/server/services/zip-inspect";
import { idSchema } from "@/server/validators/common";
import {
  IMPORT_MESSAGES,
  IMPORT_MULTIPART_OVERHEAD,
  IMPORT_SPACE_PARAM,
  MAX_IMPORT_BYTES,
} from "@/server/validators/import";

export const dynamic = "force-dynamic";
// ExcelJS roda no Node.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = MAX_IMPORT_BYTES + IMPORT_MULTIPART_OVERHEAD;

const ZIP_FAILURES: Record<ZipProblem, { readonly message: string; readonly status: number }> = {
  invalid: { message: IMPORT_MESSAGES.notXlsx, status: 415 },
  tooManyEntries: { message: IMPORT_MESSAGES.zipTooManyEntries, status: 415 },
  tooLarge: { message: IMPORT_MESSAGES.zipTooLarge, status: 413 },
  suspiciousRatio: { message: IMPORT_MESSAGES.zipSuspicious, status: 415 },
};

function fail(error: string, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

/** O arquivo do formulário multipart, já lido com limite. */
async function readUploadedFile(request: Request): Promise<File | Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) return fail(IMPORT_MESSAGES.missingFile, 400);
  // Atalho para quem declara o tamanho; quem não declara (ou mente) é parado na leitura em pedaços.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return fail(IMPORT_MESSAGES.tooBig, 413);
  const body = await readBodyWithLimit(request.body, MAX_BODY_BYTES);
  if (!body.ok) return fail(body.reason === "tooBig" ? IMPORT_MESSAGES.tooBig : IMPORT_MESSAGES.missingFile, 413);
  let form: FormData;
  try {
    form = await new Response(body.bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    return fail(IMPORT_MESSAGES.missingFile, 400);
  }
  const file = form.get("file");
  return file instanceof File ? file : fail(IMPORT_MESSAGES.missingFile, 400);
}

/**
 * Recebe a planilha (`multipart/form-data` com `file`; o espaço vai na URL, `?espaco=<id>`). A ordem importa:
 * origem, sessão e papel (`editor`) e o limite de tentativas são conferidos antes de ler o corpo; o corpo é lido
 * com teto; o ZIP é conferido (entradas, tamanho descompactado e razão de compressão) antes do ExcelJS; só então a
 * planilha passa pelo core e vira um lote para a revisão.
 */
export async function POST(request: Request): Promise<Response> {
  // Defesa extra contra envio de outro site (além do cookie SameSite=Lax): a origem tem de ser a do app.
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return fail("Origem não permitida.", 403);
  const spaceId = idSchema.safeParse(url.searchParams.get(IMPORT_SPACE_PARAM));
  if (!spaceId.success) return fail(spaceId.error.issues[0]?.message ?? IMPORT_MESSAGES.missingFile, 400);

  try {
    const db = getDb();
    const { user, membership } = await requireMember(spaceId.data, "editor");
    await enforceUserRateLimit(db, RATE_RULES.importUpload, user.id);

    const file = await readUploadedFile(request);
    if (file instanceof Response) return file;
    const early = checkUpload(file);
    if (early) return fail(early, early === IMPORT_MESSAGES.tooBig ? 413 : 415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const invalid = checkUpload(file, bytes);
    if (invalid) return fail(invalid, 415);
    const zip = inspectZip(bytes);
    if (!zip.ok) return fail(ZIP_FAILURES[zip.problem].message, ZIP_FAILURES[zip.problem].status);

    let sheets: Awaited<ReturnType<typeof readWorkbook>>;
    try {
      sheets = await readWorkbook(bytes);
    } catch {
      return fail(IMPORT_MESSAGES.notXlsx, 415);
    }
    const batch = await createImportBatch(
      db,
      { userId: user.id, memberId: membership.memberId },
      spaceId.data,
      file.name,
      sheets,
      todayInSaoPaulo(),
    );
    return Response.json({ ok: true, data: batch });
  } catch (error: unknown) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RateLimitError) return fail(error.message, 429);
    if (error instanceof DomainError) return fail(error.message, 422);
    console.error("Falha ao importar a planilha:", error);
    return fail("Não foi possível ler a planilha agora. Tente de novo em instantes.", 500);
  }
}
