import assert from "node:assert/strict"
import { setNctCalendar } from "@/lib/nct-calendar"
import { proposeAtlNightDoctor, autoFillAtlNightMonth } from "@/lib/atl-night-calendar"
import { canAssignDoctorToSlot } from "@/lib/slot-blocking"
import { generateWeekSchedule } from "@/lib/schedule-utils"

// NCT de W le jeudi 10/12/2026 : pas d'astreinte de nuit pour W le mercredi 09/12
setNctCalendar([{ date: "2026-12-10", user: "W" }])
const w: any = generateWeekSchedule("2026-W50", [])
assert.equal(canAssignDoctorToSlot("W", "2026-12-09", "Astreintes ATL Nuit", "MERCREDI", w, []).allowed, false)
assert.equal(canAssignDoctorToSlot("M", "2026-12-09", "Astreintes ATL Nuit", "MERCREDI", w, []).allowed, true)
assert.equal(canAssignDoctorToSlot("W", "2026-12-10", "Astreintes ATL Nuit", "JEUDI", w, []).allowed, true, "le soir du NCT reste possible")

// Proposition : W jamais, même s'il est d'astreinte ATL Midi ce mercredi
w["Astreintes ATL Midi"].MERCREDI = { value: ["W"], type: "doctor", status: "validated" }
assert.notEqual(proposeAtlNightDoctor("2026-12-09", { schedule: w, counts: { W: 0, M: 50, O: 50 } }), "W")

// Remplissage du mois : jamais W le 09/12
for (let i = 0; i < 3; i++) {
  const month = autoFillAtlNightMonth([], 2026, 11, () => ({}), { M: 40 + i, O: 40, W: 0 })
  assert.notEqual(month.find((e) => e.date === "2026-12-09")?.user, "W")
}

// Case NCT modifiée directement dans le planning (calendrier non à jour)
setNctCalendar([])
w["Hors site - NCT"].JEUDI = { value: ["M"], type: "doctor", status: "validated" }
assert.equal(canAssignDoctorToSlot("M", "2026-12-09", "Astreintes ATL Nuit", "MERCREDI", w, []).allowed, false)
setNctCalendar(null)
console.log("✅ jamais d'astreinte de nuit la veille d'un NCT")
