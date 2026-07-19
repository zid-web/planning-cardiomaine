'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Upload, Loader, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { GenerateWeekRequest, GenerateWeekResponse } from '@/lib/voice-panel-utils'
import type { ScheduleData } from '@/lib/types'

interface VoiceAndUploadPanelProps {
  apiBaseUrl: string
  apiKey: string
  currentWeekRequest: GenerateWeekRequest
  knownDoctors: string[]
  onScheduleUpdated: (newSchedule: ScheduleData) => void
  onPdfParsed?: (data: any) => void
}

export default function VoiceAndUploadPanel({
  apiBaseUrl,
  apiKey,
  currentWeekRequest,
  knownDoctors,
  onScheduleUpdated,
  onPdfParsed,
}: VoiceAndUploadPanelProps) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize Web Speech API
  React.useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'fr-FR' // French language

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          setTranscript(transcript)
        } else {
          interimTranscript += transcript
        }
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      toast.error(`Erreur de reconnaissance: ${event.error}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
  }, [])

  // Start voice recording
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start()
    }
  }

  // Stop voice recording and send to API
  const stopListening = async () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      
      if (transcript.trim()) {
        await sendVoiceCommandToAPI(transcript)
      }
    }
  }

  // Send voice command to backend
  const sendVoiceCommandToAPI = async (command: string) => {
    if (!command.trim()) return

    setIsProcessing(true)
    try {
      const response = await fetch(`${apiBaseUrl}/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          command,
          week_request: currentWeekRequest,
          known_doctors: knownDoctors,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data: GenerateWeekResponse = await response.json()
      console.log('[v0] Voice command response:', data)

      // Convert solver response to ScheduleData and update
      // Import and use convertSolverResponseToScheduleData from voice-panel-utils
      const { convertSolverResponseToScheduleData } = await import('@/lib/voice-panel-utils')
      const newSchedule = convertSolverResponseToScheduleData(data, currentWeekRequest.week_start_date)
      
      onScheduleUpdated(newSchedule)
      toast.success('Planning mis à jour avec la commande vocale')
      setTranscript('')
    } catch (error) {
      console.error('Voice command error:', error)
      toast.error('Erreur lors du traitement de la commande vocale')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle PDF upload
  const handlePdfUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast.error('Seuls les fichiers PDF sont acceptés')
      return
    }

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('week_request', JSON.stringify(currentWeekRequest))

      const response = await fetch(`${apiBaseUrl}/upload-planning-pdf`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('[v0] PDF parsing response:', data)

      if (onPdfParsed) {
        onPdfParsed(data)
      }

      if (data.assignments) {
        const { convertSolverResponseToScheduleData } = await import('@/lib/voice-panel-utils')
        const newSchedule = convertSolverResponseToScheduleData(data, currentWeekRequest.week_start_date)
        onScheduleUpdated(newSchedule)
        toast.success('Planning PDF appliqué avec succès')
      }
    } catch (error) {
      console.error('PDF upload error:', error)
      toast.error('Erreur lors du traitement du PDF')
    } finally {
      setIsProcessing(false)
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handlePdfUpload(files[0])
    }
  }

  return (
    <Card className="p-6 bg-white border-slate-200">
      <div className="space-y-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-slate-900">Commandes intelligentes</h3>

        {/* Voice Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Reconnaissance vocale</label>
          <div className="flex gap-2">
            <Button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              variant={isListening ? 'destructive' : 'default'}
              className="flex-1"
            >
              <Mic className="h-4 w-4 mr-2" />
              {isListening ? 'Arrêter' : 'Écouter'}
            </Button>
            {isProcessing && <Loader className="h-4 w-4 animate-spin text-slate-500" />}
          </div>

          {transcript && (
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Vous:</span> {transcript}
              </p>
            </div>
          )}
        </div>

        {/* PDF Upload Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Upload de planning PDF</label>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handlePdfUpload(e.target.files[0])
                }
              }}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-2">
              <Upload className="h-5 w-5 text-slate-400" />
              <div className="text-sm text-slate-600">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Cliquez pour sélectionner
                </button>
                {' '}ou glissez-déposez un PDF
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex gap-2 p-3 bg-blue-50 rounded border border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Dites: <span className="font-medium">"Demain S remplace B en garde de nuit"</span> ou upload un PDF de planning
          </p>
        </div>
      </div>
    </Card>
  )
}
