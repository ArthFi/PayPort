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

const EVENT_STRIP: Record<string, string> = {
  'order.created': 'border-brand',
  'payment.pending': 'border-warning',
  'payment.confirmed': 'border-brand',
  'payment.settled': 'border-success',
  'payment.failed': 'border-danger',
  'order.updated': 'border-neutral',
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
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-primary">Activity</h2>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs text-ink-muted">Live</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              <span className="text-xs text-ink-muted">Paused</span>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="h-56 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-ink-muted text-center mt-8 text-sm px-5">
            No transactions yet — waiting for payments...
          </p>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="px-5 py-3 border-b border-surface-border/50 hover:bg-surface-hover transition-colors last:border-0">
              <div className={`border-l-2 pl-4 ${EVENT_STRIP[entry.eventType] || 'border-neutral'}`}>
                <p className="text-sm text-ink-secondary">{entry.message}</p>
                <p className="text-xs text-ink-muted font-mono mt-0.5">{timeAgo(entry.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
