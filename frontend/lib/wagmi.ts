'use client'

import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'
import { QueryClient } from '@tanstack/react-query'

export const hashkeyTestnet = defineChain({
  id: 133,
  name: 'HashKey Chain Testnet',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.hsk.xyz'] } },
  blockExplorers: {
    default: { name: 'HSK Explorer', url: 'https://testnet-explorer.hsk.xyz' },
  },
  testnet: true,
})

export const wagmiConfig = createConfig({
  chains: [hashkeyTestnet],
  connectors: [injected()],
  transports: { [hashkeyTestnet.id]: http() },
  ssr: true,
})

export const queryClient = new QueryClient()
