'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BACKEND_URL } from '../lib/constants'

export interface StreamEvent {
  type: 'connected' | 'order.created' | 'order.updated' | 'event.log'
  timestamp: string
  orderId?: string
  cartMandateId?: string
  amount?: string
  token?: string
  status?: string
  txHash?: string
  settlementType?: 'real' | 'simulated' | 'unknown'
  settledAt?: string
  eventType?: string
  message?: string
  merchantId?: string
}

export function usePaymentStream(appKey: string | null) {
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!appKey) return
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const url = `${BACKEND_URL}/api/stream?key=${encodeURIComponent(appKey)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      if (mountedRef.current) setConnected(true)
    }

    es.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const parsed: StreamEvent = JSON.parse(event.data)
        setLastEvent(parsed)
      } catch (e) {
        console.warn('[SSE] Parse error:', e)
      }
    }

    es.onerror = () => {
      if (!mountedRef.current) return
      setConnected(false)
      es.close()
      esRef.current = null
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, 3000)
    }
  }, [appKey])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  return { lastEvent, connected }
}
