import type React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ExceptionalRotationRule, CellData } from "@/lib/types"
import { DOCTOR_COLORS } from "@/lib/constants"

interface ExceptionalRotationSelectorProps {
  rule: ExceptionalRotationRule
  currentValue: string
  onSelect: (doctor: string) => void
  availableDoctors: string[]
  disabled?: boolean
}

export function ExceptionalRotationSelector({
  rule,
  currentValue,
  onSelect,
  availableDoctors,
  disabled = false,
}: ExceptionalRotationSelectorProps) {
  return (
    <Select value={currentValue} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className="w-full h-8 text-xs border-amber-300 bg-amber-50">
        <SelectValue placeholder="Sélectionner..." />
      </SelectTrigger>
      <SelectContent>
        {availableDoctors.map((doctor) => (
          <SelectItem key={doctor} value={doctor}>
            <span className="font-medium">{doctor}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
