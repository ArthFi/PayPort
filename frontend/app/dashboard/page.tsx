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
  const [activeDemoKey, setActiveDemoKey] = useState<string>('')
  const [switchingKey, setSwitchingKey] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [events, setEvents] = useState<PaymentEvent[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [hp2Mode, setHp2Mode] = useState<'HP2 MOCK' | 'HP2 SIM' | 'HP2 LIVE'>('HP2 MOCK')
  const [simulateEnabled, setSimulateEnabled] = useState(false)
  const [liveMode, setLiveMode] = useState(false)

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
        const isLiveMode = String(health.liveMode) === 'true'
        const isSimulateEnabled = String(health.simulateEnabled) === 'true'
        const demoKey = String(health.demoKey || '')
        setLiveMode(isLiveMode)
        setSimulateEnabled(isSimulateEnabled)
        setActiveDemoKey(demoKey)

        if (mockMode) {
          setHp2Mode('HP2 MOCK')
          return
        }

        setHp2Mode(isLiveMode ? 'HP2 LIVE' : 'HP2 SIM')
      } catch {
        if (active) {
          setHp2Mode('HP2 MOCK')
          setLiveMode(false)
          setSimulateEnabled(false)
        }
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
    if (lastEvent.type === 'connected') return
    // Re-fetch on every order/event update to keep provider-reconciled status current.
    fetchOrders()
  }, [lastEvent, fetchOrders])

  useEffect(() => {
    if (!appKey) return
    // Fallback sync for cases where provider progression doesn't emit terminal events immediately.
    const timer = setInterval(() => {
      fetchOrders()
    }, 12000)
    return () => clearInterval(timer)
  }, [appKey, fetchOrders])

  async function handleSimulate(paymentRequestId: string) {
    if (!appKey) return
    if (!simulateEnabled || liveMode) {
      if (typeof window !== 'undefined') {
        window.alert('Simulation is disabled in live mode.')
      }
      return
    }

    try {
      const data = await simulatePayment(appKey, paymentRequestId)
      if (!data?.ok) {
        throw new Error(data?.error || 'Simulation failed')
      }
      await fetchOrders()
    } catch (err) {
      console.error('[Dashboard] simulate failed:', err)
      if (typeof window !== 'undefined') {
        window.alert('Simulation failed. Check backend logs and try again.')
      }
    }
  }

  async function handleSwitchToActiveDemoKey() {
    if (!activeDemoKey) return
    setSwitchingKey(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/merchant/me`, {
        headers: { 'x-app-key': activeDemoKey },
      })
      const data = await res.json()
      if (!data?.ok || !data?.merchant?.walletAddress) {
        throw new Error(data?.error || 'Failed to load active demo merchant')
      }

      localStorage.setItem('payport_app_key', activeDemoKey)
      localStorage.setItem('payport_wallet', data.merchant.walletAddress)
      window.location.reload()
    } catch (err) {
      console.error('[Dashboard] key switch failed:', err)
      if (typeof window !== 'undefined') {
        window.alert('Failed to switch to active demo key. Check backend health and retry.')
      }
    } finally {
      setSwitchingKey(false)
    }
  }

  function handleDisconnect() {
    localStorage.removeItem('payport_app_key')
    localStorage.removeItem('payport_wallet')
    router.push('/onboard')
  }

  if (!appKey) return null

  const modePill = hp2Mode === 'HP2 MOCK'
    ? {
        label: 'MOCK',
        className: 'bg-surface-raised border border-surface-border text-ink-muted',
      }
    : hp2Mode === 'HP2 SIM'
      ? {
          label: 'SIM',
          className: 'bg-surface-raised border border-brand/20 text-brand',
        }
      : {
          label: 'LIVE HP2',
          className: 'bg-success/10 border border-success/20 text-success',
        }

  return (
    <main className="min-h-screen bg-surface-base">
      <header className="border-b border-surface-border bg-surface-base/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium text-ink-primary">PayPort</p>
              <p className="text-xs text-ink-muted">Merchant Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand animate-pulse' : 'bg-danger'}`} />
              <span className={`text-xs font-mono ${connected ? 'text-ink-secondary' : 'text-danger'}`}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${modePill.className}`}>
              {modePill.label}
            </span>

            {walletAddress && (
              <span className="text-xs text-ink-muted font-mono hidden md:block">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            )}

            {appKey && (
              <span className="text-xs text-ink-muted font-mono hidden lg:block">
                key: {appKey.slice(0, 8)}...{appKey.slice(-4)}
              </span>
            )}

            <button
              onClick={handleDisconnect}
              className="text-xs text-danger/60 hover:text-danger transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </header>

      {!connected && (
        <div className="bg-danger/10 border-b border-danger/20 px-6 py-2 flex items-center gap-2">
          <span className="text-danger text-xs">Live stream disconnected. Data may be delayed while reconnecting.</span>
        </div>
      )}

      {liveMode && !simulateEnabled && (
        <div className="bg-success/10 border-b border-success/20 px-6 py-2">
          <span className="text-success text-xs">Live mode active. Simulation controls are disabled.</span>
        </div>
      )}

      {liveMode && appKey && activeDemoKey && appKey !== activeDemoKey && (
        <div className="bg-warning/10 border-b border-warning/20 px-6 py-2 flex items-center justify-between gap-3">
          <span className="text-warning text-xs">
            You are viewing a different merchant key than the active demo checkout key. New demo transactions may not appear here.
          </span>
          <button
            onClick={handleSwitchToActiveDemoKey}
            disabled={switchingKey}
            className="text-xs px-2.5 py-1 rounded border border-warning/30 text-warning hover:bg-warning/20 disabled:opacity-60"
          >
            {switchingKey ? 'Switching...' : 'Switch To Active Key'}
          </button>
        </div>
      )}

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <StatsBar orders={orders} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SDKSnippet appKey={appKey} />
              </div>
              <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <p className="text-sm font-medium text-ink-primary mb-3">
                  AI Agent Ready
                </p>
                <p className="text-sm text-ink-secondary leading-relaxed mb-3">
                  PayPort supports autonomous AI agents. Agents can request payment links
                  programmatically via the REST API to monetize their services.
                </p>
                <div className="bg-surface-base border border-surface-border rounded-lg p-4 font-mono text-xs">
                  <p className="text-brand">POST {BACKEND_URL}/api/payment/create</p>
                  <p className="text-ink-muted mt-1">x-app-key: {appKey.slice(0, 12)}...</p>
                </div>
              </div>
            </div>

            <OrdersTable
              orders={orders}
              canSimulate={simulateEnabled && !liveMode}
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
