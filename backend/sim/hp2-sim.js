const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SIM_PORT = 3002;
const SIM_APP_KEY = process.env.HP2_APP_KEY || 'local_sim_key';
const SIM_APP_SECRET = process.env.HP2_APP_SECRET || 'local_secret';
const BACKEND_WEBHOOK_URL = process.env.HP2_WEBHOOK_URL || 'http://localhost:3001/api/webhook';
const FRONTEND_MOCK_PAYMENT_URL = process.env.FRONTEND_MOCK_PAYMENT_URL || 'http://localhost:3000/mock-payment';
const TOKEN_ADDRESSES = {
  USDC: '0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2',
  USDT: '0x372325443233fEbaC1F6998aC750276468c83CC6',
};

const app = express();

const payments = new Map();
const paymentsByPrId = new Map();

function sha256hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sortKeys(val) {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  const sorted = {};
  for (const key of Object.keys(val).sort()) {
    sorted[key] = sortKeys(val[key]);
  }
  return sorted;
}

function canonicalJSON(obj) {
  return JSON.stringify(sortKeys(obj));
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLength), 'base64').toString('utf8');
}

function validateHMAC(req) {
  const appKey = req.headers['x-app-key'];
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];

  if (!appKey || !signature || !timestamp || !nonce) {
    return { valid: false, reason: 'Missing auth headers' };
  }

  if (appKey !== SIM_APP_KEY) {
    return { valid: false, reason: `Unknown app key: ${appKey}` };
  }

  const tsNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isNaN(tsNum) || Math.abs(now - tsNum) > 300) {
    return { valid: false, reason: `Timestamp expired: ${timestamp}` };
  }

  const method = req.method.toUpperCase();
  const path = req.path;
  const query = req.url.includes('?') ? req.url.split('?')[1] : '';
  const isGet = method === 'GET';
  let bodyHash = '';

  if (!isGet) {
    bodyHash = sha256hex(req._rawBody || '');
  }

  const message = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}\n${nonce}`;

  const expected = crypto.createHmac('sha256', SIM_APP_SECRET).update(message).digest('hex');

  if (signature.length !== expected.length) {
    return {
      valid: false,
      reason: 'Signature length mismatch',
      expected,
      received: signature,
      message,
    };
  }

  if (!/^[0-9a-f]+$/i.test(signature) || !/^[0-9a-f]+$/i.test(expected)) {
    return {
      valid: false,
      reason: 'Signature must be hex',
      expected,
      received: signature,
      message,
    };
  }

  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
    return {
      valid: false,
      reason: 'Signature mismatch',
      expected,
      received: signature,
      message,
    };
  }

  return { valid: true };
}

app.use((req, _res, next) => {
  req._rawBody = '';
  next();
});
app.use(express.json({
  verify: (req, _res, buf) => {
    req._rawBody = buf && buf.length ? buf.toString('utf8') : '';
  },
}));
app.use(cors());

app.post('/api/v1/merchant/orders', (req, res) => {
  const auth = validateHMAC(req);
  if (!auth.valid) {
    return res.status(200).json({
      code: 40001,
      msg: `Authentication failed: ${auth.reason}`,
      data: null,
    });
  }

  const { cart_mandate: cartMandate } = req.body || {};
  if (!cartMandate || !cartMandate.contents) {
    return res.status(200).json({ code: 40002, msg: 'Missing cart_mandate in body', data: null });
  }

  const contents = cartMandate.contents;
  const methodData = contents.payment_request?.method_data?.[0]?.data;
  const details = contents.payment_request?.details;

  const cart_mandate_id = contents.id;
  const payment_request_id = details?.id;
  const amount = details?.total?.amount?.value;
  const token = methodData?.coin;
  const pay_to = methodData?.pay_to;
  const merchant_name = contents.merchant_name;
  const cart_expiry = contents.cart_expiry;

  const required = {
    cart_mandate_id,
    payment_request_id,
    amount,
    token,
    pay_to,
    merchant_name,
    cart_expiry,
  };

  for (const [fieldName, fieldValue] of Object.entries(required)) {
    if (!fieldValue) {
      return res.status(200).json({
        code: 40003,
        msg: `Invalid cart mandate structure: missing ${fieldName}`,
        data: null,
      });
    }
  }

  if (!cartMandate.merchant_authorization) {
    return res.status(200).json({
      code: 40004,
      msg: 'Missing merchant_authorization JWT',
      data: null,
    });
  }

  try {
    const [jwtHeaderB64, jwtClaimsB64] = cartMandate.merchant_authorization.split('.');
    const header = JSON.parse(decodeBase64Url(jwtHeaderB64 || ''));
    const claims = JSON.parse(decodeBase64Url(jwtClaimsB64 || ''));

    console.log('[HP2-SIM] JWT decoded:', {
      alg: header.alg,
      iss: claims.iss,
      aud: claims.aud,
      cart_hash: claims.cart_hash,
      iat: claims.iat,
      exp: claims.exp,
    });

    if (claims.aud !== 'HashkeyMerchant') {
      return res.status(200).json({
        code: 40005,
        msg: `Invalid JWT audience: ${claims.aud}`,
        data: null,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp < now) {
      return res.status(200).json({ code: 40006, msg: 'Cart mandate has expired', data: null });
    }
  } catch (_err) {
    return res.status(200).json({ code: 40005, msg: 'Invalid merchant_authorization JWT', data: null });
  }

  if (payments.has(cart_mandate_id)) {
    return res.status(200).json({
      code: 40007,
      msg: `Duplicate cart_mandate_id: ${cart_mandate_id}`,
      data: null,
    });
  }

  payments.set(cart_mandate_id, {
    payment_request_id,
    cart_mandate_id,
    amount,
    token,
    merchant_name,
    pay_to,
    status: 'pending',
    created_at: new Date().toISOString(),
    completed_at: null,
    tx_signature: null,
  });
  paymentsByPrId.set(payment_request_id, cart_mandate_id);

  const paymentUrl = `${FRONTEND_MOCK_PAYMENT_URL}`
    + `?id=${encodeURIComponent(payment_request_id)}`
    + `&amount=${encodeURIComponent(amount)}`
    + `&token=${encodeURIComponent(token)}`
    + `&simBase=${encodeURIComponent('http://localhost:3002')}`;

  console.log('[HP2-SIM] Payment created:', {
    cart_mandate_id,
    payment_request_id,
    amount,
    token,
    merchant_name,
  });

  return res.status(200).json({
    code: 0,
    msg: 'success',
    data: {
      payment_request_id,
      payment_url: paymentUrl,
      multi_pay: false,
    },
  });
});

app.get('/api/v1/merchant/payments', (req, res) => {
  const auth = validateHMAC(req);
  if (!auth.valid) {
    return res.status(200).json({
      code: 40001,
      msg: `Authentication failed: ${auth.reason}`,
      data: null,
    });
  }

  const payment_request_id = req.query.payment_request_id;
  const cartMandateId = paymentsByPrId.get(payment_request_id);
  const p = cartMandateId ? payments.get(cartMandateId) : null;

  if (!p) {
    return res.status(200).json({ code: 40401, msg: 'Payment not found', data: null });
  }

  return res.status(200).json({
    code: 0,
    msg: 'success',
    data: {
      payment_request_id: p.payment_request_id,
      status: p.status,
      tx_signature: p.tx_signature,
      amount: p.amount,
      token: p.token,
      created_at: p.created_at,
      completed_at: p.completed_at,
    },
  });
});

app.post('/sim/complete/:payment_request_id', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const paymentRequestId = req.params.payment_request_id;
  const cartMandateId = paymentsByPrId.get(paymentRequestId);
  const payment = cartMandateId ? payments.get(cartMandateId) : null;

  if (!payment) {
    return res.status(404).json({ ok: false, error: 'Payment not found in sim store' });
  }

  if (payment.status === 'payment-successful' && payment.tx_signature) {
    return res.status(200).json({
      ok: true,
      message: 'Already completed',
      txHash: payment.tx_signature,
    });
  }

  const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
  payment.status = 'payment-successful';
  payment.tx_signature = txHash;
  payment.completed_at = new Date().toISOString();

  const webhookBody = {
    event_type: 'payment',
    status: 'payment-successful',
    payment_request_id: payment.payment_request_id,
    request_id: uuidv4(),
    cart_mandate_id: payment.cart_mandate_id,
    tx_signature: txHash,
    amount: Math.round(parseFloat(payment.amount) * 1_000_000).toString(),
    token: payment.token,
    token_address: TOKEN_ADDRESSES[payment.token] || null,
    chain: 'eip155:133',
    network: 'hashkey-testnet',
    payer_address: `0xSimPayer${Date.now()}`,
    to_pay_address: payment.pay_to,
    created_at: payment.created_at,
    completed_at: payment.completed_at,
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify(webhookBody);
  const message = `${timestamp}.${rawBody}`;
  const hmacHex = crypto.createHmac('sha256', SIM_APP_SECRET).update(message).digest('hex');

  console.log('[HP2-SIM] Webhook payload:', webhookBody);

  try {
    const webhookRes = await fetch(BACKEND_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `t=${timestamp},v1=${hmacHex}`,
      },
      body: rawBody,
      signal: AbortSignal.timeout(5000),
    });
    console.log('[HP2-SIM] Webhook fired to backend:', webhookRes.status);
  } catch (error) {
    console.error('[HP2-SIM] Webhook failed:', error.message || error);
  }

  return res.status(200).json({
    ok: true,
    txHash,
    payment_request_id: payment.payment_request_id,
    status: 'payment-successful',
  });
});

app.get('/sim/payments', (_req, res) => {
  return res.status(200).json({
    ok: true,
    count: payments.size,
    payments: Array.from(payments.values()),
  });
});

app.get('/sim/health', (_req, res) => {
  return res.status(200).json({
    ok: true,
    sim: 'HP2 Simulator',
    port: SIM_PORT,
    paymentCount: payments.size,
    backendWebhook: BACKEND_WEBHOOK_URL,
    timestamp: new Date().toISOString(),
  });
});

app.post('/sim/health', (req, res) => {
  const auth = validateHMAC(req);
  if (!auth.valid) {
    return res.status(200).json({
      code: 40001,
      msg: `Authentication failed: ${auth.reason}`,
      data: null,
    });
  }

  return res.status(200).json({
    code: 0,
    msg: 'success',
    data: {
      ok: true,
      sim: 'HP2 Simulator',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use((req, res) => {
  return res.status(404).json({ ok: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[HP2-SIM] Unhandled route error:', err && err.message ? err.message : err);
  return res.status(500).json({ ok: false, error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[HP2-SIM] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[HP2-SIM] Uncaught exception:', error);
});

app.listen(SIM_PORT, () => {
  console.log('\nHP2 Sim Server running on http://localhost:3002');
  console.log('   Simulates: HashKey Payment Protocol v2');
  console.log(`   App Key:   ${SIM_APP_KEY}`);
  console.log(`   Secret:    ${SIM_APP_SECRET ? 'configured' : 'missing'}`);
  console.log(`   Fires webhooks to: ${BACKEND_WEBHOOK_URL}`);
  console.log('   Debug:     http://localhost:3002/sim/payments\n');
});
