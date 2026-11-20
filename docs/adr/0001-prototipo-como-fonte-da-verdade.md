# ADR 0001: Protótipo como fonte da verdade e demo pública

- **Status:** aceito
- **Data:** 2026-11-19

## Contexto

O Juntos nasceu de uma planilha anual e foi desenhado primeiro como um protótipo de arquivo único (`prototipo/index.html`),
com JavaScript inline e dados no `localStorage`. Ele já cobre todas as telas, os textos e as regras de negócio.

## Decisão

- O protótipo é a **fonte da verdade de UX, textos e regras**, mas **não** é referência de arquitetura.
- Ele é publicado como está, como demo pública (Fase 0), com dados fictícios e sem servidor.
- O app full stack é reconstruído em camadas, com testes, a partir do inventário em `docs/01-inventario.md`.

## Consequências

- Qualquer pessoa usa a demo sem conta, e nada sai do navegador dela.
- O protótipo não recebe novas funcionalidades; correções só quando bloqueiam a demo.
- O porte de cada regra cita a função original, para comparar comportamento.
