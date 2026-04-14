'use client'

import type { ReactNode } from 'react'

export type OrderStatus = 'initiated' | 'pending' | 'confirmed' | 'settled' | 'failed'

const STATUS_CONFIG: Record<OrderStatus, {
  bg: string
  border: string
  text: string
  dot: string
  pulse: boolean
  label: ReactNode
}> = {
  initiated: {
    bg: 'bg-neutral/10',
    border: 'border-neutral/20',
    text: 'text-neutral',
    dot: 'bg-neutral',
    pulse: false,
    label: 'Initiated',
  },
  pending: {
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    text: 'text-warning',
    dot: 'bg-warning',
    pulse: true,
    label: 'Pending',
  },
  confirmed: {
    bg: 'bg-brand/10',
    border: 'border-brand/20',
    text: 'text-brand',
    dot: 'bg-brand',
    pulse: false,
    label: 'Confirmed',
  },
  settled: {
    bg: 'bg-success/10',
    border: 'border-success/20',
    text: 'text-success',
    dot: 'bg-success',
    pulse: false,
    label: 'Settled',
  },
  failed: {
    bg: 'bg-danger/10',
    border: 'border-danger/20',
    text: 'text-danger',
    dot: 'bg-danger',
    pulse: false,
    label: 'Failed',
  },
}

export default function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const c = STATUS_CONFIG[status as OrderStatus] ?? STATUS_CONFIG.initiated
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.border} ${c.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}
