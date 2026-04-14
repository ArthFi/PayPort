'use client'

import { useState } from 'react'
import StatusBadge from './StatusBadge'

export interface Order {
  id: string
  cart_mandate_id: string
  payment_request_id: string | null
  payment_url: string | null
  amount: string
  token: string
  status: string
  description: string | null
  tx_hash: string | null
  created_at: string
  updated_at: string
  settled_at: string | null
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

function shortDescription(description: string | null) {
  if (!description) return 'No description'
  if (description.length <= 20) return description
  return `${description.slice(0, 20)}...`
}

export default function OrdersTable({
  orders,
  onSimulate,
  onViewReceipt,
  simulateEnabled = true,
}: {
  orders: Order[]
  onSimulate: (paymentRequestId: string) => Promise<void>
  onViewReceipt: (order: Order) => void
  simulateEnabled?: boolean
}) {
  const [simulating, setSimulating] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function handleSimulate(order: Order) {
    const prId = order.payment_request_id || order.cart_mandate_id
    setSimulating(prId)
    try {
      await onSimulate(prId)
    } finally {
      setSimulating(null)
    }
  }

  async function handleCopyLink(order: Order) {
    if (!order.payment_url) return
    await navigator.clipboard.writeText(order.payment_url)
    setCopied(order.id)
    setTimeout(() => setCopied((curr) => (curr === order.id ? null : curr)), 2000)
  }

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1f2937]">
        <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
          Payment Orders
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-[#64748b] text-sm">
            No payments yet. Copy your SDK snippet below to start accepting payments.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2937]">
                {['Order ID', 'Amount', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr
                  key={order.id}
                  className="border-b border-[#1f2937]/50 hover:bg-white/5 transition-colors cursor-default"
                >
                  <td className="py-3 px-4 font-mono text-xs text-[#94a3b8]">
                    <div>
                      <p className="font-mono text-xs text-[#f1f5f9]">{order.id.slice(0, 8)}...</p>
                      <p
                        className="text-[11px] text-[#64748b] mt-1 truncate max-w-[200px]"
                        title={order.description || 'No description'}
                      >
                        {shortDescription(order.description)}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-white">{order.amount}</span>
                    <span className="px-1.5 py-0.5 bg-[#1A56FF]/10 text-[#1A56FF] border border-[#1A56FF]/20 rounded text-xs font-mono ml-1">
                      {order.token}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-[#64748b] font-mono">
                    {timeAgo(order.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1">
                      {simulateEnabled && ['initiated', 'pending'].includes(order.status) && (
                        <button
                          onClick={() => handleSimulate(order)}
                          disabled={simulating === (order.payment_request_id || order.cart_mandate_id)}
                          className="px-2.5 py-1 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {simulating === (order.payment_request_id || order.cart_mandate_id) ? '...' : '⚡ Simulate'}
                        </button>
                      )}
                      {['initiated', 'pending'].includes(order.status) && order.payment_url && (
                        <button
                          onClick={() => handleCopyLink(order)}
                          className="px-2.5 py-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                        >
                          {copied === order.id ? 'Copied!' : 'Copy Link'}
                        </button>
                      )}
                      <button
                        onClick={() => onViewReceipt(order)}
                        className="px-2.5 py-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                      >
                        Receipt
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
