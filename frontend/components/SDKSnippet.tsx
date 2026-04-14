'use client'

import { useState } from 'react'
import { BACKEND_URL } from '../lib/constants'

const TOKEN_MATCHER = /(\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:const|function|await|return|import|from)\b)/g

function tokenClass(token: string) {
  if (token.startsWith('//')) return 'text-ink-muted'
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) return 'text-success/80'
  if (/^(const|function|await|return|import|from)$/.test(token)) return 'text-brand/90'
  return 'text-ink-secondary'
}

function HighlightedCode({ code }: { code: string }) {
  return (
    <code className="block whitespace-pre">
      {code.split('\n').map((line, i) => {
        const parts = line.split(TOKEN_MATCHER)
        return (
          <div key={`${line}-${i}`}>
            {parts.map((part, j) => (
              <span key={`${part}-${j}`} className={tokenClass(part)}>
                {part}
              </span>
            ))}
            {i < code.split('\n').length - 1 ? '\n' : ''}
          </div>
        )
      })}
    </code>
  )
}

export default function SDKSnippet({ appKey }: { appKey: string }) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'script' | 'rest'>('script')

  const scriptSnippet = `<script
  src="${BACKEND_URL}/sdk/payport.js"
  data-app-key="${appKey}"
  data-amount="5.00"
  data-token="USDC"
  data-order-id="order_001"
  data-api-base="${BACKEND_URL}"
></script>`

  const restSnippet = `curl -X POST ${BACKEND_URL}/api/payment/create \\
  -H "Content-Type: application/json" \\
  -H "x-app-key: ${appKey}" \\
  -d '{"amount":"5.00","token":"USDC","description":"Service fee"}'`

  const snippet = activeTab === 'script' ? scriptSnippet : restSnippet

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-ink-primary">SDK Integration</span>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors bg-transparent border border-surface-border text-ink-secondary hover:border-brand/40 hover:text-ink-primary"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="flex items-center gap-5 border-b border-surface-border/60">
        <button
          onClick={() => setActiveTab('script')}
          className={`text-xs font-medium border-b-2 pb-3 transition-colors ${
            activeTab === 'script'
              ? 'text-ink-primary border-brand'
              : 'text-ink-muted border-transparent hover:text-ink-secondary'
          }`}
        >
          Script Tag
        </button>
        <button
          onClick={() => setActiveTab('rest')}
          className={`text-xs font-medium border-b-2 pb-3 transition-colors ${
            activeTab === 'rest'
              ? 'text-ink-primary border-brand'
              : 'text-ink-muted border-transparent hover:text-ink-secondary'
          }`}
        >
          REST API
        </button>
      </div>

      <pre className="bg-surface-base rounded-lg p-4 text-xs font-mono text-ink-secondary leading-relaxed overflow-x-auto mt-4 border border-surface-border">
        <HighlightedCode code={snippet} />
      </pre>

      <p className="text-xs text-ink-muted mt-3">
        Drop this into any webpage to accept crypto payments. The button renders automatically.
      </p>
    </div>
  )
}
