'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Upload, Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

// URL de l'API Render pour l'upload du planning PDF
const PLANNING_API_URL = 'https://guard-api-cardiomaine.onrender.com'

interface VoiceAndUploadPanelProps {
  onCommandExecuted?: (result: any) => void
  isOpen?: boolean
  weekStartDate?: string // Date de début de semaine (YYYY-MM-DD)
}

export function VoiceAndUploadPanel({ onCommandExecuted, isOpen = true, weekStartDate: initialWeekStartDate }: VoiceAndUploadPanelProps) {
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
        console.error('[v0] Speech recognition error:', event.error)
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

    console.log("[v0] Voice Command - Envoi:", {
      command: text.trim(),
      timestamp: new Date().toISOString()
    })

    setIsLoading(true)
    setStatus({ type: "loading", message: "Interprétation de la consigne..." })

    try {
      // Appel au backend pour interpréter la commande vocale
      const response = await fetch('/api/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: text.trim(),
          timestamp: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      console.log("[v0] Voice Command - Backend Response:", {
        status: response.status,
        statusText: response.statusText,
        data: data,
        timestamp: new Date().toISOString()
      })

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erreur lors du traitement de la commande')
      }

      const successMessage = `Succès: ${data.message || 'Commande exécutée'}`
      setStatus({
        type: "success",
        message: successMessage
      })

      // Afficher un toast de succès
      toast.success(successMessage)

      console.log("[v0] Voice Command - Succès!")

      // Réinitialiser le transcript
      setTranscript("")
      setEditedTranscript("")

      // Appeler le callback si fourni
      if (onCommandExecuted) {
        onCommandExecuted(data)
      }

      // Effacer le message de succès après 3 secondes
      setTimeout(() => {
        setStatus({ type: "idle", message: "" })
      }, 3000)
    } catch (error: any) {
      const errorMessage = error.message || "Erreur lors du traitement de la commande"
      
      console.error('[v0] Voice Command - Erreur détaillée:', {
        error: error.toString(),
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      
      setStatus({
        type: "error",
        message: errorMessage
      })

      // Afficher un toast d'erreur
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [onCommandExecuted])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Vérifier que c'est un PDF
    if (file.type !== 'application/pdf') {
      setUploadError("Veuillez sélectionner un fichier PDF")
      toast.error("Veuillez sélectionner un fichier PDF")
      return
    }

    // Vérifier la taille du fichier (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Le fichier est trop volumineux (max 10MB)")
      toast.error("Le fichier est trop volumineux (max 10MB)")
      return
    }

    setUploadError("")
    setIsLoading(true)
    setStatus({ type: "loading", message: "Upload et traitement du PDF..." })
    
    console.log("[v0] PDF Upload - Fichier sélectionné:", {
      name: file.name,
      size: file.size,
      type: file.type,
      timestamp: new Date().toISOString()
    })

    try {
      // Créer le FormData avec le fichier et la date de début de semaine
      const formData = new FormData()
      formData.append('file', file)
      
      // Ajouter la date de début de semaine
      const computedWeekStartDate = initialWeekStartDate || new Date().toISOString().split('T')[0]
      formData.append('week_start_date', computedWeekStartDate)
      
      console.log("[v0] PDF Upload - FormData contents:", {
        fileName: file.name,
        fileSize: file.size,
        weekStartDate: computedWeekStartDate,
        apiUrl: `${PLANNING_API_URL}/upload-planning-pdf`
      })

      // Envoyer le fichier à Render
      const response = await fetch(`${PLANNING_API_URL}/upload-planning-pdf`, {
        method: 'POST',
        body: formData,
        // N'ajouter pas de Content-Type - le navigateur le définira automatiquement avec le boundary
      })

      const data = await response.json()
      
      console.log("[v0] PDF Upload - Backend Response:", {
        status: response.status,
        statusText: response.statusText,
        data: data,
        timestamp: new Date().toISOString()
      })

      if (!response.ok) {
        const errorMessage = data.error || data.message || 'Erreur lors du upload du PDF'
        throw new Error(errorMessage)
      }

      setUploadedFileName(file.name)
      const successMessage = `PDF traité: ${data.message || 'Fichier importé avec succès'}`
      
      setStatus({
        type: "success",
        message: successMessage
      })

      // Afficher un toast de succès
      toast.success(successMessage)

      console.log("[v0] PDF Upload - Succès!")

      if (onCommandExecuted) {
        onCommandExecuted(data)
      }

      // Effacer le message après 3 secondes
      setTimeout(() => {
        setStatus({ type: "idle", message: "" })
      }, 3000)
    } catch (error: any) {
      const errorMessage = error.message || "Erreur lors du traitement du PDF"
      
      console.error('[v0] PDF Upload - Erreur détaillée:', {
        error: error.toString(),
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      
      setStatus({
        type: "error",
        message: errorMessage
      })

      // Afficher un toast d'erreur
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      // Réinitialiser l'input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [onCommandExecuted, initialWeekStartDate])

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
            Utilisez la reconnaissance vocale pour ajouter des médecins au planning ou importez un PDF
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

          {/* Affichage du Transcript */}
          {(transcript || editedTranscript) && !isListening && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Transcription (modifiable):
              </label>
              <textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                rows={3}
                placeholder="Corrigez la transcription si nécessaire..."
              />

              {/* Boutons d'action */}
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard()}
                  className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
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

        {/* Section Upload PDF */}
        <div className="space-y-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Import PDF du Planning
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
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