
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

const router = Router();


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

    const validTokens = ['USDC', 'USDT'];
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


router.get('/status/:paymentRequestId', requireAppKey, (req, res) => {
  try {
    const { paymentRequestId } = req.params;
    const merchant = req.merchant;

    const order = getOrderByPaymentRequestId(paymentRequestId);
    if (!order || order.merchant_id !== merchant.id) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    return res.json({
      ok: true,
      status: order.status,
      txHash: order.tx_hash,
      amount: order.amount,
      token: order.token,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      settledAt: order.settled_at,
    });
  } catch (err) {
    console.error('[Payment] Status error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


router.get('/orders', requireAppKey, (req, res) => {
  try {
    const merchant = req.merchant;
    const orders = getOrdersByMerchant(merchant.id);
    const events = getRecentEvents(merchant.id, 50);

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
