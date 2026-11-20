import { expect, type Page, test } from "@playwright/test";

// Erros de console e violações de CSP fazem o teste falhar.
function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  return erros;
}

async function entrarComExemplo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Continuar com Google" }).click();
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rafa");
}

test("a entrada abre sem erros e com a CSP de produção", async ({ page }) => {
  const erros = vigiarErros(page);
  const resposta = await page.goto("/");
  expect(resposta?.headers()["content-security-policy"]).toContain("frame-ancestors");
  await expect(page.getByRole("heading", { name: "As contas da casa, em um lugar só" })).toBeVisible();
  expect(erros).toEqual([]);
});

test("com os dados de exemplo, o Início mostra o resumo do mês", async ({ page }) => {
  const erros = vigiarErros(page);
  await entrarComExemplo(page);
  await expect(page.locator(".hero .big")).toContainText("R$");
  await expect(page.getByText("Para onde foi o dinheiro")).toBeVisible();
  expect(erros).toEqual([]);
});

test("lança uma saída e ela aparece na lista do mês", async ({ page }) => {
  await entrarComExemplo(page);
  await page.keyboard.press("n");
  await page.locator("#txval").fill("87,90");
  await page.locator("#txname").fill("Farmácia do bairro");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Lançamento salvo");
  await page.goto("/#lancamentos");
  await expect(page.locator("#txlist")).toContainText("Farmácia do bairro");
});

test("valida o valor no próprio campo", async ({ page }) => {
  await entrarComExemplo(page);
  await page.keyboard.press("n");
  await page.locator("#txname").fill("Conta de luz");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("#ferr-value")).toHaveText("Digite um valor maior que zero, como 120,50.");
  await expect(page.locator("#txval")).toHaveAttribute("aria-invalid", "true");
});

test("exporta o Excel no modelo da planilha com a CSP ativa", async ({ page }) => {
  test.slow();
  const erros = vigiarErros(page);
  await entrarComExemplo(page);
  await page.goto("/#dados");
  const download = page.waitForEvent("download");
  await page.locator("[data-act=expgo]").click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  expect(erros).toEqual([]);
});

test("nenhuma tela principal rola para o lado", async ({ page }) => {
  await entrarComExemplo(page);
  for (const tela of ["geral", "lancamentos", "planejar", "divisao", "relatorios", "avisos", "dados", "ajustes"]) {
    await page.goto(`/#${tela}`);
    await page.waitForTimeout(150);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, `a tela ${tela} rola para o lado`).toBeLessThanOrEqual(0);
  }
});
