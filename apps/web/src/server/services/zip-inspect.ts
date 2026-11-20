import { inflateRawSync } from "node:zlib";

/*
 * Conferência do .xlsx (um ZIP) antes de entregar ao ExcelJS, contra "bomba de descompressão" (ADR 0006).
 *
 * Lê o fim do diretório central (EOCD) e as entradas, sem dependência nova, e recusa o arquivo se:
 * - tiver mais de `MAX_ZIP_ENTRIES` entradas;
 * - a soma dos tamanhos descompactados declarados passar de `MAX_UNCOMPRESSED_BYTES`;
 * - alguma entrada tiver razão de compressão acima de `MAX_COMPRESSION_RATIO`;
 * - os tamanhos declarados mentirem: cada entrada é descompactada aqui com teto de saída igual ao tamanho
 *   declarado (`maxOutputLength`), então um arquivo que diz "1 KB" e expande para 1 GB para no primeiro KB a mais.
 * ZIP64, criptografia e métodos diferentes de "guardado" (0) e "deflate" (8) não aparecem num .xlsx de verdade
 * e são recusados.
 */

export const MAX_ZIP_ENTRIES = 200;
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const MAX_COMPRESSION_RATIO = 200;

export type ZipProblem = "invalid" | "tooManyEntries" | "tooLarge" | "suspiciousRatio";

export type ZipInspection =
  | { readonly ok: true; readonly entries: number; readonly uncompressedBytes: number }
  | { readonly ok: false; readonly problem: ZipProblem };

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;
const MAX_COMMENT = 0xffff;
const ZIP64_MARK_16 = 0xffff;
const ZIP64_MARK_32 = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 0x1;

interface CentralEntry {
  readonly method: number;
  readonly flags: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
}

const fail = (problem: ZipProblem): ZipInspection => ({ ok: false, problem });

/** Posição do registro EOCD (procurado de trás para frente, pulando um eventual comentário do ZIP). */
function findEndOfCentralDirectory(view: DataView): number {
  const last = view.byteLength - EOCD_MIN_SIZE;
  const first = Math.max(0, last - MAX_COMMENT);
  for (let offset = last; offset >= first; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function readCentralEntries(view: DataView, start: number, count: number, end: number): CentralEntry[] | null {
  const entries: CentralEntry[] = [];
  let offset = start;
  for (let index = 0; index < count; index += 1) {
    if (offset + CENTRAL_HEADER_SIZE > end || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      flags: view.getUint16(offset + 8, true),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }
  return offset <= end ? entries : null;
}

function isUnsupported(entry: CentralEntry): boolean {
  const zip64 =
    entry.compressedSize === ZIP64_MARK_32 ||
    entry.uncompressedSize === ZIP64_MARK_32 ||
    entry.localHeaderOffset === ZIP64_MARK_32;
  const method = entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATE;
  return zip64 || method || (entry.flags & FLAG_ENCRYPTED) !== 0;
}

function ratioTooHigh(entry: CentralEntry): boolean {
  if (entry.uncompressedSize === 0) return false;
  if (entry.compressedSize === 0) return true;
  return entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO;
}

/** Descompacta a entrada com teto no tamanho declarado e confere que ela tem exatamente esse tamanho. */
function sizeMatches(bytes: Uint8Array, view: DataView, entry: CentralEntry): boolean {
  const local = entry.localHeaderOffset;
  if (local + LOCAL_HEADER_SIZE > bytes.byteLength || view.getUint32(local, true) !== LOCAL_SIGNATURE) return false;
  const dataStart = local + LOCAL_HEADER_SIZE + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.byteLength) return false;
  const data = bytes.subarray(dataStart, dataEnd);
  if (entry.method === METHOD_STORED) return entry.compressedSize === entry.uncompressedSize;
  try {
    // `maxOutputLength` precisa ser >= 1; com tamanho declarado 0, um byte a mais já denuncia a mentira.
    const output = inflateRawSync(data, { maxOutputLength: Math.max(1, entry.uncompressedSize) });
    return output.byteLength === entry.uncompressedSize;
  } catch {
    return false;
  }
}

/** Confere o ZIP sem confiar no que ele declara. Não lança: devolve o problema encontrado. */
export function inspectZip(bytes: Uint8Array): ZipInspection {
  if (bytes.byteLength < EOCD_MIN_SIZE) return fail("invalid");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return fail("invalid");

  const totalEntries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (totalEntries === ZIP64_MARK_16 || directoryOffset === ZIP64_MARK_32) return fail("invalid");
  if (totalEntries > MAX_ZIP_ENTRIES) return fail("tooManyEntries");
  if (totalEntries === 0 || directoryOffset + directorySize > eocd) return fail("invalid");

  const entries = readCentralEntries(view, directoryOffset, totalEntries, eocd);
  if (!entries) return fail("invalid");
  if (entries.some(isUnsupported)) return fail("invalid");

  const uncompressedBytes = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) return fail("tooLarge");
  if (entries.some(ratioTooHigh)) return fail("suspiciousRatio");
  if (!entries.every((entry) => sizeMatches(bytes, view, entry))) return fail("suspiciousRatio");
  return { ok: true, entries: entries.length, uncompressedBytes };
}
