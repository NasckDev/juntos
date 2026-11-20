import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/*
 * Fluxo principal com dados de verdade: conta nova de convidado (vazia) → lança o salário fixo e uma conta →
 * aparecem no Início e na Lista → marca como pago → exclui e desfaz. Com `PRINTS_DIR`, salva os prints das telas.
 */

const PRINTS_DIR = process.env.PRINTS_DIR;

/** Hoje em America/Sao_Paulo ("2026-11-20"). */
function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Print do tamanho da tela (390 × 844 ou 1440 × 900); `fullPage` salva também a página inteira. */
async function print(page: Page, name: string, project: string, options: { fullPage?: boolean } = {}): Promise<void> {
  if (!PRINTS_DIR) return;
  // Sem toast por cima do conteúdo: espera os avisos sumirem.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(PRINTS_DIR, `${name}-${project}.png`) });
  if (options.fullPage) {
    await page.screenshot({ path: path.join(PRINTS_DIR, `${name}-${project}-pagina-inteira.png`), fullPage: true });
  }
}

async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Entra como convidado (conta anônima de verdade) e responde a folha de boas-vindas. */
async function enterAsGuest(page: Page): Promise<void> {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /Testar como convidado/ }).click();
  await page.waitForURL("**/inicio");
  await page.getByLabel("Como podemos chamar você?").fill("Rafa");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** Abre o formulário de lançamento novo pelo botão da casca (barra lateral ou botão flutuante). */
async function openNewEntry(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  await expect(page.getByRole("dialog", { name: "Novo lançamento" })).toBeVisible();
}

test("conta nova: lança, vê no Início e na Lista, marca como pago, exclui e desfaz", async ({ page }, info) => {
  const project = info.project.name;
  const today = todayInSaoPaulo();
  const ym = today.slice(0, 7);

  await enterAsGuest(page);

  // Início vazio: os três primeiros passos.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/, Rafa$/);
  await expect(page.getByText("Este espaço ainda está vazio")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ou traga sua planilha/ })).toHaveAttribute(
    "href",
    "/dados?aba=importar",
  );
  await expectNoSeriousA11yViolations(page);
  await print(page, "inicio-vazio", project);

  // Passo 1: salário que se repete todo mês.
  await page.getByRole("button", { name: /Lance o que entra/ }).click();
  const form = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(form).toBeVisible();
  await expect(form.getByRole("radio", { name: "Entrada" })).toBeChecked();
  await expect(form.getByLabel("Repetir")).toHaveValue("monthly");

  // Validação na hora, embaixo do campo, com as mensagens do protótipo.
  await form.getByLabel("Descrição").fill("S");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(form.getByText("Digite um valor maior que zero, como 120,50.")).toBeVisible();
  await expect(form.getByText("Use pelo menos 2 letras na descrição.")).toBeVisible();
  await print(page, "formulario-erros", project);

  await form.getByLabel("Valor").fill("7800");
  await form.getByLabel("Descrição").fill("Salário");
  await form.getByLabel("Data").fill(`${ym}-05`);
  await expect(form.getByLabel("Categoria").locator("option:checked")).toHaveText("Salário");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText("Lançamento salvo.")).toBeVisible();

  // Uma conta do mês, vencendo hoje e ainda não paga.
  await openNewEntry(page);
  const bill = page.getByRole("dialog", { name: "Novo lançamento" });
  await bill.getByLabel("Valor").fill("120,50");
  await bill.getByLabel("Descrição").fill("Internet");
  await bill.getByLabel("Data").fill(today);
  const paid = bill.getByRole("switch", { name: "Já foi pago" });
  if ((await paid.getAttribute("aria-checked")) === "true") await paid.click();
  await expect(bill.getByLabel("Categoria").locator("option:checked")).toHaveText("Contas da casa");
  await print(page, "formulario", project);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(bill).toBeHidden();

  // Início com dados: resumo e próximos vencimentos.
  await expect(page.getByText("Este espaço ainda está vazio")).toBeHidden();
  await expect(page.getByRole("heading", { name: /Deve sobrar até o fim de/ })).toBeVisible();
  const upcoming = page.getByRole("region", { name: "Próximos vencimentos" });
  await expect(upcoming.getByText("Internet")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "inicio", project, { fullPage: true });

  // Lista: os dois lançamentos, nos grupos certos.
  await page.goto("/lancamentos");
  await expect(page.getByRole("button", { name: /^Internet/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Salário/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "lista", project, { fullPage: true });

  // Editar lançamento de conta fixa: aviso de repetição e o escopo da mudança.
  await page.getByRole("button", { name: /^Salário/ }).click();
  const salary = page.getByRole("dialog", { name: "Editar lançamento" });
  await expect(salary.getByText("Este lançamento se repete todo mês.")).toBeVisible();
  await expect(salary.getByRole("radio", { name: "Neste e nos próximos" })).toBeVisible();
  await print(page, "formulario-edicao", project);
  await page.keyboard.press("Escape");
  await expect(salary).toBeHidden();

  // Marcar como pago.
  await page.getByRole("button", { name: "Marcar como pago: Internet" }).click();
  await expect(page.getByText("Marcado como pago.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pago: Internet" })).toHaveAttribute("aria-pressed", "true");

  // Excluir e desfazer.
  await page.getByRole("button", { name: /^Internet/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar lançamento" });
  await expect(edit).toBeVisible();
  await edit.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Lançamento excluído.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Internet/ })).toBeHidden();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Ação desfeita.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Internet/ })).toBeVisible();

  // Calendário e contas fixas.
  await page.getByRole("tab", { name: "Calendário" }).click();
  await expect(page.getByRole("button", { name: /^Dia 5, \d+ lançamentos?$/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "calendario", project);

  await page.getByRole("tab", { name: "Contas fixas" }).click();
  await expect(page.getByRole("heading", { name: "Entradas fixas" })).toBeVisible();
  await expect(page.getByText("Todo dia 5")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "contas-fixas", project);
});
