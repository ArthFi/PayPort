
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'payport.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id              TEXT PRIMARY KEY,
    wallet_address  TEXT UNIQUE NOT NULL,
    app_key         TEXT UNIQUE NOT NULL,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                  TEXT PRIMARY KEY,
    merchant_id         TEXT NOT NULL REFERENCES merchants(id),
    cart_mandate_id     TEXT UNIQUE NOT NULL,
    payment_request_id  TEXT UNIQUE,
    amount              TEXT NOT NULL,
    token               TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'initiated',
    description         TEXT,
    payment_url         TEXT,
    tx_hash             TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    settled_at          TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_events (
    id          TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    message     TEXT NOT NULL,
    timestamp   TEXT NOT NULL
  );
`);

try {
  db.exec('ALTER TABLE orders ADD COLUMN payment_url TEXT');
} catch (_err) {
}


const stmts = {
  getMerchantByWallet: db.prepare(
    'SELECT * FROM merchants WHERE wallet_address = ?'
  ),
  getMerchantByAppKey: db.prepare(
    'SELECT * FROM merchants WHERE app_key = ?'
  ),
  insertMerchant: db.prepare(
    'INSERT INTO merchants (id, wallet_address, app_key, created_at) VALUES (?, ?, ?, ?)'
  ),
  insertOrder: db.prepare(`
    INSERT INTO orders
      (id, merchant_id, cart_mandate_id, amount, token, status, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateOrderPaymentRequestId: db.prepare(
    'UPDATE orders SET payment_request_id = ?, updated_at = ? WHERE id = ?'
  ),
  updateOrderPaymentUrl: db.prepare(
    'UPDATE orders SET payment_url = ?, updated_at = ? WHERE id = ?'
  ),
  getOrdersByMerchant: db.prepare(
    'SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC'
  ),
  getOrderByPaymentRequestId: db.prepare(
    'SELECT * FROM orders WHERE payment_request_id = ?'
  ),
  getOrderByCartMandateId: db.prepare(
    'SELECT * FROM orders WHERE cart_mandate_id = ?'
  ),
  insertEvent: db.prepare(
    'INSERT INTO payment_events (id, order_id, merchant_id, event_type, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  getRecentEvents: db.prepare(
    'SELECT * FROM payment_events WHERE merchant_id = ? ORDER BY timestamp DESC LIMIT ?'
  ),
};


function getMerchantByWallet(walletAddress) {
  return stmts.getMerchantByWallet.get(walletAddress.toLowerCase()) || null;
}

function getMerchantByAppKey(appKey) {
  return stmts.getMerchantByAppKey.get(appKey) || null;
}

function createMerchant(walletAddress, appKeyOverride) {
  const id = uuidv4();
  const app_key = appKeyOverride || uuidv4();
  const created_at = new Date().toISOString();
  const addr = walletAddress.toLowerCase();

  stmts.insertMerchant.run(id, addr, app_key, created_at);

  return { id, wallet_address: addr, app_key, created_at };
}

function createOrder(merchantId, data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const status = 'initiated';

  stmts.insertOrder.run(
    id,
    merchantId,
    data.cartMandateId,
    data.amount,
    data.token,
    status,
    data.description || null,
    now,
    now
  );

  return {
    id,
    merchant_id: merchantId,
    cart_mandate_id: data.cartMandateId,
    payment_request_id: null,
    payment_url: null,
    amount: data.amount,
    token: data.token,
    status,
    description: data.description || null,
    tx_hash: null,
    created_at: now,
    updated_at: now,
    settled_at: null,
  };
}

function updateOrderStatus(paymentRequestId, status, extras = {}) {
  const now = new Date().toISOString();
  const fields = ['status = @status', 'updated_at = @updated_at'];
  const params = {
    status,
    updated_at: now,
    payment_request_id: paymentRequestId,
  };

  if (extras.txHash) {
    fields.push('tx_hash = @tx_hash');
    params.tx_hash = extras.txHash;
  }

  if (status === 'settled') {
    fields.push('settled_at = @settled_at');
    params.settled_at = extras.settledAt || now;
  }

  const sql = `
    UPDATE orders
    SET ${fields.join(', ')}
    WHERE payment_request_id = @payment_request_id
  `;
  db.prepare(sql).run(params);
}

function updateOrderPaymentRequestId(orderId, paymentRequestId) {
  const now = new Date().toISOString();
  stmts.updateOrderPaymentRequestId.run(paymentRequestId, now, orderId);
}

function setPaymentRequestId(orderId, paymentRequestId) {
  updateOrderPaymentRequestId(orderId, paymentRequestId);
}

function updateOrderPaymentUrl(orderId, paymentUrl) {
  const now = new Date().toISOString();
  stmts.updateOrderPaymentUrl.run(paymentUrl, now, orderId);
}

function getOrdersByMerchant(merchantId) {
  return stmts.getOrdersByMerchant.all(merchantId);
}

function getOrderByPaymentRequestId(paymentRequestId) {
  return stmts.getOrderByPaymentRequestId.get(paymentRequestId) || null;
}

function getOrderByCartMandateId(cartMandateId) {
  return stmts.getOrderByCartMandateId.get(cartMandateId) || null;
}

function logEvent(orderId, merchantId, eventType, message) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  stmts.insertEvent.run(id, orderId, merchantId, eventType, message, timestamp);
}

function getRecentEvents(merchantId, limit = 50) {
  return stmts.getRecentEvents.all(merchantId, limit);
}

module.exports = {
  db,
  getMerchantByWallet,
  getMerchantByAppKey,
  createMerchant,
  createOrder,
  updateOrderStatus,
  setPaymentRequestId,
  updateOrderPaymentRequestId,
  updateOrderPaymentUrl,
  getOrdersByMerchant,
  getOrderByPaymentRequestId,
  getOrderByCartMandateId,
  logEvent,
  getRecentEvents,
};
