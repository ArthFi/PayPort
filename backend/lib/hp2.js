
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const constants = require('../constants');
const { sha256hex } = require('./mandate');


async function mockCreateSinglePayment({ cartMandate, cartId, appKey }) {
  const amount = cartMandate.contents.payment_request.details.total.amount.value;
  const token = cartMandate.contents.payment_request.method_data[0].data.coin;
  const paymentRequestId = cartMandate.contents.payment_request.details.id;
  console.log(`[HP2 MOCK] createSinglePayment cartId=${cartId} amount=${amount} token=${token}`);

  await new Promise((resolve) => setTimeout(resolve, 150));

  const appKeyQuery = appKey ? `&appKey=${encodeURIComponent(appKey)}` : '';
  const paymentUrl = `http://localhost:3000/mock-payment?id=${cartId}&amount=${encodeURIComponent(amount)}&token=${token}${appKeyQuery}`;

  return {
    paymentRequestId,
    paymentUrl,
    cartMandateId: cartId,
  };
}

async function mockGetPaymentStatus(_paymentRequestId) {
  return { status: 'pending', txHash: null, amount: null, token: null, failureReason: null, raw: null };
}


function buildHP2AuthHeaders(method, path, query, bodyObject) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = uuidv4().replace(/-/g, '');
  let bodyHash = '';

  if (bodyObject) {
    const bodyString = JSON.stringify(bodyObject);
    bodyHash = sha256hex(bodyString);
  }

  const message = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}\n${nonce}`;
  const signature = crypto
    .createHmac('sha256', constants.HP2_APP_SECRET)
    .update(message, 'utf8')
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-App-Key': constants.HP2_APP_KEY,
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
  };
}

async function realCreateSinglePayment({ cartMandate, cartId, redirectUrl }) {
  const method = 'POST';
  const path = '/api/v1/merchant/orders';
  const query = '';
  const bodyObject = {
    cart_mandate: cartMandate,
    redirect_url: redirectUrl || `http://localhost:3000/payment-result`,
  };

  const headers = buildHP2AuthHeaders(method, path, query, bodyObject);

  const url = `${constants.HP2_BASE_URL}${path}`;
  console.log(`[HP2] POST ${url}`);

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(bodyObject),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HP2 createSinglePayment HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`HP2 createSinglePayment API error: ${data.msg || 'unknown error'}`);
  }

  const payload = data.data || data.result || {};
  const paymentRequestId = payload.payment_request_id || payload.paymentRequestId;
  const paymentUrl = payload.payment_url || payload.paymentUrl;
  const cartMandateId = payload.cart_mandate_id || payload.cartMandateId || cartId;

  if (!paymentRequestId || !paymentUrl) {
    throw new Error('HP2 createSinglePayment response missing payment_request_id or payment_url');
  }

  return {
    paymentRequestId,
    paymentUrl,
    cartMandateId,
  };
}

async function realGetPaymentStatus(paymentRequestId) {
  const method = 'GET';
  const path = '/api/v1/merchant/payments';
  const query = `payment_request_id=${encodeURIComponent(paymentRequestId)}`;

  const headers = buildHP2AuthHeaders(method, path, query, null);
  const url = `${constants.HP2_BASE_URL}${path}?${query}`;

  const res = await fetch(url, { method, headers, signal: AbortSignal.timeout(10_000) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HP2 getPaymentStatus HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`HP2 getPaymentStatus API error: ${data.msg || 'unknown error'}`);
  }

  const payloadData = data.data || data.result || {};
  const payload = Array.isArray(payloadData) ? (payloadData[0] || {}) : payloadData;

  return {
    status: payload.status || 'unknown',
    txHash: payload.tx_signature || payload.tx_hash || payload.txHash || null,
    amount: payload.amount || null,
    token: payload.token || null,
    failureReason: payload.failure_reason
      || payload.fail_reason
      || payload.status_reason
      || payload.reason
      || payload.error_message
      || payload.error
      || null,
    raw: payload,
  };
}


async function createSinglePayment(params) {
  if (constants.HP2_MOCK === 'true') {
    return mockCreateSinglePayment(params);
  }

  return realCreateSinglePayment(params);
}

async function getPaymentStatus(paymentRequestId) {
  if (constants.HP2_MOCK === 'true') {
    return mockGetPaymentStatus(paymentRequestId);
  }

  return realGetPaymentStatus(paymentRequestId);
}

module.exports = {
  createSinglePayment,
  getPaymentStatus,
};
