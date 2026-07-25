import { NextRequest, NextResponse } from "next/server"

/**
 * Keep-alive for the Render guard API (avoids ~20–60s cold starts).
 * Intended for Vercel Cron and external crons (e.g. cron-job.org).
 *
 * Auth: if `CRON_SECRET` is set AND the request sends `Authorization`,
 * it must be `Bearer <CRON_SECRET>`. Requests with no Authorization header
 * are allowed so public keep-alive crons work without extra config.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (secret && auth && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const base =
    process.env.GUARD_API_BASE_URL ||
    process.env.GUARD_API_URL ||
    "https://guard-api-cardiomaine.onrender.com"

  const started = Date.now()
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    })
    const ms = Date.now() - started
    console.info("[ping-solver]", { ok: res.ok, status: res.status, ms, base })
    return NextResponse.json({
      success: res.ok,
      status: res.status,
      ms,
      base,
    })
  } catch (error) {
    const ms = Date.now() - started
    console.error("[ping-solver] failed", { ms, error: String(error) })
    return NextResponse.json(
      { success: false, error: String(error), ms },
      { status: 502 },
    )
  }
}
