import type { RiskLevel } from '../types'

const cfg: Record<RiskLevel, { label: string; cls: string }> = {
  green:  { label: 'Low Risk',  cls: 'bg-green/20 text-green border-green/40' },
  yellow: { label: 'Moderate',  cls: 'bg-yellow/20 text-yellow border-yellow/40' },
  red:    { label: 'High Risk', cls: 'bg-red/20 text-red border-red/40' },
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, cls } = cfg[level]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
