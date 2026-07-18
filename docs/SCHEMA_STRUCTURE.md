# Database Schema Structure - Doctor Vacations

## doctor_vacations Table

### Column: `doctor_id`
**Type:** TEXT (flexible - not a strict foreign key constraint)

**Purpose:** Stores either a UUID or a text code to support both:
1. **Internal doctors** (with Supabase accounts):
   - Value: UUID format (matches `profiles.id`)
   - Example: `"550e8400-e29b-41d4-a716-446655440000"`
   - Can be joined with `profiles` table

2. **External doctors** (no Supabase accounts):
   - Value: Text code (matches doctor code in planning)
   - Example: `"FV"`, `"Z"`, `"A"`
   - NOT in `profiles` table
   - FV constraints: Garde Nuit lundi only, Coro jeudi only

### Key Design Decision
- `doctor_id` is **NOT** a strict foreign key constraint to `profiles.id`
- This allows flexibility for:
  - Recording vacations for external doctors without creating profiles
  - Backward compatibility with both UUID and text-based identifiers
  - Easy manual assignment in planning UI

### Supported Doctor Codes
**Internal doctors (with login accounts):**
- A, Z, S, B, G, O, W, M, P, H, U, K, V

**External doctors (no login accounts):**
- FV (Garde Nuit lundi, Coro jeudi afternoon only)

### Usage in Application

#### Frontend (vacations-modal.tsx)
```typescript
const AVAILABLE_DOCTORS = ['A', 'Z', 'S', 'B', 'G', 'O', 'W', 'M', 'P', 'H', 'U', 'K', 'V', 'FV']
```
- User selects a doctor from dropdown
- `doctor_id` is set to the selected code (e.g., "FV")
- Query: `SELECT * FROM doctor_vacations WHERE doctor_id = 'FV'`

#### Backend (vacation-actions.ts)
```typescript
const { data } = await supabase
  .from('doctor_vacations')
  .select('*')
  .eq('doctor_id', doctorId) // doctorId can be UUID or text code
```

#### Validation (guard-generation.ts)
```typescript
function isDoctorOnVacation(doctorId: string, dateStr: string, vacations: DoctorVacation[]): boolean
```
- Works with both UUID and text codes
- Filters vacations by exact `doctor_id` match

### Type Definition (lib/types.ts)
```typescript
export type DoctorVacation = {
  id: string
  doctor_id: string // UUID or TEXT code (e.g., "FV", "Z", "A")
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  reason?: string
  created_at: string
  updated_at: string
}
```

### Security Notes
- FV is **never** created in `profiles` table
- FV **cannot** authenticate (no Supabase Auth account)
- FV **can only** be assigned manually by admins in planning UI
- FV **cannot** appear in authenticated user lists
- Constraints on FV assignments are enforced at UI/business logic level

### Future Enhancements
1. Could add strict foreign key with UNION of both internal (profiles) and external (constants) doctors
2. Could add `doctor_type` enum column to explicitly distinguish internal vs external
3. Could migrate to separate `external_doctor_vacations` table if external doctors grow significantly
