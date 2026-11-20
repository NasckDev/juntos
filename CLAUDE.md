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
- `npm run dev`: servidor local em http://localhost:4791 com os cabeçalhos do `vercel.json`.
- `npm run verify`: varredura de privacidade e testes Playwright (celular 390 px e computador 1440 px).
- `npm run prints`: regenera `docs/prints/`.
