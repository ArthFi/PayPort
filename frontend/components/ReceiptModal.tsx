'use client'

import type { Order } from './OrdersTable'
import StatusBadge from './StatusBadge'

export default function ReceiptModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null

  function handlePrint() {
    window.print()
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  }

  const txHash = order.tx_hash || null
  const settlementType = order.settlement_type || 'unknown'
  const isOnChainTxHash = Boolean(txHash && /^0x[a-fA-F0-9]{64}$/.test(txHash))
  const explorerUrl = isOnChainTxHash && txHash
    ? `https://testnet-explorer.hsk.xyz/tx/${txHash}`
    : null

  function row(label: string, value: string) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className="text-xs font-mono text-ink-secondary max-w-[60%] text-right truncate" title={value}>
          {value}
        </span>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-surface-base/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="receipt-print bg-surface-card border border-surface-border rounded-2xl max-w-sm w-full mx-4 modal-enter shadow-2xl shadow-black/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-border">
          <div>
            <p className="text-xs text-ink-muted">Settlement Receipt</p>
            <p className="text-sm font-medium text-ink-primary mt-0.5">PayPort</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors p-1">
            ✕
          </button>
        </div>

        <div className="px-6 py-8 text-center border-b border-surface-border">
          <p className="text-4xl font-mono font-semibold text-ink-primary">{order.amount}</p>
          <p className="text-sm text-ink-muted font-mono mt-1">{order.token}</p>
          <StatusBadge status={order.status} className="mt-3" />
        </div>

        <div className="px-6 py-4 space-y-3">
          {row('Order ID', order.id)}
          {row('Description', order.description || '—')}
          {row('Created', formatDate(order.created_at))}
          {row('Settled', formatDate(order.settled_at))}
          {row('Settlement Type', settlementType)}
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted">
              {settlementType === 'simulated' ? 'Settlement Ref' : 'Transaction'}
            </span>
            {(settlementType === 'real' || settlementType === 'unknown') && explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-brand hover:text-brand/80 transition-colors max-w-[60%] truncate"
              >
                {txHash?.slice(0, 20)}...
              </a>
            ) : settlementType === 'simulated' && txHash ? (
              <span className="text-xs font-mono text-ink-secondary max-w-[60%] truncate" title={txHash}>
                {txHash}
              </span>
            ) : (
              <span className="text-xs font-mono text-ink-muted">—</span>
            )}
          </div>

          <button
            onClick={handlePrint}
            className="w-full mt-2 text-xs px-3 py-2 rounded-lg font-medium transition-colors bg-transparent border border-surface-border text-ink-secondary hover:border-brand/40 hover:text-ink-primary"
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
