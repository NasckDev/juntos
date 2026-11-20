# 6. Design: direção visual, design system e shell

Complementa a seção 5.8 da especificação. Os textos, as regras e o comportamento continuam vindo do protótipo
(`prototipo/index.html`); este documento decide **como o app se parece**, principalmente no computador.

Revisão visual ao vivo: `/galeria` (só fora de produção) mostra todos os componentes, estados e temas.

## 6.1 Diagnóstico do protótipo no computador

Olhando os prints em `docs/prints/*-computador.webp` (1440 × 900):

1. **Letra pequena para a tela.** O corpo é 14 px e quase tudo que é secundário tem 12 a 13 px (`.8125rem`, `.75rem`).
   Num monitor a 60 cm isso cansa, principalmente para quem tem mais de 50 anos, que é parte do público.
2. **Tudo é o mesmo card.** Resumo, listas e gráficos são caixas brancas com a mesma borda cinza clara, o mesmo raio e
   o mesmo título de 14 px. Nada diz "comece por aqui". O número que importa (quanto sobra) compete com o resto.
3. **Largura sem controle.** O conteúdo estica até 1100 px. Em "Próximos vencimentos" o nome fica a 600 px do valor e
   o olho precisa atravessar a tela para ligar um ao outro. Na Lista, Dia/Quem/Pago com viram colunas cinza soltas.
4. **Grade irregular.** Os cards de duas colunas têm alturas diferentes: a rosca de 110 px fica sozinha num card alto,
   com um vazio grande embaixo; o gráfico do saldo ocupa uma faixa larga e baixa.
5. **Barra lateral apagada.** Fundo quase branco, itens de 13 px em cinza, item ativo num cinza um pouco mais escuro.
   Não ancora a tela nem mostra onde a pessoa está.
6. **Contraste no limite.** O cinza secundário (`#666b78`) passa em AA, mas em 12 px fica fraco; os rótulos de
   legenda e as variações ("4% acima de outubro") são os primeiros a sumir.
7. **Identidade genérica.** O índigo `#4f46e5` com cards brancos e cinza claro é a cara de qualquer painel SaaS.

O celular está bom: hierarquia clara, alvos grandes, uma coluna. O problema é o computador ser o celular esticado.

## 6.2 Direção: "o quadro da casa"

Um app de finanças da casa é consultado de relance (quanto sobra? o que vence?) e usado em rajadas curtas (marcar
como pago, lançar). A direção é a de um quadro de avisos bem organizado da casa: **um número em destaque, o resto em
ordem e calmo**.

Princípios:

- **Ousadia num lugar só: o resumo do mês.** É o único bloco escuro em fundo claro (e o único levemente tingido de
  destaque no escuro). O valor da sobra é o maior texto do app, com os centavos menores. Todo o resto é discreto.
- **O dinheiro é tipografia.** Valores sempre em números tabulares, alinhados à direita nas listas, sinal "−" e "+"
  explícitos e cor como reforço (nunca como único sinal). Centavos em peso menor nos valores grandes.
- **Superfícies com hierarquia, não cards iguais.** Três níveis: fundo da página (`--bg`), painel (`--surface` com
  borda) e o resumo (`--hero`). Dentro do painel, listas são linhas, não cards dentro de cards.
- **Largura de leitura.** Conteúdo com no máximo 1200 px; listas de duas colunas (nome e valor) nunca passam de
  ~640 px de largura, para o valor ficar perto do nome.
- **Mais letra, menos cinza.** Corpo de 15 px no computador e 16 px no celular; nada menor que 13 px exceto contadores,
  teclas de atalho e os rótulos da barra inferior do celular (11 px, sempre com ícone de 24 px, para "Lançamentos"
  caber em 1/5 de 360 px). Cinza secundário mais escuro que o do protótipo.
- **Calma.** Sem animação de entrada em cada bloco. Movimento só para responder a uma ação (abrir painel, marcar como
  pago, trocar de mês). `prefers-reduced-motion` desliga tudo.

## 6.3 Grade e pontos de quebra

| Faixa | Largura | Casca | Grade do conteúdo |
| --- | --- | --- | --- |
| Celular | até 639 px | Topo fixo com vidro + barra inferior de 5 itens + botão flutuante | 1 coluna, margem de 16 px |
| Tablet | 640 a 1023 px | Igual ao celular | 2 colunas onde couber, margem de 24 px |
| Computador | 1024 px ou mais | Barra lateral de 264 px | 12 colunas, espaço de 24 px, máximo de 1200 px, margem de 40 px |

O ponto de troca da casca é `lg` (1024 px), o mesmo usado pelo `ResponsiveSheet` (painel lateral × folha de baixo).
Sem rolagem lateral em 360 px: todo texto longo quebra ou corta com reticências, tabelas viram listas.

## 6.4 Tipografia

Uma família só, **Inter** (via `next/font`, com `cv11` e `ss01` como no protótipo), números tabulares em valores.
A personalidade vem de tamanho, peso e espaçamento, não de uma segunda fonte.

| Papel | Tamanho | Peso | Entrelinha | Espaço entre letras |
| --- | --- | --- | --- | --- |
| Valor do resumo (`text-display`) | 40 px celular / 56 px computador | 700 | 1.0 | −0,04 em |
| Título de página (`text-title`) | 24 px / 30 px | 650 | 1.15 | −0,03 em |
| Título de seção (`text-lg`) | 18 px | 600 | 1.3 | −0,015 em |
| Valor em destaque (`text-xl`/`2xl`) | 20 a 24 px | 650 | 1.2 | −0,02 em |
| Corpo (`text-base`) | 16 px celular / 15 px computador | 400 a 500 | 1.5 | 0 |
| Secundário (`text-sm`) | 14 px | 400 a 500 | 1.45 | 0 |
| Legenda (`text-xs`) | 13 px | 500 | 1.4 | 0 |

Os quatro tamanhos de letra do usuário (87,5 %, 100 %, 112,5 %, 125 %) mudam o `font-size` do `<html>`; como tudo é
em `rem`, a interface inteira escala junto. Sem caixa-alta em rótulos.

## 6.5 Cores

Tokens em `src/app/globals.css`, expostos ao Tailwind por `@theme inline` (classes `bg-surface`, `text-muted`,
`border-line`, `text-in`, `bg-out-soft` etc.).

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#f6f7f9` | `#0b0c0f` | Fundo da página no computador (no celular, igual a `--surface`) |
| `--side` | `#ffffff` | `#0e0f12` | Barra lateral |
| `--surface` / `2` / `3` | `#fff` / `#f6f7f9` / `#eceef2` | `#121318` / `#16181d` / `#1e2027` | Painéis, hover, trilhos |
| `--ink` | `#0f1117` | `#ececf0` | Texto principal |
| `--muted` | `#585d6b` (6,6:1) | `#a3a7b3` (7,9:1) | Texto secundário |
| `--line` / `--line2` | `#e6e8ec` / `#d5d9e0` | `#22242b` / `#2e313a` | Divisórias e bordas de campo |
| `--hero` | tinta índigo profunda `hsl(h 32% 14%)` | `hsl(h 22% 13%)` | Resumo do mês |
| `--in` / `--out` / `--save` / `--warn` | `#097650` / `#c42d4b` / `#2361c9` / `#8f5300` | `#3ccf96` / `#f2879b` / `#82b2f7` / `#eab65a` | Entrada, saída, guardado, alerta |

Cor de destaque: 11 opções do protótipo (`ACC`), em HSL com `--h --s --l`, escolhidas por `data-accent` no `<html>`.
`--brand` (botão primário), `--brand-text` (links, 12 pontos mais escuro no claro), `--brand-soft` (fundos suaves).
Todas passam 4,5:1 com o texto do botão nos dois temas.

As cores semânticas sempre vêm acompanhadas de sinal ou texto ("− R$ 86,00", "Atrasado", "Passou R$ 492"); a cor só
reforça.

## 6.6 Espaçamento, raios e sombras

- Escala de 4 px (Tailwind padrão). Painéis com 20 px de respiro no celular e 24 px no computador.
- Raios por hierarquia: painel 16 px, resumo 20 px, campo e botão 10 px, chip e contador redondos, avatar redondo.
- Sombra só no que flutua (popover, paleta, painel lateral, toast): `--pop`. Painéis no chão não têm sombra.

## 6.7 Movimento

- Painel lateral entra da direita (220 ms, `cubic-bezier(.2,.8,.2,1)`); folha de baixo sobe (gerida pelo `vaul`).
- Popover do mês e paleta: 140 ms de opacidade e escala de 98 % para 100 %.
- Botão flutuante some ao rolar para baixo e volta ao rolar para cima.
- Barras e rosca não animam ao carregar.
- `@media (prefers-reduced-motion: reduce)` zera transições e animações.

## 6.8 Casca (`components/shell`)

**Computador:** barra lateral fixa de 264 px em `--side` com borda à direita. De cima para baixo: marca, seletor de
espaço (quadrado com inicial, nome, "2 pessoas"), botão "Novo lançamento" (atalho N), busca com `Ctrl K`, os 5
destinos principais, espaço flexível, Notificações (com contador), Importar e exportar, Ajustes, e o rodapé com o
usuário, esconder valores e o sino. Item ativo: fundo `--brand-soft`, texto `--brand-text`, ícone `--brand`, peso 600.

**Celular:** topo fixo com vidro (fundo 85 % + desfoque) com o seletor de espaço, busca, esconder valores, sino e
avatar; barra inferior de 5 itens (Início, Lançamentos, Planejar, Divisão, Relatórios) com área segura do iOS; botão
flutuante "Novo lançamento" acima da barra, que some ao rolar.

Link "Pular para o conteúdo" é o primeiro foco da página. O shell recebe tudo por props; não busca dados.

`PageHeader`: título, subtítulo, ações e seletor de mês. No computador, título à esquerda e ações à direita na mesma
linha; no celular, o seletor de mês ocupa a largura toda embaixo do título.

## 6.9 Layout das telas no computador

### Início

```
┌ Boa noite, Rafa ─────────────────────────────── [‹ Novembro 2026 ›] [+ Entrada] [+ Saída] ┐
│ Casa, novembro 2026                                                                       │
├───────────────────────────────────────────────────────────┬───────────────────────────────┤
│ RESUMO (8 col., fundo --hero)                              │ Entrou      R$ 16.100,00      │
│ Deve sobrar até o fim de novembro                          │ 4% acima de outubro           │
│ R$ 4.265,00                                                 │ Saiu        R$ 11.435,00      │
│ Até hoje entrou R$ 13.000 e saiu R$ 6.819                  │ Guardado    R$ 400,00         │
│ [████████████▒▒▒▒▒▒▒▒░██████████]  legenda                 │ (4 col., painel)              │
├──────────────────────────────────┬────────────────────────┴───────────────────────────────┤
│ Próximos vencimentos (6 col.)    │ Para onde foi o dinheiro (6 col.)                       │
│ [20] MEI · Outros      − R$ 86   │  (rosca 168 px)   Cartões   R$ 4.092  36%               │
│ [20] Parcela do carro  − R$ 790  │                   Moradia   R$ 3.990  35% …             │
├──────────────────────────────────┴─────────────────┬──────────────────────────────────────┤
│ Saldo do mês, dia a dia (8 col.)                    │ Orçamento (3 mais apertados)         │
│                                                     │ Metas (2)  (4 col.)                  │
└─────────────────────────────────────────────────────┴──────────────────────────────────────┘
```

- Os três números de apoio saem de dentro do resumo e vão para uma coluna própria: o resumo fica com uma mensagem só.
- Linhas da lista com a data num bloco à esquerda ("20" grande, "nov" pequeno): ancora o olho e encurta a linha.
- A rosca cresce para 168 px e a legenda fica ao lado, alinhada pelo valor.
- Estado vazio (conta nova): o resumo vira "Comece por aqui" com os 3 passos do protótipo, na mesma área.

### Lançamentos (Lista)

- Barra de filtros numa linha: busca (flexível), categoria, ordenação, e os chips embaixo.
- Tabela com colunas fixas: marcar pago (44 px), lançamento (nome, etiquetas e categoria embaixo), dia, quem,
  pago com, valor. Grupos (Atrasados, Em aberto, Concluídos) com título em peso 600 e subtotal à direita, sem
  caixa-alta. Linha com 56 px de altura e hover em `--surface2`.
- Painel lateral de 440 px para criar e editar (o `ResponsiveSheet`), sem tirar a lista de vista.

### Planejamento

- Abas em linha embaixo do cabeçalho (Orçamento, Metas, Próximos meses, Simulador), estado na URL.
- Orçamento: resumo do total numa faixa (gasto × limite e barra), depois a lista de categorias em duas colunas
  de informação: nome e barra (8 col.) e o valor restante e as ações (4 col.), com a barra limitada a 480 px.
- Metas: grade de 3 colunas de cartões com progresso; Próximos meses: barras de 6 meses (8 col.) + "O que muda no
  caminho" (4 col.) e a tabela embaixo.

## 6.10 Layout das telas no celular

- Uma coluna, margem de 16 px, painéis com 20 px de respiro e 16 px entre eles.
- Início: saudação, seletor de mês em largura total, resumo (os três números ficam dentro dele, em 3 colunas),
  próximos vencimentos, rosca, saldo, orçamento e metas.
- Lista: busca e chips roláveis no topo; linhas com 56 px (alvo de 44 px no botão de pago).
- Formulários sempre em folha de baixo (`vaul`), com campos de 16 px (evita o zoom do iOS) e botão de salvar fixo
  no rodapé da folha.

## 6.11 Componentes (resumo)

Ver `/galeria` para os estados. Base em `src/components/ui`, gráficos em `src/components/charts`, casca em
`src/components/shell`. Variantes com `class-variance-authority`, classes unidas com `cn` (`src/lib/cn.ts`).

## 6.12 Preferências e anti-flash

`<html>` recebe `data-theme` (`light`, `dark` ou ausente para seguir o sistema), `data-accent` (uma das 11 chaves),
`data-font` (`menor`, `normal`, `grande`, `maior`) e `data-hide` (`true` desfoca valores). Um script inline com o
nonce da CSP lê `localStorage["juntos:prefs"]` antes da primeira pintura; quem salvar as preferências no servidor
(`user_preferences`) deve espelhar nesse item para a próxima visita abrir sem piscar.
