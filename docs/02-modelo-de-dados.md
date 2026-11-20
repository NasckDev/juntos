# 2. Modelo de dados (proposta)

Proposta para PostgreSQL com Drizzle. **Aguarda aprovação** antes da primeira migração (ver [plano de fases](03-plano-de-fases.md)).

Princípios:
- **Dinheiro em centavos inteiros** (`bigint`), nunca ponto flutuante ([ADR 0002](adr/0002-dinheiro-em-centavos.md)).
- **Tudo pertence a um espaço** (`space_id`), e toda consulta filtra por ele e confere o papel do membro no servidor.
- **Mês de competência** guardado como `date` no dia 1 (`competence`), separado da data de vencimento (`due_date`). Isso deixa o filtro por mês e período simples e indexável.
- **Soft delete e lotes** (`deleted_at`, `import_batch_id`, `undo_token`) para o "Desfazer" funcionar no servidor.
- **Idempotência** dos jobs: unicidade `(recurrence_id, competence)` em `transactions` e `(space_id, dedupe_key)` em `notifications`.

```mermaid
erDiagram
  users ||--o{ space_members : "participa"
  users ||--|| user_preferences : "tem"
  users ||--o{ accounts : "login (Better Auth)"
  users ||--o{ sessions : "sessões (Better Auth)"
  spaces ||--o{ space_members : "tem"
  spaces ||--o{ invites : "convida"
  spaces ||--o{ categories : "personaliza"
  spaces ||--o{ recurrences : "contas fixas"
  spaces ||--o{ transactions : "lançamentos"
  spaces ||--o{ budgets : "limites"
  spaces ||--o{ goals : "metas"
  spaces ||--o{ settlements : "acertos"
  spaces ||--o{ notifications : "avisos"
  spaces ||--o{ import_batches : "importações"
  spaces ||--o{ audit_log : "auditoria"
  categories ||--o{ transactions : "classifica"
  categories ||--o{ recurrences : "classifica"
  categories ||--o{ budgets : "limita"
  recurrences ||--o{ transactions : "gera"
  import_batches ||--o{ transactions : "trouxe"
  goals ||--o{ goal_deposits : "recebe"
  goal_deposits |o--|| transactions : "vira Guardado"
  space_members ||--o{ transactions : "pagou (paid_by)"
  space_members ||--o{ settlements : "de / para"

  users {
    text id PK
    text name
    text email "único, nulo no convidado"
    text avatar "código do avatar"
    bool is_anonymous "conta de convidado"
    timestamptz deletion_requested_at "carência LGPD"
    timestamptz created_at
  }
  user_preferences {
    text user_id PK,FK
    text theme "auto | light | dark"
    text accent "indigo ... grafite"
    text font_size "menor | normal | grande | maior"
    bool hide_values
    jsonb notify "tipos de aviso ligados"
    text whatsapp_e164 "só depois de verificado"
  }
  spaces {
    uuid id PK
    text name
    text icon
    text split_mode "equal | income | custom"
    smallint split_pct "0 a 100, só em custom"
    timestamptz created_at
    timestamptz deleted_at
  }
  space_members {
    uuid id PK
    uuid space_id FK
    text user_id FK "nulo enquanto convidado"
    text invited_email
    text role "owner | editor | viewer"
    text status "invited | active"
    timestamptz joined_at
  }
  invites {
    uuid id PK
    uuid space_id FK
    text token_hash "só o hash do token"
    text email
    text role
    text invited_by FK
    timestamptz expires_at
    timestamptz accepted_at
  }
  categories {
    uuid id PK
    uuid space_id FK "nulo = padrão do sistema"
    text name
    text icon
    smallint hue
    text kind "in | out | save"
  }
  recurrences {
    uuid id PK
    uuid space_id FK
    text kind "in | out | save"
    text description
    bigint amount_cents
    uuid category_id FK
    text frequency "monthly | yearly"
    smallint day "1 a 31"
    date start_competence
    smallint installments_total "nulo = sem fim"
    text payment_method
    uuid paid_by FK
    bool personal
    bool paused
  }
  transactions {
    uuid id PK
    uuid space_id FK
    text kind "in | out | save"
    text description
    bigint amount_cents "maior que zero"
    date competence "dia 1 do mês"
    date due_date
    uuid category_id FK
    bool paid
    date paid_at
    text payment_method
    uuid paid_by FK "space_members"
    bool personal "fora da divisão"
    text note
    uuid recurrence_id FK "único com competence"
    smallint installment_number
    smallint installments_total
    uuid import_batch_id FK
    text created_by
    text updated_by
    timestamptz deleted_at
  }
  budgets {
    uuid space_id PK,FK
    uuid category_id PK,FK
    bigint monthly_limit_cents
  }
  goals {
    uuid id PK
    uuid space_id FK
    text name
    text icon
    bigint target_cents
    bigint monthly_cents
  }
  goal_deposits {
    uuid id PK
    uuid goal_id FK
    uuid transaction_id FK
    bigint amount_cents
    timestamptz created_at
  }
  settlements {
    uuid id PK
    uuid space_id FK
    uuid from_member FK
    uuid to_member FK
    bigint amount_cents
    date period_start
    date period_end
    timestamptz settled_at
  }
  notifications {
    uuid id PK
    uuid space_id FK
    text user_id FK
    text type "late | due | budget | goal | invite | auto"
    text dedupe_key "único por espaço"
    text title
    text body
    text href
    date competence
    timestamptz seen_at
    timestamptz read_at
    timestamptz created_at
  }
  import_batches {
    uuid id PK
    uuid space_id FK
    text file_name
    text source "monthly-sheet | detailed-export"
    int rows_total
    int rows_imported
    text mode "add | replace"
    text status "review | done | undone"
    text created_by
    timestamptz created_at
  }
  audit_log {
    bigint id PK
    uuid space_id FK
    text actor_id
    text action
    text entity
    text entity_id
    jsonb diff
    timestamptz at
  }
  accounts {
    text id PK
    text user_id FK
  }
  sessions {
    text id PK
    text user_id FK
  }
```

## Índices e restrições principais

| Tabela | Índice ou restrição | Para quê |
| --- | --- | --- |
| `transactions` | `(space_id, competence)` onde `deleted_at is null` | Mês e período (até 36 meses na exportação) |
| `transactions` | único `(recurrence_id, competence)` | Job de contas fixas idempotente |
| `transactions` | `check (amount_cents > 0)` | Valor sempre positivo; o tipo dá o sinal |
| `notifications` | único `(space_id, dedupe_key)` | Aviso não repete |
| `space_members` | único `(space_id, user_id)` e `(space_id, invited_email)` | Sem membro duplicado |
| `budgets` | chave `(space_id, category_id)` | Um limite por categoria |
| `invites` | `token_hash` único, `expires_at` | Convite de uso único que expira |

## Diferenças em relação ao briefing

- `competence` separada de `due_date`: o protótipo trabalha com "mês + dia" e o mês é o eixo de tudo.
- `goal_deposits.transaction_id`: no protótipo o depósito cria um lançamento Guardado; a ligação permite desfazer os dois juntos.
- `settlements.period_start/period_end`: o protótipo grava o acerto só no primeiro mês do período; com início e fim o acerto vale para o período inteiro.
- `invites.token_hash`: o token nunca é guardado em texto puro.
