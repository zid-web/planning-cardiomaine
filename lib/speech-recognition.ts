/**
 * Helpers Web Speech API (reconnaissance vocale navigateur).
 * Chrome / Edge recommandés ; HTTPS (ou localhost) requis.
 */

export type SpeechErrorCode =
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "service-not-allowed"
  | "language-not-supported"
  | "bad-grammar"
  | "not-supported"
  | "insecure-context"
  | "start-failed"
  | string

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor())
}

export function speechErrorMessage(error: SpeechErrorCode): string {
  switch (error) {
    case "not-allowed":
      return "Micro refusé. Autorisez le micro (cadenas de l’URL → Micro → Autoriser), puis réessayez. Chrome ou Edge recommandé."
    case "no-speech":
      // Non bloquant : Chrome envoie souvent no-speech en continuous — on redémarre l’écoute.
      return ""
    case "audio-capture":
      return "Aucun microphone détecté sur cet appareil."
    case "network":
      return "Erreur réseau de la reconnaissance vocale. Vérifiez la connexion Internet."
    case "aborted":
      return ""
    case "service-not-allowed":
      return "Reconnaissance vocale bloquée. Utilisez HTTPS (ou localhost) et Chrome/Edge."
    case "language-not-supported":
      return "Langue fr-FR non supportée par ce navigateur."
    case "not-supported":
      return "Reconnaissance vocale indisponible. Utilisez Chrome ou Edge (pas Firefox/Safari iOS)."
    case "insecure-context":
      return "Contexte non sécurisé : le micro nécessite HTTPS (ou localhost)."
    case "start-failed":
      return "Impossible de démarrer le micro. Fermez les autres onglets qui l’utilisent, puis réessayez."
    default:
      return error ? `Erreur micro : ${error}` : "Erreur de reconnaissance vocale"
  }
}

/** Erreurs Web Speech qui ne doivent pas couper la dictée (auto-restart). */
export function isRecoverableSpeechError(error: SpeechErrorCode): boolean {
  return error === "no-speech" || error === "aborted"
}

/** Demande l’accès micro avant SpeechRecognition (meilleur feedback permission). */
export async function ensureMicrophonePermission(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "not-supported" }
  if (!window.isSecureContext) return { ok: false, error: "insecure-context" }
  if (!navigator.mediaDevices?.getUserMedia) {
    // Certains contextes n’exposent pas getUserMedia mais SpeechRecognition peut marcher
    return { ok: true }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return { ok: true }
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ""
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, error: "not-allowed" }
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { ok: false, error: "audio-capture" }
    }
    return { ok: false, error: "start-failed" }
  }
}

/** Sous-ensemble typé minimal de l’API SpeechRecognition (évite les dépendances DOM lib). */
export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((ev: Event) => void) | null
  onend: ((ev: Event) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null
}

export type SpeechRecognitionResultEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

export function createFrSpeechRecognition(opts?: {
  continuous?: boolean
}): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = "fr-FR"
  recognition.continuous = opts?.continuous !== false
  recognition.interimResults = true
  if (typeof recognition.maxAlternatives === "number") {
    recognition.maxAlternatives = 1
  }
  return recognition
}

/** Agrège résultats finals + interim pour affichage live. */
export function collectSpeechTranscript(
  event: SpeechRecognitionResultEventLike,
  previousFinal: string,
): { finalText: string; displayText: string } {
  let finalText = previousFinal
  let interim = ""
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const part = event.results[i][0]?.transcript || ""
    if (event.results[i].isFinal) {
      finalText = `${finalText}${part} `.replace(/\s+/g, " ")
    } else {
      interim += part
    }
  }
  const displayText = `${finalText}${interim}`.trim()
  return { finalText: finalText.trimEnd(), displayText }
}
