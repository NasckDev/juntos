import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AjustesNav } from "@/components/ajustes/ajustes-nav";
import { AparenciaPanel } from "@/components/ajustes/aparencia-panel";
import { AvisosPanel } from "@/components/ajustes/avisos-panel";
import { CategoriasPanel } from "@/components/ajustes/categorias-panel";
import { ContaPanel } from "@/components/ajustes/conta-panel";
import { DadosPanel } from "@/components/ajustes/dados-panel";
import { PessoasPanel } from "@/components/ajustes/pessoas-panel";
import { AJUSTES_SECTIONS, resolveSection } from "@/components/ajustes/sections";
import { PageHeader } from "@/components/shell/page-header";
import { toAppearance } from "@/lib/preferences";
import { firstParam } from "@/lib/return-path";
import { requireMember } from "@/server/access";
import { getDb } from "@/server/db";
import { getAppContext, getSpaceMembers } from "@/server/loaders";
import { DELETION_GRACE_MS } from "@/server/services/account";
import { listCategories } from "@/server/services/categories-read";

export const metadata: Metadata = { title: "Ajustes" };

type PageParams = Promise<{ aba?: string[] }>;
type PageSearch = Promise<{ erro?: string | string[] }>;

export default async function AjustesPage({ params, searchParams }: { params: PageParams; searchParams: PageSearch }) {
  const section = resolveSection((await params).aba);
  if (!section) notFound();
  const href = AJUSTES_SECTIONS.find((item) => item.slug === section)?.href ?? "/ajustes";
  const ctx = await getAppContext();
  if (!ctx) redirect(`/entrar?voltar=${encodeURIComponent(href)}`);
  const { user, preferences, features, activeSpace } = ctx;
  const googleFailed = firstParam((await searchParams).erro) === "google";

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Conta, aparência, avisos e pessoas" />
      <AjustesNav active={section} />
      <div className="pt-5 lg:pt-6">
        {section === "conta" ? (
          <ContaPanel
            name={user.name}
            email={user.email}
            avatar={user.avatar}
            isGuest={user.isAnonymous}
            googleEnabled={features.google}
            googleFailed={googleFailed}
            deleteAfter={
              user.deletionRequestedAt
                ? new Date(user.deletionRequestedAt.getTime() + DELETION_GRACE_MS).toISOString()
                : null
            }
          />
        ) : null}
        {section === "aparencia" ? <AparenciaPanel initial={toAppearance(preferences)} /> : null}
        {section === "avisos" ? (
          <AvisosPanel
            notify={preferences.notify}
            push={{ serverEnabled: features.push, vapidPublicKey: features.vapidPublicKey }}
          />
        ) : null}
        {section === "pessoas" ? (
          <PessoasPanel
            space={{ id: activeSpace.id, name: activeSpace.name, role: activeSpace.role }}
            members={(await getSpaceMembers(activeSpace.id)) ?? []}
            spaceCount={ctx.spaces.length}
          />
        ) : null}
        {section === "categorias" ? (
          <CategoriasPanel
            spaceId={activeSpace.id}
            categories={await listCategories(getDb(), activeSpace.id)}
            canEdit={(await requireMember(activeSpace.id, "viewer")).membership.role !== "viewer"}
          />
        ) : null}
        {section === "dados" ? <DadosPanel /> : null}
      </div>
    </>
  );
}
