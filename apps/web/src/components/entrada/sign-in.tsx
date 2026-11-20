"use client";

import { Info, LoaderCircle, Repeat, ShieldCheck, Target, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { signInAsGuest, signInWithGoogle } from "@/lib/auth-client";
import { DEFAULT_RETURN_PATH } from "@/lib/return-path";
import { SignInArt } from "./sign-in-art";

export interface SignInProps {
  /** Vem do servidor (`isGoogleEnabled()`): sem as chaves do Google, o botão não aparece. */
  googleEnabled: boolean;
  /** Voltou do Google com erro (`/entrar?erro=google`). */
  googleFailed?: boolean;
  /** Para onde ir depois de entrar (já validado no servidor: só caminho interno). */
  returnTo?: string;
}

const FEATURES = [
  {
    icon: Repeat,
    title: "Contas que se lançam sozinhas",
    text: "Fixas, parcelas e anuais entram todo mês, sem digitar de novo.",
  },
  { icon: Users, title: "Divisão justa entre vocês", text: "Quem pagou o quê e quanto falta acertar no mês." },
  { icon: Target, title: "Planejamento de verdade", text: "Orçamento, metas e a projeção dos próximos seis meses." },
] as const;

type Pending = "google" | "guest" | null;

/** Volta do Google com erro para a mesma tela, sem perder o destino pedido. */
function googleErrorPath(returnTo: string): string {
  const params = new URLSearchParams({ erro: "google" });
  if (returnTo !== DEFAULT_RETURN_PATH) params.set("voltar", returnTo);
  return `/entrar?${params.toString()}`;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Tela de entrada: o que o app faz, entrar com Google (se configurado) ou testar como convidado. */
const GOOGLE_ERROR = "Não foi possível entrar com o Google. Tente de novo ou entre como convidado.";
const NETWORK_ERROR = "Não foi possível entrar agora. Confira a conexão e tente de novo.";

export function SignIn({ googleEnabled, googleFailed = false, returnTo = DEFAULT_RETURN_PATH }: SignInProps) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(googleFailed ? GOOGLE_ERROR : null);

  async function run(kind: Exclude<Pending, null>) {
    setPending(kind);
    setError(null);
    try {
      const result =
        kind === "google" ? await signInWithGoogle(returnTo, googleErrorPath(returnTo)) : await signInAsGuest();
      if (!result.ok) {
        setError(result.error);
        setPending(null);
        return;
      }
      // O Google redireciona sozinho; o convidado entra direto no app.
      if (kind === "guest") router.replace(returnTo);
    } catch {
      setError(NETWORK_ERROR);
      setPending(null);
    }
  }

  const spinner = <LoaderCircle aria-hidden="true" className="animate-spin" />;

  return (
    <main className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-4 lg:p-4">
      <div className="mx-auto flex w-full max-w-[30rem] flex-col justify-center px-5 py-10 sm:px-8 lg:py-12">
        <Logo />
        <p className="mt-10 inline-flex items-center gap-2 self-start rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-text">
          <Users aria-hidden="true" className="size-4" />
          Finanças da casa, a dois ou sozinho
        </p>
        <h1 className="mt-4 text-[2rem] leading-[1.1] font-bold tracking-[-0.035em] sm:text-[2.5rem]">
          As contas da casa, em um lugar só
        </h1>
        <p className="mt-4 text-lg text-muted">
          Veja o que entra, o que sai e quanto sobra. Sozinho ou junto com quem divide as contas com você.
        </p>

        <ul className="mt-8 flex flex-col gap-5 border-t border-line pt-8">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-[0.7rem] bg-brand-soft text-brand-text">
                <f.icon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <b className="block font-semibold">{f.title}</b>
                <span className="text-muted">{f.text}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-col gap-3">
          {googleEnabled ? (
            <>
              <Button
                variant="line"
                size="lg"
                block
                icon={pending === "google" ? spinner : <GoogleMark />}
                disabled={pending !== null}
                onClick={() => void run("google")}
              >
                Continuar com Google
              </Button>
              <div aria-hidden="true" className="flex items-center gap-3 text-sm text-muted">
                <span className="h-px flex-1 bg-line" />
                ou
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          ) : (
            <p className="flex gap-2.5 rounded-field bg-surface2 p-3.5 text-sm text-muted">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                O login com Google ainda não foi configurado neste ambiente. Por enquanto, dá para entrar como
                convidado.
              </span>
            </p>
          )}
          <Button
            variant={googleEnabled ? "ghost" : "primary"}
            size="lg"
            block
            icon={pending === "guest" ? spinner : undefined}
            disabled={pending !== null}
            onClick={() => void run("guest")}
          >
            Testar como convidado
          </Button>
          <p className="text-center text-sm text-muted">
            Como convidado, você usa o app sem cadastro. Depois, é só entrar com o Google para guardar tudo na sua
            conta.
          </p>
          {error ? (
            <p role="alert" className="rounded-field bg-out-soft p-3 text-sm font-medium text-out">
              {error}
            </p>
          ) : null}
        </div>

        <p className="mt-8 flex gap-2.5 border-t border-line pt-6 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Ao continuar, você concorda com os{" "}
            <Link href="/termos" className="font-semibold text-brand-text underline underline-offset-4">
              Termos de uso
            </Link>{" "}
            e com a{" "}
            <Link href="/privacidade" className="font-semibold text-brand-text underline underline-offset-4">
              Política de privacidade
            </Link>
            . Você pode exportar ou apagar seus dados quando quiser.
          </span>
        </p>
      </div>
      <div className="hidden lg:block">
        <SignInArt />
      </div>
    </main>
  );
}
