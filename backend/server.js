
const express = require('express');
const cors = require('cors');
const path = require('path');

const constants = require('./constants');

const { getMerchantByAppKey, createMerchant } = require('./db');

const { router: merchantRouter } = require('./routes/merchant');
const paymentRouter = require('./routes/payment');
const webhookRouter = require('./routes/webhook');
const streamRouter = require('./routes/stream');

const app = express();

function ensureDemoMerchant() {
  if (constants.DEV_BYPASS_KYC !== 'true') return;

  const existing = getMerchantByAppKey(constants.DEMO_APP_KEY);
  if (existing) {
    console.log(`Demo merchant available. App key: ${constants.DEMO_APP_KEY}`);
    return;
  }

  createMerchant(constants.DEMO_WALLET, constants.DEMO_APP_KEY);
  console.log(`Demo merchant registered. App key: ${constants.DEMO_APP_KEY}`);
}

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));

app.use('/api/webhook', (req, res, next) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    req._rawBody = raw;
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}, webhookRouter);

app.use(express.json());

app.use('/sdk', express.static(path.join(__dirname, 'public/sdk')));
app.use('/demo', express.static(path.join(__dirname, 'public/demo')));

app.get('/demo', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/demo/index.html'));
});

app.use('/api/merchant', merchantRouter);
app.use('/api/payment', paymentRouter);
app.use('/api', streamRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    mockMode: constants.HP2_MOCK,
    bypassKYC: constants.DEV_BYPASS_KYC,
    kycContract: constants.KYC_CONTRACT_ADDRESS,
    hp2BaseUrl: constants.HP2_BASE_URL,
    demoKey: constants.DEMO_APP_KEY,
    chain: 133,
  });
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ ok: false, error: err.message, source: 'backend' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[Backend] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Backend] Uncaught exception:', error);
});

try {
  ensureDemoMerchant();

  app.listen(constants.PORT, () => {
    console.log(`⬡ PayPort Backend running on http://localhost:${constants.PORT}`);
    console.log(`Demo URL: http://localhost:${constants.PORT}/demo`);
    console.log(`SDK URL: http://localhost:${constants.PORT}/sdk/payport.js`);
    console.log(`Health URL: http://localhost:${constants.PORT}/api/health`);
    console.log(`Mock mode: ${constants.HP2_MOCK}`);
    console.log(`Bypass KYC: ${constants.DEV_BYPASS_KYC}`);
  });
} catch (err) {
  console.error('[Startup] Failed to initialize backend:', err.message);
  process.exit(1);
}
