# Juntos: convenções do projeto

Projeto pessoal e público de Alexandre Diogo (GitHub NasckDev). Commits com o e-mail pessoal configurado no
`git config --local`. Nada de referências ao trabalho do autor.

## Idioma
- Documentação, interface, mensagens de erro e PRs em português do Brasil.
- Código, nomes técnicos e mensagens de commit em inglês (Conventional Commits, uma linha).

## Fonte da verdade
- `prototipo/index.html` define UX, textos e regras. Não é referência de arquitetura.
- Antes de portar uma regra, leia a função citada em `docs/01-inventario.md` e escreva o teste primeiro.
- Não invente funcionalidade fora do protótipo; sugestões vão para `docs/04-duvidas-e-decisoes.md`.

## Regras que não se negociam
- Dinheiro em **centavos inteiros** (ADR 0002). Nada de `toFixed` ou ponto flutuante para valores.
- Nenhum dado real no repositório (ADR 0003): sem planilhas, CSV, PDF, `.env`, tokens ou e-mails fora de `example.com`.
  `npm run privacidade` tem de passar.
- Toda consulta filtra por `space_id` e confere o papel do membro no servidor (a partir da Fase 3).
- Sem `any`, sem desligar regra do TypeScript para passar.
- Antes de instalar dependência, confirme a versão estável com `npm view <pacote> version` e justifique no PR.

## Fluxo
- `main` protegida; trabalho em `feat/<fase>-<assunto>`, `fix/…`, `docs/…`, `chore/…`, sempre por PR com CI verde.
- Decisões de arquitetura viram ADR curto em `docs/adr/` (contexto, decisão, consequências).
- Ao terminar uma fase: testes verdes, CI verde, prints atualizados (`npm run prints`) e resumo no PR.

## Comandos
Monorepo npm workspaces + Turborepo: o app Next.js fica em `apps/web` e as regras puras em `packages/core`.
Rode da raiz (ou com `-w web` para um script só do app).
- `npm run dev`: app em http://localhost:3010 (sem `DATABASE_URL`, usa PGlite em `apps/web/.data/pglite`).
- `npm run verify`: privacidade, Biome, typecheck, testes (Vitest) e build, na ordem. Tem de passar antes do PR.
- `npm run privacidade`, `npm run lint` (`biome check .`), `npm run typecheck`, `npm run build`: cada etapa sozinha.
- `npm run test`: Vitest do core e do app (servidor com PGlite em memória e componentes com jsdom). Só o app:
  `npm run test -w web`; um arquivo: `npx vitest run <caminho>` dentro de `apps/web`.
- `npm run test:e2e`: Playwright do app (celular 390 px e computador 1440 px, com axe), num `next dev` próprio na
  porta 3012 com PGlite temporário e saída em `.next-e2e`. Um spec: `npx playwright test e2e/<nome>.spec.ts` em
  `apps/web`.
- Migrações: `npm run db:generate -w web` gera a próxima a partir do schema (`apps/web/drizzle/`);
  `npm run db:migrate -w web` aplica (no PGlite, com o `npm run dev` parado).
- `npm run test:prototipo`: testes Playwright do protótipo (`prototipo/`); `npm run prints:prototipo` regenera os
  prints dele. Prints do app: `npx tsx scripts/gerar-prints.ts` em `apps/web`.
- `npm run icones -w web`: regenera os PNGs de `apps/web/public/icons/` a partir do `icon.svg`.
