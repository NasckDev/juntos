# ADR 0006: Segurança de convites, uploads, push e limites de tentativas

- **Status:** aceito
- **Data:** 2026-11-20

## Contexto

Uma revisão de segurança independente apontou riscos nas bordas do app: a importação lia e descompactava a
planilha antes de conferir quem enviava; o servidor fazia POST em qualquer endereço HTTPS informado como inscrição
de push; nenhuma rota sensível tinha limite de tentativas; o convite por e-mail podia ser usado para mandar e-mail
a terceiros; e havia corridas e vazamentos menores (confirmação dupla da importação, exportação de quem só vê
gravando no banco, "Baixar meus dados" com dados de outras pessoas, vínculo do convidado desfazendo uma remoção).

Também foi questionado se o convite deveria valer só para o e-mail convidado.

## Decisão

### Convite é um link de portador (não amarrado ao e-mail)

O dono manda o link pelo WhatsApp, e quem recebe muitas vezes entra como convidado, sem e-mail. Amarrar o
convite ao e-mail quebraria o uso principal. O link continua sendo o que dá acesso, com estas mitigações:

- token de 32 bytes aleatórios (base64url) que só existe no link; o banco guarda apenas o SHA-256;
- uso único e atômico (`update … where accepted_at is null returning`): duas abas não aceitam o mesmo convite;
- vale 7 dias; os vencidos são apagados pela rotina diária;
- o dono vê na lista de pessoas quem entrou (e os convites pendentes) e pode remover a pessoa ou cancelar o convite.

### Convite por e-mail não vira disparador de spam

- Só conta com login Google envia o e-mail; o convidado anônimo gera o link para copiar, sem e-mail.
- Assunto fixo ("Você foi convidado para um espaço no Juntos"): nome do espaço e de quem convida (texto livre)
  ficam só no corpo, escapados.
- No máximo 20 convites pendentes por espaço (com trava do espaço na transação), 20 convites por pessoa por dia e
  5 por destinatário por dia.

### Importação: autenticar antes de ler; conferir o ZIP antes de abrir

- O espaço vai na URL (`/api/importar?espaco=<id>`, validado com Zod); sessão, papel `editor` e limite de
  tentativas são conferidos antes de ler o corpo.
- O corpo é lido em pedaços com teto (4 MB + folga do formulário), sem confiar no `Content-Length`.
- Antes do ExcelJS, um leitor mínimo do diretório central do ZIP (sem dependência nova) recusa: mais de 200
  entradas, soma descompactada acima de 50 MB, razão de compressão acima de 200:1, ZIP64, criptografia e métodos
  diferentes de "guardado" e "deflate". Cada entrada é descompactada com teto igual ao tamanho declarado, então um
  ZIP que mente sobre o tamanho é recusado sem expandir. Cada caso tem mensagem própria em português.

### Push sem SSRF

- Lista fechada de hosts de push: `fcm.googleapis.com`, `android.googleapis.com` (FCM e o antigo GCM),
  `updates.push.services.mozilla.com`, `web.push.apple.com`, `*.push.apple.com` e `*.notify.windows.com`.
  Só HTTPS na porta padrão, sem usuário/senha; IP literal e `localhost` ficam de fora. A lista vale na gravação
  (Zod) e no envio (inscrições antigas fora da lista são apagadas sem receber POST).
  Os demais subdomínios de `googleapis.com` não entram: não são serviço de push.
- `timeout` de 10 s no `sendNotification` (opção do `web-push`, no socket).
- No máximo 10 inscrições por pessoa; a mais antiga sai.
- O log de falha leva só o host e o status, nunca o corpo da resposta (evita forjar linhas no log) nem o caminho do
  endpoint (identifica o aparelho).
- O link da notificação passa pelas mesmas regras do retorno do login (`safeReturnPath`), no servidor e no
  service worker. Ao sair da conta, o navegador cancela a inscrição e a apaga no servidor antes de encerrar a sessão.

### Limite de tentativas guardado no banco

Tabela `rate_limits(key, count, window_start)` com janela fixa e upsert atômico (uma instrução, sem corrida), para
valer entre instâncias da Vercel sem serviço externo (mantém a ADR 0005). Por pessoa (`user.id`):

| Ação | Limite |
| --- | --- |
| Enviar planilha (`/api/importar`) | 10 por hora |
| Confirmar importação | 20 por hora |
| Exportar (`/api/exportar`) | 30 por hora |
| Criar convite | 20 por dia, e 5 por destinatário por dia |
| Criar espaço | 10 por dia |
| Salvar inscrição de push | 20 por dia |
| Notificação de teste | 5 por hora |

Estourou: "Muitas tentativas. Tente de novo em alguns minutos." (429 nas rotas). O destinatário do convite entra
na chave só como hash. A rotina diária apaga contadores com mais de 2 dias.

### Correções menores

- `confirmImport` reivindica o lote dentro da transação (`status 'review' → 'done' … returning`); a segunda
  confirmação simultânea desiste sem gravar.
- Quem só vê exporta sem escrever: as contas fixas que faltam entram calculadas pelo core, sem gravar.
- "Baixar meus dados" leva só os lotes de importação criados pela própria pessoa, e o e-mail de convites pendentes
  só para o dono do espaço.
- Ao vincular o convidado à conta Google, a participação que o dono removeu continua removida.

## Consequências

- Quem tem o link do convite entra no espaço enquanto ele valer: o dono deve mandá-lo só para a pessoa certa e
  remover quem não deveria estar lá. Isso fica explícito na tela de pessoas (lista e remoção).
- Planilhas legítimas muito repetitivas acima de 200:1 seriam recusadas; nas planilhas da casa e nas exportadas pelo
  app a razão fica muito abaixo disso (há teste de ida e volta).
- A importação descompacta o arquivo duas vezes (conferência e ExcelJS), limitado a 50 MB: custo aceitável.
- Cada tentativa nas ações limitadas faz um upsert a mais no banco. Testes usam PGlite e levam o contador ao limite
  direto no banco, sem repetir a ação.
- A exportação para quem só vê não grava as contas fixas do período; outras telas que materializam o mês ao abrir
  (início, lançamentos, relatórios) continuam como antes e podem ser revistas depois.
