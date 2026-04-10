'use client'

export type OrderStatus = 'initiated' | 'pending' | 'confirmed' | 'settled' | 'failed'

const STATUS_CONFIG: Record<OrderStatus, { label: string; colorClass: string; pulse: boolean }> = {
  initiated: { label: 'INITIATED', colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', pulse: false },
  pending:   { label: 'PENDING',   colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', pulse: true },
  confirmed: { label: 'CONFIRMED', colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     pulse: false },
  settled:   { label: 'SETTLED',   colorClass: 'bg-green-500/10 text-green-400 border-green-500/20',   pulse: true },
  failed:    { label: 'FAILED',    colorClass: 'bg-red-500/10 text-red-400 border-red-500/20',         pulse: false },
}

const DOT_COLOR: Record<OrderStatus, string> = {
  initiated: 'bg-yellow-400',
  pending:   'bg-yellow-400',
  confirmed: 'bg-blue-400',
  settled:   'bg-green-400',
  failed:    'bg-red-400',
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as OrderStatus] ?? STATUS_CONFIG.initiated
  const dot = DOT_COLOR[status as OrderStatus] ?? 'bg-gray-400'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.colorClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}
