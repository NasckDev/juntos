import type { Category, Kind } from "./types.ts";

/** As 13 categorias padrão do protótipo (globais, iguais para todos os espaços). */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: "moradia", name: "Moradia", icon: "casa", hue: 232, kind: "out" },
  { id: "contas", name: "Contas da casa", icon: "contas", hue: 42, kind: "out" },
  { id: "cartao", name: "Cartões", icon: "cartao", hue: 268, kind: "out" },
  { id: "mercado", name: "Mercado", icon: "mercado", hue: 140, kind: "out" },
  { id: "transp", name: "Transporte", icon: "carro", hue: 18, kind: "out" },
  { id: "assin", name: "Assinaturas", icon: "assinatura", hue: 330, kind: "out" },
  { id: "saude", name: "Saúde", icon: "saude", hue: 172, kind: "out" },
  { id: "educ", name: "Educação", icon: "estudo", hue: 205, kind: "out" },
  { id: "lazer", name: "Lazer", icon: "lazer", hue: 295, kind: "out" },
  { id: "outros", name: "Outros", icon: "caixa", hue: 222, kind: "out" },
  { id: "salario", name: "Salário", icon: "trabalho", hue: 160, kind: "in" },
  { id: "extra", name: "Renda extra", icon: "dinheiro", hue: 42, kind: "in" },
  { id: "reserva", name: "Reserva", icon: "reserva", hue: 214, kind: "save" },
];

export const SUBSCRIPTIONS_CATEGORY_ID = "assin";
export const FALLBACK_CATEGORY_ID = "outros";

type Rule = readonly [categoryId: string, pattern: RegExp];

/** Ordem importa: a primeira regra que casa vence (igual ao protótipo). */
const RULES: readonly Rule[] = [
  ["moradia", /aluguel|condom|ap[êe]|obra|entrada|garagem|iptu|financ/i],
  ["cartao", /nubank|ita[úu]|c6|bradesco|cart[ãa]o|cart[õo]es|fatura/i],
  ["contas", /luz|eletric|energia|[áa]gua|g[áa]s|internet|celular|telefone/i],
  ["assin", /netflix|youtube|game ?pass|disney|hbo|spotify|prime/i],
  ["saude", /conv[êe]nio|sa[úu]de|terapia|farm|m[ée]dic|wellhub|academia|est[ée]tica|dentista/i],
  ["educ", /ingl[êe]s|curso|escola|faculdade|livro/i],
  ["transp", /carro|ipva|seguro|combust|gasolina|uber|habilita|licenciamento|despachante|[ôo]nibus|metr[ôo]/i],
  ["lazer", /passeio|viagem|cinema|restaurante|presente|s[íi]tio|bar\b/i],
  ["mercado", /mercado|feira|padaria|a[çc]ougue/i],
];

const SALARY = /sal[áa]rio|fonte|f[ée]rias|d[ée]cimo|13/i;

/** Sugere a categoria pelo nome do lançamento. */
export function guessCategory(description: string, kind: Kind): string {
  if (kind === "in") return SALARY.test(description) ? "salario" : "extra";
  if (kind === "save") return "reserva";
  for (const [id, pattern] of RULES) if (pattern.test(description)) return id;
  return FALLBACK_CATEGORY_ID;
}

/** Categoria pelo id; id desconhecido cai em "Outros" (igual ao protótipo). */
export function categoryById(id: string, categories: readonly Category[] = DEFAULT_CATEGORIES): Category {
  const found = categories.find((c) => c.id === id) ?? categories.find((c) => c.id === FALLBACK_CATEGORY_ID);
  return found ?? { id: FALLBACK_CATEGORY_ID, name: "Outros", icon: "caixa", hue: 222, kind: "out" };
}

/** Categoria do tipo informado pelo nome (sem diferenciar maiúsculas), ou `undefined`. */
export function categoryByName(
  name: string,
  kind: Kind,
  categories: readonly Category[] = DEFAULT_CATEGORIES,
): Category | undefined {
  const wanted = name.trim().toLowerCase();
  return categories.find((c) => c.kind === kind && c.name.toLowerCase() === wanted);
}
