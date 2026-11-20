import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/*
 * Planejamento com dados de verdade: conta nova de convidado (vazia) → lança saídas (neste mês e no mês passado) →
 * sugere e define limites no Orçamento → cria uma meta e guarda nela até concluir → vê os próximos meses →
 * usa o simulador. Com `PRINTS_DIR`, salva os prints de cada aba.
 */

const PRINTS_DIR = process.env.PRINTS_DIR;

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** "2026-11" → "2026-10" (mês anterior). */
function previousMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

async function enterAsGuest(page: Page): Promise<void> {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /Testar como convidado/ }).click();
  await page.waitForURL("**/inicio");
  await page.getByLabel("Como podemos chamar você?").fill("Rafa");
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

interface EntryOptions {
  readonly kind?: "Entrada" | "Saída";
  readonly repeat?: "monthly";
}

/** Lança pelo formulário do app (botão da casca). */
async function addEntry(
  page: Page,
  description: string,
  amount: string,
  date: string,
  options: EntryOptions = {},
): Promise<void> {
  await page.getByRole("button", { name: "Novo lançamento" }).first().click();
  const form = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(form).toBeVisible();
  if (options.kind) {
    // Sem `force`: no celular a folha ainda está subindo quando o diálogo aparece, e o clique forçado caía fora do
    // rádio. Assim o Playwright espera a folha parar antes de clicar.
    const kind = form.getByRole("radio", { name: options.kind });
    await kind.check();
    await expect(kind).toBeChecked();
  }
  await form.getByLabel("Valor").fill(amount);
  await form.getByLabel("Descrição").fill(description);
  await form.getByLabel("Data").fill(date);
  if (options.repeat) {
    await form.getByText("Mais opções").click();
    await form.getByLabel("Repetir").selectOption(options.repeat);
  }
  await form.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/^Lançamento salvo/)).toBeVisible();
  await expect(form).toBeHidden();
  // Espera o aviso sumir: o próximo lançamento só abre depois da folha fechar por completo.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
}

test("conta nova: orçamento, metas, próximos meses e simulador", async ({ page }, info) => {
  // Fluxo longo e o `next dev` compila cada tela na primeira visita.
  test.setTimeout(420_000);
  const project = info.project.name;
  const today = todayInSaoPaulo();
  const ym = today.slice(0, 7);

  await enterAsGuest(page);

  // Orçamento vazio: sem dados, só o convite para definir limites.
  await page.goto("/planejamento");
  await expect(page.getByRole("heading", { level: 1, name: "Planejamento" })).toBeVisible();
  await expect(page.getByText("Quanto vocês querem gastar em cada categoria?")).toBeVisible();
  // O primeiro clique pode chegar antes da hidratação da página: repete até a mensagem aparecer.
  await expect(async () => {
    await page.getByRole("button", { name: "Sugerir pelos últimos 3 meses" }).click();
    await expect(page.getByText("Ainda não há meses anteriores para calcular.")).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 60_000 });
  await expectNoSeriousA11yViolations(page);
  await print(page, "planejamento-orcamento-vazio", project);

  // Algumas saídas: duas neste mês e uma no mês passado, mais salário e uma conta fixa.
  await addEntry(page, "Mercado do mês", "600", `${ym}-03`);
  await addEntry(page, "Cinema", "80", `${ym}-04`);
  await addEntry(page, "Mercado do mês passado", "300", `${previousMonth(ym)}-10`);
  await addEntry(page, "Salário", "7800", `${ym}-05`, { kind: "Entrada", repeat: "monthly" });
  await addEntry(page, "Aluguel", "1500", `${ym}-06`, { repeat: "monthly" });

  await page.goto("/planejamento");
  const mercado = page.getByRole("listitem").filter({ hasText: "Mercado" }).filter({ hasText: "gastos em" });
  await expect(mercado.first()).toContainText("sem limite");

  // Sugestão pela média dos 3 meses anteriores: R$ 300 / 3 = R$ 100, arredondado para cima de R$ 50.
  await page.getByRole("button", { name: "Sugerir pelos últimos 3 meses" }).click();
  await expect(page.getByText("Limites sugeridos pela média de três meses.")).toBeVisible();
  await expect(mercado.first()).toContainText("R$ 100,00");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Ação desfeita.")).toBeVisible();
  await expect(mercado.first()).toContainText("sem limite");

  // Definir limite (com a mensagem de erro do protótipo antes).
  await mercado.first().getByRole("button", { name: "Definir limite" }).click();
  const limit = page.getByRole("dialog", { name: "Limite de Mercado" });
  await limit.getByLabel("Limite por mês").fill("abc");
  await limit.getByRole("button", { name: "Salvar" }).click();
  await expect(limit.getByText("Digite um valor maior que zero ou deixe vazio.")).toBeVisible();
  await limit.getByLabel("Limite por mês").fill("500");
  await limit.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Limite salvo.")).toBeVisible();
  await expect(mercado.first()).toContainText("Passou R$ 100,00");
  await expect(page.getByText("categoria com limite")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "planejamento-orcamento", project);

  // O "+" da categoria abre o formulário de lançamento com a categoria já escolhida.
  await mercado.first().getByRole("button", { name: "Lançar gasto em Mercado" }).click();
  const entry = page.getByRole("dialog", { name: "Novo lançamento" });
  await expect(entry.getByLabel("Categoria").locator("option:checked")).toHaveText("Mercado");
  await page.keyboard.press("Escape");
  await expect(entry).toBeHidden();

  // Nova categoria com limite e toque no nome para ver os lançamentos dela.
  await page.getByRole("button", { name: "Nova categoria" }).click();
  const category = page.getByRole("dialog", { name: "Nova categoria" });
  await category.getByLabel("Nome").fill("Pets");
  await category.getByLabel("Limite por mês (opcional)").fill("250");
  await category.getByRole("button", { name: "Criar categoria" }).click();
  await expect(page.getByText("Categoria “Pets” criada.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Pets" })).toBeVisible();
  await page.getByRole("link", { name: "Mercado" }).first().click();
  await page.waitForURL(/\/lancamentos\?cat=/);
  await expect(page.getByRole("button", { name: /^Mercado do mês/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cinema/ })).toBeHidden();

  // Ajustes → Categorias: exclui a personalizada e desfaz.
  await page.goto("/ajustes/categorias");
  await expect(page.getByRole("heading", { name: "Suas categorias" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "ajustes-categorias", project);
  await page.getByRole("button", { name: "Excluir Pets" }).click();
  await expect(page.getByText("Categoria excluída.")).toBeVisible();
  await expect(page.getByText("Pets")).toBeHidden();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Ação desfeita.")).toBeVisible();
  await expect(page.getByText("Pets")).toBeVisible();

  // Metas: vazia → cria → guarda → conclui.
  await page.goto("/planejamento?aba=metas");
  await expect(page.getByText("Nenhuma meta neste espaço")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "planejamento-metas-vazio", project);
  await page.getByRole("button", { name: "Criar meta" }).click();
  const goal = page.getByRole("dialog", { name: "Nova meta" });
  await goal.getByRole("button", { name: "Salvar" }).click();
  await expect(goal.getByText("Dê um nome para a meta, como “viagem de férias”.")).toBeVisible();
  await goal.getByLabel("Nome da meta").fill("Viagem de férias");
  await goal.getByLabel("Quanto precisa juntar").fill("1000");
  await goal.getByLabel("Já guardado").fill("1500");
  await goal.getByRole("button", { name: "Salvar" }).click();
  await expect(goal.getByText("O valor guardado passa da meta. Ajuste um dos dois.")).toBeVisible();
  await goal.getByLabel("Já guardado").fill("");
  await goal.getByLabel("Guardar por mês").fill("250");
  await goal.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Meta salva.")).toBeVisible();
  const card = page.getByRole("region", { name: "Viagem de férias" });
  await expect(card).toContainText("Faltam R$ 1.000,00");

  await card.getByRole("button", { name: "Guardar nesta meta" }).click();
  const deposit = page.getByRole("dialog", { name: /Guardar em/ });
  await expect(deposit.getByLabel("Valor")).toHaveValue("250,00");
  await deposit.getByLabel("Valor").fill("1200");
  await deposit.getByRole("button", { name: "Guardar" }).click();
  await expect(deposit.getByText("Faltam só R$ 1.000,00 para a meta. Digite até esse valor.")).toBeVisible();
  await deposit.getByLabel("Valor").fill("400");
  await deposit.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Valor guardado na meta.")).toBeVisible();
  await expect(card).toContainText("Faltam R$ 600,00");
  await expect(card).toContainText("40%");
  await expectNoSeriousA11yViolations(page);
  await print(page, "planejamento-metas", project);

  await card.getByRole("button", { name: "Guardar nesta meta" }).click();
  await page
    .getByRole("dialog", { name: /Guardar em/ })
    .getByLabel("Valor")
    .fill("600");
  await page
    .getByRole("dialog", { name: /Guardar em/ })
    .getByRole("button", { name: "Guardar" })
    .click();
  const celebration = page.getByRole("dialog", { name: "Meta alcançada!" });
  await expect(celebration).toContainText("Vocês juntaram R$ 1.000,00 para “Viagem de férias”.");
  await print(page, "planejamento-meta-alcancada", project);
  await celebration.getByRole("button", { name: "Continuar" }).click();
  await expect(card).toContainText("Meta concluída");

  // O depósito virou lançamento Guardado deste mês.
  await page.goto("/lancamentos");
  await expect(page.getByRole("button", { name: /^Meta: Viagem de férias/ }).first()).toBeVisible();

  // Próximos meses: com salário e aluguel fixos, a projeção existe.
  await page.goto("/planejamento?aba=proximos");
  await expect(page.getByRole("heading", { name: "Próximos 6 meses" })).toBeVisible();
  await expect(page.getByText("Sobra prevista em 6 meses")).toBeVisible();
  await expect(page.getByRole("heading", { name: "O que muda no caminho" })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await print(page, "planejamento-proximos", project);

  // Simulador.
  await page.goto("/planejamento?aba=simulador");
  await expect(page.getByText("Preencha saldo, juros e parcelas para simular.")).toBeVisible();
  await page.getByLabel("Saldo devedor").fill("100000");
  await page.getByLabel("Juros ao mês (%)").fill("1");
  await page.getByLabel("Parcelas que faltam").fill("12,5");
  await expect(page.getByText("Parcelas que faltam: use um número inteiro de até 600.")).toBeVisible();
  await page.getByLabel("Parcelas que faltam").fill("120");
  await page.getByLabel("Valor extra por mês").fill("300");
  await expect(page.getByText("Parcela calculada")).toBeVisible();
  await expect(page.getByText("Juros economizados")).toBeVisible();
  await expect(page.getByRole("img", { name: /Saldo devedor ao longo do tempo/ })).toBeVisible();
  await page.getByLabel(/Ver o saldo daqui a/).fill("60");
  await expect(page.getByText("Só a parcela:")).toBeVisible();
  await page.getByLabel("Juros ao mês (%)").fill("20");
  await expect(page.getByText(/Juros acima de 15% ao mês parecem errados/)).toBeVisible();
  await page.getByLabel("Juros ao mês (%)").fill("1");
  await expectNoSeriousA11yViolations(page);
  await print(page, "planejamento-simulador", project);
});
