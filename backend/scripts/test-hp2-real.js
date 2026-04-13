'use strict';

process.env.PORT = process.env.PORT || '3001';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const constants = require('../constants');
const { buildCartMandate, sha256hex } = require('../lib/mandate');
const hp2 = require('../lib/hp2');

const isMockMode = constants.HP2_MOCK === 'true';
const modeLabel = isMockMode ? 'MOCK' : 'REAL';

function nowIso() {
  return new Date().toISOString();
}

function logStep(step, message) {
  console.log(`[STEP ${step}] [${nowIso()}] [${modeLabel}] ${message}`);
}

function logError(step, err, context) {
  console.error(`[STEP ${step}] [${nowIso()}] [${modeLabel}] ERROR ${context || ''}`);
  if (err && err.stack) {
    console.error(err.stack);
  } else if (err) {
    console.error(String(err));
  }
  if (err && err.status !== undefined) {
    console.error(`HTTP_STATUS=${err.status}`);
  }
  if (err && err.responseBody !== undefined) {
    console.error(`RESPONSE_BODY=${err.responseBody}`);
  }
  if (err && err.bodyText !== undefined) {
    console.error(`RESPONSE_BODY=${err.bodyText}`);
  }
}

function looksLikeMockResult(result) {
  if (!result || typeof result.paymentUrl !== 'string' || typeof result.paymentRequestId !== 'string') {
    return false;
  }
  return result.paymentUrl.startsWith('http://localhost:3000/mock-payment')
    || result.paymentRequestId.endsWith('_pr');
}

function isValidPaymentResult(result) {
  return result
    && typeof result.paymentUrl === 'string' && result.paymentUrl.length > 0
    && typeof result.paymentRequestId === 'string' && result.paymentRequestId.length > 0
    && typeof result.cartMandateId === 'string' && result.cartMandateId.length > 0;
}

function buildHp2Headers(method, path, query, bodyObject) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = uuidv4().replace(/-/g, '');
  const bodyHash = bodyObject ? sha256hex(JSON.stringify(bodyObject)) : '';
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

async function directRealCreate(cartMandate, cartId) {
  const method = 'POST';
  const path = '/api/v1/merchant/orders';
  const query = '';
  const bodyObject = {
    cart_mandate: cartMandate,
    redirect_url: 'http://localhost:3000/payment-result',
  };

  const headers = buildHp2Headers(method, path, query, bodyObject);
  const url = `${constants.HP2_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(bodyObject),
    signal: AbortSignal.timeout(10_000),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    const err = new Error(`HP2 real createSinglePayment HTTP ${res.status}: ${bodyText}`);
    err.status = res.status;
    err.responseBody = bodyText;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (parseErr) {
    const err = new Error(`HP2 real createSinglePayment non-JSON response: ${bodyText}`);
    err.status = res.status;
    err.responseBody = bodyText;
    throw err;
  }

  if (data.code !== 0) {
    const err = new Error(`HP2 real createSinglePayment API error: ${data.msg || 'unknown error'}`);
    err.responseBody = JSON.stringify(data);
    throw err;
  }

  const payload = data.data || data.result || {};
  const paymentRequestId = payload.payment_request_id || payload.paymentRequestId;
  const paymentUrl = payload.payment_url || payload.paymentUrl;
  const cartMandateId = payload.cart_mandate_id || payload.cartMandateId || cartId;

  if (!paymentRequestId || !paymentUrl) {
    const err = new Error('HP2 real createSinglePayment response missing payment_request_id or payment_url');
    err.responseBody = JSON.stringify(data);
    throw err;
  }

  return { paymentRequestId, paymentUrl, cartMandateId };
}

async function main() {
  console.log(`[${nowIso()}] ${isMockMode ? '[MOCK MODE]' : '[REAL MODE]'} test-hp2-real starting`);

  let step1Pass = false;
  let step2Pass = false;
  let step3Pass = false;

  let cartMandate;
  let cartId;
  let hp2Result;
  let realResult;

  try {
    logStep(1, 'Building cart mandate');
    cartId = `test_${Date.now()}`;
    const paymentRequestId = uuidv4();

    const result = await buildCartMandate({
      merchantName: 'PayPort Test',
      cartId,
      paymentRequestId,
      amount: '0.01',
      token: 'USDC',
      toAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      expiryHours: 1,
    });

    cartMandate = result.cartMandate;
    console.log(`[STEP 1] [${nowIso()}] [${modeLabel}] Cart Mandate JSON:`);
    console.log(JSON.stringify(cartMandate, null, 2));
    step1Pass = true;
  } catch (err) {
    logError(1, err, 'buildCartMandate failed');
  }

  if (step1Pass) {
    try {
      logStep(2, 'Creating single payment via HP2');
      hp2Result = await hp2.createSinglePayment({ cartMandate, cartId });
      if (!isValidPaymentResult(hp2Result)) {
        throw new Error('createSinglePayment returned invalid shape');
      }

      console.log(`[STEP 2] [${nowIso()}] [${modeLabel}] paymentUrl=${hp2Result.paymentUrl}`);
      console.log(`[STEP 2] [${nowIso()}] [${modeLabel}] paymentRequestId=${hp2Result.paymentRequestId}`);
      console.log(`[STEP 2] [${nowIso()}] [${modeLabel}] cartMandateId=${hp2Result.cartMandateId}`);

      step2Pass = true;

      if (!isMockMode && looksLikeMockResult(hp2Result)) {
        step2Pass = false;
        logError(2, new Error('Real mode appears to have fallen back to mock result'), 'mock fallback detected');

        try {
          logStep(2, 'Attempting direct real HP2 call for error details');
          realResult = await directRealCreate(cartMandate, cartId);
          console.log(`[STEP 2] [${nowIso()}] [${modeLabel}] directReal paymentUrl=${realResult.paymentUrl}`);
          console.log(`[STEP 2] [${nowIso()}] [${modeLabel}] directReal paymentRequestId=${realResult.paymentRequestId}`);
          console.log(`[STEP 2] [${nowIso()}] [${modeLabel}] directReal cartMandateId=${realResult.cartMandateId}`);
        } catch (realErr) {
          logError(2, realErr, 'direct real call failed');
        }
      }
    } catch (err) {
      logError(2, err, 'createSinglePayment failed');
    }
  }

  if (step1Pass && (hp2Result || realResult)) {
    const paymentRequestId = (!isMockMode && realResult && !looksLikeMockResult(realResult))
      ? realResult.paymentRequestId
      : hp2Result.paymentRequestId;

    try {
      logStep(3, `Fetching payment status for ${paymentRequestId}`);
      const status = await hp2.getPaymentStatus(paymentRequestId);
      console.log(`[STEP 3] [${nowIso()}] [${modeLabel}] status=${status.status}`);
      console.log(`[STEP 3] [${nowIso()}] [${modeLabel}] txHash=${status.txHash}`);
      console.log(`[STEP 3] [${nowIso()}] [${modeLabel}] amount=${status.amount}`);
      console.log(`[STEP 3] [${nowIso()}] [${modeLabel}] token=${status.token}`);
      step3Pass = true;
    } catch (err) {
      logError(3, err, 'getPaymentStatus failed');
    }
  }

  console.log('--- SUMMARY ---');
  console.log(`MOCK_MODE=${isMockMode}`);
  console.log(`STEP_1_${step1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`STEP_2_${step2Pass ? 'PASS' : 'FAIL'}`);
  console.log(`STEP_3_${step3Pass ? 'PASS' : 'FAIL'}`);
}

main().catch((err) => {
  logError('MAIN', err, 'unhandled');
  process.exit(1);
});
