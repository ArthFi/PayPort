'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useRouter } from 'next/navigation'
import { checkHealth, registerMerchant } from '../../lib/api'

type Step = 'connect' | 'verifying' | 'error'

export default function OnboardPage() {
  const KYC_HELP_URL = process.env.NEXT_PUBLIC_KYC_HELP_URL || ''
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [step, setStep] = useState<Step>('connect')
  const [errorMsg, setErrorMsg] = useState('')
  const [kycContract, setKycContract] = useState('')
  const [copiedKyc, setCopiedKyc] = useState(false)

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
  const kycExplorer = isAddress ? `https://testnet-explorer.hsk.xyz/address/${kycContract}` : ''
  const stepIndex: 1 | 2 | 3 = !isConnected ? 1 : step === 'verifying' ? 3 : 2

  async function handleCopyKycContract() {
    if (!kycContract) return
    try {
      await navigator.clipboard.writeText(kycContract)
      setCopiedKyc(true)
      setTimeout(() => setCopiedKyc(false), 1500)
    } catch {
      setCopiedKyc(false)
    }
  }

  function StepDot({ index, label }: { index: 1 | 2 | 3; label: string }) {
    const completed = stepIndex > index
    const active = stepIndex === index

    const circleClass = completed
      ? 'bg-brand border-brand text-white'
      : active
        ? 'bg-brand border-brand text-white'
        : 'bg-transparent border-surface-border text-ink-muted'

    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`w-5 h-5 rounded-full border text-[10px] font-mono flex items-center justify-center ${circleClass}`}>
          {completed ? '✓' : index}
        </div>
        <span className="text-[11px] text-ink-muted">{label}</span>
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
    <main className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="text-center">
          <h1 className="text-xl font-medium text-ink-primary mt-2">PayPort</h1>
          <p className="text-sm text-ink-muted leading-relaxed mt-2 mx-auto max-w-xs">
            Compliant B2B payment infrastructure on HashKey Chain.
          </p>
        </div>

        <div className="mt-7">
          <div className="flex items-start justify-between">
            <StepDot index={1} label="Connect" />
            <div className={`flex-1 mt-2 border-t ${stepIndex > 1 ? 'border-brand' : 'border-surface-border'}`} />
            <StepDot index={2} label="Verify" />
            <div className={`flex-1 mt-2 border-t ${stepIndex > 2 ? 'border-brand' : 'border-surface-border'}`} />
            <StepDot index={3} label="API Key" />
          </div>
        </div>

        <div className="bg-surface-raised border border-surface-border rounded-lg p-4 mt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-sm font-medium text-ink-primary">KYC verification required</p>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                Your wallet needs a HashKey KYC Soul Bound Token on chain 133.
              </p>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted mt-3">KYC Contract</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-mono text-ink-primary border border-surface-border bg-surface-base px-2 py-1 rounded truncate" title={kycContract || kycLabel}>
                  {kycLabel}
                </span>
                {isAddress && (
                  <button
                    type="button"
                    onClick={handleCopyKycContract}
                    className="text-[11px] px-2 py-1 rounded border border-surface-border text-ink-secondary hover:text-ink-primary hover:border-brand/40 transition-colors"
                  >
                    {copiedKyc ? 'Copied' : 'Copy'}
                  </button>
                )}
                {isAddress && (
                  <a
                    href={kycExplorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] px-2 py-1 rounded border border-brand/30 text-brand hover:bg-brand/10 transition-colors"
                  >
                    Explorer
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {step === 'connect' && !isConnected && (
          <div className="mt-6 space-y-3">
            {connectors.map(connector => (
              <button
                key={(connector.uid || connector.id || connector.name)}
                onClick={() => connect({ connector })}
                className="w-full h-10 rounded-lg bg-brand text-white text-sm font-medium hover:brightness-110 transition"
              >
                Connect {connector.name}
              </button>
            ))}
          </div>
        )}

        {step === 'connect' && isConnected && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between bg-surface-raised border border-surface-border rounded-lg p-3">
              <span className="text-xs text-ink-muted font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
              <span className="text-xs text-success">Connected</span>
            </div>
            <button
              onClick={handleRegister}
              className="w-full h-10 rounded-lg bg-brand text-white text-sm font-medium hover:brightness-110 transition"
            >
              Verify KYC and register merchant
            </button>
            <button
              onClick={() => disconnect()}
              className="w-full text-xs text-ink-muted hover:text-ink-secondary transition-colors"
            >
              Disconnect wallet
            </button>
          </div>
        )}

        {step === 'verifying' && (
          <div className="text-center py-6 mt-4">
            <div className="inline-block h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-ink-secondary text-sm">Checking KYC status on HashKey Chain...</p>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-3 mt-6">
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
              <p className="text-danger text-sm">{errorMsg}</p>
              {errorMsg.toLowerCase().includes('kyc') && (
                KYC_HELP_URL ? (
                  <a
                    href={KYC_HELP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand hover:underline mt-2 inline-block"
                  >
                    Complete KYC at configured portal
                  </a>
                ) : (
                  <p className="text-xs text-ink-muted mt-2">
                    KYC portal link is unavailable. Use a pre-approved HashKey testnet wallet, or set DEV_BYPASS_KYC=true for local demo.
                  </p>
                )
              )}
            </div>
            <button
              onClick={() => { setStep('connect'); setErrorMsg('') }}
              className="w-full h-10 rounded-lg bg-transparent border border-surface-border text-ink-secondary hover:border-brand/40 hover:text-ink-primary transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        )}

        <p className="text-center text-xs text-ink-muted mt-7">
          Built for HashKey Chain Horizon Hackathon 2026
        </p>
      </div>
    </main>
  )
}
