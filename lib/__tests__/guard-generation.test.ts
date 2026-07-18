import { generateWeeklyGuards, isDoctorOnVacation, canAssignDoctorToDate } from '../guard-generation'
import { DoctorVacation } from '../types'

/**
 * Test de génération de gardes pour la semaine 3 de 2026
 * avec plusieurs scenarios de vacances et contraintes
 */
function runTests() {
  console.log('=== GUARD GENERATION TEST SUITE ===\n')

  // Test 1: Génération basique sans vacances
  console.log('TEST 1: Génération basique semaine 3 de 2026')
  console.log('----------------------------------------')
  const result1 = generateWeeklyGuards('2026-W03', [])
  console.log('Guards générés:', result1.guards.length)
  console.log('Equity:', result1.equity)
  result1.guards.forEach((guard) => {
    console.log(
      `  ${guard.date} (${guard.day}): Dr. ${guard.doctor} - ${guard.type}`
    )
  })
  console.log('\n')

  // Test 2: Avec vacances (Z en vacances 19-25 janvier)
  console.log('TEST 2: Avec vacances (Dr. Z absent 19-25 janvier)')
  console.log('--------------------------------------------------')
  const vacations: DoctorVacation[] = [
    {
      id: '1',
      doctor_id: 'Z',
      start_date: '2026-01-19',
      end_date: '2026-01-25',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
  const result2 = generateWeeklyGuards('2026-W04', vacations)
  console.log('Guards générés:', result2.guards.length)
  result2.guards.forEach((guard) => {
    console.log(
      `  ${guard.date} (${guard.day}): Dr. ${guard.doctor} - ${guard.type}`
    )
  })
  console.log('\n')

  // Test 3: Avec FV en vacances (devrait être reassigné)
  console.log('TEST 3: FV en vacances le lundi 18 janvier')
  console.log('------------------------------------------')
  const vacationsFV: DoctorVacation[] = [
    {
      id: '2',
      doctor_id: 'FV',
      start_date: '2026-01-18',
      end_date: '2026-01-18',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
  const result3 = generateWeeklyGuards('2026-W03', vacationsFV)
  console.log('Guards générés:', result3.guards.length)
  const guardeLundi = result3.guards.find(
    (g) => g.date === '2026-01-19' && g.type === 'Garde Nuit'
  )
  console.log('Garde nuit lundi:', guardeLundi ? `Dr. ${guardeLundi.doctor}` : 'NONE')
  result3.guards.forEach((guard) => {
    console.log(
      `  ${guard.date} (${guard.day}): Dr. ${guard.doctor} - ${guard.type}`
    )
  })
  console.log('\n')

  // Test 4: Vérification des contraintes FV
  console.log('TEST 4: Vérification des contraintes FV')
  console.log('--------------------------------------')
  const fvLundiNuit = canAssignDoctorToDate('FV', '2026-01-19', 'Garde Nuit', [])
  console.log('FV Lundi Garde Nuit:', fvLundiNuit.allowed ? '✓ Autorisé' : `✗ ${fvLundiNuit.reason}`)

  const fvMardiNuit = canAssignDoctorToDate('FV', '2026-01-20', 'Garde Nuit', [])
  console.log('FV Mardi Garde Nuit:', fvMardiNuit.allowed ? '✓ Autorisé' : `✗ ${fvMardiNuit.reason}`)

  const fvJeudiCoro = canAssignDoctorToDate('FV', '2026-01-22', 'Coro', [])
  console.log('FV Jeudi Coro:', fvJeudiCoro.allowed ? '✓ Autorisé' : `✗ ${fvJeudiCoro.reason}`)

  const fvJeudiGarde = canAssignDoctorToDate('FV', '2026-01-22', 'Garde Nuit', [])
  console.log('FV Jeudi Garde Nuit:', fvJeudiGarde.allowed ? '✓ Autorisé' : `✗ ${fvJeudiGarde.reason}`)
  console.log('\n')

  // Test 5: Vérification des vacances
  console.log('TEST 5: Vérification des vacances')
  console.log('---------------------------------')
  const isZOnVacation = isDoctorOnVacation('Z', '2026-01-20', vacations)
  console.log('Z absent 20 janvier:', isZOnVacation ? '✓ En vacances' : '✗ Disponible')

  const isZAvailable = isDoctorOnVacation('Z', '2026-01-26', vacations)
  console.log('Z absent 26 janvier:', isZAvailable ? '✓ En vacances' : '✗ Disponible')
  console.log('\n')

  console.log('=== TESTS COMPLETED ===')
}

// Exécuter les tests
runTests()
