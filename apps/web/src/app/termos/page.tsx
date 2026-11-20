import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { REPO_ISSUES_URL } from "@/components/legal/links";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras simples para usar o Juntos.",
};

export default function TermosPage() {
  return (
    <LegalPage
      title="Termos de uso"
      updatedAt="20 de novembro de 2026"
      intro={
        <p>
          Ao usar o Juntos, você concorda com estes termos. Eles são curtos de propósito: o app serve para organizar as
          finanças da sua casa, e você continua dono de tudo o que lança.
        </p>
      }
      sections={[
        {
          title: "O que é o Juntos",
          body: (
            <p>
              Um app gratuito para registrar o que entra, o que sai e o que é guardado, sozinho ou junto com quem divide
              as contas com você. É um projeto pessoal e de código aberto, oferecido como está.
            </p>
          ),
        },
        {
          title: "Não é aconselhamento financeiro",
          body: (
            <p>
              Sugestões, projeções e o simulador de quitação são estimativas feitas com os dados que você informou.
              Confira valores, juros e prazos com o seu banco antes de tomar decisões.
            </p>
          ),
        },
        {
          title: "Sua conta e seus espaços",
          body: (
            <ul>
              <li>Você é responsável pelo que lança e por quem convida para os seus espaços.</li>
              <li>Quem é dono de um espaço decide quem entra, quem edita e quem só vê, e pode remover pessoas.</li>
              <li>Não use o app para atividades ilegais nem para enviar convites a quem não conhece.</li>
            </ul>
          ),
        },
        {
          title: "Disponibilidade",
          body: (
            <p>
              Fazemos o possível para o app ficar no ar e para os dados ficarem seguros, mas não há garantia de
              funcionamento sem interrupções. Mantenha cópias exportando seus dados quando quiser.
            </p>
          ),
        },
        {
          title: "Privacidade",
          body: <p>O tratamento dos seus dados está explicado na Política de privacidade.</p>,
        },
        {
          title: "Mudanças e contato",
          body: (
            <p>
              Se estes termos mudarem, a data no topo da página muda junto. Dúvidas:{" "}
              <a
                href={REPO_ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-text underline underline-offset-4"
              >
                github.com/NasckDev/juntos
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
