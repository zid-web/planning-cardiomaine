-- Migration: Document external doctors classification
-- Date: 2025-01-20
--
-- Purpose: Clarify the handling of external doctors in the system
-- - CH: Centre Hospitalier (can be assigned to guards/astreinte, no account)
-- - FV: Médecin externe (can be assigned to specific slots, no account)
-- - DAAS: EE2 consultation (external, fixed schedule, no solver assignment)
-- - D: Echo PSS stress consultation (external, fixed schedule, no solver assignment)
--
-- These doctors are referenced by their TEXT code in the schedule, not UUIDs.
-- They do NOT have accounts in auth.users or users table.

-- Notes on implementation:
-- 1. All external doctors are identified by their TEXT code (e.g., 'DAAS', 'D', 'CH', 'FV')
-- 2. They have no corresponding entry in auth.users or users table
-- 3. They can be manually assigned in the schedule by admins
-- 4. The solver (OR-Tools) excludes DAAS and D from assignments
-- 5. FV and CH are handled with specific constraints when appropriate
-- 6. Vacations can be recorded for external doctors using their TEXT code as doctor_id

-- Doctor classification reference:
-- Internal doctors (with auth accounts): P, Z, B, G, W, M, S, O, H, U, A, V, Val, K, R, T
-- External - Guard/Astreinte capable: FV, CH
-- External - Consultation fixed: DAAS (EE2 lundi), D (Echo PSS stress jeudi)

-- No table changes needed - the system already supports this via:
-- - doctor_vacations.doctor_id (TEXT, can be code or UUID)
-- - schedule_data (JSON, allows any string as doctor identifier)

-- Verification queries:
-- SELECT * FROM doctor_vacations WHERE doctor_id IN ('DAAS', 'D', 'FV', 'CH');
-- SELECT DISTINCT schedule_data FROM schedules LIMIT 1;
