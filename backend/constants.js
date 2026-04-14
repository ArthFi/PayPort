const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const HP2_MOCK = process.env.HP2_MOCK === 'false' ? 'false' : 'true';
const DEV_BYPASS_KYC = process.env.DEV_BYPASS_KYC === 'false' ? 'false' : 'true';
const ENABLE_SIMULATE_ENDPOINT = process.env.ENABLE_SIMULATE_ENDPOINT === 'true' ? 'true' : 'false';
const NATIVE_USDC_ADDRESS = '0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6';
const NATIVE_USDT_ADDRESS = '0x372325443233fEbaC1F6998aC750276468c83CC6';

const REQUIRED_ALWAYS = ['PORT', 'MERCHANT_PRIVATE_KEY'];
for (const key of REQUIRED_ALWAYS) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    console.error('Copy backend/.env.example to backend/.env and set all required values.');
    process.exit(1);
  }
}

if (HP2_MOCK !== 'true') {
  const REQUIRED_REAL_HP2 = ['HP2_BASE_URL', 'HP2_APP_KEY', 'HP2_APP_SECRET'];
  for (const key of REQUIRED_REAL_HP2) {
    if (!process.env[key]) {
      console.error(`[FATAL] Missing required environment variable for real HP2 mode: ${key}`);
      console.error('Set HP2_* values in backend/.env or switch HP2_MOCK=true.');
      process.exit(1);
    }
  }
}

function buildTokenConfig() {
  const defaultConfig = {
    USDC: {
      coin: 'USDC',
      address: process.env.USDC_ADDRESS || NATIVE_USDC_ADDRESS,
    },
    USDT: {
      coin: 'USDT',
      address: process.env.USDT_ADDRESS || NATIVE_USDT_ADDRESS,
    },
  };

  if (!process.env.TOKEN_CONFIG_JSON) {
    return defaultConfig;
  }

  try {
    const parsed = JSON.parse(process.env.TOKEN_CONFIG_JSON);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('TOKEN_CONFIG_JSON must be a JSON object');
    }

    const merged = { ...defaultConfig };

    for (const [symbol, cfg] of Object.entries(parsed)) {
      if (!cfg || typeof cfg !== 'object') continue;

      const tokenSymbol = String(symbol || '').trim();
      const address = typeof cfg.address === 'string' ? cfg.address.trim() : '';
      const coin = typeof cfg.coin === 'string' ? cfg.coin.trim() : tokenSymbol;

      if (!tokenSymbol || !address || !coin) continue;
      merged[tokenSymbol] = { coin, address };
    }

    return merged;
  } catch (err) {
    console.warn(`[WARN] Invalid TOKEN_CONFIG_JSON, using defaults. ${err.message}`);
    return defaultConfig;
  }
}

function buildSupportedTokens(tokenConfig) {
  const defaults = Object.keys(tokenConfig);
  if (!process.env.SUPPORTED_TOKENS) return defaults;

  const available = new Set(defaults);
  const requested = process.env.SUPPORTED_TOKENS
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token && available.has(token));

  return requested.length ? requested : defaults;
}

const TOKEN_CONFIG = buildTokenConfig();
const SUPPORTED_TOKENS = buildSupportedTokens(TOKEN_CONFIG);

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  MERCHANT_PRIVATE_KEY: process.env.MERCHANT_PRIVATE_KEY,
  DEV_BYPASS_KYC,
  ENABLE_SIMULATE_ENDPOINT,
  KYC_CONTRACT_ADDRESS: process.env.KYC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  HP2_MOCK,
  HP2_BASE_URL: process.env.HP2_BASE_URL || 'https://api.hp2.hashkey.com',
  HP2_APP_KEY: process.env.HP2_APP_KEY || '',
  HP2_APP_SECRET: process.env.HP2_APP_SECRET || '',
  HP2_WEBHOOK_URL: process.env.HP2_WEBHOOK_URL || 'http://localhost:3001/api/webhook',
  TOKEN_CONFIG,
  SUPPORTED_TOKENS,
  USDC_E_ADDRESS: process.env.USDC_E_ADDRESS || '0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2',
  USDC_ADDRESS: TOKEN_CONFIG.USDC?.address || NATIVE_USDC_ADDRESS,
  NATIVE_USDC_ADDRESS,
  USDT_ADDRESS: TOKEN_CONFIG.USDT?.address || NATIVE_USDT_ADDRESS,
  MAINNET_USDC: '0x054ed45810DbBAb8B27668922D110669c9D88D0a',
  MAINNET_USDT: '0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029',
  DEMO_APP_KEY: 'cd76f5f3-5523-4a7e-a581-58acbb5b4c49',
  DEMO_WALLET: '0xe5606a8773b7e9ebf24d33c01139e9f4eba7e866',
  HASHKEY_CHAIN_ID: 133,
  HASHKEY_RPC_URL: 'https://testnet.hsk.xyz',
};
