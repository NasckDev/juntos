import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/server/session";

const sessionState = vi.hoisted(() => ({ current: null as SessionUser | null }));
vi.mock("@/server/session", () => ({ getSession: async () => sessionState.current }));

const { POST } = await import("./route");
const { GET } = await import("../exportar/route");
const { getDb } = await import("@/server/db");
const { findPendingImport } = await import("@/server/services/import");
const { addMember, createTestUser, migrateTestDb, sessionOf } = await import("@/server/test/helpers");
const { gridsToXlsx, insertTxs } = await import("@/server/test/finance-fixtures");
const { IMPORT_MESSAGES, MAX_IMPORT_BYTES } = await import("@/server/validators/import");
const { XLSX_MIME } = await import("@/server/services/import-workbook");
const { buildZip } = await import("@/server/test/zip-fixtures");
const { hitRateLimit, RATE_LIMIT_MESSAGE, RATE_RULES, rateKey } = await import("@/server/rate-limit");

const BASE = "http://localhost:3010";

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

function uploadRequest(spaceId: string, file: File, headers: Record<string, string> = {}): Request {
  const form = new FormData();
  form.set("file", file);
  return new Request(`${BASE}/api/importar?espaco=${spaceId}`, { method: "POST", body: form, headers });
}

async function sheetFile(name = "Gasto 2025.xlsx"): Promise<File> {
  const bytes = await gridsToXlsx([
    {
      name: "Janeiro",
      rows: [
        [null, "Renda mensal"],
        [null, "Item", "Valor"],
        [null, "Salário", 5000],
        [null, "Despesas mensais"],
        [null, "Aluguel", 1500, "pago"],
      ],
    },
  ]);
  return new File([bytes], name, { type: XLSX_MIME });
}

describe("POST /api/importar", () => {
  it("guarda o lote em revisão para quem edita", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const response = await POST(uploadRequest(owner.home.id, await sheetFile()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { count: 2 } });
    expect((await findPendingImport(getDb(), owner.home.id, owner.id))?.year).toBe(2025);
  });

  it("recusa outro formato, arquivo falso, arquivo grande, quem só vê e quem não está logado", async () => {
    const owner = await createTestUser("Rafa");
    const viewer = await createTestUser("Carol");
    await addMember(owner.home.id, viewer.id, "viewer");

    expect((await POST(uploadRequest(owner.home.id, await sheetFile()))).status).toBe(401);

    sessionState.current = sessionOf(owner);
    const csv = new File(["Mês;Dia\n2026-01;5"], "dados.csv", { type: "text/csv" });
    const notXlsx = await POST(uploadRequest(owner.home.id, csv));
    expect(notXlsx.status).toBe(415);
    expect(await notXlsx.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.notXlsx });

    const fake = new File(["isto não é uma planilha"], "falsa.xlsx", { type: XLSX_MIME });
    expect((await POST(uploadRequest(owner.home.id, fake))).status).toBe(415);

    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], "grande.xlsx", { type: XLSX_MIME });
    const tooBig = await POST(uploadRequest(owner.home.id, big));
    expect(tooBig.status).toBe(413);
    expect(await tooBig.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.tooBig });

    const foreign = await POST(uploadRequest(owner.home.id, await sheetFile(), { origin: "https://evil.example.com" }));
    expect(foreign.status).toBe(403);

    sessionState.current = sessionOf(viewer);
    expect((await POST(uploadRequest(owner.home.id, await sheetFile()))).status).toBe(403);
  });
});

/**
 * Corpo em pedaços que registra quantos pedaços o servidor pediu (para provar que nem começou a ler). Com
 * `highWaterMark: 0`, o stream só produz um pedaço quando alguém lê.
 */
function trackedBody(chunks: number, chunkSize = 64 * 1024) {
  const state = { pulled: 0, canceled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (state.pulled >= chunks) return controller.close();
        state.pulled += 1;
        controller.enqueue(new Uint8Array(chunkSize));
      },
      cancel() {
        state.canceled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { state, stream };
}

function streamRequest(spaceId: string | null, stream: ReadableStream<Uint8Array>): Request {
  const query = spaceId === null ? "" : `?espaco=${spaceId}`;
  return new Request(`${BASE}/api/importar${query}`, {
    method: "POST",
    body: stream,
    headers: { "content-type": "multipart/form-data; boundary=xyz" },
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("POST /api/importar: ordem das conferências e limites", () => {
  it("exige sessão e papel de editor antes de ler o corpo", async () => {
    const owner = await createTestUser("Rafa");
    const viewer = await createTestUser("Carol");
    const stranger = await createTestUser("Fulano");
    await addMember(owner.home.id, viewer.id, "viewer");

    for (const [who, status] of [
      [null, 401],
      [viewer, 403],
      [stranger, 404],
    ] as const) {
      sessionState.current = who ? sessionOf(who) : null;
      const { state, stream } = trackedBody(10);
      const response = await POST(streamRequest(owner.home.id, stream));
      expect(response.status).toBe(status);
      expect(state.pulled).toBe(0);
    }
  });

  it("recusa sem o espaço na URL (validado antes de tudo)", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const { state, stream } = trackedBody(10);
    expect((await POST(streamRequest(null, stream))).status).toBe(400);
    expect((await POST(streamRequest("nao-e-uuid", trackedBody(1).stream))).status).toBe(400);
    expect(state.pulled).toBe(0);
  });

  it("corta corpo grande sem Content-Length lendo em pedaços, sem ler tudo", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    // 64 KB × 200 = 12,5 MB anunciados por stream, sem Content-Length.
    const { state, stream } = trackedBody(200);
    const response = await POST(streamRequest(owner.home.id, stream));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.tooBig });
    expect(state.pulled).toBeLessThan(80);
    expect(state.canceled).toBe(true);
  });

  it("recusa bomba de descompressão antes do ExcelJS, com mensagem clara", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    const bomb = buildZip([{ name: "xl/worksheets/sheet1.xml", data: new Uint8Array(3 * 1024 * 1024) }]);
    const suspicious = await POST(uploadRequest(owner.home.id, new File([bomb], "bomba.xlsx", { type: XLSX_MIME })));
    expect(suspicious.status).toBe(415);
    expect(await suspicious.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.zipSuspicious });

    const lying = buildZip([{ name: "a.xml", data: new Uint8Array(10), declaredSize: 60 * 1024 * 1024 }]);
    const huge = await POST(uploadRequest(owner.home.id, new File([lying], "enorme.xlsx", { type: XLSX_MIME })));
    expect(huge.status).toBe(413);
    expect(await huge.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.zipTooLarge });

    const many = buildZip(Array.from({ length: 201 }, (_, i) => ({ name: `p${i}.xml`, data: new Uint8Array(1) })));
    const crowded = await POST(uploadRequest(owner.home.id, new File([many], "muitas.xlsx", { type: XLSX_MIME })));
    expect(crowded.status).toBe(415);
    expect(await crowded.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.zipTooManyEntries });
  });

  it("aceita de volta a planilha exportada pelo próprio app", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    await insertTxs(owner.home.id, owner.id, [
      { description: "Aluguel", amount: 150_000, competence: "2026-03", day: 10, category: "moradia" },
      { description: "Salário", amount: 500_000, competence: "2026-03", day: 5, category: "salario", kind: "in" },
    ]);
    const exported = await GET(
      new Request(`${BASE}/api/exportar?espaco=${owner.home.id}&formato=xlsx&de=2026-01&ate=2026-12`),
    );
    const file = new File([await exported.arrayBuffer()], "Gasto_anual_2026_Casa.xlsx", { type: XLSX_MIME });
    const response = await POST(uploadRequest(owner.home.id, file));
    expect(response.status).toBe(200);
  });

  it("depois de 10 envios na hora, recusa com 429 sem ler o arquivo", async () => {
    const owner = await createTestUser("Rafa");
    sessionState.current = sessionOf(owner);
    for (let i = 0; i < RATE_RULES.importUpload.limit; i += 1) {
      await hitRateLimit(getDb(), RATE_RULES.importUpload, rateKey(RATE_RULES.importUpload, owner.id));
    }
    const { state, stream } = trackedBody(1);
    const response = await POST(streamRequest(owner.home.id, stream));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ok: false, error: RATE_LIMIT_MESSAGE });
    expect(state.pulled).toBe(0);
  });
});

describe("GET /api/exportar", () => {
  it("baixa com o nome do protótipo; quem não é do espaço recebe 404; filtro inválido, 400", async () => {
    const owner = await createTestUser("Rafa");
    const stranger = await createTestUser("Fulano");
    await insertTxs(owner.home.id, owner.id, [
      { description: "Aluguel", amount: 150_000, competence: "2026-03", day: 10, category: "moradia" },
    ]);
    const url = `${BASE}/api/exportar?espaco=${owner.home.id}&formato=xlsx&de=2026-01&ate=2026-12`;

    expect((await GET(new Request(url))).status).toBe(401);
    sessionState.current = sessionOf(stranger);
    expect((await GET(new Request(url))).status).toBe(404);

    sessionState.current = sessionOf(owner);
    const ok = await GET(new Request(url));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain('filename="Gasto_anual_2026_Casa.xlsx"');
    expect(new Uint8Array(await ok.arrayBuffer()).slice(0, 2)).toEqual(Uint8Array.from([0x50, 0x4b]));

    const tooLong = await GET(new Request(url.replace("de=2026-01", "de=2023-01")));
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toEqual({ ok: false, error: "Escolha no máximo 36 meses por vez." });

    const empty = await GET(new Request(`${url}&situacao=paid`));
    expect(empty.status).toBe(422);
    expect(await empty.json()).toEqual({ ok: false, error: "Nenhum lançamento com esses filtros." });
  });
});
