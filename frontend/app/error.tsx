'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center p-6">
      <div className="bg-[#111827] border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-red-400 text-4xl mb-4">⚠</div>
        <h2 className="text-white font-semibold text-lg mb-2">Something went wrong</h2>
        <p className="text-[#94a3b8] text-sm mb-6 font-mono">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
