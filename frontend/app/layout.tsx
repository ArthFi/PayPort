import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PayPort — Compliant Web3 Payments',
  description: 'B2B payment infrastructure on HashKey Chain. KYC-verified merchants. HP2 settlement. Real-time dashboard.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-surface-base text-ink-primary min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
