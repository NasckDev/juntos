/**
 * Gera os prints do app real em `docs/prints/app/` (WebP), para o README e o portfólio.
 *
 * Uso (de `apps/web`): `npx tsx scripts/gerar-prints.ts`
 *
 * 1. Sobe um `next dev` próprio (porta `PRINTS_PORT`, padrão 3031) pelo `scripts/e2e-server.ts`, com banco PGlite
 *    e pasta de saída do Next só desta execução, em diretórios temporários apagados no fim.
 * 2. Cadastra tudo PELA INTERFACE, como uma pessoa faria: a Rafa entra como convidada, convida a Lu (que aceita o
 *    convite num segundo navegador), lança as contas fixas, a parcela do carro, uma conta anual e os gastos
 *    variáveis de três meses, pede a sugestão de orçamento, cria a meta e guarda nela. Nada é inserido direto no banco.
 * 3. Fotografa as telas em 1440 × 900 e 390 × 844 (DPR 2), tema claro e movimento reduzido, mais o Início no tema
 *    escuro, e converte para WebP no próprio Chromium.
 *
 * Nomes, valores e e-mails são fictícios (`example.com`). Os meses são relativos a hoje: a parcela do carro começa
 * quatro meses atrás para aparecer como "5 de 54" no mês atual.
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Browser, type BrowserContext, chromium, type Locator, type Page } from "@playwright/test";

const PORT = Number(process.env.PRINTS_PORT ?? 3031);
const BASE = `http://localhost:${PORT}`;
const APP_DIR = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.resolve(APP_DIR, "../../docs/prints/app");
const WORK_DIR = path.join(tmpdir(), `juntos-prints-${process.pid}`);
const PGLITE_DIR = path.join(WORK_DIR, "pglite");
const NEXT_DIST_DIR = process.env.PRINTS_NEXT_DIST_DIR ?? ".next-e2e-prints";

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;
type Device = "computador" | "celular";

// ——— Datas relativas a hoje (America/Sao_Paulo) ———

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const TODAY_DAY = Number(TODAY.slice(8, 10));
const CURRENT_YM = TODAY.slice(0, 7);

/** Mês relativo ao atual no formato `2026-11`. */
function ym(offset: number): string {
  const date = new Date(Date.UTC(Number(CURRENT_YM.slice(0, 4)), Number(CURRENT_YM.slice(5, 7)) - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

/** Data `AAAA-MM-DD` num mês relativo; no mês atual, o dia nunca passa de hoje (gasto já feito). */
function day(offset: number, dayOfMonth: number, options: { future?: boolean } = {}): string {
  const clamped = offset === 0 && !options.future ? Math.min(dayOfMonth, TODAY_DAY) : dayOfMonth;
  return `${ym(offset)}-${String(clamped).padStart(2, "0")}`;
}

// ——— Dados fictícios ———

const RAFA = "Rafa (você)";
const LU = "Lu";

interface Entry {
  readonly kind: "Entrada" | "Saída";
  readonly description: string;
  readonly amount: string;
  readonly date: string;
  readonly who?: string;
  readonly paid: boolean;
  /** Forma de pagamento ("Pago com"). */
  readonly method?: string;
  /** Categoria escolhida à mão, quando a sugerida pela descrição não serve. */
  readonly category?: string;
  readonly repeat?: "monthly" | "yearly";
  readonly installments?: string;
}

const FIXED: readonly Entry[] = [
  {
    kind: "Entrada",
    description: "Salário Rafa",
    amount: "6800",
    date: day(-4, 5),
    who: RAFA,
    paid: true,
    method: "Transferência",
    repeat: "monthly",
  },
  {
    kind: "Entrada",
    description: "Salário Lu",
    amount: "5400",
    date: day(-4, 5),
    who: LU,
    paid: true,
    method: "Transferência",
    repeat: "monthly",
  },
  {
    kind: "Saída",
    description: "Aluguel",
    amount: "2350",
    date: day(-4, 10),
    who: RAFA,
    paid: true,
    method: "Pix",
    repeat: "monthly",
  },
  {
    kind: "Saída",
    description: "Luz",
    amount: "186,40",
    date: day(-4, 15),
    who: LU,
    paid: true,
    method: "Débito automático",
    repeat: "monthly",
  },
  {
    kind: "Saída",
    description: "Internet",
    amount: "119,90",
    date: day(-4, 22),
    who: RAFA,
    paid: true,
    method: "Cartão de crédito",
    repeat: "monthly",
  },
  {
    kind: "Saída",
    description: "Parcela do carro",
    amount: "1289",
    date: day(-4, 12),
    who: RAFA,
    paid: true,
    method: "Boleto",
    repeat: "monthly",
    installments: "54",
  },
  {
    kind: "Saída",
    description: "Seguro do apartamento",
    amount: "1180",
    date: day(1, 8, { future: true }),
    who: RAFA,
    paid: false,
    method: "Boleto",
    category: "Moradia",
    repeat: "yearly",
  },
];

/** Gastos variáveis do mês: [mês relativo, dia, descrição, valor, quem, forma de pagamento]. */
type Variable = readonly [
  offset: number,
  day: number,
  description: string,
  amount: string,
  who: string,
  method: string,
];

const VARIABLE_ROWS: readonly Variable[] = [
  [-3, 5, "Mercado", "1090", LU, "Cartão de crédito"],
  [-3, 9, "Combustível", "300", RAFA, "Cartão de crédito"],
  [-3, 14, "Conta de água", "88,70", RAFA, "Boleto"],
  [-3, 21, "Farmácia", "72", LU, "Pix"],
  [-2, 6, "Mercado", "1120", RAFA, "Cartão de crédito"],
  [-2, 9, "Combustível", "280", LU, "Cartão de crédito"],
  [-2, 14, "Conta de água", "91,10", RAFA, "Boleto"],
  [-2, 17, "Farmácia", "86,90", LU, "Pix"],
  [-2, 20, "Jantar fora", "168", RAFA, "Cartão de crédito"],
  [-1, 4, "Mercado", "1045,30", LU, "Cartão de crédito"],
  [-1, 11, "Combustível", "310", RAFA, "Cartão de crédito"],
  [-1, 14, "Conta de água", "94,60", RAFA, "Boleto"],
  [-1, 18, "Presente de aniversário", "150", LU, "Pix"],
  [-1, 25, "Cinema", "64", RAFA, "Cartão de crédito"],
  [0, 3, "Mercado", "982,60", RAFA, "Cartão de crédito"],
  [0, 8, "Combustível", "295", LU, "Cartão de crédito"],
  [0, 13, "Farmácia", "64,50", RAFA, "Pix"],
  [0, 16, "Jantar fora", "142", LU, "Cartão de crédito"],
];

const VARIABLE: readonly Entry[] = [
  ...VARIABLE_ROWS.map(
    ([offset, dayOfMonth, description, amount, who, method]): Entry => ({
      kind: "Saída",
      description,
      amount,
      date: day(offset, dayOfMonth),
      who,
      paid: true,
      method,
    }),
  ),
  // A conta de água deste mês ainda não foi paga e já venceu: aparece em "Atrasados" e na central.
  {
    kind: "Saída",
    description: "Conta de água",
    amount: "92,30",
    date: day(0, 14),
    who: RAFA,
    paid: false,
    method: "Boleto",
  },
];

/** A Lu lança um gasto pelo próprio navegador. */
const LU_ENTRY: Entry = {
  kind: "Saída",
  description: "Feira",
  amount: "78,40",
  date: day(0, 17),
  paid: true,
  method: "Pix",
};

/** Metas: [nome, quanto juntar, guardar por mês, depósitos feitos pela tela]. */
const GOALS: readonly (readonly [name: string, target: string, monthly: string, deposits: readonly string[]])[] = [
  ["Reserva de emergência", "12000", "600", ["600", "400"]],
  ["Viagem de férias", "6000", "300", ["300"]],
];

// ——— Utilidades ———

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Repete a ação até dar certo (o primeiro clique pode chegar antes da hidratação da página). */
async function retry(action: () => Promise<void>, timeout = 90_000): Promise<void> {
  const end = Date.now() + timeout;
  for (;;) {
    try {
      await action();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
      await sleep(500);
    }
  }
}

async function noToasts(page: Page): Promise<void> {
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 30_000 });
}

async function visit(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "load", timeout: 240_000 });
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 240_000 });
}

async function waitForServer(): Promise<void> {
  const end = Date.now() + 300_000;
  while (Date.now() < end) {
    try {
      const response = await fetch(`${BASE}/entrar`);
      if (response.ok) return;
    } catch {
      // Ainda subindo.
    }
    await sleep(1000);
  }
  throw new Error(`O servidor não respondeu em ${BASE}/entrar.`);
}

function startServer(): ChildProcess {
  const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
  return spawn(process.execPath, [tsxCli, "scripts/e2e-server.ts"], {
    cwd: APP_DIR,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: "",
      PGLITE_DIR,
      NEXT_DIST_DIR,
      BETTER_AUTH_URL: BASE,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
}

function stopServer(server: ChildProcess): void {
  if (server.pid === undefined || server.exitCode !== null) return;
  // No Windows o `next dev` abre processos filhos: derruba a árvore inteira.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill("SIGTERM");
}

async function newContext(
  browser: Browser,
  device: Device,
  options: { dark?: boolean; storageState?: Awaited<ReturnType<BrowserContext["storageState"]>> } = {},
): Promise<BrowserContext> {
  const phone = device === "celular";
  return browser.newContext({
    baseURL: BASE,
    viewport: phone ? PHONE : DESKTOP,
    deviceScaleFactor: phone ? 2 : 1,
    isMobile: phone,
    hasTouch: phone,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: options.dark ? "dark" : "light",
    reducedMotion: "reduce",
    ...(options.storageState ? { storageState: options.storageState } : {}),
  });
}

/** Fotografa a tela visível e salva como `juntos-<tela>-<aparelho>[-escuro].webp`. */
async function shot(
  page: Page,
  converter: Page,
  name: string,
  device: Device,
  options: { dark?: boolean; keepScroll?: boolean } = {},
): Promise<void> {
  await noToasts(page);
  if (!options.keepScroll) await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  const png = await page.screenshot({ type: "png", animations: "disabled", caret: "hide" });
  // Converte para WebP numa página em branco (sem a CSP do app), como o `prototipo/gerar-prints.mjs`.
  const webp = await converter.evaluate(async (b64: string) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/webp", 0.88).split(",")[1] ?? "";
  }, png.toString("base64"));
  const file = path.join(OUT_DIR, `juntos-${name}-${device}${options.dark ? "-escuro" : ""}.webp`);
  writeFileSync(file, Buffer.from(webp, "base64"));
  console.log(`ok ${path.relative(path.resolve(APP_DIR, "../.."), file)}`);
}

// ——— Ações pela interface ———

async function nameYourself(page: Page, name: string): Promise<void> {
  const field = page.getByLabel("Como podemos chamar você?");
  await field.waitFor({ timeout: 180_000 });
  await retry(async () => {
    if (!(await field.isVisible())) return;
    await field.fill(name);
    await page.getByRole("button", { name: "Começar" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 4_000 });
  });
}

async function openNewEntry(page: Page): Promise<Locator> {
  const form = page.getByRole("dialog", { name: "Novo lançamento" });
  await retry(async () => {
    await page.getByRole("button", { name: "Novo lançamento" }).first().click();
    await form.waitFor({ timeout: 4_000 });
  });
  return form;
}

async function addEntry(page: Page, entry: Entry): Promise<void> {
  const form = await openNewEntry(page);
  await form.getByRole("radio", { name: entry.kind, exact: true }).check({ force: true });
  await form.getByLabel("Valor").fill(entry.amount);
  await form.getByLabel("Descrição").fill(entry.description);
  await form.getByLabel("Data").fill(entry.date);
  if (entry.category) await form.getByLabel("Categoria").selectOption({ label: entry.category });
  if (entry.who) await form.getByLabel(/^Quem (pagou|recebeu)/).selectOption({ label: entry.who });

  const details = form.locator("details");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await form.getByText("Mais opções").click();
  }
  if (entry.method) await form.getByLabel("Pago com").fill(entry.method);
  await form.getByLabel("Repetir").selectOption(entry.repeat ?? "none");
  if (entry.installments) await form.getByLabel("Parcelas").fill(entry.installments);

  const paid = form.getByRole("switch", { name: /Já foi (pago|recebido)/ });
  if ((await paid.getAttribute("aria-checked")) !== String(entry.paid)) await paid.click();

  await form.getByRole("button", { name: "Salvar" }).click();
  await form.waitFor({ state: "hidden", timeout: 30_000 });
  await noToasts(page);
}

async function createInvite(page: Page): Promise<string> {
  await visit(page, "/ajustes/pessoas");
  const link = page.getByLabel("Link do convite");
  await retry(async () => {
    await page.getByLabel("E-mail").fill("lu@example.com");
    await page.getByRole("button", { name: "Criar convite" }).click();
    await link.waitFor({ timeout: 6_000 });
  });
  return link.inputValue();
}

async function acceptAsLu(browser: Browser, inviteUrl: string): Promise<BrowserContext> {
  const context = await newContext(browser, "computador");
  const page = await context.newPage();
  await page.goto(inviteUrl, { timeout: 240_000 });
  const accept = page.getByRole("button", { name: "Aceitar convite" });
  await retry(async () => {
    if (await accept.isVisible()) return;
    await page.getByRole("button", { name: "Entrar como convidado" }).click({ timeout: 4_000 });
    await accept.waitFor({ timeout: 120_000 });
  });
  await retry(async () => {
    if (page.url().includes("/inicio")) return;
    await page.getByRole("button", { name: "Aceitar convite" }).click({ timeout: 4_000 });
    await page.waitForURL("**/inicio", { timeout: 180_000 });
  });
  await nameYourself(page, "Lu");
  return context;
}

async function suggestBudgets(page: Page): Promise<void> {
  await visit(page, "/planejamento");
  await retry(async () => {
    await page.getByRole("button", { name: "Sugerir pelos últimos 3 meses" }).click();
    await page.getByText("Limites sugeridos pela média de três meses.").waitFor({ timeout: 4_000 });
  });
  await noToasts(page);
}

async function createGoals(page: Page): Promise<void> {
  await visit(page, "/planejamento?aba=metas");
  for (const [name, target, monthly, deposits] of GOALS) {
    const goal = page.getByRole("dialog", { name: "Nova meta" });
    await retry(async () => {
      await page
        .getByRole("button", { name: /^(Criar meta|Nova meta)$/ })
        .first()
        .click();
      await goal.waitFor({ timeout: 4_000 });
    });
    await goal.getByLabel("Nome da meta").fill(name);
    await goal.getByLabel("Quanto precisa juntar").fill(target);
    await goal.getByLabel("Guardar por mês").fill(monthly);
    await goal.getByRole("button", { name: "Salvar" }).click();
    await goal.waitFor({ state: "hidden", timeout: 30_000 });
    await noToasts(page);

    const card = page.getByRole("region", { name });
    for (const amount of deposits) {
      const deposit = page.getByRole("dialog", { name: /Guardar em/ });
      await retry(async () => {
        await card.getByRole("button", { name: "Guardar nesta meta" }).click();
        await deposit.waitFor({ timeout: 4_000 });
      });
      await deposit.getByLabel("Valor").fill(amount);
      await deposit.getByRole("button", { name: "Guardar" }).click();
      await deposit.waitFor({ state: "hidden", timeout: 30_000 });
      await noToasts(page);
    }
  }
}

async function chooseIncomeSplit(page: Page): Promise<void> {
  await visit(page, "/divisao");
  await retry(async () => {
    await page.getByRole("radio", { name: "Proporcional à renda" }).check({ timeout: 4_000 });
  });
  await page.getByRole("region", { name: /^Acerto de/ }).waitFor();
  await noToasts(page);
}

/** Exporta o Excel dos últimos 3 meses pelo botão da tela e devolve o caminho do arquivo baixado. */
async function exportRecent(page: Page, converter: Page): Promise<string> {
  await visit(page, "/dados");
  const summary = page.getByRole("region", { name: "Resumo da exportação" });
  await retry(async () => {
    await page.getByRole("button", { name: "Últimos 3 meses" }).click({ timeout: 4_000 });
    await summary.getByText(/[0-9]+ lançamentos/).waitFor({ timeout: 4_000 });
  });
  await shot(page, converter, "exportar", "computador");
  const downloading = page.waitForEvent("download", { timeout: 120_000 });
  await summary.getByRole("button", { name: "Exportar Excel" }).click();
  const download = await downloading;
  const file = path.join(WORK_DIR, download.suggestedFilename());
  await download.saveAs(file);
  await noToasts(page);
  return file;
}

/**
 * Importa de volta o Excel exportado: antes, exclui o mercado de dois meses atrás, para a revisão mostrar o que
 * "Já existe" (desmarcado) e o que falta (marcado). Depois do print, importa e o lançamento volta.
 */
async function importBack(page: Page, converter: Page, workbook: string): Promise<void> {
  await visit(page, `/lancamentos?mes=${ym(-2)}`);
  const edit = page.getByRole("dialog", { name: "Editar lançamento" });
  await retry(async () => {
    await page
      .getByRole("button", { name: /^Mercado/ })
      .first()
      .click({ timeout: 4_000 });
    await edit.waitFor({ timeout: 4_000 });
  });
  await edit.getByRole("button", { name: "Excluir" }).click();
  await edit.waitFor({ state: "hidden", timeout: 30_000 });
  await noToasts(page);

  await visit(page, "/dados?aba=importar");
  await retry(async () => {
    await page.getByTestId("arquivo-importacao").setInputFiles(workbook);
    await page.getByRole("heading", { name: "Revise antes de importar" }).waitFor({ timeout: 30_000 });
  });
  await shot(page, converter, "importar", "computador");
  await page.getByRole("button", { name: "Importar 1 lançamento" }).click();
  await page.waitForURL("**/lancamentos**", { timeout: 120_000 });
  await noToasts(page);
}

// ——— Roteiro ———

async function desktopTour(browser: Browser, converter: Page): Promise<BrowserContext> {
  const context = await newContext(browser, "computador");
  const page = await context.newPage();
  const device = "computador";

  await visit(page, "/entrar");
  await shot(page, converter, "entrada", device);

  await retry(async () => {
    if (page.url().includes("/inicio")) return;
    await page.getByRole("button", { name: /Testar como convidado/ }).click({ timeout: 4_000 });
    await page.waitForURL("**/inicio", { timeout: 180_000 });
  });
  await nameYourself(page, "Rafa");
  await page.getByText("Este espaço ainda está vazio").waitFor();
  await shot(page, converter, "inicio-vazio", device);

  const lu = await acceptAsLu(browser, await createInvite(page));

  await visit(page, "/lancamentos");
  for (const entry of [...FIXED, ...VARIABLE]) await addEntry(page, entry);
  // Abrir cada mês lança as contas fixas que faltam (como faz o app para quem navega).
  for (const offset of [-4, -3, -2, -1, 0]) await visit(page, `/lancamentos?mes=${ym(offset)}`);

  const luPage = lu.pages()[0] ?? (await lu.newPage());
  await visit(luPage, "/lancamentos");
  await addEntry(luPage, LU_ENTRY);
  await lu.close();

  await suggestBudgets(page);
  await createGoals(page);
  await chooseIncomeSplit(page);

  await visit(page, "/inicio");
  await page.getByRole("heading", { name: /Deve sobrar até o fim de/ }).waitFor();
  await shot(page, converter, "inicio", device);

  await visit(page, "/lancamentos");
  await shot(page, converter, "lancamentos", device);
  await visit(page, "/lancamentos?aba=calendario");
  await shot(page, converter, "calendario", device);
  await visit(page, "/lancamentos?aba=fixas");
  await page.getByRole("heading", { name: "Entradas fixas" }).waitFor();
  await shot(page, converter, "contas-fixas", device);

  await visit(page, "/planejamento");
  await shot(page, converter, "orcamento", device);
  await visit(page, "/planejamento?aba=metas");
  await page.getByRole("region", { name: "Reserva de emergência" }).waitFor();
  await shot(page, converter, "metas", device);
  await visit(page, "/planejamento?aba=proximos");
  await page.getByRole("heading", { name: "Próximos 6 meses" }).waitFor();
  await shot(page, converter, "proximos-meses", device);

  await visit(page, "/divisao");
  await page.getByRole("region", { name: /^Acerto de/ }).waitFor();
  await shot(page, converter, "divisao", device);

  await visit(page, "/relatorios");
  await page.getByRole("heading", { name: /^Resumo de / }).waitFor();
  await shot(page, converter, "relatorios", device);

  await visit(page, "/notificacoes");
  await page.getByRole("region", { name: "Precisa da sua atenção" }).waitFor();
  await shot(page, converter, "notificacoes", device);

  await visit(page, "/ajustes/aparencia");
  await shot(page, converter, "ajustes", device);

  await importBack(page, converter, await exportRecent(page, converter));

  return context;
}

async function phoneTour(browser: Browser, converter: Page, rafa: BrowserContext): Promise<void> {
  const storageState = await rafa.storageState();
  const context = await newContext(browser, "celular", { storageState });
  const page = await context.newPage();
  const device = "celular";

  await visit(page, "/inicio");
  await page.getByRole("heading", { name: /Deve sobrar até o fim de/ }).waitFor();
  await shot(page, converter, "inicio", device);
  await visit(page, "/lancamentos");
  await shot(page, converter, "lancamentos", device);
  await visit(page, "/divisao");
  await page.getByRole("region", { name: /^Acerto de/ }).waitFor();
  await shot(page, converter, "divisao", device);
  await visit(page, "/planejamento");
  await shot(page, converter, "orcamento", device);

  // Formulário de novo lançamento na folha de baixo, preenchido pela metade (não é salvo).
  await visit(page, "/lancamentos");
  const form = await openNewEntry(page);
  await form.getByLabel("Valor").fill("38,90");
  await form.getByLabel("Descrição").fill("Padaria");
  await form.getByLabel("Descrição").blur();
  await page.waitForTimeout(800);
  await shot(page, converter, "novo-lancamento", device, { keepScroll: true });
  await page.keyboard.press("Escape");
  await context.close();

  for (const target of ["computador", "celular"] as const) {
    const dark = await newContext(browser, target, { dark: true, storageState });
    const darkPage = await dark.newPage();
    await visit(darkPage, "/inicio");
    await darkPage.getByRole("heading", { name: /Deve sobrar até o fim de/ }).waitFor();
    await shot(darkPage, converter, "inicio", target, { dark: true });
    await dark.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(WORK_DIR, { recursive: true });
  const server = startServer();
  let browser: Browser | undefined;
  try {
    await waitForServer();
    browser = await chromium.launch({ args: ["--lang=pt-BR"] });
    const converter = await (await browser.newContext()).newPage();
    const rafa = await desktopTour(browser, converter);
    await phoneTour(browser, converter, rafa);
    await rafa.close();
  } finally {
    await browser?.close();
    stopServer(server);
    await sleep(1500);
    rmSync(WORK_DIR, { recursive: true, force: true });
    rmSync(path.resolve(APP_DIR, NEXT_DIST_DIR), { recursive: true, force: true });
  }
}

await main();
