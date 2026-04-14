'use client'

import { useEffect, useState } from 'react'
import { checkHealth } from '../lib/api'

interface Order {
  status: string
  amount: string
  token: string
}

export default function StatsBar({ orders }: { orders: Order[] }) {
  const [kycContract, setKycContract] = useState<string>('')

  useEffect(() => {
    let active = true

    async function fetchHealth() {
      try {
        const data = await checkHealth()
        if (active) {
          setKycContract(String(data?.kycContract || ''))
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

  const total = orders.length
  const finalizedStatuses = new Set(['confirmed', 'settled'])
  const pendingStatuses = new Set(['initiated', 'pending'])

  const finalized = orders.filter(o => finalizedStatuses.has(o.status)).length
  const pending = orders.filter(o => pendingStatuses.has(o.status)).length
  const volume = orders
    .filter(o => finalizedStatuses.has(o.status))
    .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
    .toFixed(2)

  const isZeroAddress = /^0x0{40}$/i.test(kycContract)
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(kycContract)
  const kycDisplay = isAddress ? `${kycContract.slice(0, 6)}...${kycContract.slice(-4)}` : 'NOT DEPLOYED'
  const kycExplorer = isAddress
    ? `https://testnet-explorer.hsk.xyz/address/${kycContract}`
    : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3">
      <div className="xl:col-span-2 bg-surface-card border border-surface-border rounded-xl p-5 ring-1 ring-brand/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <p className="text-xs text-ink-muted uppercase tracking-wide">Total Volume</p>
        <div>
          <p className="text-3xl font-mono font-semibold text-ink-primary mt-1">${volume}</p>
          <p className="text-xs text-ink-muted font-mono mt-1">HashKey Chain · 133</p>
        </div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <p className="text-xs text-ink-muted">Total orders</p>
        <p className="text-2xl font-mono font-semibold mt-2 text-ink-primary">{total}</p>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <p className="text-xs text-ink-muted">Finalized</p>
        <p className="text-2xl font-mono font-semibold mt-2 text-success">{finalized}</p>
        <p className="text-[11px] text-ink-muted mt-1">confirmed + settled</p>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <p className="text-xs text-ink-muted">Pending</p>
        <p className="text-2xl font-mono font-semibold mt-2 text-warning">{pending}</p>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] col-span-2 sm:col-span-2 xl:col-span-1">
        <p className="text-xs text-ink-muted">KYC Contract</p>
        {isAddress && !isZeroAddress && kycExplorer ? (
          <a
            href={kycExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-brand hover:text-brand/80 transition-colors mt-2 block truncate"
          >
            {kycDisplay}
          </a>
        ) : (
          <p className="text-xs font-mono text-ink-muted mt-2">NOT DEPLOYED</p>
        )}
        <p className="text-xs text-ink-muted mt-1">chain 133</p>
      </div>
    </div>
  )
}
