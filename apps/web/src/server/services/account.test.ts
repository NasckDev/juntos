import { beforeAll, describe, expect, it } from "vitest";
import { buildMonthlySheets } from "../../../../../packages/core/test/fixtures/monthly-sheet";
import { getDb } from "../db";
import { gridsToXlsx } from "../test/finance-fixtures";
import { addMember, createTestUser, migrateTestDb, type TestUser } from "../test/helpers";
import { exportUserData, PENDING_INVITE_LABEL } from "./account";
import { createImportBatch } from "./import";
import { readWorkbook } from "./import-workbook";
import { createInvite } from "./members";

const TODAY = "2026-11-20";

beforeAll(async () => {
  await migrateTestDb();
});

async function uploadAs(person: TestUser, spaceId: string, memberId: string, fileName: string) {
  const sheets = await readWorkbook(await gridsToXlsx(buildMonthlySheets()));
  return createImportBatch(getDb(), { userId: person.id, memberId }, spaceId, fileName, sheets, TODAY);
}

describe("Baixar meus dados", () => {
  it("não leva lote de importação de outra pessoa nem o e-mail de convite pendente para quem não é dono", async () => {
    const db = getDb();
    const owner = await createTestUser("Rafa");
    const editor = await createTestUser("Lu");
    const editorMemberId = await addMember(owner.home.id, editor.id, "editor");
    await createInvite(
      db,
      { id: owner.id, email: owner.email },
      { spaceId: owner.home.id, email: "convidada@example.com", role: "viewer" },
    );
    const ownerBatch = await uploadAs(owner, owner.home.id, owner.home.memberId, "Gasto 2025.xlsx");
    const editorBatch = await uploadAs(editor, owner.home.id, editorMemberId, "Planilha da Lu 2025.xlsx");

    const asEditor = await exportUserData(db, editor.id);
    const sharedForEditor = asEditor.spaces.find((space) => space.space.id === owner.home.id);
    expect(sharedForEditor?.importBatches.map((batch) => batch.id)).toEqual([editorBatch.batchId]);
    expect(JSON.stringify(sharedForEditor)).not.toContain("convidada@example.com");
    expect(sharedForEditor?.members.map((member) => member.name)).toContain(PENDING_INVITE_LABEL);

    const asOwner = await exportUserData(db, owner.id);
    const sharedForOwner = asOwner.spaces.find((space) => space.space.id === owner.home.id);
    expect(sharedForOwner?.importBatches.map((batch) => batch.id)).toEqual([ownerBatch.batchId]);
    expect(sharedForOwner?.members.map((member) => member.name)).toContain("convidada@example.com");
  });
});
