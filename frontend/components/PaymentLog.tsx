'use client'

import { useEffect, useRef, useState } from 'react'
import type { StreamEvent } from '../hooks/usePaymentStream'

interface PaymentEvent {
  id: string
  event_type: string
  message: string
  timestamp: string
  order_id: string
}

interface LogEntry {
  id: string
  eventType: string
  message: string
  timestamp: string
}

const EVENT_META: Record<string, { icon: string; color: string }> = {
  'order.created': { icon: '↗', color: 'text-blue-400' },
  'payment.pending': { icon: '◷', color: 'text-yellow-400' },
  'payment.settled': { icon: '✓', color: 'text-green-400' },
  'payment.failed': { icon: '✗', color: 'text-red-400' },
  'order.updated': { icon: '·', color: 'text-[#94a3b8]' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PaymentLog({
  initialEvents,
  newEvent,
  connected,
}: {
  initialEvents: PaymentEvent[]
  newEvent: StreamEvent | null
  connected: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)
  const seenIds = useRef(new Set<string>(
    (initialEvents || []).flatMap(e => [e.id, `${e.event_type}_${e.message}_${e.timestamp}`])
  ))

  const [entries, setEntries] = useState<LogEntry[]>(() =>
    (initialEvents || []).map(e => ({
      id: e.id,
      eventType: e.event_type,
      message: e.message,
      timestamp: e.timestamp,
    })).slice(0, 100)
  )

  useEffect(() => {
    const newEntries = (initialEvents || []).map(e => ({
      id: e.id,
      eventType: e.event_type,
      message: e.message,
      timestamp: e.timestamp,
    })).slice(0, 100)

    const nextSeen = new Set<string>()
    newEntries.forEach(e => {
      nextSeen.add(e.id)
      nextSeen.add(`${e.eventType}_${e.message}_${e.timestamp}`)
    })

    seenIds.current = nextSeen
    setEntries(newEntries)
  }, [initialEvents])

  useEffect(() => {
    if (!newEvent || newEvent.type !== 'event.log') return
    const dedupeKey = `${newEvent.eventType}_${newEvent.message}_${newEvent.timestamp}`
    if (seenIds.current.has(dedupeKey)) return
    seenIds.current.add(dedupeKey)

    const entry: LogEntry = {
      id: dedupeKey,
      eventType: newEvent.eventType || 'order.updated',
      message: newEvent.message || '',
      timestamp: newEvent.timestamp,
    }
    setEntries(prev => [entry, ...prev].slice(0, 100))
  }, [newEvent])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [entries.length])

  useEffect(() => {
    const timer = setInterval(() => setTick(v => v + 1), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-[#0a0e17] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1f2937] flex items-center gap-2">
        <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
          Live Transaction Log
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <span className={`text-xs font-mono ${connected ? 'text-green-400' : 'text-amber-400'}`}>
            {connected ? 'LIVE' : 'PAUSED'}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="h-56 overflow-y-auto p-4 font-mono text-xs space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-[#64748b] text-center mt-8">
            No transactions yet — waiting for payments...
          </p>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="flex gap-3 items-start">
              <span className="text-[#64748b] shrink-0 tabular-nums font-mono w-16">
                {timeAgo(entry.timestamp)}
              </span>
              <span className={`${EVENT_META[entry.eventType]?.color ?? 'text-[#64748b]'} w-4`}> 
                {EVENT_META[entry.eventType]?.icon ?? '·'}
              </span>
              <span className={EVENT_META[entry.eventType]?.color ?? 'text-[#64748b]'}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
