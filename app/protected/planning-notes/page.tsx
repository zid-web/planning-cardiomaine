import { PlanningNotes } from '@/components/planning-notes'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Consignes de Planning - Cardiomaine',
  description: 'Gérez les consignes et notes pour la génération des gardes',
}

export default function PlanningNotesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <PlanningNotes />
    </main>
  )
}
