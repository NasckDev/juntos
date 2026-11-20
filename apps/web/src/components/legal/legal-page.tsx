import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/shell/logo";

type Section = { title: string; body: ReactNode };

type Props = {
  title: string;
  updatedAt: string;
  intro: ReactNode;
  sections: Section[];
};

/** Página pública de texto (privacidade, termos), legível em qualquer tela e sem exigir login. */
export function LegalPage({ title, updatedAt, intro, sections }: Props) {
  return (
    <main id="conteudo" className="mx-auto w-full max-w-[44rem] px-5 py-10 sm:py-14">
      <Link href="/entrar" className="inline-flex rounded-field" aria-label="Juntos, ir para a entrada">
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Atualizado em {updatedAt}</p>
      <div className="mt-6 text-base leading-relaxed text-ink">{intro}</div>
      {sections.map((section) => (
        <section key={section.title} className="mt-9 border-t border-line pt-7">
          <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
          <div className="mt-3 space-y-3 text-base leading-relaxed text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
            {section.body}
          </div>
        </section>
      ))}
      <nav
        aria-label="Outras páginas"
        className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm"
      >
        <Link href="/privacidade" className="font-semibold text-brand-text underline-offset-4 hover:underline">
          Política de privacidade
        </Link>
        <Link href="/termos" className="font-semibold text-brand-text underline-offset-4 hover:underline">
          Termos de uso
        </Link>
        <Link href="/entrar" className="font-semibold text-brand-text underline-offset-4 hover:underline">
          Entrar no Juntos
        </Link>
      </nav>
    </main>
  );
}
