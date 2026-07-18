import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock } from 'lucide-react'

export default function ExternalDoctorsPage() {
  return (
    <main className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Médecins Externes</h1>
        <p className="text-gray-600">Gestion des consultations externes fixes</p>
      </div>

      {/* Info générale */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">
            Les médecins externes ont des consultations fixes qui apparaissent dans le planning
            indépendamment de l&apos;algorithme de génération automatique. Ils ne sont jamais
            assignés par le solveur et ne comptent pas dans l&apos;équité.
          </p>
        </CardContent>
      </Card>

      {/* DAAS */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge className="bg-violet-600">DAAS</Badge>
            <span>EE2 (Échocardiographie de stress)</span>
          </CardTitle>
          <CardDescription>Consultation externe fixe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Lundi matin (AM)</p>
                <p className="text-sm text-gray-600">
                  DAAS est assigné automatiquement à la case EE2 du lundi matin. 
                  Cette assignation est fixe et n&apos;est pas modifiable par le solveur.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Propriétés:</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Statut: Médecin externe (consultation)</li>
                <li>N&apos;a pas de compte utilisateur</li>
                <li>N&apos;apparaît jamais dans les gardes/astreintes</li>
                <li>N&apos;est pas incluait dans l&apos;équité</li>
                <li>Peut avoir des vacances enregistrées</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* D */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge className="bg-violet-600">D</Badge>
            <span>Echo PSS Stress</span>
          </CardTitle>
          <CardDescription>Consultation externe fixe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Jeudi matin et AM</p>
                <p className="text-sm text-gray-600">
                  D est assigné automatiquement à la case Echo PSS stress du jeudi matin et après-midi. 
                  Cette assignation est fixe et n&apos;est pas modifiable par le solveur.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Propriétés:</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Statut: Médecin externe (consultation)</li>
                <li>N&apos;a pas de compte utilisateur</li>
                <li>N&apos;apparaît jamais dans les gardes/astreintes</li>
                <li>N&apos;est pas incluait dans l&apos;équité</li>
                <li>Peut avoir des vacances enregistrées</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autres externes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge className="bg-amber-600">FV</Badge>
            <span className="ml-2">Médecin Externe (Astreinte)</span>
          </CardTitle>
          <CardDescription>Astreinte programmée</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">Assignations fixes:</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Lundi: Garde Nuit (unique)</li>
              <li>Jeudi: Coro Après-midi (unique)</li>
            </ul>
            <p className="text-sm text-gray-500 mt-3">
              FV est un médecin externe avec un compte spécifique. Il peut avoir des vacances 
              et est inclus dans les propositions du solveur selon ses contraintes métier.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
