import { getAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

// O Better Auth atende todas as rotas de login em /api/auth/* (Google, convidado, sessão, sair).
export function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
