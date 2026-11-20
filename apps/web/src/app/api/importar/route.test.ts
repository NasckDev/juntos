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

const BASE = "http://localhost:3010";

beforeAll(async () => {
  await migrateTestDb();
});

beforeEach(() => {
  sessionState.current = null;
});

function uploadRequest(spaceId: string, file: File, headers: Record<string, string> = {}): Request {
  const form = new FormData();
  form.set("spaceId", spaceId);
  form.set("file", file);
  return new Request(`${BASE}/api/importar`, { method: "POST", body: form, headers });
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
