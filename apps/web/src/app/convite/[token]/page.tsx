import type { Metadata } from "next";
import { InviteCard, type InviteView } from "@/components/convite/invite-card";
import { firstParam } from "@/lib/return-path";
import { getFeatures, getInvitePreview } from "@/server/loaders";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Convite", robots: { index: false, follow: false } };

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string | string[] }>;
};

export default async function ConvitePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const preview = await getInvitePreview(token);
  const session = await getSession();
  const invite: InviteView =
    preview.status === "invalid" ? preview : { ...preview, expiresAt: preview.expiresAt.toISOString() };
  return (
    <InviteCard
      token={token}
      invite={invite}
      signedIn={session !== null}
      googleEnabled={getFeatures().google}
      googleFailed={firstParam((await searchParams).erro) === "google"}
    />
  );
}
