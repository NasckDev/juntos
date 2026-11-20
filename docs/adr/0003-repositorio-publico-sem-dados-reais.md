# ADR 0003: Repositório público sem dados reais

- **Status:** aceito
- **Data:** 2026-11-19

## Contexto

O repositório é público para o portfólio, mas o produto lida com finanças pessoais, e o briefing nasceu
da planilha real de um casal.

## Decisão

- Só **dados fictícios** no repositório. E-mails só em domínios reservados (`example.com`).
- Planilhas, CSVs, PDFs exportados e `.env` estão no `.gitignore` **e** são barrados por `scripts/verificar-privacidade.mjs`,
  que roda no CI e no build da Vercel (o deploy falha se achar algo).
- O script também procura tokens e chaves conhecidas. O GitHub tem secret scanning e push protection ligados.
- Segredos só em variáveis da Vercel e do GitHub Actions; o repositório terá apenas `.env.example`.
- A demo não tem servidor: o que a pessoa digita fica no navegador dela.
- Cabeçalhos de segurança na Vercel: CSP restrita, `frame-ancestors` só para o portfólio, `nosniff`, `no-referrer`
  e `Permissions-Policy` fechada.
- Vulnerabilidades são reportadas pelo canal privado do GitHub (`SECURITY.md`), nunca em issue pública.

## Consequências

- A fixture de testes da importação precisa ser uma cópia anonimizada da planilha (ver dúvida 11).
- Qualquer arquivo novo de dados passa pela varredura antes de chegar à `main`.
