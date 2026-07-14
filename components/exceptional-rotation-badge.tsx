import { Badge } from "@/components/ui/badge"

interface ExceptionalRotationBadgeProps {
  type: "Roulement exceptionnel" | "Modifié manuellement"
  className?: string
}

export function ExceptionalRotationBadge({ type, className = "" }: ExceptionalRotationBadgeProps) {
  if (type === "Roulement exceptionnel") {
    return (
      <Badge className={`bg-amber-100 text-amber-800 hover:bg-amber-200 ${className}`}>
        <span className="text-xs font-medium">Roulement</span>
      </Badge>
    )
  }

  return (
    <Badge className={`bg-rose-100 text-rose-800 hover:bg-rose-200 ${className}`}>
      <span className="text-xs font-medium">Modifié</span>
    </Badge>
  )
}
