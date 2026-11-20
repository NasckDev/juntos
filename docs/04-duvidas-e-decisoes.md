# 4. Decisões da etapa 1

As 14 dúvidas levantadas na descoberta foram decididas em 2026-11-19 (o dono do produto delegou a escolha:
"decide por mim o melhor"). Cada linha diz o que vale e por quê. Mudar uma decisão exige um ADR novo.

## Contas e custos

| # | Tema | Decisão | Por quê |
| --- | --- | --- | --- |
| 1 | Serviços externos | Neon, Google Cloud (OAuth), Resend, Inngest, Upstash, Sentry e PostHog, todos no plano gratuito e no e-mail pessoal do projeto. São criados só quando a fase que precisa deles começar (banco e login na Fase 3, e-mail e jobs na Fase 8). Até lá, os testes usam PGlite (Postgres em memória), sem conta nenhuma. | Nada de custo nem segredo antes da hora; o CI continua rodando sem credenciais. |
| 2 | Domínio | `*.vercel.app` até a Fase 9. | Domínio próprio só faz sentido com o app pronto. |
| 3 | WhatsApp | Fica atrás de feature flag desligada. O lançamento usa e-mail e Web Push. | A API do Meta exige verificação do Meta Business, que não cabe numa demo de portfólio. |

## Regras de negócio

| # | Tema | Decisão | Por quê |
| --- | --- | --- | --- |
| 4 | "Vence em breve" | Duas constantes: `DUE_SOON_HOME_DAYS = 7` (Início) e `DUE_SOON_NOTIFY_DAYS = 3` (avisos). | Mantém o comportamento do protótipo, mas com nome explícito. |
| 5 | Divisão proporcional à renda | Usa só as entradas **recebidas** do período. Sem renda recebida, cai para partes iguais. | A divisão não muda quando uma entrada prevista atrasa. |
| 6 | Acerto no modo período | O acerto guarda início e fim do período e vale para o período inteiro. | No protótipo, o acerto ficava só no primeiro mês. |
| 7 | "1.5" no campo de valor | Vira R$ 1,50, com teste documentando. Só "1.200" (grupos de 3 dígitos) é lido como milhar. | É o que a pessoa quis dizer na maioria dos casos. |
| 8 | Categorias padrão | Globais e iguais para todos os espaços; as personalizadas são por espaço. | Menos dados repetidos e relatórios comparáveis. |

## Privacidade e LGPD

| # | Tema | Decisão | Por quê |
| --- | --- | --- | --- |
| 9 | Exclusão de conta | Carência de 30 dias, com e-mail de confirmação e opção de cancelar; depois, exclusão definitiva dos dados pessoais. | Protege contra exclusão por engano e cumpre a LGPD. |
| 10 | Conta de convidado | Apagada após 30 dias sem uso, com aviso na tela desde o primeiro acesso. | O convidado não tem e-mail para receber aviso. |
| 11 | Planilha real nos testes | Nunca entra no repositório. A fixture é gerada por código (`packages/core/test/fixtures`), com a mesma estrutura da planilha e valores fictícios. Conferir contra a planilha real é opcional, só local, apontando para um arquivo fora do repositório. | Teste reproduzível sem dado pessoal. |

## Engenharia

| # | Tema | Decisão | Por quê |
| --- | --- | --- | --- |
| 12 | Stack | Aprovada a do [ADR 0004](adr/0004-stack-proposta.md), com uma troca: **npm workspaces + Turborepo** no lugar de pnpm. | O npm já está em todas as máquinas e projetos do autor, e a Vercel e o CI funcionam igual. O Turborepo continua cuidando do cache. |
| 13 | Commits | Inglês, uma linha, Conventional Commits. | Padrão dos outros repositórios do autor. |
| 14 | "Hoje" | Calculado em America/Sao_Paulo. No core, "hoje" é sempre um parâmetro (nunca `new Date()` escondido). | Regras testáveis e iguais no servidor e no celular. |

## Publicação na Vercel

O portfólio já serve a demo pela Vercel (`/projetos/juntos/`). Para o Juntos ter um endereço próprio, o repositório
é importado uma vez em vercel.com/new (a configuração está em `vercel.json`). A partir daí, cada push na `main`
publica sozinho e cada PR ganha uma prévia.
