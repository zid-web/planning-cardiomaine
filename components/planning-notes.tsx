'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Mic, MicOff, Edit2, Save, X } from 'lucide-react'
import { createPlanningNote, updatePlanningNote, deletePlanningNote, getPlanningNotes, type PlanningNote } from '@/app/actions/planning-notes-actions'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function PlanningNotes() {
  const [notes, setNotes] = useState<PlanningNote[]>([])
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'absence' | 'contrainte' | 'note_generale'>('note_generale')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState<'absence' | 'contrainte' | 'note_generale'>('note_generale')

  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialiser Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'fr-FR'

      recognitionRef.current.onstart = () => {
        setIsRecording(true)
      }

      recognitionRef.current.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            setContent((prev) => (prev ? prev + ' ' + transcript : transcript))
          } else {
            interimTranscript += transcript
          }
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('[v0] Speech recognition error:', event.error)
        setError(`Erreur de reconnaissance vocale: ${event.error}`)
      }
    }
  }, [])

  // Charger les notes au montage
  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    try {
      setIsLoading(true)
      const { data, error: fetchError } = await getPlanningNotes()
      if (fetchError) {
        setError(fetchError)
      } else if (data) {
        setNotes(data)
      }
    } catch (err) {
      setError('Erreur lors du chargement des notes')
      console.error('[v0] Error loading notes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError('La reconnaissance vocale n\'est pas disponible dans votre navigateur')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
    }
  }

  const handleAddNote = async () => {
    if (!content.trim()) {
      setError('Veuillez entrer une note')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const { data, error: createError } = await createPlanningNote(content, category)

      if (createError) {
        setError(createError)
      } else if (data) {
        setNotes([data, ...notes])
        setContent('')
        setCategory('note_generale')
        setSuccess('Note ajoutée avec succès')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout de la note')
      console.error('[v0] Error adding note:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditStart = (note: PlanningNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
    setEditCategory(note.category)
  }

  const handleEditSave = async () => {
    if (!editContent.trim()) {
      setError('Le contenu ne peut pas être vide')
      return
    }

    try {
      setIsLoading(true)
      const { data, error: updateError } = await updatePlanningNote(editingId!, editContent, editCategory)

      if (updateError) {
        setError(updateError)
      } else if (data) {
        setNotes(notes.map((n) => (n.id === editingId ? data : n)))
        setEditingId(null)
        setSuccess('Note mise à jour')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError('Erreur lors de la mise à jour')
      console.error('[v0] Error updating note:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note?')) return

    try {
      setIsLoading(true)
      const { success, error: deleteError } = await deletePlanningNote(noteId)

      if (deleteError) {
        setError(deleteError)
      } else if (success) {
        setNotes(notes.filter((n) => n.id !== noteId))
        setSuccess('Note supprimée')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError('Erreur lors de la suppression')
      console.error('[v0] Error deleting note:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      absence: 'Absence',
      contrainte: 'Contrainte',
      note_generale: 'Note générale',
    }
    return labels[cat] || cat
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      absence: 'bg-red-100 text-red-800 border-red-300',
      contrainte: 'bg-orange-100 text-orange-800 border-orange-300',
      note_generale: 'bg-blue-100 text-blue-800 border-blue-300',
    }
    return colors[cat] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Consignes de Planning</h1>
        <p className="text-gray-600">
          Gérez les consignes et notes pour la génération des gardes (absences, contraintes, notes générales)
        </p>
      </div>

      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {/* Saisie */}
      <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm space-y-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-900 mb-2">
            Catégorie
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="note_generale">Note générale</option>
            <option value="absence">Absence</option>
            <option value="contrainte">Contrainte</option>
          </select>
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-900 mb-2">
            Contenu
          </label>
          <textarea
            ref={textareaRef}
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tapez votre consigne ou enregistrez-la par voix..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleAddNote}
            disabled={isLoading || !content.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition"
          >
            Ajouter la consigne
          </Button>

          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200'
            }`}
            title={isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement vocal'}
          >
            {isRecording ? (
              <>
                <MicOff className="w-4 h-4" />
                <span className="hidden sm:inline">Arrêter</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">Enregistrer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Liste des notes */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Consignes enregistrées</h2>
        {isLoading && notes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : notes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
            Aucune consigne pour le moment
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition">
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="note_generale">Note générale</option>
                      <option value="absence">Absence</option>
                      <option value="contrainte">Contrainte</option>
                    </select>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditSave}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium"
                      >
                        <Save className="w-4 h-4" />
                        Enregistrer
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-300 hover:bg-gray-400 text-gray-900 px-3 py-2 rounded text-sm font-medium"
                      >
                        <X className="w-4 h-4" />
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(note.category)}`}
                        >
                          {getCategoryLabel(note.category)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(note.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-gray-900 break-words">{note.content}</p>
                      <p className="text-xs text-gray-500 mt-2">Par: {note.created_by_email}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEditStart(note)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
