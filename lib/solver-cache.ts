/**
 * Short-lived in-memory cache for solver responses (same week + mode).
 * Survives within a warm serverless instance / Node process only.
 */

type CacheEntry<T> = { value: T; expiresAt: number }

const store = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL_MS = 5 * 60 * 1000

export function solverCacheKey(weekStartDate: string, weekendMode: string) {
  return `solver:${weekStartDate}:${weekendMode}`
}

export function getSolverCache<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return null
  }
  return hit.value as T
}

export function setSolverCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function clearSolverCache(prefix = "solver:") {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}
