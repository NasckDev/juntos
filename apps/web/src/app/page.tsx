import { redirect } from "next/navigation";
import { getSession } from "@/server/session";

/** A raiz leva ao Início (com sessão) ou à entrada. */
export default async function RootPage() {
  redirect((await getSession()) ? "/inicio" : "/entrar");
}
