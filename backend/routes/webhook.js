
const { Router } = require('express');
const crypto = require('crypto');
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

function randomTxHash() {
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

function settleOrder(order, paymentRequestId, txHash, message) {
  const now = new Date().toISOString();
  updateOrderStatus(paymentRequestId, 'settled', {
    txHash,
    settledAt: now,
  });

  logEvent(order.id, order.merchant_id, 'payment.settled', message);

  broadcastToMerchant(order.merchant_id, {
    type: 'order.updated',
    orderId: order.id,
    status: 'settled',
    txHash,
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
      amount,
      token,
      event_type,
      cart_mandate_id,
    } = req.body;

    console.log(`[Webhook] Received: status=${status} payment_request_id=${payment_request_id}`);

    const order = getOrderByPaymentRequestId(payment_request_id);
    if (!order) {
      console.warn(`[Webhook] Order not found for payment_request_id: ${payment_request_id}`);
      return res.status(200).json({ ok: true });
    }

    if (status === 'payment-successful') {
      const txHash = tx_signature || randomTxHash();
      settleOrder(order, payment_request_id, txHash, `Payment settled: ${order.amount} ${order.token}`);
    } else if (
      status === 'payment-required'
      || status === 'payment-submitted'
      || status === 'payment-verified'
      || status === 'payment-processing'
    ) {
      const now = new Date().toISOString();
      const infoMsg = `Webhook status update received: ${status}`;

      logEvent(order.id, order.merchant_id, 'payment.info', infoMsg);
      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.info',
        message: infoMsg,
        timestamp: now,
      });
    } else if (status === 'payment-included') {
      const now = new Date().toISOString();
      const includedMsg = 'Payment included in block, awaiting confirmation';

      logEvent(order.id, order.merchant_id, 'payment.included', includedMsg);

      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.included',
        message: includedMsg,
        timestamp: now,
      });
    } else if (status === 'payment-failed') {
      const now = new Date().toISOString();
      updateOrderStatus(payment_request_id, 'failed', {});

      logEvent(order.id, order.merchant_id, 'payment.failed', 'Payment failed');

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
        message: 'Payment failed',
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


router.post('/simulate/:paymentRequestId', (req, res) => {
  try {
    if (constants.HP2_MOCK !== 'true') {
      console.warn('[Webhook] /simulate called in production mode — proceeding with caution');
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
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const txHash = randomTxHash();
    settleOrder(
      order,
      lookupPaymentRequestId,
      txHash,
      `Payment settled (simulated): ${order.amount} ${order.token}`
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
