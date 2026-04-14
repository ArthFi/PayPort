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
  settlement_type: 'real' | 'simulated' | 'unknown' | null
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
  if (!description) return ''
  if (description.length <= 24) return description
  return `${description.slice(0, 24)}...`
}

export default function OrdersTable({
  orders,
  canSimulate = true,
  onSimulate,
  onViewReceipt,
}: {
  orders: Order[]
  canSimulate?: boolean
  onSimulate: (paymentRequestId: string) => Promise<void>
  onViewReceipt: (order: Order) => void
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
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-primary">Payment Orders</h2>
        <span className="text-xs text-ink-muted font-mono">{orders.length} total</span>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-ink-muted text-sm">
            No payments yet. Copy your SDK snippet below to start accepting payments.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Order ID', 'Amount', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-ink-muted font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr
                  key={order.id}
                  className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors cursor-default last:border-0"
                >
                  <td className="py-3 px-4">
                    <p className="text-sm font-mono text-ink-primary">{order.id.slice(0, 8)}</p>
                    {order.description && (
                      <p className="text-xs text-ink-muted mt-0.5 truncate max-w-32" title={order.description}>
                        {shortDescription(order.description)}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-ink-primary">{order.amount}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-mono bg-brand/10 text-brand/90 border border-brand/20">
                      {order.token}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-ink-muted font-mono">
                    {timeAgo(order.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      {canSimulate && ['initiated', 'pending'].includes(order.status) && (
                        <button
                          onClick={() => handleSimulate(order)}
                          disabled={simulating === (order.payment_request_id || order.cart_mandate_id)}
                          className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {simulating === (order.payment_request_id || order.cart_mandate_id) ? '...' : '⚡ Simulate'}
                        </button>
                      )}
                      {['initiated', 'pending'].includes(order.status) && order.payment_url && (
                        <button
                          onClick={() => handleCopyLink(order)}
                          className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors bg-surface-raised text-ink-secondary border border-surface-border hover:border-brand/30 hover:text-brand"
                        >
                          {copied === order.id ? 'Copied!' : 'Copy Link'}
                        </button>
                      )}
                      <button
                        onClick={() => onViewReceipt(order)}
                        className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors bg-surface-raised text-ink-secondary border border-surface-border hover:border-surface-border/80"
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
