# 7. Publicação na Vercel

Passo a passo para colocar o app (`apps/web`) no ar pela primeira vez, com banco Neon, login com Google, rotina
diária e notificações push. Leva uns 30 minutos. Nenhum segredo entra no repositório: tudo vai nas variáveis do
projeto na Vercel.

## 7.1 O que já está pronto no repositório

`apps/web/vercel.json` cuida do resto quando o projeto aponta para `apps/web`:

| Campo | Valor | Por quê |
| --- | --- | --- |
| `installCommand` | `cd ../.. && npm ci` | Instala na raiz do monorepo, com o `package-lock.json` da raiz e o pacote `@juntos/core`. |
| `buildCommand` | `npm run db:migrate:deploy && npm run build` | Aplica as migrações no banco do ambiente e depois roda o `next build`. |
| `crons` | `/api/cron/diario` às `0 9 * * *` | Rotina diária às 9h UTC (6h em Brasília): lança as contas fixas do mês, gera os avisos e manda push e e-mail. |

O `db:migrate:deploy` (`apps/web/scripts/migrar-no-deploy.ts`) decide assim:

- **Com `DATABASE_URL`:** aplica as migrações pendentes (`apps/web/drizzle`) e as categorias padrão. Se falhar, o
  deploy para antes de publicar código que espera um banco que ainda não existe.
- **Produção sem `DATABASE_URL`:** o deploy para com a explicação. Sem banco o app não sobe, então é melhor não
  publicar.
- **Preview sem `DATABASE_URL`:** pula as migrações e o build continua (o `next build` não abre banco). O preview só
  funciona de verdade com um banco próprio (passo 7.3).

## 7.2 Importar o repositório

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `NasckDev/juntos`.
2. Em **Root Directory**, escolha `apps/web`. O Framework Preset fica **Next.js** (detectado sozinho).
3. Não mexa em Install Command nem Build Command: o `vercel.json` já define os dois.
4. Ainda não clique em **Deploy** (sem banco, o deploy de produção para de propósito). Crie o projeto e siga para o
   banco. Se a tela só deixar seguir com Deploy, pode clicar: ele falha com a mensagem "DATABASE_URL não está
   definida na produção", o que é esperado.
5. Em **Settings → Build and Deployment**:
   - **Node.js Version:** `22.x` (a mesma do CI).
   - **Include files outside the root directory in the Build Step:** ligado (o app usa `packages/core`).
6. Em **Settings → Functions → Function Region**, escolha **São Paulo, Brazil (gru1)**, perto de quem usa e do banco.

## 7.3 Banco Neon pela aba Storage

1. No projeto, abra a aba **Storage → Create Database → Neon** (Serverless Postgres).
2. Região: **AWS São Paulo (sa-east-1)**, a mesma das funções. Plano gratuito serve para começar.
3. Ao conectar o banco ao projeto:
   - Marque os ambientes **Production** e **Preview**.
   - Ligue a criação de um **branch do banco para cada deploy de preview**. Assim o preview aplica as migrações num
     branch descartável e nunca mexe no banco de produção. Sem isso, deixe o Neon só em Production: um preview de
     uma branch ainda não aprovada não pode migrar o banco de verdade.
   - Deixe o prefixo das variáveis vazio, para a variável se chamar exatamente `DATABASE_URL`.
4. Confira em **Settings → Environment Variables** que `DATABASE_URL` existe em Production (e em Preview, se ligou os
   branches). O app usa a URL com pool (`DATABASE_URL`), pelo driver `@neondatabase/serverless`.

## 7.4 Variáveis de ambiente

Em **Settings → Environment Variables**. Todas são validadas quando o app sobe (`apps/web/src/server/env.ts`); as
opcionais desligam o recurso de forma explícita, e a tela explica o que está desligado.

| Variável | Ambientes | Obrigatória | Como gerar |
| --- | --- | --- | --- |
| `DATABASE_URL` | Production, Preview | Sim | Criada pelo Neon no passo 7.3. |
| `BETTER_AUTH_SECRET` | Production, Preview | Sim | `npx @better-auth/cli secret` (no mínimo 32 caracteres). Um valor para cada ambiente. |
| `BETTER_AUTH_URL` | Production | Recomendada | O endereço público, sem barra no fim: `https://<seu-projeto>.vercel.app` ou o domínio próprio. Em Preview, deixe sem: o app usa o endereço do próprio preview. |
| `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` | Production | Para o login com Google | Passo 7.5. As duas juntas ou nenhuma. Sem elas, só o convidado aparece na entrada. |
| `CRON_SECRET` | Production | Para a rotina diária | Texto aleatório com pelo menos 16 caracteres (ex.: `openssl rand -hex 32`). Sem ela, a rotina responde 401 e fica desligada. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Production | Para push | Passo 7.6. As três juntas ou nenhuma. |
| `RESEND_API_KEY` e `EMAIL_FROM` | Production | Não | Chave do Resend e o remetente (ex.: `Juntos <avisos@seu-dominio>`). Sem elas, convites e avisos ficam no app e no push. |

Depois de criar ou mudar uma variável, faça um **Redeploy** (aba Deployments → menu do último deploy → Redeploy):
a variável só vale para os deploys feitos depois dela.

## 7.5 Login com Google (OAuth)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: "Juntos").
2. Em **APIs e serviços → Tela de consentimento OAuth** (Google Auth Platform): tipo **Externo**, nome do app
   "Juntos", e-mail de suporte e de contato do desenvolvedor. Enquanto estiver em **Teste**, só os e-mails cadastrados
   em **Usuários de teste** conseguem entrar; para abrir a todos, publique o app nessa mesma tela.
3. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas:** `https://<seu-projeto>.vercel.app` (e o domínio próprio, se tiver).
   - **URIs de redirecionamento autorizados:** `https://<seu-projeto>.vercel.app/api/auth/callback/google` (e o mesmo
     caminho no domínio próprio).
   - Para o desenvolvimento local, acrescente `http://localhost:3010` e
     `http://localhost:3010/api/auth/callback/google`.
4. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (só em Production) e faça o Redeploy.

O endereço dos previews muda a cada deploy e o Google só aceita redirecionamentos cadastrados; por isso o Google fica
só em Production. Nos previews, teste como convidado.

## 7.6 Notificações push (VAPID)

1. Na sua máquina, na raiz do repositório: `npm run chaves:vapid -w web`.
2. Copie as três linhas para as variáveis de Production. Em `VAPID_SUBJECT`, use `mailto:` com o seu e-mail ou o
   endereço `https://` do app.
3. Gere uma vez só: trocar as chaves invalida as inscrições de push já feitas nos aparelhos.

## 7.7 Rotina diária (Cron)

- Já vem do `vercel.json`. Com `CRON_SECRET` definida, a Vercel chama `/api/cron/diario` mandando
  `Authorization: Bearer <CRON_SECRET>` sozinha; a rota confere o segredo em tempo constante.
- No plano Hobby a Vercel permite rotinas diárias e pode disparar em qualquer minuto dentro da hora marcada (entre 9h e
  9h59 UTC). As rotinas só rodam no deploy de produção.
- Para conferir: **Settings → Cron Jobs** mostra a rotina e tem o botão **Run** para disparar na hora; os registros
  ficam na aba **Logs**.

## 7.8 Testar depois do deploy

Com o Redeploy de produção pronto (aba Deployments, estado **Ready**; no log do build aparece "Migrações aplicadas no
banco do ambiente production."):

1. **Entrada:** abra `https://<seu-projeto>.vercel.app`. A raiz leva a `/entrar`, com **Continuar com Google** (se
   configurado) e **Testar como convidado**.
2. **Convidado:** entre como convidado, responda o nome e lance uma entrada e uma saída. A conta começa vazia, só com as
   categorias padrão.
3. **Google:** saia e entre com o Google (ou, como convidado, vincule a conta em Ajustes > Conta): os dados do
   convidado continuam lá.
4. **Convite:** em Ajustes > Pessoas e compartilhamento, crie um convite, abra o link em outro navegador e aceite. A
   Divisão passa a mostrar o acerto entre as duas pessoas.
5. **Importar e exportar:** em Importar e exportar, exporte o Excel do ano e importe o mesmo arquivo de volta (até
   4 MB). A revisão mostra o que "Já existe".
6. **Push:** em Ajustes > Avisos, toque em **Ativar notificações neste aparelho**, permita no navegador e use
   **Enviar notificação de teste**. Num navegador sem suporte, a própria tela avisa. Teste no Chrome do Android ou do
   computador: o app ainda não tem manifesto web, e o iPhone só entrega push a apps instalados na Tela de Início.
7. **Rotina diária:** dispare pelo botão **Run** (7.7) ou pelo terminal:

   ```sh
   curl -i -H "Authorization: Bearer <CRON_SECRET>" https://<seu-projeto>.vercel.app/api/cron/diario
   ```

   A resposta esperada é `200` com `"ok": true` e a lista de jobs. Sem o cabeçalho, `401`.
8. **Cabeçalhos de segurança:** `curl -I https://<seu-projeto>.vercel.app/entrar` mostra `Content-Security-Policy`
   com nonce, `Strict-Transport-Security` e `X-Content-Type-Options: nosniff`.

## 7.9 Quando algo dá errado

| Sintoma | Causa provável |
| --- | --- |
| Build para com "DATABASE_URL não está definida na produção" | O Neon ainda não foi conectado ao ambiente Production (7.3). |
| Build para com "Falha ao aplicar as migrações" | O banco recusou uma migração; o log mostra o comando. Nada foi publicado. |
| Página de erro com "Em produção, defina BETTER_AUTH_SECRET…" nos logs | Falta `BETTER_AUTH_SECRET` (ou `DATABASE_URL`) no ambiente; crie e faça Redeploy. |
| Google responde `redirect_uri_mismatch` | A URI de redirecionamento do 7.5 não bate com o endereço aberto (confira `https`, domínio e `/api/auth/callback/google`). |
| Rotina diária responde 401 | `CRON_SECRET` não está definida em Production, ou foi criada depois do último deploy. |
| Importação recusa a planilha grande | O limite é 4 MB, abaixo do teto de 4,5 MB por requisição da Vercel. |
