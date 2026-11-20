# Segurança

## Como reportar uma vulnerabilidade

Não abra issue pública. Use o reporte privado do GitHub:
**Security → Report a vulnerability** neste repositório
([link direto](https://github.com/NasckDev/juntos/security/advisories/new)).

Inclua o que encontrou, como reproduzir e o impacto. A resposta inicial sai em até 7 dias.

## Escopo

- A demo publicada (`prototipo/`) e os cabeçalhos definidos em `vercel.json`.
- Qualquer dado real ou segredo encontrado no repositório ou no histórico.

## O que o projeto já faz

- Só dados fictícios no repositório; a varredura `scripts/verificar-privacidade.mjs` roda no CI e no build da Vercel.
- A demo não tem servidor: os dados ficam no `localStorage` do navegador de quem usa.
- CSP restrita, `frame-ancestors` limitado, `nosniff`, `no-referrer` e `Permissions-Policy` fechada.
- Secret scanning e push protection ligados no GitHub; Dependabot para dependências e Actions.
