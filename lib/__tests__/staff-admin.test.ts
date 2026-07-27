/**
 * Run: bunx tsx lib/__tests__/staff-admin.test.ts
 */
import assert from "node:assert/strict"
import { DOCTORS } from "@/lib/constants"
import {
  adminEditsAreValidated,
  findNonSchedulingStaffAdminByEmail,
  isNonSchedulingStaffAdminCode,
  NON_SCHEDULING_STAFF_ADMINS,
} from "@/lib/staff-admin"

function main() {
  const lucille = NON_SCHEDULING_STAFF_ADMINS.find((a) => a.code === "L")
  assert.ok(lucille)
  assert.equal(lucille!.email, "lucillecardiomaine@gmail.com")

  // L n’est PAS un médecin du planning
  assert.equal(DOCTORS.includes("L"), false)

  assert.equal(isNonSchedulingStaffAdminCode("L"), true)
  assert.equal(isNonSchedulingStaffAdminCode("l"), true)
  assert.equal(isNonSchedulingStaffAdminCode("P"), false)

  assert.equal(adminEditsAreValidated("L"), true)
  assert.equal(adminEditsAreValidated("M"), true)
  assert.equal(adminEditsAreValidated("Z"), true)
  assert.equal(adminEditsAreValidated("P"), false)

  assert.ok(findNonSchedulingStaffAdminByEmail("lucillecardiomaine@gmail.com"))
  assert.ok(findNonSchedulingStaffAdminByEmail("LucilleCardiomaine@gmail.com"))
  assert.equal(findNonSchedulingStaffAdminByEmail("other@example.com"), undefined)

  console.log("✅ staff-admin tests passed")
}

main()
