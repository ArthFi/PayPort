'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BACKEND_URL } from '../../lib/constants'

type Step = 'connect' | 'confirm' | 'processing' | 'success' | 'error'

function MockPaymentInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') || ''
  const amount = searchParams.get('amount') || '0'
  const token = searchParams.get('token') || 'USDC'
  const simBase = searchParams.get('simBase') || ''
  const appKey = searchParams.get('appKey') || ''

  const [step, setStep] = useState<Step>('connect')
  const [txHash, setTxHash] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [expiresIn, setExpiresIn] = useState(180)
  const [errorMsg, setErrorMsg] = useState('')
  const [canAutoClose, setCanAutoClose] = useState(false)
  const [simulateEnabled, setSimulateEnabled] = useState(true)
  const [liveMode, setLiveMode] = useState(false)

  function formatCountdown(total: number) {
    const mins = Math.floor(total / 60)
    const secs = total % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  useEffect(() => {
    setCanAutoClose(Boolean(window.opener && !window.opener.closed))
  }, [])

  useEffect(() => {
    let active = true
    async function fetchHealth() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`)
        const health = await res.json()
        if (!active) return
        setSimulateEnabled(String(health?.simulateEnabled) === 'true')
        setLiveMode(String(health?.liveMode) === 'true')
      } catch {
        if (active) {
          setSimulateEnabled(false)
          setLiveMode(false)
        }
      }
    }

    fetchHealth()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (step === 'success' || step === 'error') return
    const timer = setInterval(() => {
      setExpiresIn(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  const handleConnect = useCallback(() => {
    setTimeout(() => setStep('confirm'), 500)
  }, [])

  const handleConfirm = useCallback(async () => {
    setStep('processing')
    try {
      let data: { ok: boolean; error?: string; txHash?: string }

      if (simBase) {
        const res = await fetch(`${simBase}/sim/complete/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Sim payment failed')
      } else {
        if (!simulateEnabled || liveMode) {
          throw new Error('Simulation checkout is disabled in live mode.')
        }
        if (!appKey) {
          throw new Error('Missing app key for simulation checkout.')
        }

        const res = await fetch(`${BACKEND_URL}/api/webhook/simulate/${id}`, {
          method: 'POST',
          headers: { 'x-app-key': appKey },
        })
        data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Simulation failed')
      }

      setTxHash(data.txHash || '')
      setStep('success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed'
      setErrorMsg(msg)
      setStep('error')
    }
  }, [appKey, id, liveMode, simBase, simulateEnabled])

  useEffect(() => {
    if (step !== 'success') return
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'hashpay:paid', orderId: id, txHash }, '*')
            window.close()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [step, id, txHash])

  return (
    <main className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-sm overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="bg-brand/10 border-b border-brand/20 px-6 py-4">
          <p className="text-xs text-brand font-medium">HashKey Checkout</p>
          <p className="text-xs text-ink-muted mt-0.5">Secured by PayPort</p>
        </div>

        <div className="bg-warning/10 border-b border-warning/20 px-6 py-2">
          <p className="text-[11px] text-warning">
            Development simulation page. Do not use for real merchant acceptance.
          </p>
        </div>

        <div className="px-6 py-8 text-center">
          <p className="text-3xl font-mono font-semibold text-ink-primary">{amount}</p>
          <p className="text-sm text-ink-muted font-mono">{token}</p>
        </div>

        <div className="px-6 pb-6 space-y-2 border-t border-surface-border pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-ink-muted">Order</span>
            <span className="font-mono text-ink-secondary truncate ml-4">{id ? `${id.slice(0, 12)}...` : '—'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ink-muted">Network</span>
            <span className="font-mono text-ink-secondary">HashKey Chain Testnet</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ink-muted">Protocol</span>
            <span className="font-mono text-ink-secondary">HP2</span>
          </div>
        </div>

        <div className="px-6 pb-6">
          {step === 'connect' && (
            <button
              onClick={handleConnect}
              className="w-full h-10 rounded-lg bg-brand text-white text-sm font-medium hover:brightness-110 transition"
            >
              Connect Wallet
            </button>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="bg-surface-raised border border-surface-border rounded-lg p-3 text-xs">
                <p className="text-ink-muted mb-1">From</p>
                <p className="text-ink-secondary font-mono">0xf39F...2266 (Demo Wallet)</p>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full h-10 rounded-lg bg-brand text-white text-sm font-medium hover:brightness-110 transition"
              >
                Confirm payment
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-2">
              <div className="inline-block h-7 w-7 border-2 border-brand border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-ink-secondary text-sm">Processing settlement...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="text-4xl text-success mb-3">✓</div>
              <p className="text-ink-primary font-medium mb-1">Payment confirmed</p>
              <p className="text-ink-secondary text-sm mb-3">{amount} {token} settled</p>
              {txHash && (
                <p className="text-xs text-ink-muted font-mono mb-3">{txHash.slice(0, 24)}...</p>
              )}
              {canAutoClose ? (
                <p className="text-xs text-ink-muted">Closing in {countdown}s...</p>
              ) : (
                <p className="text-xs text-ink-muted">Payment complete. You can close this tab.</p>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
                <p className="text-danger text-sm">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setStep('connect'); setErrorMsg('') }}
                className="w-full h-10 rounded-lg bg-transparent border border-surface-border text-ink-secondary text-sm hover:border-brand/40 hover:text-ink-primary transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {(step === 'connect' || step === 'confirm' || step === 'processing') && (
            <p className="text-xs text-ink-muted text-center mt-3">Expires in {formatCountdown(expiresIn)}</p>
          )}
        </div>
      </div>
    </main>
  )
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-base" />}>
      <MockPaymentInner />
    </Suspense>
  )
}
