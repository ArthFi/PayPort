
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAppKey } = require('./merchant');
const {
  createOrder,
  updateOrderStatus,
  updateOrderPaymentRequestId,
  updateOrderPaymentUrl,
  getOrdersByMerchant,
  getOrderByPaymentRequestId,
  logEvent,
  getRecentEvents,
} = require('../db');
const { buildCartMandate } = require('../lib/mandate');
const hp2 = require('../lib/hp2');
const { broadcastToMerchant } = require('../sse');
const constants = require('../constants');

const router = Router();

const HP2_PENDING_STATUSES = new Set([
  'payment-required',
  'payment-submitted',
  'payment-verified',
  'payment-processing',
]);

const HP2_CONFIRMED_STATUSES = new Set([
  'payment-safe',
  'payment-included',
]);

const HP2_SUCCESS_STATUSES = new Set(['payment-successful']);
const HP2_FAILED_STATUSES = new Set(['payment-failed', 'payment-expired', 'payment-cancelled']);

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

async function reconcileOrderFromHp2(order) {
  if (!order || !order.payment_request_id) return;
  if (!['initiated', 'pending', 'confirmed', 'unknown'].includes(order.status)) return;

  let hp2Status;
  try {
    hp2Status = await hp2.getPaymentStatus(order.payment_request_id);
  } catch (err) {
    console.warn(`[Payment] HP2 status sync failed for ${order.payment_request_id}: ${err.message}`);
    return;
  }

  const externalStatus = normalizeStatus(hp2Status.status);
  const now = new Date().toISOString();

  if (HP2_SUCCESS_STATUSES.has(externalStatus) && order.status !== 'settled') {
    updateOrderStatus(order.payment_request_id, 'settled', {
      txHash: hp2Status.txHash || null,
      settledAt: now,
      settlementType: 'real',
    });

    const settledMsg = `Payment settled via HP2 status sync: ${order.amount} ${order.token}`;
    logEvent(order.id, order.merchant_id, 'payment.settled', settledMsg);

    broadcastToMerchant(order.merchant_id, {
      type: 'order.updated',
      orderId: order.id,
      status: 'settled',
      txHash: hp2Status.txHash || null,
      settlementType: 'real',
      settledAt: now,
      timestamp: now,
    });

    broadcastToMerchant(order.merchant_id, {
      type: 'event.log',
      orderId: order.id,
      eventType: 'payment.settled',
      message: settledMsg,
      timestamp: now,
    });

    return;
  }

  if (HP2_FAILED_STATUSES.has(externalStatus) && order.status !== 'failed') {
    updateOrderStatus(order.payment_request_id, 'failed', {});

    const reason = hp2Status.failureReason || `HP2 status: ${externalStatus}`;
    const failMsg = `Payment failed: ${reason}`;
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

    return;
  }

  if (HP2_CONFIRMED_STATUSES.has(externalStatus)) {
    const nextTxHash = hp2Status.txHash || null;
    const shouldPromoteToConfirmed =
      order.status !== 'confirmed'
      || (nextTxHash && order.tx_hash !== nextTxHash);

    if (shouldPromoteToConfirmed) {
      updateOrderStatus(order.payment_request_id, 'confirmed', {
        txHash: nextTxHash,
      });

      const confirmedMsg = nextTxHash
        ? `Payment confirmed on-chain: ${nextTxHash}`
        : `Payment progressing via HP2 status sync: ${externalStatus}`;

      logEvent(order.id, order.merchant_id, 'payment.confirmed', confirmedMsg);

      broadcastToMerchant(order.merchant_id, {
        type: 'order.updated',
        orderId: order.id,
        status: 'confirmed',
        txHash: nextTxHash,
        settlementType: 'real',
        timestamp: now,
      });

      broadcastToMerchant(order.merchant_id, {
        type: 'event.log',
        orderId: order.id,
        eventType: 'payment.confirmed',
        message: confirmedMsg,
        timestamp: now,
      });
    }

    return;
  }

  if (HP2_PENDING_STATUSES.has(externalStatus)) {
    return;
  }
}


router.post('/create', requireAppKey, async (req, res) => {
  try {
    const { amount, token, orderId, description } = req.body;
    const merchant = req.merchant;

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'amount must be a positive number string (e.g. "25.00")',
      });
    }

    const validTokens = constants.SUPPORTED_TOKENS;
    if (!token || !validTokens.includes(token)) {
      return res.status(400).json({
        ok: false,
        error: `token must be one of: ${validTokens.join(', ')}`,
      });
    }

    const cartMandateId = orderId || uuidv4();
    const paymentRequestId = uuidv4();
    const now = new Date().toISOString();
    const amountString = parsedAmount.toFixed(2);

    const order = createOrder(merchant.id, {
      amount: amountString,
      token,
      description: description || null,
      cartMandateId,
    });

    logEvent(order.id, merchant.id, 'order.created', `Order created: ${amount} ${token}`);
    broadcastToMerchant(merchant.id, {
      type: 'order.created',
      orderId: order.id,
      amount: amountString,
      token,
      status: 'initiated',
      timestamp: now,
    });

    const { cartMandate, jwt } = await buildCartMandate({
      merchantName: 'PayPort Merchant',
      cartId: cartMandateId,
      paymentRequestId,
      amount: amountString,
      token,
      description,
      toAddress: merchant.wallet_address,
      expiryHours: 2,
    });

    updateOrderPaymentRequestId(order.id, paymentRequestId);
    updateOrderStatus(paymentRequestId, 'pending', {});

    const hp2Result = await hp2.createSinglePayment({
      cartMandate,
      cartId: cartMandateId,
      appKey: merchant.app_key,
    });
    updateOrderPaymentUrl(order.id, hp2Result.paymentUrl);

    logEvent(order.id, merchant.id, 'payment.pending', 'Payment link generated via HP2');
    broadcastToMerchant(merchant.id, {
      type: 'order.updated',
      orderId: order.id,
      status: 'pending',
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      ok: true,
      paymentUrl: hp2Result.paymentUrl,
      paymentRequestId,
      cartMandateId,
      orderId: order.id,
      expiresIn: '2 hours',
    });
  } catch (err) {
    console.error('[Payment] Create error:', err);
    return res.status(500).json({ ok: false, error: err.message, source: 'backend' });
  }
});


router.get('/status/:paymentRequestId', requireAppKey, async (req, res) => {
  try {
    const { paymentRequestId } = req.params;
    const merchant = req.merchant;

    const order = getOrderByPaymentRequestId(paymentRequestId);
    if (!order || order.merchant_id !== merchant.id) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    await reconcileOrderFromHp2(order);

    const latestOrder = getOrderByPaymentRequestId(paymentRequestId);

    let providerStatus = null;
    let failureReason = null;
    try {
      const provider = await hp2.getPaymentStatus(paymentRequestId);
      providerStatus = provider.status || null;
      failureReason = provider.failureReason || null;
    } catch (_err) {
    }

    return res.json({
      ok: true,
      status: latestOrder.status,
      providerStatus,
      failureReason,
      settlementType: latestOrder.settlement_type,
      txHash: latestOrder.tx_hash,
      amount: latestOrder.amount,
      token: latestOrder.token,
      createdAt: latestOrder.created_at,
      updatedAt: latestOrder.updated_at,
      settledAt: latestOrder.settled_at,
    });
  } catch (err) {
    console.error('[Payment] Status error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


router.get('/orders', requireAppKey, async (req, res) => {
  try {
    const merchant = req.merchant;

    const existingOrders = getOrdersByMerchant(merchant.id);
    const pending = existingOrders
      .filter((order) => order.payment_request_id && ['initiated', 'pending', 'confirmed', 'unknown'].includes(order.status))
      .slice(0, 10);

    await Promise.all(pending.map((order) => reconcileOrderFromHp2(order)));

    const orders = getOrdersByMerchant(merchant.id);
    const events = getRecentEvents(merchant.id, 100);

    return res.json({
      ok: true,
      orders,
      events,
      total: orders.length,
    });
  } catch (err) {
    console.error('[Payment] Orders error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
