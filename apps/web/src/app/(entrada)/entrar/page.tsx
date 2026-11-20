import type { Metadata } from "next";
import { SignIn } from "@/components/entrada/sign-in";
import { firstParam, safeReturnPath } from "@/lib/return-path";
import { isGoogleEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<{ erro?: string | string[]; voltar?: string | string[] }>;

export default async function EntrarPage({ searchParams }: { searchParams: SearchParams }) {
  const { erro, voltar } = await searchParams;
  // `voltar` vem do proxy (a rota que a pessoa queria abrir); só caminho interno vale, nunca URL externa.
  return (
    <SignIn
      googleEnabled={isGoogleEnabled()}
      googleFailed={firstParam(erro) === "google"}
      returnTo={safeReturnPath(firstParam(voltar))}
    />
  );
}
