# 1. Inventário do protótipo

Levantamento completo de [`prototipo/index.html`](../prototipo/index.html), a fonte da verdade de UX, textos e regras
de negócio. Cada regra aponta a função do protótipo onde ela está implementada hoje, para o porte ir direto ao ponto.

## 1.1 Telas e fluxos

| Rota (hash) | Tela | O que tem |
| --- | --- | --- |
| *(sem login)* | **Entrada** | Continuar com Google (simulado no protótipo) ou Testar como convidado; três destaques do produto; arte com dados fictícios. Depois, **Boas-vindas**: nome e escolha entre dados de exemplo e começar do zero. |
| `#geral` | **Início** | Saudação por horário; aviso de convidado; estado vazio com 3 passos; resumo do mês ou período (sobra prevista, "até hoje", entrou/saiu/guardado com variação contra o período anterior); barra de destino do dinheiro (já pago, falta pagar, guardado, sobra); próximos vencimentos (atrasados e próximos 7 dias); saldo dia a dia (no período, barras por mês); Vale saber; Para onde foi o dinheiro (rosca com top 5 + demais); Orçamento (3 categorias mais apertadas); Metas (2). |
| `#lancamentos` | **Lançamentos: Lista** | Busca por nome e observação, opção "buscar em todos os meses", filtro de categoria, ordenação (situação e dia, maior valor, nome), chips (Todos, Em aberto, Entradas, Saídas, Guardado), grupos Atrasados, Em aberto e Concluídos com subtotal, rodapé com totais. |
| | **Lançamentos: Calendário** | Grade do mês com totais por dia (pontos coloridos no celular), dia de hoje marcado, painel do dia com "Adicionar". Sempre um mês só. |
| | **Lançamentos: Contas fixas** | Resumo mensal (contas anuais divididas por 12), parcelamentos com progresso e quanto falta, grupos por tipo, editar, pausar, retomar e excluir. |
| `#planejar` | **Orçamento** | Total gasto contra o limite somado; sugestão pela média de 3 meses; lista de categorias com barra, "+" para lançar direto na categoria, definir ou editar limite, nova categoria; toque no nome abre a lista filtrada. |
| | **Metas** | Cards com progresso, valor por mês, previsão de data; "Guardar nesta meta" (vira lançamento Guardado) e celebração ao concluir. |
| | **Próximos meses** | 6 meses: sobra acumulada, mês mais apertado, média de variáveis, contas fixas; barras; "O que muda no caminho" (parcelas que terminam, contas anuais que chegam); tabela. |
| | **Simulador de quitação** | Tabela Price com saldo, juros, parcelas e valor extra; pode partir de um parcelamento do usuário; juros e tempo economizados; gráfico do saldo devedor. |
| `#divisao` | **Divisão de contas** | Veredito ("Lu deve R$ X a Rafa"), registrar e desfazer acerto, modo de divisão (iguais, proporcional à renda, personalizado para 2), cards por pessoa (pagou, parte justa, saldo), lançamentos sem "quem pagou", o que cada um pagou. |
| `#relatorios` | **Relatórios** | Resumo do período, barras de 12 meses (clicar escolhe o mês), maiores saídas, categorias do ano, por forma de pagamento, tabela anual com links, exportar o ano. |
| `#avisos` | **Notificações** | "Precisa da sua atenção" (avisos ativos) e histórico agrupado por dia, com filtros (todas, não lidas, contas, automáticos, pessoas, orçamento e metas) e "marcar todas como lidas". Guarda os últimos 200. |
| `#dados` | **Importar e exportar** | *Exportar*: formato (Excel no modelo da planilha, PDF, CSV), período até 36 meses com atalhos, filtros de tipo, situação, pessoa e categoria, resumo ao vivo, cópia de segurança JSON. *Importar*: revisão linha a linha, marcação "Já existe", ano da planilha, destino (este espaço ou novo) e modo (somar ou substituir), com desfazer. |
| `#ajustes` | **Ajustes** | *Conta* (nome, e-mail, 24 avatares em 3 grupos, entrar com Google, baixar dados, sair, excluir); *Aparência* (tema, 11 cores, 4 tamanhos de letra, esconder valores); *Avisos* (6 tipos + resumo semanal no WhatsApp com prévia); *Pessoas e compartilhamento* (membros, papéis, convite, renomear e excluir espaço); *Categorias*; *Dados* (importar, exportar, restaurar exemplo, começar do zero). |

### Padrões globais
- **Navegação:** barra lateral no computador; barra inferior com 5 itens e botão flutuante (que some ao rolar) no celular; rota no hash, voltar do navegador funciona.
- **Espaços:** seletor de espaço (Casa, Só meu, Viagem), cada um com lançamentos, metas, pessoas e orçamento próprios.
- **Seletor de mês:** abre ao clicar; grade de meses, troca de ano, modo Período (até 3 meses) com atalhos "últimos 3" e "próximos 3"; botão "Mês atual".
- **Busca Ctrl/⌘+K:** ações, páginas e lançamentos de todos os meses, com navegação por setas.
- **Atalhos:** `N` novo lançamento, `/` buscar, `←` `→` mês, `?` lista de atalhos, `Esc` fecha.
- **Formulários:** gaveta lateral no computador, folha de baixo no celular; erro embaixo do campo com `aria-invalid` e `aria-describedby`; valor em reais formatado ao sair do campo.
- **Desfazer** no toast em vez de pedir confirmação nas ações reversíveis (`act`).
- **Esconder valores** (desfoque) em toda a interface.
- **Acessibilidade:** link "pular para o conteúdo", foco visível, alvos de 44 px no celular, `prefers-reduced-motion` desliga animações, `aria-label` com a frase completa em cada barra de gráfico.

## 1.2 Componentes de interface

Botão (primário, linha, fantasma, perigo, pequeno, bloco), botão de ícone com contador, chip, segmentado, interruptor,
campo de dinheiro, campo com erro, select, abas, card, estatística, resumo (hero), barra de fluxo, rosca, gráfico de
barras com dica e eixo arredondado, linha do saldo diário, calendário, linha de lista e de tabela, botão de "pago",
etiqueta (atrasado, parcela, anual, pessoal), barra de progresso, estado vazio com ilustração, gaveta e folha,
paleta de comandos, toast com desfazer, seletor de mês, avatar e seletor de avatar, seletor de tema e de cor,
item de notificação, chave-valor (kv), linha de nota.

**Tokens:** fonte Inter; paleta clara e escura (superfícies, tinta, linhas, entrada `--in`, saída `--out`, guardado
`--save`, alerta `--warn`); 11 cores de destaque em HSL; 4 tamanhos de letra (87,5 %, 100 %, 112,5 %, 125 %); raios
de 0,3 a 1,25 rem; sombra de janela `--pop`.

## 1.3 Regras de negócio

| Regra | Onde está no protótipo | Observação para o porte |
| --- | --- | --- |
| Leitura de valores em pt-BR ("1.200" = 1200; "1.200,50"; "12,5") | `parseMoney` | "1.5" vira 1,5 (ambíguo); definir e testar. Hoje arredonda para 2 casas em ponto flutuante: no app, **centavos inteiros**. |
| Categoria sugerida pelo nome | `guessCat`, `RULES` | Regex por categoria; entradas viram Salário ou Renda extra. Ao digitar um nome já usado, repete categoria, valor, forma e pessoa do último. |
| Recorrência mensal, anual e parcelada | `ensureMonth`, `addFromRec` | Mês gerado uma vez por espaço (`generated[ym]`), o que torna o lançamento idempotente. Dia ajustado ao fim do mês (31 em fevereiro). Meses passados e o dia de hoje já nascem pagos. |
| Editar "só neste mês" ou "neste e nos próximos" | `submit #txf` | "Próximos" muda o modelo e só os futuros **em aberto**. |
| Pausar, retomar e excluir conta fixa | `A.recpause`, `A.recdel` | Pausar apaga os futuros em aberto; retomar recria; excluir mantém o histórico desligado do modelo. |
| Situação | `isLate`, `rowc` | Atrasado = vencido e não pago (não vale para entradas). Início lista o que vence em até 7 dias; aviso usa 3 dias. |
| Totais do mês | `totals` | Entrou, saiu (pago e a pagar), guardado e sobra (`in - out - save`). |
| Período de até 3 meses | `rangeCan`, `yms`, `SPAN` | Vale para Início, Lista, Orçamento, Divisão e Relatórios. Calendário volta a um mês. Comparação com o período anterior de mesmo tamanho. |
| Divisão | `division` | Só saídas pagas, não pessoais e com "quem pagou". Modos: iguais, proporcional à renda do período (cai para iguais sem renda), personalizado só com 2 pessoas. Quitação gulosa entre devedores e credores; acertos registrados entram no saldo. |
| Orçamento | `pOrc`, `budauto`, `spent` | Limite mensal × meses do período. Sugestão = média de 3 meses arredondada **para cima de 50 em 50**. |
| Metas | `pMetas`, `depf` | Previsão = meses até completar com o valor mensal. Depósito não passa do que falta e gera um lançamento "Guardado". |
| Projeção de 6 meses | `pProj` | Contas já lançadas + média dos gastos não recorrentes dos 3 meses anteriores com dados, menos o variável já lançado em cada mês futuro. |
| Simulador Price | `simOut`, `simSaldo` | Parcela Price; juros acima de 15 % ao mês viram alerta; até 600 parcelas inteiras; saldo estimado a partir de um parcelamento. |
| Vale saber | `tips` | Até 3: saídas maiores que entradas, 90 % comprometido, conta fixa que subiu mais de R$ 50, parcelamento que termina em até 6 meses, conta anual em até 3 meses (sugere guardar por mês, arredondado de 10 em 10), assinaturas somadas por ano. |
| Notificações | `notifs`, `syncEv`, `logEv` | Atrasadas, vencendo em 3 dias, orçamento em 90 % ou mais, meta alcançada, convite pendente, contas fixas lançadas no mês. Deduplicação por chave; histórico de 200. |
| Lançamento duplicado | `submit #txf` | Mesmo nome, valor, tipo e dia: avisa e deixa salvar se tocar de novo. |
| Validações | `fieldError` e cada `submit` | Mensagens prontas para cada campo (valor, descrição, data, parcelas de 2 a 480, e-mail, nomes repetidos de meta, espaço e categoria). |
| Importação | `parseBook`, `doImport`, `dImport` | Dois formatos: planilha mensal (abas Janeiro a Dezembro, seções Renda mensal, Despesas mensais com situação, Economia mensal, subseção "Apê", parcela "7/29" no nome) e aba "Lançamentos" do próprio app. Marca o que já existe; ano, destino e modo somar ou substituir; desfazer. |
| Exportação | `expFilt`, `buildXlsx`, `buildPdf`, `doExport` | Filtros de período (até 36 meses), tipo, situação, pessoa e categoria. Excel com uma aba por mês (fórmulas em C4 a C10 e B11), Visão Geral com somas 3D entre abas e aba Lançamentos para reimportar; PDF com resumo e tabela; CSV com BOM e `;`. |

## 1.4 Pontos do protótipo que não devem ir para o app

- **Dinheiro em ponto flutuante** (`r2`): trocar por centavos inteiros.
- **Login com Google simulado** e dados só no `localStorage`.
- **Código morto:** `bellDlg`, a primeira versão de `A.import` (chama `loadXlsx`, que não existe) e várias ações de `A` redefinidas depois por versões com desfazer.
- **Pequenos desvios a decidir:** `tips` começa com `ym0=ym0||ym0` (sem efeito); o acerto no modo período fica gravado só no primeiro mês; "vence em breve" é 7 dias no Início e 3 dias nos avisos.
- **Bibliotecas por CDN** (SheetJS, ExcelJS, jsPDF): no app, leitura e geração de arquivos no servidor.
