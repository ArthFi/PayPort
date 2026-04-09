const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const HP2_MOCK = process.env.HP2_MOCK === 'false' ? 'false' : 'true';
const DEV_BYPASS_KYC = process.env.DEV_BYPASS_KYC === 'false' ? 'false' : 'true';

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

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  MERCHANT_PRIVATE_KEY: process.env.MERCHANT_PRIVATE_KEY,
  DEV_BYPASS_KYC,
  KYC_CONTRACT_ADDRESS: process.env.KYC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
  HP2_MOCK,
  HP2_BASE_URL: process.env.HP2_BASE_URL || 'https://api.hp2.hashkey.com',
  HP2_APP_KEY: process.env.HP2_APP_KEY || '',
  HP2_APP_SECRET: process.env.HP2_APP_SECRET || '',
  HP2_WEBHOOK_URL: process.env.HP2_WEBHOOK_URL || 'http://localhost:3001/api/webhook',
  USDC_ADDRESS: '0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6',
  USDT_ADDRESS: '0x372325443233fEbaC1F6998aC750276468c83CC6',
  MAINNET_USDC: '0x054ed45810DbBAb8B27668922D110669c9D88D0a',
  MAINNET_USDT: '0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029',
  DEMO_APP_KEY: 'pprt_demo_2026',
  DEMO_WALLET: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  HASHKEY_CHAIN_ID: 133,
  HASHKEY_RPC_URL: 'https://testnet.hsk.xyz',
};
