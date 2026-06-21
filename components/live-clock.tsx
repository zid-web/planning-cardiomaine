"use client"

import { useEffect, useState } from "react"

export function LiveClock() {
  const [date, setDate] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setDate(new Date())
    setIsMounted(true)
    const timer = setInterval(() => setDate(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!isMounted || !date) {
    return (
      <div className="flex flex-col items-end text-right">
        <div className="text-2xl font-bold text-slate-900">--:--</div>
        <div className="text-sm text-slate-500 capitalize">--</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end text-right">
      <div className="text-2xl font-bold text-slate-900">
        {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="text-sm text-slate-500 capitalize">
        {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  )
}
