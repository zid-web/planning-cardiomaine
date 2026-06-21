import type { FullSchedule, User, SwapRequest, Preference, AuditLog } from "./types"
import { INITIAL_USERS } from "./constants"

// In-memory store for demonstration purposes
// In a real app, this would be a database connection (Postgres, MongoDB, etc.)

declare global {
  var _db: {
    users: User[]
    schedule: FullSchedule
    swaps: SwapRequest[]
    preferences: Preference[]
    logs: AuditLog[]
  }
}

if (!global._db) {
  global._db = {
    users: [...INITIAL_USERS],
    schedule: {},
    swaps: [],
    preferences: [],
    logs: [],
  }
}

export const db = global._db
