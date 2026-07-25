/** Lightweight structured timing logs for Server Actions / API routes. */

export function perfLog(
  scope: string,
  event: string,
  data: Record<string, unknown> = {},
) {
  console.info(
    JSON.stringify({
      level: "info",
      scope,
      event,
      ts: new Date().toISOString(),
      ...data,
    }),
  )
}

export function perfWarn(
  scope: string,
  event: string,
  data: Record<string, unknown> = {},
) {
  console.warn(
    JSON.stringify({
      level: "warn",
      scope,
      event,
      ts: new Date().toISOString(),
      ...data,
    }),
  )
}

export async function withTiming<T>(
  scope: string,
  event: string,
  fn: () => Promise<T>,
  extra: Record<string, unknown> = {},
): Promise<T> {
  const started = Date.now()
  try {
    const result = await fn()
    perfLog(scope, event, { ...extra, ms: Date.now() - started, ok: true })
    return result
  } catch (error) {
    perfWarn(scope, event, {
      ...extra,
      ms: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
