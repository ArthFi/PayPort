'use client'

import { useState } from 'react'
import { BACKEND_URL } from '../lib/constants'

export default function SDKSnippet({ appKey }: { appKey: string }) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'script' | 'rest'>('script')

  const scriptSnippet = `<script
  src="${BACKEND_URL}/sdk/payport.js"
  data-app-key="${appKey}"
  data-amount="10.00"
  data-token="USDC"
  data-order-id="order_001"
  data-api-base="${BACKEND_URL}"
></script>`

  const restSnippet = `curl -X POST ${BACKEND_URL}/api/payment/create \\
  -H "Content-Type: application/json" \\
  -H "x-app-key: ${appKey}" \\
  -d '{"amount":"10.00","token":"USDC","description":"Service fee"}'`

  const snippet = activeTab === 'script' ? scriptSnippet : restSnippet

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
          SDK Integration
        </span>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex items-center border-b border-[#1f2937] mb-3">
        <button
          onClick={() => setActiveTab('script')}
          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 ${
            activeTab === 'script'
              ? 'bg-[#1f2937] text-white border-[#1A56FF]'
              : 'text-[#64748b] border-transparent hover:text-[#94a3b8]'
          }`}
        >
          Script Tag
        </button>
        <button
          onClick={() => setActiveTab('rest')}
          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 ${
            activeTab === 'rest'
              ? 'bg-[#1f2937] text-white border-[#1A56FF]'
              : 'text-[#64748b] border-transparent hover:text-[#94a3b8]'
          }`}
        >
          REST API
        </button>
      </div>

      <pre className="bg-[#0a0e17] border border-[#1f2937] rounded-lg p-4 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre">
        {snippet}
      </pre>
      <p className="text-xs text-[#64748b] mt-2">
        Drop this into any webpage to accept crypto payments. The button renders automatically.
      </p>
    </div>
  )
}
