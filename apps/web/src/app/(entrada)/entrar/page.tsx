import type { Metadata } from "next";
import { SignIn } from "@/components/entrada/sign-in";
import { isGoogleEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string | string[] }> }) {
  const { erro } = await searchParams;
  return <SignIn googleEnabled={isGoogleEnabled()} googleFailed={erro === "google"} />;
}
