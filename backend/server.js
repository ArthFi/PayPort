
const express = require('express');
const cors = require('cors');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

const constants = require('./constants');

const { getMerchantByAppKey, createMerchant } = require('./db');

const { router: merchantRouter } = require('./routes/merchant');
const paymentRouter = require('./routes/payment');
const webhookRouter = require('./routes/webhook');
const streamRouter = require('./routes/stream');

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://unsaid-carline-incommensurately.ngrok-free.dev',
];

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { ok: false, error: 'RATE_LIMIT', message: 'Too many registration attempts. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { ok: false, error: 'RATE_LIMIT', message: 'Too many payment requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function rawBodyCapture(req, res, next) {
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
}

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

app.use('/api/webhook', cors(), rawBodyCapture, webhookRouter);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS: origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,
}));

app.use(express.json());

app.use('/api/merchant/register', registrationLimiter);
app.use('/api/payment/create', paymentLimiter);

app.use('/sdk', express.static(path.join(__dirname, 'public/sdk')));
app.use('/demo', express.static(path.join(__dirname, 'public/demo')));

app.get('/demo', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/demo/index.html'));
});

app.use('/api/merchant', merchantRouter);
app.use('/api/payment', paymentRouter);
app.use('/api', streamRouter);

app.get('/api/health', (_req, res) => {
  const hp2Base = String(constants.HP2_BASE_URL || '').toLowerCase();
  const usingLocalHp2 = hp2Base.includes('localhost') || hp2Base.includes('127.0.0.1') || hp2Base.includes(':3002');
  const liveMode = constants.HP2_MOCK === 'false' && !usingLocalHp2;

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
    simulateEnabled: constants.ENABLE_SIMULATE_ENDPOINT,
    liveMode: liveMode ? 'true' : 'false',
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
    console.log(`PayPort Backend running on http://localhost:${constants.PORT}`);
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
