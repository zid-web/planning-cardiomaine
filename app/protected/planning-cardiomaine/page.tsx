'use client'

import { useState, useCallback, useMemo, Fragment, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Mic, MicOff, Upload, FileText, Loader2, Plus, X, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Palette de couleurs (selon cahier des charges)
const PALETTE = {
  background: '#F5F7F7',
  surface: '#FFFFFF',
  textPrimary: '#16232B',
  textSecondary: '#5C7079',
  accentPrimary: '#0E7C7B', // teal clinique
  accentAlert: '#C17D2E', // ambre
  border: '#DCE3E6',
  // Teintes de fond par catégorie
  astreinte: '#EAF6F5',
  garde: '#FDF1E6',
  actes: '#F1F0FB',
  absence: '#F6F6F2',
}

// Catégories et activités
const CATEGORIES = {
  'Astreintes ATL': {
    color: PALETTE.astreinte,
    rows: ['Matin (8h-13h)', 'Après-midi (13h-18h30)', 'Nuit (18h30-8h)'],
  },
  'Gardes sur place': {
    color: PALETTE.garde,
    rows: ['Matin (8h-12h30)', 'Après-midi (12h30-19h30)', 'Nuit'],
  },
  'Actes': {
    color: PALETTE.actes,
    rows: ['Coro matin', 'Coro après-midi', 'NCT (jeudi)', 'Rythmo matin', 'Rythmo après-midi', 'Rééducation', 'Pré-op'],
  },
  'Absences': {
    color: PALETTE.absence,
    rows: ['Vacances', 'Congé', 'Congrès', '1/2 journée libre'],
  },
}

const DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

type Doctor = {
  id: string
  code: string
  status: 'permanent' | 'astreinte_coro' | 'ch' | 'fv' | 'daas' | 'd' | 'admin'
}

type GridCell = {
  doctors: string[]
}

export default function PlanningCardiomainePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekType, setWeekType] = useState<1 | 2>(1)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [gridData, setGridData] = useState<Record<string, Record<string, GridCell>>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState('')

  // Initialiser les médecins par défaut au premier chargement
  useEffect(() => {
    if (doctors.length === 0) {
      setDoctors([
        { id: 'W', code: 'W', status: 'astreinte_coro' },
        { id: 'O', code: 'O', status: 'astreinte_coro' },
        { id: 'M', code: 'M', status: 'astreinte_coro' },
        { id: 'CH', code: 'CH', status: 'ch' },
        { id: 'FV', code: 'FV', status: 'fv' },
        { id: 'A', code: 'A', status: 'permanent' },
      ])
    }
  }, [])

  // Calculer les dates de la semaine
  const weekDates = useMemo(() => {
    const d = new Date(currentDate)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday)
      date.setDate(date.getDate() + i)
      return date
    })
  }, [currentDate])

  // Format date pour affichage
  const formatDateShort = (date: Date) => {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  const mondayDisplay = formatDateShort(weekDates[0])

  // Navigation semaine
  const goToNextWeek = useCallback(() => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + 7)
    setCurrentDate(next)
  }, [currentDate])

  const goToPreviousWeek = useCallback(() => {
    const prev = new Date(currentDate)
    prev.setDate(prev.getDate() - 7)
    setCurrentDate(prev)
  }, [currentDate])

  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  // Gestion roster médecins
  const addDoctor = useCallback(() => {
    setDoctors([...doctors, { id: Date.now().toString(), code: '', status: 'permanent' }])
  }, [doctors])

  const updateDoctor = useCallback((id: string, field: string, value: string) => {
    setDoctors(doctors.map(d => d.id === id ? { ...d, [field]: value } : d))
  }, [doctors])

  const removeDoctor = useCallback((id: string) => {
    setDoctors(doctors.filter(d => d.id !== id))
  }, [doctors])

  // Génération du planning
  const handleGeneratePlanning = useCallback(async () => {
    setIsGenerating(true)
    setStatusMessage('Génération du planning...')
    
    try {
      const payload = {
        week_start_date: weekDates[0].toISOString().split('T')[0],
        week_type: parseInt(String(weekType), 10),
        medecins: doctors.map(d => ({ id: d.code, statut: d.status })),
        vacations: [],
        congres: [],
        weekend_mode: 'ROTATION',
      }

      const response = await fetch('https://guard-api-cardiomaine.onrender.com/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('API error')
      
      const data = await response.json()
      setWarnings(data.warnings || [])
      setStatusMessage('Planning généré avec succès')
      
      // Transformer les assignations en grille
      // TODO: Implémenter la transformation des données
      
    } catch (error) {
      setStatusMessage('Erreur lors de la génération')
      console.error('[v0] Generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [weekDates, weekType, doctors])

  // Commande vocale
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatusMessage('Web Speech API non supportée')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = true

    setIsListening(true)
    setTranscript('')

    recognition.onstart = () => {
      setStatusMessage('Écoute en cours...')
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          setTranscript(prev => prev + ' ' + transcript)
        } else {
          interimTranscript += transcript
        }
      }
      if (interimTranscript) {
        setTranscript(prev => prev.split(' ').slice(0, -1).join(' ') + ' ' + interimTranscript)
      }
    }

    recognition.onerror = (event: any) => {
      setStatusMessage(`Erreur: ${event.error}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }, [])

  const handleVoiceSubmit = useCallback(async () => {
    if (!transcript.trim()) return

    try {
      const response = await fetch('https://guard-api-cardiomaine.onrender.com/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          reference_date: weekDates[0].toISOString().split('T')[0],
          known_doctors: doctors.map(d => d.code),
          current_week_request: { /* current grid state */ },
        }),
      })

      const data = await response.json()
      setStatusMessage(data.message || 'Commande appliquée')
      setWarnings(data.updated_schedule?.warnings || [])
      setTranscript('')
      
    } catch (error) {
      setStatusMessage('Erreur lors du traitement de la commande vocale')
      console.error('[v0] Voice command error:', error)
    }
  }, [transcript, weekDates, doctors])

  return (
    <div style={{ backgroundColor: PALETTE.background }} className="min-h-screen p-6">
      <div className="max-w-8xl mx-auto space-y-6">
        
        {/* === EN-TÊTE === */}
        <header className="space-y-4">
          <div>
            <p style={{ color: PALETTE.textSecondary }} className="text-sm uppercase tracking-wide">Cardiomaine</p>
            <h1 style={{ color: PALETTE.textPrimary }} className="text-3xl font-bold">Planning des gardes & astreintes</h1>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Navigation semaine */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div style={{ color: PALETTE.textPrimary }} className="font-mono text-sm min-w-20 text-center">
                {mondayDisplay}
              </div>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={goToToday} className="text-xs">Aujourd'hui</Button>
            </div>

            {/* Toggle Type 1/2 */}
            <div className="flex gap-2">
              {[1, 2].map(type => (
                <Button
                  key={type}
                  variant={weekType === type ? 'default' : 'outline'}
                  onClick={() => setWeekType(type as 1 | 2)}
                  style={weekType === type ? { backgroundColor: PALETTE.accentPrimary } : {}}
                >
                  Type {type}
                </Button>
              ))}
            </div>

            {/* Bouton Générer */}
            <Button
              onClick={handleGeneratePlanning}
              disabled={isGenerating}
              style={{ backgroundColor: isGenerating ? PALETTE.textSecondary : PALETTE.textPrimary }}
              className="text-white hover:opacity-90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Générer
                </>
              )}
            </Button>
          </div>
        </header>

        {/* === GRILLE PRINCIPALE + PANNEAU LATÉRAL === */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          
          {/* GRILLE PRINCIPALE */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: PALETTE.border, backgroundColor: PALETTE.surface }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: PALETTE.background }}>
                  <th style={{ color: PALETTE.textSecondary }} className="px-4 py-3 text-left font-mono text-xs uppercase sticky left-0 z-10" style={{ backgroundColor: PALETTE.surface }}>
                    Activité
                  </th>
                  {DAYS.map((day, idx) => (
                    <th key={day} className="px-3 py-3 text-center min-w-20">
                      <p style={{ color: PALETTE.textSecondary }} className="text-xs uppercase">
                        {day}
                      </p>
                      <p style={{ color: PALETTE.textPrimary }} className="font-mono text-sm">
                        {formatDateShort(weekDates[idx])}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(CATEGORIES).map(([categoryName, { color, rows }]) => (
                  <Fragment key={categoryName}>
                    {/* Bandeau catégorie */}
                    <tr style={{ backgroundColor: color }}>
                      <td colSpan={8} className="px-4 py-2">
                        <p style={{ color: PALETTE.textPrimary }} className="text-xs font-bold uppercase tracking-wider">
                          {categoryName}
                        </p>
                      </td>
                    </tr>
                    
                    {/* Lignes d'activités */}
                    {rows.map((rowName) => (
                      <tr key={rowName} style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
                        <td style={{ backgroundColor: color }} className="px-4 py-3 font-mono text-xs sticky left-0 z-10">
                          {rowName}
                        </td>
                        {DAYS.map((day) => (
                          <td key={`${rowName}-${day}`} className="px-3 py-3 text-center border-r" style={{ borderColor: PALETTE.border }}>
                            <p style={{ color: PALETTE.textPrimary }} className="font-mono text-sm">
                              {gridData?.[rowName]?.[day]?.doctors?.join(' / ') || '—'}
                            </p>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* === PANNEAU LATÉRAL === */}
          <div className="space-y-4">
            
            {/* 1. Roster médecins */}
            <div style={{ backgroundColor: PALETTE.surface }} className="rounded-lg border p-4" style={{ borderColor: PALETTE.border }}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ color: PALETTE.textPrimary }} className="font-semibold text-sm">Roster médecins</h3>
                <Button variant="ghost" size="sm" onClick={addDoctor}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {doctors.length === 0 ? (
                  <p style={{ color: PALETTE.textSecondary }} className="text-xs">Aucun médecin ajouté</p>
                ) : (
                  doctors.map(doc => (
                    <div key={doc.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        maxLength={3}
                        value={doc.code}
                        onChange={(e) => updateDoctor(doc.id, 'code', e.target.value.toUpperCase())}
                        placeholder="Code"
                        style={{ borderColor: PALETTE.border }}
                        className="font-mono text-xs px-2 py-1 border rounded flex-1"
                      />
                      <select
                        value={doc.status}
                        onChange={(e) => updateDoctor(doc.id, 'status', e.target.value)}
                        className="text-xs px-2 py-1 border rounded flex-1"
                        style={{ borderColor: PALETTE.border }}
                      >
                        {['astreinte_coro', 'permanent', 'ch', 'fv', 'daas', 'd', 'admin'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <Button variant="ghost" size="sm" onClick={() => removeDoctor(doc.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Zone drag & drop PDF */}
            <div
              style={{ backgroundColor: PALETTE.surface, borderColor: PALETTE.accentPrimary, borderStyle: 'dashed' }}
              className="rounded-lg border-2 p-4 text-center cursor-pointer hover:bg-opacity-50 transition"
            >
              <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: PALETTE.accentPrimary }} />
              <p style={{ color: PALETTE.textSecondary }} className="text-xs">Glissez un PDF de planning, ou cliquez</p>
              <input type="file" accept=".pdf" className="hidden" />
            </div>

            {/* 3. Commande vocale */}
            <div style={{ backgroundColor: PALETTE.surface }} className="rounded-lg border p-4" style={{ borderColor: PALETTE.border }}>
              <div className="flex justify-center mb-3">
                <button
                  onClick={startListening}
                  disabled={isListening}
                  style={{ backgroundColor: isListening ? '#EF4444' : PALETTE.accentPrimary }}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:opacity-90 transition"
                >
                  {isListening ? (
                    <MicOff className="w-6 h-6 animate-pulse" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>
              </div>
              <p style={{ color: PALETTE.textSecondary }} className="text-xs text-center mb-2">
                Ex: demain Z remplace A en garde du matin
              </p>
              {transcript && (
                <p style={{ color: PALETTE.textPrimary }} className="text-xs p-2 bg-gray-50 rounded mb-2 font-mono">
                  {transcript}
                </p>
              )}
              {transcript && (
                <Button
                  onClick={handleVoiceSubmit}
                  style={{ backgroundColor: PALETTE.accentPrimary }}
                  className="w-full text-white text-xs"
                >
                  Valider et appliquer
                </Button>
              )}
            </div>

            {/* Zone de statut */}
            {statusMessage && (
              <div style={{ backgroundColor: PALETTE.surface }} className="rounded-lg border p-3" style={{ borderColor: PALETTE.border }}>
                <p style={{ color: PALETTE.textPrimary }} className="text-xs">{statusMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* === AVERTISSEMENTS === */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                style={{ backgroundColor: PALETTE.accentAlert, borderColor: PALETTE.accentAlert }}
                className="rounded-lg border-l-4 p-3 flex gap-2"
              >
                <AlertTriangle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p style={{ color: '#FFF' }} className="text-sm">{warning}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
