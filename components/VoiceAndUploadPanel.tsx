'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Upload, Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { DOCTORS } from '@/lib/constants'
import {
  buildCurrentWeekRequestPayload,
  getIsoWeekStartDate,
  toIsoDateLocal,
  type GenerateWeekRequestPayload,
} from '@/lib/guard-api-mapping'
import {
  isPlanningPdf,
  isPlanningSpreadsheet,
  parseCsvToMapped,
  parseExcelToMapped,
} from '@/lib/planning-import'
import {
  looksLikeNctScheduleText,
  parseNctAssignmentsFromText,
} from '@/lib/nct-command'

interface VoiceAndUploadPanelProps {
  onCommandExecuted?: (result: any) => void
  isOpen?: boolean
  /** Monday of the current week (YYYY-MM-DD) */
  weekStartDate?: string
  /** ISO week number (used to derive week_type 1|2) */
  weekNumber?: number
  knownDoctors?: string[]
  /** Full GenerateWeekRequest; if omitted, built from weekStartDate + weekNumber */
  currentWeekRequest?: GenerateWeekRequestPayload
  vacations?: Array<{ doctor_id: string; start_date: string; end_date: string }>
}

export function VoiceAndUploadPanel({
  onCommandExecuted,
  isOpen = true,
  weekStartDate: initialWeekStartDate,
  weekNumber,
  knownDoctors = DOCTORS,
  currentWeekRequest,
  vacations = [],
}: VoiceAndUploadPanelProps) {
  const [transcript, setTranscript] = useState("")
  const [editedTranscript, setEditedTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error"
    message: string
  }>({
    type: "idle",
    message: ""
  })
  const [uploadedFileName, setUploadedFileName] = useState("")
  const [uploadError, setUploadError] = useState("")

  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialiser Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'fr-FR'

      recognitionRef.current.onstart = () => {
        setIsListening(true)
        setStatus({ type: "loading", message: "Écoute en cours..." })
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + " "
          } else {
            interimTranscript += transcriptPart
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript)
          setEditedTranscript((prev) => prev + finalTranscript)
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('[app] Speech recognition error:', event.error)
        // Ne pas afficher l'erreur "not-allowed" au démarrage
        if (event.error !== 'not-allowed') {
          setStatus({
            type: "error",
            message: `Erreur: ${event.error}`
          })
        }
        setIsListening(false)
      }
    }
  }, [])

  // Mettre à jour editedTranscript quand la transcription change
  useEffect(() => {
    setEditedTranscript(transcript)
  }, [transcript])

  const resolveWeekStart = useCallback(() => {
    return initialWeekStartDate || getIsoWeekStartDate(new Date())
  }, [initialWeekStartDate])

  const resolveWeekRequest = useCallback((): GenerateWeekRequestPayload => {
    if (currentWeekRequest) return currentWeekRequest
    return buildCurrentWeekRequestPayload({
      weekStartDate: resolveWeekStart(),
      weekNumber: weekNumber ?? 1,
      vacations,
    })
  }, [currentWeekRequest, resolveWeekStart, weekNumber, vacations])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setStatus({
        type: "error",
        message: "La reconnaissance vocale n'est pas disponible dans votre navigateur"
      })
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
    } else {
      setTranscript("")
      setEditedTranscript("")
      recognitionRef.current.start()
    }
  }, [isListening])

  const sendVoiceCommand = useCallback(async (text: string) => {
    if (!text.trim()) {
      const errorMsg = "Veuillez entrer ou dicter une commande"
      setStatus({
        type: "error",
        message: errorMsg
      })
      toast.error(errorMsg)
      return
    }

    const trimmed = text.trim()
    setIsLoading(true)

    // Liste multi-dates NCT : application locale (évite matin/NCT + une seule semaine Render)
    if (looksLikeNctScheduleText(trimmed)) {
      const nctAssignments = parseNctAssignmentsFromText(trimmed).filter((a) =>
        knownDoctors.map((d) => d.toUpperCase()).includes(a.doctor.toUpperCase()),
      )
      if (nctAssignments.length === 0) {
        const errorMsg = "Aucune date NCT valide trouvée (format attendu : 2026-09-10 → M)"
        setStatus({ type: "error", message: errorMsg })
        toast.error(errorMsg)
        setIsLoading(false)
        return
      }

      setStatus({ type: "loading", message: `Application de ${nctAssignments.length} NCT…` })
      try {
        const successMessage = `${nctAssignments.length} dates NCT appliquées au planning`
        setStatus({ type: "success", message: successMessage })
        toast.success(successMessage)
        setTranscript("")
        setEditedTranscript("")
        onCommandExecuted?.({ nct_assignments: nctAssignments, message: successMessage })
        setTimeout(() => setStatus({ type: "idle", message: "" }), 3000)
      } finally {
        setIsLoading(false)
      }
      return
    }

    const payload = {
      text: trimmed,
      reference_date: toIsoDateLocal(new Date()),
      known_doctors: knownDoctors,
      current_week_request: resolveWeekRequest(),
    }

    setStatus({ type: "loading", message: "Interprétation de la consigne..." })

    try {
      // Proxy Next.js → backend Render (évite les problèmes CORS)
      const response = await fetch('/api/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        const detail = data.error || data.detail || data.message
        const msg = typeof detail === 'string' ? detail : JSON.stringify(detail)
        throw new Error(msg || 'Erreur lors du traitement de la commande')
      }

      // Si le backend renvoie matin/NCT, le front applique quand même via resolveRowKey
      if (data?.parsed_command?.activity) {
        data.parsed_command.activity = String(data.parsed_command.activity).toUpperCase()
        if (data.parsed_command.activity === "NCT") {
          data.parsed_command.slot = "nuit"
        }
      }

      const successMessage = `Succès: ${data.message || 'Commande exécutée'}`
      setStatus({
        type: "success",
        message: successMessage
      })

      toast.success(successMessage)

      setTranscript("")
      setEditedTranscript("")

      if (onCommandExecuted) {
        onCommandExecuted(data)
      }

      setTimeout(() => {
        setStatus({ type: "idle", message: "" })
      }, 3000)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors du traitement de la commande"

      console.error("[voice] Command failed:", errorMessage)

      setStatus({
        type: "error",
        message: errorMessage
      })

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [onCommandExecuted, knownDoctors, resolveWeekRequest])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Limite pratique Vercel Hobby/Pro pour le body des Serverless Functions (~4,5 Mo).
    const maxUploadBytes = 4 * 1024 * 1024
    if (file.size > maxUploadBytes) {
      const msg =
        "Fichier trop volumineux pour l’upload (max 4 Mo). Compressez le PDF ou photographiez une seule page."
      setUploadError(msg)
      toast.error(msg)
      return
    }

    setUploadError("")
    setIsLoading(true)

    try {
      // G4: CSV / Excel — parse local, applique via mapped_existing_schedule
      if (isPlanningSpreadsheet(file)) {
        setStatus({ type: "loading", message: "Import CSV/Excel en cours..." })
        const name = file.name.toLowerCase()
        const result = name.endsWith(".csv") || file.type === "text/csv"
          ? parseCsvToMapped(await file.text())
          : parseExcelToMapped(await file.arrayBuffer())

        if (Object.keys(result.mapped).length === 0) {
          throw new Error("Aucune affectation trouvée dans le fichier")
        }

        setUploadedFileName(file.name)
        const successMessage = `Import ${name.endsWith(".csv") ? "CSV" : "Excel"} : ${Object.keys(result.mapped).length} case(s) (${result.rowCount} ligne(s))`
        setStatus({ type: "success", message: successMessage })
        toast.success(successMessage)
        result.warnings.slice(0, 3).forEach((w) => toast.warning(w))

        onCommandExecuted?.({
          mapped_existing_schedule: result.mapped,
          warnings: result.warnings,
        })

        setTimeout(() => setStatus({ type: "idle", message: "" }), 3000)
        return
      }

      if (!isPlanningPdf(file)) {
        setUploadError("Formats acceptés : PDF, CSV, XLSX")
        toast.error("Formats acceptés : PDF, CSV, XLSX")
        return
      }

      setStatus({ type: "loading", message: "Upload et traitement du PDF..." })

      const weekStart = resolveWeekStart()
      const maxAttempts = 2
      let data: Record<string, unknown> | null = null
      let lastError = "Erreur lors du upload du PDF"

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt > 1) {
          setStatus({
            type: "loading",
            message: "Nouvelle tentative d’extraction PDF…",
          })
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("week_start_date", weekStart)

        const response = await fetch("/api/upload-pdf", {
          method: "POST",
          body: formData,
        })

        if (response.status === 413) {
          throw new Error(
            "Fichier refusé (413 — trop volumineux). Réduisez le PDF sous 4 Mo puis réessayez.",
          )
        }

        let payload: Record<string, unknown> = {}
        try {
          payload = (await response.json()) as Record<string, unknown>
        } catch {
          if (!response.ok) {
            throw new Error(`Erreur upload PDF (HTTP ${response.status})`)
          }
        }

        if (response.ok) {
          data = payload
          break
        }

        const detail = payload.error || payload.detail || payload.message
        lastError =
          typeof detail === "string" ? detail : JSON.stringify(detail) || lastError
        const retryable =
          payload.retryable === true ||
          /JSON malformé|Expecting value/i.test(lastError)

        if (!retryable || attempt === maxAttempts) {
          throw new Error(lastError)
        }
      }

      if (!data) {
        throw new Error(lastError)
      }

      setUploadedFileName(file.name)
      const warnCount = Array.isArray(data.warnings) ? data.warnings.length : 0
      const successMessage =
        warnCount > 0
          ? `PDF traité avec ${warnCount} avertissement(s)`
          : `PDF traité: ${(data.message as string) || "Fichier importé avec succès"}`

      setStatus({ type: "success", message: successMessage })
      toast.success(successMessage)
      onCommandExecuted?.(data)

      setTimeout(() => setStatus({ type: "idle", message: "" }), 3000)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur lors du traitement du fichier"
      setStatus({ type: "error", message: errorMessage })
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [onCommandExecuted, resolveWeekStart])

  const copyToClipboard = useCallback(() => {
    if (editedTranscript) {
      navigator.clipboard.writeText(editedTranscript)
      setStatus({
        type: "success",
        message: "Texte copié dans le presse-papiers"
      })
      setTimeout(() => setStatus({ type: "idle", message: "" }), 2000)
    }
  }, [editedTranscript])

  if (!isOpen) return null

  return (
    <Card className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
      <div className="space-y-4">
        {/* Titre et description */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Panneau Vocal & Upload
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Reconnaissance vocale, import PDF (Render), ou CSV/Excel local
          </p>
        </div>

        {/* Section Reconnaissance Vocale */}
        <div className="space-y-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isListening ? "Écoute en cours..." : "Reconnaissance vocale"}
            </span>
          </div>

          {/* Bouton Écouter */}
          <button
            onClick={toggleListening}
            disabled={isLoading}
            className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                Arrêter l'enregistrement
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Commencer l'enregistrement
              </>
            )}
          </button>

          {/* Transcription / saisie manuelle (toujours visible hors écoute) */}
          {!isListening && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Commande (dictée ou saisie manuelle):
              </label>
              <textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                rows={3}
                placeholder='Ex: "demain S remplace B en garde de nuit"'
              />

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard()}
                  disabled={!editedTranscript.trim()}
                  className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Copy className="w-4 h-4" />
                  Copier
                </button>
                <button
                  onClick={() => sendVoiceCommand(editedTranscript)}
                  disabled={isLoading || !editedTranscript.trim()}
                  className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Appliquer
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section Upload PDF / CSV / Excel */}
        <div className="space-y-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Import PDF / CSV / Excel
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            CSV/XLSX : colonnes <code>activite,LUNDI,…,DIMANCHE</code> (initiales séparées par virgule).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:transition-colors file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {uploadedFileName && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {uploadedFileName}
            </p>
          )}

          {uploadError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {uploadError}
            </p>
          )}
        </div>

        {/* Messages de statut */}
        {status.type !== "idle" && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              status.type === "loading"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : status.type === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {status.type === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
            {status.type === "success" && <CheckCircle2 className="w-4 h-4" />}
            {status.type === "error" && <AlertCircle className="w-4 h-4" />}
            <span>{status.message}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
export default VoiceAndUploadPanel;
