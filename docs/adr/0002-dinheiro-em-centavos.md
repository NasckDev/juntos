# ADR 0002: Dinheiro em centavos inteiros

- **Status:** aceito
- **Data:** 2026-11-19

## Contexto

O protótipo guarda valores em `number` com duas casas (`r2`). Somas em ponto flutuante acumulam erro
(`0.1 + 0.2 !== 0.3`), e a divisão de contas e as projeções somam centenas de valores.

## Decisão

- Banco: `bigint` em centavos (`amount_cents`). API e core: inteiros em centavos.
- Conversão de texto para centavos só em um lugar (`parseMoney` do core), com testes para "1.200", "1.200,50" e "12,5".
- Divisões (proporcional à renda, Price) calculam em centavos e distribuem o resto do arredondamento de forma determinística.
- Formatação para a tela só com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.

## Consequências

- Nada de `toFixed` para dinheiro. A regra entra no `CLAUDE.md` e na revisão de código.
