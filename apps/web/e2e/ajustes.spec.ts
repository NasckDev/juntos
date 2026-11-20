import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/** Entra como convidado (conta anônima de verdade) e cai no app. */
async function enterAsGuest(page: Page, voltar = "/ajustes"): Promise<void> {
  await page.goto(`/entrar?voltar=${encodeURIComponent(voltar)}`);
  await page.getByRole("button", { name: /Testar como convidado/ }).click();
  await page.waitForURL(`**${voltar}`);
  // A folha de boas-vindas do convidado abre em qualquer tela do app (layout autenticado).
  await page.getByRole("button", { name: "Agora não" }).click();
}

test.describe("Ajustes", () => {
  test("a tela de entrada volta para o destino pedido e ignora URL externa", async ({ page }) => {
    await enterAsGuest(page, "/ajustes/avisos");
    await expect(page.getByRole("link", { name: "Avisos", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("destino externo em ?voltar= cai no início", async ({ page }) => {
    await page.goto(`/entrar?voltar=${encodeURIComponent("https://evil.example.com")}`);
    await page.getByRole("button", { name: /Testar como convidado/ }).click();
    await page.waitForURL("**/inicio");
    expect(new URL(page.url()).origin).not.toContain("evil");
  });

  test("navega pelas abas e salva nome e avatar", async ({ page }) => {
    await enterAsGuest(page);
    await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();

    await page.getByLabel("Nome").fill("Rafa");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Dados salvos.")).toBeVisible();

    await page.getByRole("button", { name: "Ver mais" }).click();
    await page.getByRole("button", { name: "Gato" }).click();
    await page.reload();
    await expect(page.getByLabel("Nome")).toHaveValue("Rafa");

    // No computador a aba se chama "Pessoas e compartilhamento"; no celular, só "Pessoas".
    for (const [label, path] of [
      [/^Aparência$/, "/ajustes/aparencia"],
      [/^Avisos$/, "/ajustes/avisos"],
      [/^Pessoas( e compartilhamento)?$/, "/ajustes/pessoas"],
      [/^Dados$/, "/ajustes/dados"],
    ] as const) {
      await page.getByRole("link", { name: label }).click();
      await page.waitForURL(`**${path}`);
    }
  });

  test("aparência: o tema escuro aplica na hora e continua depois de recarregar", async ({ page }) => {
    await enterAsGuest(page, "/ajustes/aparencia");
    await page.getByRole("button", { name: "Escuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Automático" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("pessoas: cria o convite e mostra o link para copiar", async ({ page }) => {
    await enterAsGuest(page, "/ajustes/pessoas");
    await page.getByLabel("E-mail").fill("lu@example.com");
    await page.getByRole("button", { name: "Criar convite" }).click();
    await expect(page.getByLabel("Link do convite")).toHaveValue(/\/convite\/[A-Za-z0-9_-]{43}$/);
    await expect(page.getByText("lu@example.com").first()).toBeVisible();
  });

  test("convite inexistente mostra o estado inválido", async ({ page }) => {
    await page.goto(`/convite/${"x".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "Convite não encontrado" })).toBeVisible();
  });

  test("sem erros graves de acessibilidade", async ({ page }) => {
    await enterAsGuest(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
