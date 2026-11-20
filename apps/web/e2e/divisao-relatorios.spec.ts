import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

/*
 * Divisão e Relatórios com dados de verdade e duas pessoas: a Rafa (convidada, dona do espaço) cria o convite
 * pela interface, a Lu aceita o link `/convite/[token]` num segundo navegador, cada uma lança despesas, a Rafa vê o
 * veredito, muda o modo, registra o acerto e desfaz. Depois, os Relatórios com os dados lançados.
 * Com `PRINTS_DIR`, salva os prints das telas.
 */

const PRINTS_DIR = process.env.PRINTS_DIR;

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Mês vizinho no formato `2026-11`. */
function shiftMonth(ym: string, delta: number): string {
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Seta do teclado troca o mês na URL. Antes de a página hidratar, a tecla não tem quem a ouça; por isso tenta de novo,
 * mas só enquanto a URL ainda não mudou (a URL muda na hora, então nunca anda dois meses).
 */
async function pressMonthKey(page: Page, key: "ArrowLeft" | "ArrowRight", expected: string): Promise<void> {
  const target = new RegExp(`mes=${expected}`);
  await expect(async () => {
    if (!target.test(page.url())) await page.keyboard.press(key);
    await expect(page).toHaveURL(target, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

async function print(page: Page, name: string, project: string): Promise<void> {
  if (!PRINTS_DIR) return;
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(PRINTS_DIR, `${name}-${project}.png`) });
  await page.screenshot({ path: path.join(PRINTS_DIR, `${name}-${project}-pagina-inteira.png`), fullPage: true });
}

async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Entra como convidado (conta anônima de verdade) e responde a folha de boas-vindas com o nome. */
async function nameYourself(page: Page, name: string): Promise<void> {
  // Se a folha ainda não terminou de hidratar, o campo perde o texto: repete até a folha fechar.
  await expect(async () => {
    await page.getByLabel("Como podemos chamar você?").fill(name);
    await page.getByRole("button", { name: "Começar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 4_000 });
  }).toPass({ timeout: 90_000 });
}

async function enterAsGuest(page: Page, name: string): Promise<void> {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /Testar como convidado/ }).click();
  await page.waitForURL("**/inicio");
  await nameYourself(page, name);
}

interface Entry {
  readonly kind?: "Entrada" | "Saída";
  readonly description: string;
  readonly amount: string;
  readonly date?: string;
  /** Rótulo da pessoa em "Quem pagou", quando diferente do padrão. */
  readonly who?: string;
}

async function addEntry(page: Page, entry: Entry): Promise<void> {
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  const form = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(form).toBeVisible();
  if (entry.kind)
    await form
      .locator("label")
      .filter({ hasText: new RegExp(`^${entry.kind}$`) })
      .click();
  await form.getByLabel("Valor").fill(entry.amount);
  await form.getByLabel("Descrição").fill(entry.description);
  await form.getByLabel("Data").fill(entry.date ?? todayInSaoPaulo());
  if (entry.who !== undefined) await form.getByLabel(/^Quem (pagou|recebeu)/).selectOption({ label: entry.who });
  const paid = form.getByRole("switch", { name: /Já foi (pago|recebido)/ });
  if ((await paid.getAttribute("aria-checked")) !== "true") await paid.click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(form).toBeHidden();
}

/** Convida a Lu pela tela de pessoas e devolve o link do convite. */
async function createInvite(page: Page): Promise<string> {
  await page.goto("/ajustes/pessoas");
  await page.getByLabel("E-mail").fill("lu@example.com");
  await page.getByRole("button", { name: "Criar convite" }).click();
  const link = page.getByLabel("Link do convite");
  await expect(link).toHaveValue(/\/convite\/[A-Za-z0-9_-]{43}$/);
  return link.inputValue();
}

/** Segundo navegador: a Lu abre o link, entra como convidada, aceita o convite e se apresenta. */
async function acceptAsLu(
  browser: Browser,
  baseURL: string,
  viewport: { width: number; height: number } | null,
  inviteUrl: string,
) {
  const context: BrowserContext = await browser.newContext({
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    ...(viewport ? { viewport } : {}),
  });
  const page = await context.newPage();
  await page.goto(inviteUrl);
  await page.getByRole("button", { name: "Entrar como convidado" }).click();
  await page.getByRole("button", { name: "Aceitar convite" }).click();
  await page.waitForURL("**/inicio");
  await nameYourself(page, "Lu");
  return { context, page };
}

const verdict = (page: Page) => page.getByRole("region", { name: /^Acerto de/ });

test("duas pessoas: veredito, modos, acerto, desfazer; relatórios com dados", async ({ page, browser }, info) => {
  test.setTimeout(360_000);
  const project = info.project.name;
  const baseURL = String(info.project.use.baseURL);
  const ym = todayInSaoPaulo().slice(0, 7);

  await enterAsGuest(page, "Rafa");

  // Espaço com uma pessoa só: estado vazio com o caminho para convidar.
  await page.goto("/divisao");
  await expect(page.getByRole("region", { name: "Este espaço só tem você" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Convidar pessoa" })).toHaveAttribute("href", "/ajustes/pessoas");
  await expectNoSeriousA11yViolations(page);
  await print(page, "divisao-sozinho", project);
  // As setas do teclado trocam o mês também na Divisão.
  await pressMonthKey(page, "ArrowRight", shiftMonth(ym, 1));

  // Relatórios de conta nova: estado vazio.
  await page.goto("/relatorios");
  await expect(page.getByRole("region", { name: `Sem lançamentos em ${ym.slice(0, 4)}` })).toBeVisible();
  await print(page, "relatorios-vazio", project);

  // A Lu entra pelo convite de verdade.
  const inviteUrl = await createInvite(page);
  const lu = await acceptAsLu(browser, baseURL, page.viewportSize(), inviteUrl);

  // Despesas pagas por cada uma (R$ 100,00 da Rafa e R$ 20,00 da Lu) e a renda da Rafa.
  await page.goto("/lancamentos");
  await addEntry(page, { kind: "Entrada", description: "Salário", amount: "5000" });
  await addEntry(page, { description: "Mercado", amount: "100" });
  await addEntry(page, { description: "Lazer fora de casa", amount: "40", who: "Não informar" });
  await lu.page.goto("/lancamentos");
  await addEntry(lu.page, { description: "Padaria", amount: "20" });

  // Veredito: a Lu deve a diferença da parte justa (R$ 120,00 / 2 = R$ 60,00) à Rafa.
  await page.goto("/divisao");
  await expect(verdict(page)).toContainText("Lu deve R$ 40,00 a Rafa");
  const people = page.getByRole("region", { name: "Cada pessoa" });
  await expect(people).toContainText("Rafa (você)");
  await expect(people.getByRole("region", { name: /^Lu$/ })).toContainText("R$ 20,00");
  // Quem pagou "Não informar" fica fora da conta e aparece para ser corrigido.
  const without = page.getByRole("region", { name: "Sem quem pagou" });
  await expect(without.getByRole("button", { name: /Lazer fora de casa/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "divisao", project);

  // O lançamento sem pagador abre o formulário de edição que já existe.
  await without.getByRole("button", { name: /Lazer fora de casa/ }).click();
  const edit = page.getByRole("dialog", { name: "Editar lançamento" });
  await expect(edit).toBeVisible();
  await edit.getByLabel("Quem pagou").selectOption({ label: "Lu" });
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(edit).toBeHidden();
  // Agora Lu pagou R$ 60,00 e Rafa R$ 100,00: total R$ 160,00, parte R$ 80,00 e Lu deve R$ 20,00.
  await expect(verdict(page)).toContainText("Lu deve R$ 20,00 a Rafa");
  await expect(page.getByRole("region", { name: "Sem quem pagou" })).toBeHidden();

  // Modo proporcional à renda: só a Rafa recebeu (R$ 5.000,00), então ela arca com tudo; a Lu não deve nada.
  await page.getByRole("radio", { name: "Proporcional à renda" }).check();
  await expect(verdict(page)).toContainText("Rafa deve R$ 60,00 a Lu");
  await expect(page.getByText(/Rafa 100%, Lu 0%/)).toBeVisible();

  // Personalizado (duas pessoas): slider de 5 em 5.
  await page.getByRole("radio", { name: "Personalizado" }).check();
  const slider = page.getByRole("slider");
  await expect(slider).toHaveAttribute("step", "5");
  await slider.fill("70");
  await expect(page.getByText("Rafa 70% e Lu 30%")).toBeVisible();
  // Total R$ 160,00: Rafa fica com R$ 112,00 e pagou R$ 100,00; Rafa deve R$ 12,00 a Lu.
  await expect(verdict(page)).toContainText("Rafa deve R$ 12,00 a Lu");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Personalizado" })).toBeChecked();
  await expect(page.getByText("Rafa 70% e Lu 30%")).toBeVisible();

  // De volta a partes iguais; a Lu (outro navegador) vê o mesmo veredito.
  await page.getByRole("radio", { name: "Partes iguais" }).check();
  await expect(verdict(page)).toContainText("Lu deve R$ 20,00 a Rafa");
  await lu.page.goto("/divisao");
  await expect(verdict(lu.page)).toContainText("Lu deve R$ 20,00 a Rafa");
  await expect(lu.page.getByRole("radio", { name: "Partes iguais" })).toBeChecked();

  // Registrar o acerto zera a diferença; a lista mostra o acerto e o "Desfazer" o traz de volta.
  await page.getByRole("button", { name: "Registrar acerto" }).click();
  await expect(page.getByText("Acerto registrado.")).toBeVisible();
  await expect(verdict(page)).toContainText("Tudo acertado no mês");
  const settled = page.getByRole("region", { name: "Acertos registrados" });
  await expect(settled).toContainText("Lu pagou R$ 20,00 a Rafa");
  await expect(page.getByRole("button", { name: "Registrar acerto" })).toBeHidden();
  await print(page, "divisao-acertada", project);

  await settled.getByRole("button", { name: /^Desfazer acerto/ }).click();
  await expect(page.getByText("Acerto desfeito.")).toBeVisible();
  await expect(verdict(page)).toContainText("Lu deve R$ 20,00 a Rafa");
  await expect(page.getByRole("region", { name: "Acertos registrados" })).toBeHidden();

  // O "Desfazer" do toast de registro também funciona.
  // Cada aviso aparece de novo, mesmo logo depois de outro (um por vez: o novo fecha o anterior).
  await page.getByRole("button", { name: "Registrar acerto" }).click();
  const registered = page.locator("[data-sonner-toast]").filter({ hasText: "Acerto registrado." });
  await expect(registered).toBeVisible();
  await expect(page.getByText("Acerto desfeito.")).toBeHidden();
  await expect(verdict(page)).toContainText("Tudo acertado no mês");
  await registered.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.getByText("Ação desfeita.")).toBeVisible();
  await expect(verdict(page)).toContainText("Lu deve R$ 20,00 a Rafa");

  // Relatórios do ano com os dados lançados.
  await page.goto("/relatorios");
  await expect(page.getByRole("heading", { name: /^Resumo de / })).toBeVisible();
  await expect(page.getByRole("region", { name: /^Resumo de / })).toContainText("Maior saída");
  await expect(page.getByRole("link", { name: "Exportar o ano" })).toHaveAttribute(
    "href",
    `/dados?aba=exportar&de=${ym.slice(0, 4)}-01&ate=${ym.slice(0, 4)}-12`,
  );
  const bars = page.getByRole("list", { name: /^Entradas e saídas por mês em / });
  await expect(bars.getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(page.getByRole("region", { name: /^Categorias em / })).toContainText("Outros");
  await expect(page.getByRole("region", { name: /^Pago com/ })).toContainText("Não informado");
  await expectNoSeriousA11yViolations(page);
  await print(page, "relatorios", project);

  // Tocar noutro mês escolhe o mês na URL; a tabela leva o mês para os Lançamentos.
  const other = ym.endsWith("-01") ? `${Number(ym.slice(0, 4))}-02` : `${ym.slice(0, 4)}-01`;
  const otherMonth = new Date(`${other}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  await bars.getByRole("button", { name: new RegExp(`^${otherMonth}`, "i") }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${other}`));
  await expect(page.getByRole("heading", { name: new RegExp(`^Resumo de ${otherMonth}`, "i") })).toBeVisible();
  await page.goto("/relatorios");
  // As setas do teclado trocam o mês também nos Relatórios.
  await pressMonthKey(page, "ArrowLeft", shiftMonth(ym, -1));
  await page.goto("/relatorios");
  const tableLink = page.getByRole("link", { name: new RegExp(`^${otherMonth}$`, "i") }).first();
  await expect(tableLink).toHaveAttribute("href", `/lancamentos?mes=${other}`);

  await lu.context.close();
});
