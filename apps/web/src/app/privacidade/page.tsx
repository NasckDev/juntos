import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { REPO_ISSUES_URL } from "@/components/legal/links";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o Juntos guarda, para quê, onde ficam e como você exporta ou apaga tudo.",
};

export default function PrivacidadePage() {
  return (
    <LegalPage
      title="Política de privacidade"
      updatedAt="20 de novembro de 2026"
      intro={
        <p>
          O Juntos é um app para organizar as finanças da casa, sozinho ou a dois. Esta página explica, em linguagem
          simples, quais dados o app guarda, por que guarda e como você controla tudo isso, conforme a Lei Geral de
          Proteção de Dados (LGPD, Lei 13.709/2018).
        </p>
      }
      sections={[
        {
          title: "Quais dados guardamos",
          body: (
            <ul>
              <li>
                <strong>Conta:</strong> se você entra com o Google, recebemos seu nome, e-mail e foto de perfil. Se
                entra como convidado, não pedimos nenhum dado pessoal.
              </li>
              <li>
                <strong>O que você lança:</strong> entradas, saídas, contas fixas, parcelas, metas, orçamentos, acertos,
                categorias e as planilhas que você importa.
              </li>
              <li>
                <strong>Preferências:</strong> tema, cor, tamanho da letra, avatar e os avisos que você ligou.
              </li>
              <li>
                <strong>Notificações no celular:</strong> se você ativar, guardamos o endereço técnico de entrega do
                navegador (fornecido pelo Google, Apple, Mozilla ou Microsoft), sem acesso ao conteúdo do aparelho.
              </li>
              <li>
                <strong>Segurança:</strong> cookies de sessão, que mantêm você conectado, e contadores de tentativas,
                que impedem abuso. Não usamos cookies de publicidade nem de rastreamento.
              </li>
            </ul>
          ),
        },
        {
          title: "Para que usamos",
          body: (
            <ul>
              <li>Mostrar suas finanças, calcular a sobra do mês, a divisão das contas e as projeções.</li>
              <li>Lançar sozinho as contas fixas de cada mês e avisar sobre vencimentos, se você quiser.</li>
              <li>Proteger sua conta e o serviço contra uso indevido.</li>
            </ul>
          ),
        },
        {
          title: "Com quem compartilhamos",
          body: (
            <>
              <p>
                Seus dados financeiros aparecem só para as pessoas que você mesmo convida para um espaço, com a
                permissão que você escolhe (editar ou só ver). Não vendemos dados e não exibimos anúncios.
              </p>
              <p>
                Para funcionar, o app usa provedores que processam os dados em nosso nome: Vercel (hospedagem), Neon
                (banco de dados, na região de São Paulo), Google (login, se você escolher) e os serviços de notificação
                do seu navegador.
              </p>
            </>
          ),
        },
        {
          title: "Seus direitos e controles",
          body: (
            <ul>
              <li>
                <strong>Baixar seus dados:</strong> em Ajustes, "Baixar meus dados" entrega um arquivo com tudo o que
                você lançou.
              </li>
              <li>
                <strong>Exportar:</strong> leve seus lançamentos para o Excel, PDF ou CSV quando quiser.
              </li>
              <li>
                <strong>Excluir a conta:</strong> em Ajustes. A exclusão acontece 30 dias depois do pedido, e você pode
                cancelar nesse prazo. Contas de convidado sem uso por 30 dias são apagadas.
              </li>
              <li>
                <strong>Corrigir:</strong> você edita seus dados e lançamentos a qualquer momento pelo próprio app.
              </li>
            </ul>
          ),
        },
        {
          title: "Segurança",
          body: (
            <p>
              A conexão é sempre criptografada (HTTPS), os cookies de sessão não ficam acessíveis a scripts, cada
              consulta confere se você tem permissão no espaço, e convites usam links de uso único que vencem em 7 dias.
            </p>
          ),
        },
        {
          title: "Contato",
          body: (
            <p>
              Dúvidas ou pedidos sobre seus dados podem ser feitos pela página do projeto no GitHub:{" "}
              <a
                href={REPO_ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-text underline underline-offset-4"
              >
                github.com/NasckDev/juntos
              </a>
              . Para assuntos sensíveis, não publique dados pessoais em comentários públicos.
            </p>
          ),
        },
      ]}
    />
  );
}
