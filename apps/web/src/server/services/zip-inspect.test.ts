import { describe, expect, it } from "vitest";
import { gridsToXlsx } from "../test/finance-fixtures";
import { buildZip } from "../test/zip-fixtures";
import { inspectZip, MAX_UNCOMPRESSED_BYTES, MAX_ZIP_ENTRIES } from "./zip-inspect";

const text = (value: string) => new Uint8Array(Buffer.from(value, "utf8"));

describe("inspectZip", () => {
  it("aceita uma planilha .xlsx de verdade", async () => {
    const bytes = await gridsToXlsx([{ name: "Janeiro", rows: [["Renda mensal"], ["Salário", 5000]] }]);
    const result = inspectZip(bytes);
    expect(result.ok).toBe(true);
  });

  it("aceita entradas guardadas sem compressão e com compressão normal", () => {
    const xml = text(`<x>${"<c>linha de planilha 123</c>".repeat(200)}</x>`);
    expect(
      inspectZip(
        buildZip([
          { name: "a.xml", data: text("oi"), method: 0 },
          { name: "b.xml", data: xml },
        ]),
      ),
    ).toEqual({ ok: true, entries: 2, uncompressedBytes: 2 + xml.byteLength });
  });

  it("recusa mais de 200 entradas", () => {
    const many = Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `f${i}.xml`, data: text("x") }));
    expect(inspectZip(buildZip(many))).toEqual({ ok: false, problem: "tooManyEntries" });
  });

  it("recusa quando a soma descompactada passa de 50 MB", () => {
    const zeros = new Uint8Array(MAX_UNCOMPRESSED_BYTES + 1024);
    expect(inspectZip(buildZip([{ name: "bomba.xml", data: zeros }]))).toEqual({ ok: false, problem: "tooLarge" });
  });

  it("recusa razão de compressão absurda (bomba pequena)", () => {
    const zeros = new Uint8Array(2 * 1024 * 1024);
    expect(inspectZip(buildZip([{ name: "sheet1.xml", data: zeros }]))).toEqual({
      ok: false,
      problem: "suspiciousRatio",
    });
  });

  it("recusa ZIP que declara um tamanho menor do que o conteúdo expande", () => {
    const pseudoRandom = text(Array.from({ length: 20_000 }, (_, i) => String((i * 7919) % 97)).join(","));
    const lying = buildZip([{ name: "sheet1.xml", data: pseudoRandom, declaredSize: 2000 }]);
    expect(inspectZip(lying)).toEqual({ ok: false, problem: "suspiciousRatio" });
  });

  it("recusa o que não é ZIP, ZIP cortado, criptografado e método desconhecido", () => {
    expect(inspectZip(text("isto não é uma planilha, só um texto qualquer"))).toEqual({
      ok: false,
      problem: "invalid",
    });
    const good = buildZip([{ name: "a.xml", data: text("conteúdo") }]);
    expect(inspectZip(good.subarray(0, good.byteLength - 5))).toEqual({ ok: false, problem: "invalid" });
    expect(inspectZip(buildZip([{ name: "a.xml", data: text("x"), flags: 1 }]))).toEqual({
      ok: false,
      problem: "invalid",
    });
    expect(inspectZip(buildZip([{ name: "a.xml", data: text("x"), method: 12 }]))).toEqual({
      ok: false,
      problem: "invalid",
    });
  });
});
