'use client'

interface VacationsButtonProps {
  onClick: () => void
  disabled?: boolean
  className?: string
}

export function VacationsButton({ onClick, disabled = false, className = '' }: VacationsButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition ${className}`}
      title="Gérer les vacances"
    >
      <span className="text-lg">✈️</span>
      <span>Vacances</span>
    </button>
  )
}
