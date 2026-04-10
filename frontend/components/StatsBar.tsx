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
  const settled = orders.filter(o => o.status === 'settled').length
  const pending = orders.filter(o => ['initiated', 'pending', 'confirmed'].includes(o.status)).length
  const volume = orders
    .filter(o => o.status === 'settled')
    .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
    .toFixed(2)

  const isZeroAddress = /^0x0{40}$/i.test(kycContract)
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(kycContract)
  const kycDisplay = isAddress ? `${kycContract.slice(0, 6)}...${kycContract.slice(-4)}` : 'NOT DEPLOYED'
  const kycExplorer = isAddress
    ? `https://testnet-explorer.hsk.xyz/address/${kycContract}`
    : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
          Total Orders
        </p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-mono font-bold text-white">{total}</p>
          <span className="text-xs font-mono text-[#64748b]">↗</span>
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
          Settled
        </p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-mono font-bold text-green-400">{settled}</p>
          <span className="text-xs font-mono text-green-400">↑</span>
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
          Pending
        </p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-mono font-bold text-yellow-400">{pending}</p>
          <span className="text-xs font-mono text-yellow-400">↻</span>
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
          Total Volume
        </p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-mono font-bold text-[#1A56FF]">${volume}</p>
          <span className="text-xs font-mono text-[#1A56FF]">↗</span>
        </div>
        <p className="text-xs text-[#64748b] font-mono mt-1">HashKey Chain · 133</p>
      </div>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
          KYC Contract
        </p>
        {isAddress && !isZeroAddress && kycExplorer ? (
          <a
            href={kycExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono font-semibold text-[#1A56FF] hover:underline"
          >
            {kycDisplay}
          </a>
        ) : (
          <p className="text-sm font-mono font-semibold text-amber-400">NOT DEPLOYED</p>
        )}
      </div>
    </div>
  )
}
