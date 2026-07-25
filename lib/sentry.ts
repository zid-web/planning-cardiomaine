/**
 * Error capture helper. When NEXT_PUBLIC_SENTRY_DSN is set and @sentry/nextjs
 * is installed, wire Sentry.init in instrumentation.ts (see docs/PERFORMANCE.md).
 * Until then, emit structured console errors for Vercel log drains.
 */

export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      level: "error",
      ts: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    }),
  )
}
