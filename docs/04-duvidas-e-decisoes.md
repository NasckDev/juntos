# 4. Dúvidas e decisões pendentes

Itens que precisam do dono do produto antes da Fase 1. Cada um traz a recomendação.

## Contas e custos

1. **Serviços externos.** O app full stack precisa de contas em Neon (banco), Google Cloud (login), Resend (e-mail), Inngest (jobs), Upstash (limite de requisições), Sentry e PostHog. Todos têm plano gratuito suficiente para a demo. *Recomendação:* criar no e-mail pessoal do projeto; os segredos entram só nas variáveis da Vercel e do GitHub Actions.
2. **Domínio.** Seguir com `*.vercel.app` ou comprar um domínio? *Recomendação:* `vercel.app` até a Fase 9.
3. **WhatsApp.** A API do Meta exige verificação do Meta Business. *Recomendação:* deixar atrás de feature flag e lançar só com e-mail e Web Push.

## Regras de negócio

4. **"Vence em breve".** O Início usa 7 dias e os avisos usam 3. *Recomendação:* manter os dois, com nome explícito no código (`DUE_SOON_HOME_DAYS`, `DUE_SOON_NOTIFY_DAYS`).
5. **Divisão proporcional à renda.** O protótipo usa todas as entradas do período, recebidas ou não. *Recomendação:* usar só as recebidas, para a divisão não mudar quando uma entrada prevista falhar.
6. **Acerto no modo período.** O protótipo grava o acerto só no primeiro mês. *Recomendação:* gravar com início e fim do período (já no modelo de dados).
7. **"1.5" no campo de valor.** Hoje vira R$ 1,50. *Recomendação:* aceitar, com um teste documentando o comportamento.
8. **Categorias padrão.** São globais e iguais para todos os espaços? *Recomendação:* sim, com as personalizadas por espaço.

## Privacidade e LGPD

9. **Carência da exclusão de conta.** *Recomendação:* 30 dias, com e-mail de confirmação e opção de cancelar.
10. **Conta de convidado.** Por quanto tempo guardar sem login? *Recomendação:* 30 dias sem uso, depois apagar.
11. **Planilha real como teste.** A planilha do casal nunca entra no repositório. *Recomendação:* um script local gera uma cópia anonimizada (nomes trocados e valores multiplicados por um fator) que vira a fixture; a conferência contra a planilha real roda só na máquina, apontando para um arquivo fora do repositório por variável de ambiente.

## Engenharia

12. **Stack.** Confirmar o [ADR 0004](adr/0004-stack-proposta.md) (Next.js em monorepo). A alternativa seria Vite como os outros projetos do portfólio, mas o briefing pede RSC, Server Actions e tRPC.
13. **Idioma dos commits.** *Recomendação:* inglês, uma linha, Conventional Commits.
14. **Fuso de "hoje".** Calcular no servidor em America/Sao_Paulo, e não pelo relógio do aparelho.
