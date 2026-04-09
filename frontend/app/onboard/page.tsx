'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'
import { checkHealth, registerMerchant } from '../../lib/api'

type Step = 'connect' | 'verifying' | 'error'

export default function OnboardPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [step, setStep] = useState<Step>('connect')
  const [errorMsg, setErrorMsg] = useState('')
  const [kycContract, setKycContract] = useState('')

  useEffect(() => {
    const existing = localStorage.getItem('payport_app_key')
    if (existing) {
      router.push('/dashboard')
    }
  }, [router])

  useEffect(() => {
    let active = true
    async function fetchHealth() {
      try {
        const health = await checkHealth()
        if (active) {
          setKycContract(String(health?.kycContract || ''))
        }
      } catch {
        if (active) setKycContract('')
      }
    }
    fetchHealth()
    return () => {
      active = false
    }
  }, [])

  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(kycContract)
  const kycLabel = isAddress ? `${kycContract.slice(0, 6)}...${kycContract.slice(-4)}` : '0xbCcec...473C'

  const stepIndex = !isConnected ? 1 : 2

  function StepNode({
    index,
    label,
  }: {
    index: 1 | 2 | 3
    label: string
  }) {
    const completed = index < stepIndex
    const active = index === stepIndex

    return (
      <div className="flex-1 flex flex-col items-center gap-2 text-center">
        <div
          className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs font-mono ${
            completed
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : active
                ? 'bg-[#1A56FF]/10 text-[#1A56FF] border-[#1A56FF]/30'
                : 'bg-[#1f2937] text-[#64748b] border-[#1f2937]'
          }`}
        >
          {completed ? '✓' : index}
        </div>
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${active ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>
          {label}
        </span>
      </div>
    )
  }

  async function handleRegister() {
    if (!address) return
    setStep('verifying')
    setErrorMsg('')
    try {
      const data = await registerMerchant(address)
      localStorage.setItem('payport_app_key', data.appKey)
      localStorage.setItem('payport_wallet', address)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setErrorMsg(msg)
      setStep('error')
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0e17] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl text-[#1A56FF] mb-3">⬡</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PayPort</h1>
          <p className="text-[#94a3b8] text-sm mt-1">Compliant B2B Payments on HashKey Chain</p>
        </div>

        <div className="mb-6 bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center gap-2">
            <StepNode index={1} label="Connect Wallet" />
            <div className="h-px flex-1 bg-[#1f2937] mb-5" />
            <StepNode index={2} label="Verify KYC" />
            <div className="h-px flex-1 bg-[#1f2937] mb-5" />
            <StepNode index={3} label="Get API Key" />
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-1">Merchant Onboarding</h2>
          <p className="text-[#94a3b8] text-sm mb-4">
            Connect your KYC-verified wallet to start accepting crypto payments.
          </p>

          <div className="bg-[#1a2332] border border-[#1f2937] rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-[#1A56FF] text-xl mt-0.5">⬡</span>
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  HashKey Chain KYC Required
                </p>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Your wallet must hold a KYC Soul Bound Token (SBT) on HashKey Chain
                  Testnet (chainId: 133). This non-transferable credential confirms
                  regulatory compliance. Contract:{' '}
                  <span className="font-mono text-[#1A56FF]">{kycLabel}</span>
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs">
                    ✓ On-chain verification
                  </span>
                  <span className="px-2 py-1 bg-[#1A56FF]/10 text-[#1A56FF] border border-[#1A56FF]/20 rounded text-xs font-mono">
                    ⬡ HashKey Chain 133
                  </span>
                </div>
              </div>
            </div>
          </div>

          {step === 'connect' && (
            <>
              {!isConnected ? (
                <div className="space-y-2">
                  {connectors.map(connector => (
                    <button
                      key={(connector.uid || connector.id || connector.name)}
                      onClick={() => connect({ connector })}
                      className="w-full py-3 bg-[#1A56FF]/10 text-[#1A56FF] border border-[#1A56FF]/30 rounded-xl hover:bg-[#1A56FF]/20 transition-colors font-medium"
                    >
                      Connect {connector.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[#1a2332] rounded-lg p-3">
                    <span className="text-xs text-[#64748b] font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
                      Connected
                    </span>
                  </div>
                  <button
                    onClick={handleRegister}
                    className="w-full py-3 bg-[#1A56FF]/10 text-[#1A56FF] border border-[#1A56FF]/30 rounded-xl hover:bg-[#1A56FF]/20 transition-colors font-medium"
                  >
                    Verify KYC &amp; Register Merchant
                  </button>
                  <button onClick={() => disconnect()} className="w-full py-2 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors">
                    Disconnect wallet
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'verifying' && (
            <div className="text-center py-6">
              <div className="inline-block h-8 w-8 border-2 border-[#1A56FF] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[#94a3b8] text-sm">Checking KYC status on HashKey Chain...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{errorMsg}</p>
                {errorMsg.toLowerCase().includes('kyc') && (
                  <a
                    href="https://kyc-testnet.hunyuankyc.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1A56FF] hover:underline mt-1 block"
                  >
                    Complete KYC at kyc-testnet.hunyuankyc.com →
                  </a>
                )}
              </div>
              <button
                onClick={() => { setStep('connect'); setErrorMsg('') }}
                className="w-full py-2 bg-[#1f2937] text-[#94a3b8] border border-[#1f2937] rounded-lg hover:bg-[#1e293b] transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#64748b] mt-6">
          ⬡ PayFi Track — HashKey Chain Horizon Hackathon 2026
        </p>
      </div>
    </main>
  )
}
