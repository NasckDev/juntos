import { isAuthorizedCron } from "@/server/cron-auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { runDailyJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";
// Os jobs usam Node (crypto, web-push) e podem levar alguns segundos.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Chamado pela Vercel Cron (ver `vercel.json`) com `Authorization: Bearer ${CRON_SECRET}`. */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const startedAt = new Date();
  const jobs = await runDailyJobs({ db: getDb(), now: startedAt });
  const ok = jobs.every((job) => job.ok);
  return Response.json({ ok, startedAt: startedAt.toISOString(), jobs }, { status: ok ? 200 : 500 });
}
