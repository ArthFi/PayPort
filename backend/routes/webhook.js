
const { Router } = require('express');
const crypto = require('crypto');
const { requireAppKey } = require('./merchant');
const {
  getOrderByPaymentRequestId,
  getOrderByCartMandateId,
  updateOrderStatus,
  logEvent,
} = require('../db');
const { broadcastToMerchant } = require('../sse');
const constants = require('../constants');

const router = Router();

function verifyWebhookSignature(req, rawBody) {
  const sig = req.headers['x-signature'];
  if (!sig) return { valid: false, reason: 'Missing X-Signature header' };

  let ts = null;
  let received = null;
  for (const part of sig.split(',')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('t=')) ts = trimmed.slice(2);
    if (trimmed.startsWith('v1=')) received = trimmed.slice(3);
  }

  if (!ts || !received) {
    return { valid: false, reason: `Malformed X-Signature: ${sig}` };
  }

  const tsNum = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isNaN(tsNum) || Math.abs(now - tsNum) > 300) {
    return { valid: false, reason: 'Timestamp expired' };
  }

  if (!constants.HP2_APP_SECRET) {
    return { valid: false, reason: 'Missing HP2_APP_SECRET for verification' };
  }

  const message = `${ts}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', constants.HP2_APP_SECRET)
    .update(message)
    .digest('hex');

  if (!/^[0-9a-f]+$/i.test(received) || !/^[0-9a-f]+$/i.test(expected)) {
    return { valid: false, reason: 'Invalid signature encoding' };
  }

  const receivedBuf = Buffer.from(received, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return { valid: false, reason: 'Signature mismatch' };
  }

  return { valid: true };
}

function randomSimulatedRef() {
  return `sim_${crypto.randomBytes(8).toString('hex')}`;
}

function settleOrder(order, paymentRequestId, txHash, message, settlementType = 'unknown') {
  const now = new Date().toISOString();
  updateOrderStatus(paymentRequestId, 'settled', {
    txHash,
    settledAt: now,
    settlementType,
  });

  logEvent(order.id, order.merchant_id, 'payment.settled', message);

  broadcastToMerchant(order.merchant_id, {
    type: 'order.updated',
    orderId: order.id,
    status: 'settled',
    txHash,
    settlementType,
    settledAt: now,
    timestamp: now,
  });

  broadcastToMerchant(order.merchant_id, {
    type: 'event.log',
    orderId: order.id,
    eventType: 'payment.settled',
    message,
    timestamp: now,
  });

  return now;
}


router.post('/', (req, res) => {
  try {
    if (constants.HP2_MOCK !== 'true') {
      const verification = verifyWebhookSignature(req, req._rawBody || '');
      if (!verification.valid) {
        console.warn('[Webhook] Signature verification failed:', verification.reason);
        return res.status(200).json({ ok: true });
      }
      console.log('[Webhook] Signature verified OK');
    }

    const {
      status,
      payment_request_id,
      tx_signature,
      tx_hash,
      txHash: txHashCamel,
      amount,
      token,
      event_type,
      cart_mandate_id,
      failure_reason,
      fail_reason,
      status_reason,
      reason,
      error_message,
      error,
    } = req.body;

    console.log(`[Webhook] Received: status=${status} payment_request_id=${payment_request_id}`);

    const order = getOrderByPaymentRequestId(payment_request_id);
    if (!order) {
      console.warn(`[Webhook] Order not found for payment_request_id: ${payment_request_id}`);
      return res.status(200).json({ ok: true });
    }

    if (status === 'payment-successful') {
      // Only persist chain tx hash when HP2 provides one.
      const txHash = tx_signature || tx_hash || txHashCamel || null;
      settleOrder(order, payment_request_id, txHash, `Payment settled: ${order.amount} ${order.token}`, 'real');
    } else if (status === 'payment-included') {
      const now = new Date().toISOString();
      const txHash = tx_signature || tx_hash || txHashCamel || null;

      updateOrderStatus(payment_request_id, 'confirmed', {
        txHash,
      });

      const includedMsg = txHash
        ? `Payment included in block: ${txHash}`
        : 'Payment included in block, awaiting confirmation';

      logEvent(order.id, order.merchant_id, 'payment.confirmed', includedMsg);

      broadcastToMerchant(order.merchant_id, {
        type: 'order.updated',
        orderId: order.id,
        status: 'confirmed',
        txHash,
        settlementType: 'real',
        timestamp: now,
      });

      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.confirmed',
        message: includedMsg,
        timestamp: now,
      });
    } else if (
      status === 'payment-required'
      || status === 'payment-submitted'
      || status === 'payment-verified'
      || status === 'payment-processing'
      || status === 'payment-safe'
    ) {
      const now = new Date().toISOString();
      const infoMsg = `Webhook status update received: ${status}`;

      logEvent(order.id, order.merchant_id, 'payment.info', infoMsg);

      broadcastToMerchant(order.merchant_id, {
        type: 'order.updated',
        orderId: order.id,
        status: order.status === 'initiated' ? 'pending' : order.status,
        timestamp: now,
      });

      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.info',
        message: infoMsg,
        timestamp: now,
      });
    } else if (status === 'payment-failed') {
      const now = new Date().toISOString();
      updateOrderStatus(payment_request_id, 'failed', {});

      const failReason = failure_reason || fail_reason || status_reason || reason || error_message || error || 'Payment failed';
      const failMsg = `Payment failed: ${failReason}`;

      logEvent(order.id, order.merchant_id, 'payment.failed', failMsg);

      broadcastToMerchant(order.merchant_id, {
        type: 'order.updated',
        orderId: order.id,
        status: 'failed',
        timestamp: now,
      });

      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.failed',
        message: failMsg,
        timestamp: now,
      });
    } else {
      const now = new Date().toISOString();
      const infoMsg = `Webhook status update received: ${status || 'unknown'}`;
      console.log(`[Webhook] ${infoMsg}`);

      logEvent(order.id, order.merchant_id, 'payment.info', infoMsg);
      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.info',
        message: infoMsg,
        timestamp: now,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return res.status(200).json({ ok: true });
  }
});


router.post('/simulate/:paymentRequestId', requireAppKey, async (req, res) => {
  try {
    if (constants.ENABLE_SIMULATE_ENDPOINT !== 'true') {
      return res.status(403).json({
        ok: false,
        error: 'SIMULATE_DISABLED',
        message: 'Simulation endpoint is disabled in this mode. Set ENABLE_SIMULATE_ENDPOINT=true to enable.',
      });
    }

    const { paymentRequestId } = req.params;
    let lookupPaymentRequestId = paymentRequestId;
    let order = getOrderByPaymentRequestId(paymentRequestId);
    if (!order) {
      const cartMandateId = paymentRequestId.replace(/_pr$/, '');
      order = getOrderByCartMandateId(cartMandateId);
      if (order && order.payment_request_id) {
        lookupPaymentRequestId = order.payment_request_id;
      }
    }

    if (!order) {
      return res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
    }

    if (order.merchant_id !== req.merchant.id) {
      return res.status(403).json({ ok: false, error: 'ORDER_NOT_YOURS' });
    }

    if (!['initiated', 'pending'].includes(order.status)) {
      return res.status(409).json({
        ok: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: `Cannot simulate settlement for order in status: ${order.status}`,
      });
    }

    const txHash = randomSimulatedRef();
    settleOrder(
      order,
      lookupPaymentRequestId,
      txHash,
      `Payment settled (simulated): ${order.amount} ${order.token}`,
      'simulated'
    );

    return res.status(200).json({
      ok: true,
      txHash,
      orderId: order.id,
    });
  } catch (err) {
    console.error('[Webhook] Simulate error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
