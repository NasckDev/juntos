"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { formatLongDate } from "@/components/ajustes/format-date";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { signInAsGuest, signInWithGoogle } from "@/lib/auth-client";
import { acceptInvite } from "@/server/actions/members";

export type InviteView =
  | { status: "invalid" }
  | {
      status: "valid" | "expired" | "used";
      spaceName: string;
      inviterName: string | null;
      role: "owner" | "editor" | "viewer";
      /** ISO. */
      expiresAt: string;
    };

export interface InviteCardProps {
  token: string;
  invite: InviteView;
  /** Há sessão (Google ou convidado). */
  signedIn: boolean;
  googleEnabled: boolean;
  googleFailed?: boolean;
}

const ROLE_TEXT = {
  owner: "Dono",
  editor: "Pode editar: lança e edita as contas junto com os outros.",
  viewer: "Só vê: acompanha as contas sem alterar nada.",
} as const;

const GOOGLE_ERROR = "Não foi possível entrar com o Google. Tente de novo ou entre como convidado.";
const GENERIC_ERROR = "Não foi possível continuar agora. Confira a conexão e tente de novo.";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[28rem]">
        <Logo className="mb-6 justify-center" />
        <section aria-labelledby="convite-titulo" className="rounded-panel border border-line bg-surface p-6 lg:p-8">
          <h1 id="convite-titulo" className="text-title font-[650] tracking-[-0.03em]">
            {title}
          </h1>
          {children}
        </section>
      </div>
    </main>
  );
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

const DEAD_END = {
  invalid: {
    title: "Convite não encontrado",
    text: () => "Confira se o link foi copiado inteiro ou peça um novo para quem convidou.",
  },
  expired: {
    title: "Este convite venceu",
    text: (inviter: string | null) =>
      `Convites valem por 7 dias. Peça um novo link para ${inviter ?? "quem convidou você"}.`,
  },
  used: {
    title: "Este convite já foi usado",
    text: () => "Cada link funciona uma única vez. Se foi você quem entrou, é só abrir o Juntos.",
  },
} as const;

/** Página do convite: mostra espaço, quem convidou e permissão; entra (Google ou convidado) e aceita. */
export function InviteCard({ token, invite, signedIn, googleEnabled, googleFailed = false }: InviteCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"google" | "guest" | "accept" | null>(null);
  const [error, setError] = useState<string | null>(googleFailed ? GOOGLE_ERROR : null);
  const spinner = <LoaderCircle aria-hidden="true" className="animate-spin" />;

  if (invite.status !== "valid") {
    const copy = DEAD_END[invite.status];
    const inviter = invite.status === "invalid" ? null : invite.inviterName;
    return (
      <Shell title={copy.title}>
        <p className="mt-3 text-muted">{copy.text(inviter)}</p>
        <Button asChild className="mt-6" block>
          <Link href={signedIn ? "/inicio" : "/entrar"}>{signedIn ? "Abrir o Juntos" : "Ir para a entrada"}</Link>
        </Button>
      </Shell>
    );
  }

  const backToInvite = `/convite/${token}`;

  async function enter(kind: "google" | "guest") {
    setBusy(kind);
    setError(null);
    try {
      const result =
        kind === "google" ? await signInWithGoogle(backToInvite, `${backToInvite}?erro=google`) : await signInAsGuest();
      if (!result.ok) {
        setError(result.error);
        setBusy(null);
        return;
      }
      // O Google redireciona sozinho; o convidado volta a esta página já com sessão.
      if (kind === "guest") {
        router.refresh();
        // Com a sessão criada, a página volta com o botão "Aceitar convite": ele não pode ficar travado.
        setBusy(null);
      }
    } catch {
      setError(GENERIC_ERROR);
      setBusy(null);
    }
  }

  async function accept() {
    setBusy("accept");
    setError(null);
    const result = await acceptInvite({ token });
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
      return;
    }
    toast.success(`Você entrou em “${result.data.spaceName}”.`);
    router.replace("/inicio");
  }

  const heading = invite.inviterName
    ? `${invite.inviterName} convidou você para “${invite.spaceName}”`
    : `Você foi convidado para “${invite.spaceName}”`;

  return (
    <Shell title={heading}>
      <p className="mt-3 text-muted">
        No Juntos, vocês acompanham as contas da casa em um lugar só: o que entra, o que sai e quanto sobra.
      </p>
      <dl className="mt-5 grid gap-3 rounded-field bg-surface2 p-4 text-sm">
        <div>
          <dt className="text-muted">Espaço</dt>
          <dd className="font-semibold">{invite.spaceName}</dd>
        </div>
        <div>
          <dt className="text-muted">Sua permissão</dt>
          <dd className="font-semibold">{ROLE_TEXT[invite.role]}</dd>
        </div>
        <div>
          <dt className="text-muted">O convite vale até</dt>
          <dd className="font-semibold">{formatLongDate(invite.expiresAt)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-3">
        {signedIn ? (
          <Button
            size="lg"
            block
            icon={busy === "accept" ? spinner : undefined}
            disabled={busy !== null}
            onClick={() => void accept()}
          >
            Aceitar convite
          </Button>
        ) : (
          <>
            {googleEnabled ? (
              <Button
                variant="line"
                size="lg"
                block
                icon={busy === "google" ? spinner : <GoogleMark />}
                disabled={busy !== null}
                onClick={() => void enter("google")}
              >
                Continuar com Google
              </Button>
            ) : null}
            <Button
              variant={googleEnabled ? "ghost" : "primary"}
              size="lg"
              block
              icon={busy === "guest" ? spinner : undefined}
              disabled={busy !== null}
              onClick={() => void enter("guest")}
            >
              Entrar como convidado
            </Button>
            <p className="text-center text-sm text-muted">Depois de entrar, você volta aqui para aceitar o convite.</p>
          </>
        )}
        {error ? (
          <p role="alert" className="rounded-field bg-out-soft p-3 text-sm font-medium text-out">
            {error}
          </p>
        ) : null}
      </div>
    </Shell>
  );
}
