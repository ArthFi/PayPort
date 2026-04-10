'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import StatsBar from '../../components/StatsBar'
import OrdersTable, { type Order } from '../../components/OrdersTable'
import PaymentLog from '../../components/PaymentLog'
import SDKSnippet from '../../components/SDKSnippet'
import ReceiptModal from '../../components/ReceiptModal'
import { usePaymentStream } from '../../hooks/usePaymentStream'
import { checkHealth, getOrders, simulatePayment } from '../../lib/api'
import { BACKEND_URL } from '../../lib/constants'

interface PaymentEvent {
  id: string
  event_type: string
  message: string
  timestamp: string
  order_id: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [appKey, setAppKey] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [events, setEvents] = useState<PaymentEvent[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [hp2Mode, setHp2Mode] = useState<'HP2 MOCK' | 'HP2 SIM' | 'HP2 LIVE'>('HP2 MOCK')

  useEffect(() => {
    const key = localStorage.getItem('payport_app_key')
    const wallet = localStorage.getItem('payport_wallet') || ''
    if (!key) {
      router.push('/onboard')
      return
    }
    setAppKey(key)
    setWalletAddress(wallet)
  }, [router])

  const fetchOrders = useCallback(async () => {
    if (!appKey) return
    try {
      const data = await getOrders(appKey)
      if (data.ok) {
        setOrders(data.orders || [])
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('[Dashboard] fetchOrders failed:', err)
    } finally {
      setLoading(false)
    }
  }, [appKey])

  useEffect(() => {
    if (appKey) fetchOrders()
  }, [appKey, fetchOrders])

  useEffect(() => {
    let active = true
    async function fetchHealth() {
      try {
        const health = await checkHealth()
        if (!active || !health) return

        const mockMode = String(health.mockMode) === 'true'
        if (mockMode) {
          setHp2Mode('HP2 MOCK')
          return
        }

        const base = String(health.hp2BaseUrl || '').toLowerCase()
        const isSim = base.includes('localhost') || base.includes('127.0.0.1') || base.includes(':3002')
        setHp2Mode(isSim ? 'HP2 SIM' : 'HP2 LIVE')
      } catch {
        if (active) setHp2Mode('HP2 MOCK')
      }
    }

    fetchHealth()
    return () => {
      active = false
    }
  }, [])

  const { lastEvent, connected } = usePaymentStream(appKey)

  useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'order.created') {
      fetchOrders()
    } else if (lastEvent.type === 'order.updated') {
      setOrders(prev => prev.map(o =>
        o.id === lastEvent.orderId
          ? {
              ...o,
              status: lastEvent.status || o.status,
              tx_hash: lastEvent.txHash ?? o.tx_hash,
              settled_at: lastEvent.settledAt ?? o.settled_at,
            }
          : o
      ))
    }
  }, [lastEvent, fetchOrders])

  async function handleSimulate(paymentRequestId: string) {
    await simulatePayment(paymentRequestId)
  }

  function handleDisconnect() {
    localStorage.removeItem('payport_app_key')
    localStorage.removeItem('payport_wallet')
    router.push('/onboard')
  }

  if (!appKey) return null

  const hp2ModeClass = hp2Mode === 'HP2 MOCK'
    ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    : 'bg-[#1A56FF]/10 text-[#1A56FF] border-[#1A56FF]/20'

  return (
    <main className="min-h-screen bg-[#0a0e17]">
      <header className="border-b border-[#1f2937] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#1A56FF] text-xl">⬡</span>
          <span className="font-bold text-white tracking-tight">PayPort</span>
          <span className="text-xs text-[#64748b] hidden sm:block">Merchant Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-xs font-mono ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <span className={`px-2 py-0.5 border rounded text-xs font-semibold uppercase tracking-wider ${hp2ModeClass}`}>
            {hp2Mode}
          </span>
          {walletAddress && (
            <span className="text-xs text-[#64748b] font-mono hidden md:block">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          )}
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </header>

      {!connected && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center gap-2">
          <span className="text-red-400 text-xs">⚠ Live stream disconnected — data may be delayed. Reconnecting...</span>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 border-2 border-[#1A56FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <StatsBar orders={orders} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SDKSnippet appKey={appKey} />
              </div>
              <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">
                  AI Agent Ready
                </p>
                <p className="text-xs text-[#64748b] leading-relaxed mb-3">
                  PayPort supports autonomous AI agents. Agents can request payment links
                  programmatically via the REST API to monetize their services.
                </p>
                <div className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-3 font-mono text-xs">
                  <p className="text-green-400">POST {BACKEND_URL}/api/payment/create</p>
                  <p className="text-[#64748b]">x-app-key: {appKey.slice(0, 12)}...</p>
                </div>
              </div>
            </div>

            <OrdersTable
              orders={orders}
              onSimulate={handleSimulate}
              onViewReceipt={setSelectedOrder}
            />

            <PaymentLog initialEvents={events} newEvent={lastEvent} connected={connected} />
          </>
        )}
      </div>

      <ReceiptModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </main>
  )
}
