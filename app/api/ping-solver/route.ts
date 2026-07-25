import { NextRequest, NextResponse } from "next/server"

/**
 * Keep-alive for the Render guard API (avoids ~20–60s cold starts).
 * Called by Vercel Cron every 5 minutes. Optional CRON_SECRET auth.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
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
