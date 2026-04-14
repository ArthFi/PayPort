import { BACKEND_URL } from './constants'

export async function registerMerchant(walletAddress: string) {
  const res = await fetch(`${BACKEND_URL}/api/merchant/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.message || data.error || 'Registration failed')
  return data
}

export async function getOrders(appKey: string) {
  const res = await fetch(`${BACKEND_URL}/api/payment/orders`, {
    headers: { 'x-app-key': appKey },
  })
  return res.json()
}

export async function simulatePayment(paymentRequestId: string) {
  const res = await fetch(`${BACKEND_URL}/api/webhook/simulate/${paymentRequestId}`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Simulate payment failed')
  }
  return data
}

export async function checkHealth() {
  const res = await fetch(`${BACKEND_URL}/api/health`)
  return res.json()
}
