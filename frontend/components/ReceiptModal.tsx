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

  const explorerUrl = order.tx_hash
    ? `https://testnet-explorer.hsk.xyz/tx/${order.tx_hash}`
    : null

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="receipt-print bg-[#111827] border border-[#1f2937] rounded-2xl p-6 max-w-md w-full modal-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#1f2937]">
          <div className="flex items-center gap-2">
            <span className="text-[#1A56FF] text-lg">⬡</span>
            <span className="text-sm font-semibold text-white">PayPort Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#1A56FF]/10 text-[#1A56FF] border border-[#1A56FF]/20 rounded text-xs font-mono">HP2</span>
            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs">HashKey Chain</span>
          </div>
        </div>

        <div className="text-center py-4">
          <p className="text-4xl font-mono font-bold text-white">{order.amount}</p>
          <p className="text-lg text-[#94a3b8] font-mono">{order.token}</p>
        </div>

        <div className="flex justify-end mb-4">
          <button onClick={onClose} className="text-[#64748b] hover:text-white transition-colors text-xl">×</button>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between py-2 border-b border-[#1f2937]">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">Status</span>
            <StatusBadge status={order.status} />
          </div>

          <div className="flex items-start justify-between py-2 border-b border-[#1f2937]">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">Order ID</span>
            <span className="font-mono text-xs text-[#f1f5f9] text-right max-w-[60%] truncate">{order.id}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b border-[#1f2937]">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">Description</span>
            <span className="text-sm text-[#f1f5f9] text-right max-w-[60%]">{order.description || '—'}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b border-[#1f2937]">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">Created</span>
            <span className="text-xs font-mono text-[#f1f5f9]">{formatDate(order.created_at)}</span>
          </div>

          <div className="flex items-start justify-between py-2 border-b border-[#1f2937]">
            <span className="text-xs text-[#64748b] uppercase tracking-wider">Settled</span>
            <span className="text-xs font-mono text-[#f1f5f9]">{formatDate(order.settled_at)}</span>
          </div>

          {order.tx_hash && explorerUrl && (
            <div className="flex items-start justify-between py-2 border-b border-[#1f2937]">
              <span className="text-xs text-[#64748b] uppercase tracking-wider">TX Hash</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1A56FF] text-xs font-mono hover:underline max-w-[60%] truncate"
              >
                {order.tx_hash.slice(0, 20)}...
              </a>
            </div>
          )}
        </div>

        <button
          onClick={handlePrint}
          className="mt-4 w-full py-2 bg-[#1f2937] text-[#94a3b8] border border-[#1f2937] rounded-lg hover:bg-[#1e293b] transition-colors text-sm"
        >
          Print Receipt
        </button>
      </div>
    </div>
  )
}
