"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

/**
 * Pastille discrète signalant la perte de réseau. L'application reste
 * pleinement fonctionnelle hors ligne : le badge sert uniquement à lever le
 * doute lorsqu'un utilisateur constate que rien ne se met à jour.
 *
 * Le positionnement est assuré par la pile flottante du layout, pour que le
 * badge et l'invitation à installer ne se chevauchent jamais sur mobile.
 */
export function OfflineBadge() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="flex items-center gap-1.5 rounded-full bg-[#1e293b] px-3 py-1.5 text-[11px] font-medium text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      Hors ligne — calculs disponibles
    </div>
  )
}

export default OfflineBadge
