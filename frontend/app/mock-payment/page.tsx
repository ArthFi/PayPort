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

  const [step, setStep] = useState<Step>('connect')
  const [txHash, setTxHash] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [errorMsg, setErrorMsg] = useState('')
  const [canAutoClose, setCanAutoClose] = useState(false)

  useEffect(() => {
    setCanAutoClose(Boolean(window.opener && !window.opener.closed))
  }, [])

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
        const res = await fetch(`${BACKEND_URL}/api/webhook/simulate/${id}`, {
          method: 'POST',
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
  }, [id, simBase])

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
    <main className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-3xl text-[#1A56FF]">⬡</span>
          <h1 className="text-white font-bold text-lg mt-1">PayPort</h1>
          <span className="text-xs text-[#64748b] font-mono">HashKey Chain Testnet</span>
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6">
          <div className="text-center mb-6 pb-6 border-b border-[#1f2937]">
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Payment Amount</p>
            <p className="text-3xl font-mono font-bold text-white">{amount}</p>
            <p className="text-lg text-[#94a3b8] font-mono">{token}</p>
          </div>

          <div className="space-y-2 text-xs mb-6">
            {[
              ['Merchant', 'PayPort Demo Merchant'],
              ['Network', 'HashKey Chain Testnet'],
              ['Protocol', 'HP2 · EIP-3009'],
              ['Order', id ? id.slice(0, 16) + '...' : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-[#64748b]">{k}</span>
                <span className="text-[#94a3b8] font-mono">{v}</span>
              </div>
            ))}
          </div>

          {step === 'connect' && (
            <button
              onClick={handleConnect}
              className="w-full py-3 bg-[#1A56FF]/10 text-[#1A56FF] border border-[#1A56FF]/30 rounded-xl font-medium hover:bg-[#1A56FF]/20 transition-colors"
            >
              Connect Wallet
            </button>
          )}

          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="bg-[#1a2332] border border-[#1f2937] rounded-lg p-3 text-xs">
                <p className="text-[#64748b] mb-1">From</p>
                <p className="text-[#94a3b8] font-mono">0xf39F...2266 (Demo Wallet)</p>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full py-3 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl font-medium hover:bg-green-500/20 transition-colors"
              >
                Confirm Payment
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-4">
              <div className="inline-block h-8 w-8 border-2 border-[#1A56FF] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-[#94a3b8] text-sm">Processing on HashKey Chain...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="text-4xl text-green-400 mb-3">✓</div>
              <p className="text-white font-semibold mb-1">Payment Confirmed</p>
              <p className="text-[#94a3b8] text-sm mb-3">{amount} {token} settled via HP2</p>
              {txHash && (
                <p className="text-xs text-[#64748b] font-mono mb-3">{txHash.slice(0, 24)}...</p>
              )}
              {canAutoClose ? (
                <p className="text-xs text-[#64748b]">Closing in {countdown}s...</p>
              ) : (
                <p className="text-xs text-[#64748b]">Payment complete. You can close this tab.</p>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setStep('connect'); setErrorMsg('') }}
                className="w-full py-2 bg-[#1f2937] text-[#94a3b8] rounded-lg text-sm hover:bg-[#1e293b] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#64748b] mt-4">
          ⬡ Powered by HashKey Chain · HP2 Protocol
        </p>
      </div>
    </main>
  )
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0e17]" />}>
      <MockPaymentInner />
    </Suspense>
  )
}
