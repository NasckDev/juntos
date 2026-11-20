import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import ExcelJS from "exceljs";

/*
 * Importar, exportar e notificações de ponta a ponta, com dados de verdade: conta nova de convidado → lança
 * → exporta o Excel (confere o arquivo baixado) → exclui um lançamento → importa o arquivo baixado → revisa →
 * importa → desfaz → a central mostra o aviso da importação. Com `PRINTS_DIR`, salva os prints das telas.
 */

const PRINTS_DIR = process.env.PRINTS_DIR;

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function print(page: Page, name: string, project: string): Promise<void> {
  if (!PRINTS_DIR) return;
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(PRINTS_DIR, `${name}-${project}.png`) });
  await page.screenshot({ path: path.join(PRINTS_DIR, `${name}-${project}-pagina-inteira.png`), fullPage: true });
}

async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function enterAsGuest(page: Page): Promise<void> {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /Testar como convidado/ }).click();
  await page.waitForURL("**/inicio");
  await page.getByLabel("Como podemos chamar você?").fill("Rafa");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

async function addEntry(
  page: Page,
  entry: { kind: "Entrada" | "Saída"; amount: string; description: string; date: string; paid: boolean },
): Promise<void> {
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  const form = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(form).toBeVisible();
  await form.getByRole("radio", { name: entry.kind }).check();
  await form.getByLabel("Valor").fill(entry.amount);
  await form.getByLabel("Descrição").fill(entry.description);
  await form.getByLabel("Data").fill(entry.date);
  const repeat = form.getByLabel("Repetir");
  if ((await repeat.inputValue()) !== "none") await repeat.selectOption("none");
  const paid = form.getByRole("switch", { name: entry.kind === "Entrada" ? "Já foi recebido" : "Já foi pago" });
  if ((await paid.getAttribute("aria-checked")) !== String(entry.paid)) await paid.click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(form).toBeHidden();
}

test("exporta o Excel, importa o arquivo de volta, desfaz e vê o aviso na central", async ({ page }, info) => {
  const project = info.project.name;
  const today = todayInSaoPaulo();
  const ym = today.slice(0, 7);

  await enterAsGuest(page);
  await addEntry(page, { kind: "Entrada", amount: "5200", description: "Salário", date: `${ym}-05`, paid: true });
  await addEntry(page, { kind: "Saída", amount: "120,50", description: "Internet", date: today, paid: false });
  await addEntry(page, { kind: "Saída", amount: "89,90", description: "Luz", date: today, paid: false });

  // Exportar: só este mês, resumo ao vivo e o download do Excel.
  await page.goto("/dados");
  await expect(page.getByRole("heading", { level: 1, name: "Importar e exportar" })).toBeVisible();
  await page.getByRole("button", { name: "Este mês" }).click();
  const summary = page.getByRole("region", { name: "Resumo da exportação" });
  await expect(summary).toContainText("3 lançamentos");
  await expectNoSeriousA11yViolations(page);
  await print(page, "exportar", project);

  const downloading = page.waitForEvent("download");
  await summary.getByRole("button", { name: "Exportar Excel" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`Juntos_${ym}_Casa.xlsx`);
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toHaveLength(3);
  expect(workbook.getWorksheet("Lançamentos")?.rowCount).toBe(4);
  expect(workbook.getWorksheet("Visão Geral")?.getCell("C4").value).toMatchObject({ result: 5200 });

  // Excluir um lançamento.
  await page.goto("/lancamentos");
  await page.getByRole("button", { name: /^Internet/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar lançamento" });
  await edit.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Lançamento excluído.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Internet/ })).toBeHidden();

  // Importar o arquivo baixado: só o excluído vem marcado.
  await page.goto("/dados?aba=importar");
  await page.getByTestId("arquivo-importacao").setInputFiles(file);
  await expect(page.getByRole("heading", { name: "Revise antes de importar" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Importar (revisão)" })).toBeVisible();
  await expect(page.getByText("2 lançamentos já existem neste espaço e vieram desmarcados.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^Internet/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Luz/ })).not.toBeChecked();
  await expect(page.getByText("1 de 3 selecionados")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "importar-revisao", project);

  await page.getByRole("button", { name: "Importar 1 lançamento" }).click();
  await page.waitForURL(`**/lancamentos?mes=${ym}`);
  await expect(page.getByText("1 lançamento importado.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Internet/ })).toBeVisible();

  // Desfazer o lote inteiro.
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Ação desfeita.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Internet/ })).toBeHidden();

  // Central: o aviso da importação no histórico e a conta que vence hoje em "Precisa da sua atenção".
  await page.goto("/notificacoes");
  await expect(page.getByRole("heading", { level: 1, name: "Notificações" })).toBeVisible();
  await expect(page.getByRole("button", { name: /1 lançamento importado/ })).toBeVisible();
  const attention = page.getByRole("region", { name: "Precisa da sua atenção" });
  await expect(attention.getByText("Luz vence hoje")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "notificacoes", project);

  await page.getByRole("button", { name: "Contas", exact: true }).click();
  await page.waitForURL("**/notificacoes?filtro=contas");
  await expect(page.getByRole("button", { name: /1 lançamento importado/ })).toBeHidden();
});
