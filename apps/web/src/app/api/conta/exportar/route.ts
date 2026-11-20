import { AccessError, accessErrorResponse, requireUser } from "@/server/access";
import { getDb } from "@/server/db";
import { exportUserData } from "@/server/services/account";

export const dynamic = "force-dynamic";

/** "Baixar meus dados": JSON com tudo o que a pessoa pode ver (LGPD). */
export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const data = await exportUserData(getDb(), user.id);
    const date = data.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="juntos-meus-dados-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("Falha ao exportar os dados do usuário:", error);
    return Response.json({ ok: false, error: "Não foi possível gerar o arquivo." }, { status: 500 });
  }
}
