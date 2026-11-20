<div align="center">

# Juntos

**As contas da casa, em um lugar só. Sozinho ou a dois.**

[![CI](https://github.com/NasckDev/juntos/actions/workflows/ci.yml/badge.svg)](https://github.com/NasckDev/juntos/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)
![Fase](https://img.shields.io/badge/fase-9%20%C2%B7%20acabamento%20e%20publica%C3%A7%C3%A3o-4f46e5)
![Contas](https://img.shields.io/badge/contas-come%C3%A7am%20vazias-0d8a5c)

[Plano de fases](docs/03-plano-de-fases.md) ·
[Especificação técnica](docs/05-especificacao-tecnica.md) ·
[Design](docs/06-design.md) ·
[Publicação](docs/07-publicacao.md) ·
[Decisões (ADRs)](docs/adr/)

<img src="docs/prints/app/juntos-inicio-computador.webp" alt="Início do Juntos no computador: quanto deve sobrar até o fim do mês, o que entrou e saiu, próximos vencimentos e para onde foi o dinheiro" width="900">

</div>

## O problema

Um casal organizava o ano numa planilha do Excel: uma aba por mês, com **Renda mensal**, **Despesas mensais** (e uma
coluna dizendo se já foi pago) e **Economia mensal**, mais uma aba de Visão Geral. Funcionava, mas:

- toda conta fixa e toda parcela precisavam ser digitadas de novo a cada mês;
- ninguém sabia, no meio do mês, quanto ia sobrar até o fim;
- dividir as contas de forma justa entre os dois era feito de cabeça;
- no celular, onde 90 % do uso acontece, a planilha é quase inutilizável.

O **Juntos** faz tudo o que a planilha fazia e resolve esses quatro pontos, sem obrigar ninguém a abandonar o Excel:
ele importa a planilha antiga e exporta de volta no mesmo modelo, com as fórmulas nas mesmas células.

## O que o app faz

| | |
| --- | --- |
| **Contas que se lançam sozinhas** | Fixas, anuais e parceladas ("5 de 54") entram todo mês, de forma idempotente, ao abrir o mês e pela rotina diária. Editar vale "só neste mês" ou "neste e nos próximos". |
| **Quanto vai sobrar** | Sobra prevista até o fim do mês, o que já foi pago e o que falta, saldo dia a dia, calendário e comparação com o mês anterior. |
| **Divisão justa** | Partes iguais, proporcional à renda ou personalizada. Mostra quem deve quanto a quem e registra o acerto, com desfazer. |
| **Planejamento** | Orçamento por categoria (com sugestão pela média de 3 meses), metas com previsão de data, projeção de 6 meses e simulador de quitação (Tabela Price). |
| **Planilha de volta** | Importa a planilha mensal (`.xlsx`, lida no servidor) com revisão linha a linha; exporta Excel no mesmo modelo, PDF e CSV, com filtros. |
| **Avisos** | Central de notificações com histórico (contas atrasadas, vencendo, orçamento no limite, metas, convites) e push no aparelho. |
| **Sozinho ou a dois** | Login com Google ou como convidado (que depois vira conta Google sem perder dados), convite por link e papéis: dono, edita ou só vê. |
| **Feito para o celular** | Barra inferior, botão flutuante, folhas de baixo, alvos de 44 px, busca Ctrl/⌘+K, desfazer, tema claro e escuro, 11 cores e 4 tamanhos de letra. No computador, layout próprio. |

Toda conta começa **vazia**: só as categorias padrão existem. A tela inicial guia os primeiros passos (lançar o que
entra, as contas fixas ou importar a planilha).

<p>
<img src="docs/prints/app/juntos-inicio-celular.webp" alt="Início no celular, com a sobra prevista do mês e os próximos vencimentos" width="250">
<img src="docs/prints/app/juntos-lancamentos-celular.webp" alt="Lançamentos no celular, agrupados em atrasados, em aberto e concluídos" width="250">
<img src="docs/prints/app/juntos-divisao-celular.webp" alt="Divisão de contas no celular, proporcional à renda, com quem deve a quem" width="250">
</p>

<details>
<summary>Mais telas</summary>

![Lançamentos do mês agrupados em atrasados, em aberto e concluídos](docs/prints/app/juntos-lancamentos-computador.webp)
![Calendário do mês com o total de cada dia](docs/prints/app/juntos-calendario-computador.webp)
![Contas fixas, parcelamentos e quanto sobra livre por mês](docs/prints/app/juntos-contas-fixas-computador.webp)
![Orçamento por categoria com limite, gasto e quanto resta](docs/prints/app/juntos-orcamento-computador.webp)
![Metas com progresso, guardado por mês e previsão](docs/prints/app/juntos-metas-computador.webp)
![Próximos 6 meses e o que muda no caminho](docs/prints/app/juntos-proximos-meses-computador.webp)
![Divisão de contas proporcional à renda, com o acerto do mês](docs/prints/app/juntos-divisao-computador.webp)
![Relatórios com entradas e saídas de cada mês do ano](docs/prints/app/juntos-relatorios-computador.webp)
![Exportação com formato, período e filtros](docs/prints/app/juntos-exportar-computador.webp)
![Revisão da importação: o que já existe vem desmarcado](docs/prints/app/juntos-importar-computador.webp)
![Central de notificações](docs/prints/app/juntos-notificacoes-computador.webp)
![Ajustes de aparência: tema, cor de destaque e tamanho da letra](docs/prints/app/juntos-ajustes-computador.webp)
![Início de uma conta nova, vazia, com os três primeiros passos](docs/prints/app/juntos-inicio-vazio-computador.webp)
![Início no tema escuro](docs/prints/app/juntos-inicio-computador-escuro.webp)
![Tela de entrada](docs/prints/app/juntos-entrada-computador.webp)

<img src="docs/prints/app/juntos-novo-lancamento-celular.webp" alt="Novo lançamento na folha de baixo, no celular" width="250">
<img src="docs/prints/app/juntos-orcamento-celular.webp" alt="Orçamento no celular" width="250">
<img src="docs/prints/app/juntos-inicio-celular-escuro.webp" alt="Início no celular, tema escuro" width="250">

</details>

Os prints são do app de verdade, com dados fictícios cadastrados pela própria interface por
`apps/web/scripts/gerar-prints.ts`. Os prints antigos em [`docs/prints/`](docs/prints/) ficam só como histórico do
protótipo.

## Onde o projeto está

O projeto segue um plano em fases ([detalhes e critérios de aceite](docs/03-plano-de-fases.md)):

```mermaid
flowchart LR
  F0["0. Protótipo ✅"] --> F1["1. Base ✅"]
  F1 --> F2["2. Núcleo ✅"]
  F2 --> F3["3. Dados e acesso ✅"]
  F3 --> F4["4. Lançamentos ✅"]
  F4 --> F5["5. Visão ✅"]
  F5 --> F6["6. Planejamento e divisão ✅"]
  F6 --> F7["7. Importar e exportar ✅"]
  F7 --> F8["8. Notificações ✅"]
  F8 --> F9["9. Acabamento e produção"]
```

O app full stack está no código e testado. A **Fase 9** cuida do acabamento e da publicação: o passo a passo para pôr
no ar na Vercel, com banco Neon, login com Google, rotina diária e push, está em
[docs/07-publicacao.md](docs/07-publicacao.md).

O protótipo navegável da Fase 0 continua em `prototipo/` como fonte da verdade de UX, textos e regras
([ADR 0001](docs/adr/0001-prototipo-como-fonte-da-verdade.md)).

### Arquitetura

```mermaid
flowchart TB
  subgraph Navegador
    UI["Telas e componentes<br/>React 19 · Tailwind v4 · Radix · vaul · cmdk"]
    SW["Service worker<br/>notificações push"]
  end
  subgraph Web["apps/web · Next.js 16 (App Router)"]
    Proxy["proxy.ts<br/>CSP com nonce"]
    Actions["Server Actions + Zod<br/>requireMember(espaço, papel)"]
    Routes["Route Handlers<br/>importar · exportar · auth · cron"]
    Auth["Better Auth<br/>Google + convidado"]
  end
  Core["packages/core<br/>regras puras em centavos: recorrência,<br/>divisão, orçamento, projeção, planilha"]
  Db[("Drizzle ORM<br/>PGlite no dev e nos testes · Neon em produção")]
  Cron["Vercel Cron<br/>/api/cron/diario"]
  Push["web-push (VAPID) · Resend (opcional)"]

  UI --> Proxy --> Actions
  UI --> Routes
  Actions --> Core
  Routes --> Core
  Actions --> Db
  Routes --> Db
  Auth --> Db
  Cron --> Routes
  Routes --> Push --> SW
```

Stack e trocas em relação ao plano inicial: [ADR 0005](docs/adr/0005-stack-ajustada-para-funcionar-sem-contas.md)
(npm workspaces + Turborepo, Server Actions no lugar de tRPC, Vercel Cron no lugar de Inngest, ExcelJS para ler e gerar
planilhas, gráficos em SVG próprio). Outras decisões: [dinheiro em centavos inteiros](docs/adr/0002-dinheiro-em-centavos.md)
e [repositório público sem dados reais](docs/adr/0003-repositorio-publico-sem-dados-reais.md).

## Segurança e privacidade

- Nenhum dado real no repositório: só nomes e e-mails fictícios (`example.com`). `scripts/verificar-privacidade.mjs`
  barra planilhas, CSV, PDF, `.env`, tokens e e-mails reais, e roda no CI.
- Toda consulta filtra pelo espaço e confere o papel de quem pede no servidor; convite por link de uso único (só o hash
  fica no banco), que expira em 7 dias.
- Importação só de `.xlsx`, até 4 MB, lida no servidor. Segredos só em variáveis de ambiente, validadas ao subir.
- Content-Security-Policy com nonce, `nosniff`, HSTS e `Permissions-Policy` fechada.
- Vulnerabilidades: veja [SECURITY.md](SECURITY.md).

## Rodar localmente

Requer Node 20 ou mais novo (o CI usa o 22).

```bash
npm install
npm run db:migrate -w web   # cria o banco local (PGlite em apps/web/.data) com as categorias padrão
npm run dev                 # http://localhost:3010
npm run verify              # privacidade, lint, tipos, testes e build
```

Sem nenhuma variável, o app roda com banco local e só o login como convidado. Para o Google, push e e-mail, copie
`apps/web/.env.example` para `apps/web/.env.local` e preencha (cada variável está explicada no arquivo e em
[docs/07-publicacao.md](docs/07-publicacao.md)).

### Testes

```bash
npm run test                # núcleo (Vitest com cobertura) e app (servidor com PGlite em memória e componentes)
npm run test:e2e            # ponta a ponta com Playwright e axe, no celular (390 px) e no computador (1440 px)
```

Na primeira vez, baixe o navegador dos testes com `npx playwright install chromium`. Os testes de ponta a ponta sobem
um servidor próprio, com banco temporário, e cobrem conta nova, lançamentos, planejamento, divisão entre duas pessoas
com convite, importar e exportar, notificações e ajustes.

Para regenerar os prints deste README: `cd apps/web && npx tsx scripts/gerar-prints.ts`.

## Estrutura

```text
apps/web/                 o app (Next.js): rotas em src/app, telas em src/components, servidor em src/server
apps/web/e2e/             testes de ponta a ponta (Playwright)
apps/web/scripts/         servidor dos testes, migrações no deploy, chaves VAPID e geração de prints
packages/core/            regras de negócio puras, em TypeScript, com testes
prototipo/                protótipo original (referência de UX e regras, não é publicado)
docs/                     inventário, modelo de dados, plano, especificação, design, publicação, ADRs e prints
scripts/                  varredura de privacidade
```

## Licença

[MIT](LICENSE). Feito por [Alexandre Diogo](https://nasck-myportifolio.vercel.app).
