'use strict';

process.env.PORT = process.env.PORT || '3001';

if (!process.env.MERCHANT_PRIVATE_KEY) {
  console.error('[FATAL] MERCHANT_PRIVATE_KEY is required because constants validation runs on import.');
  process.exit(1);
}

const walletAddress = process.argv[2];
if (!walletAddress) {
  console.error('Usage: node scripts/test-kyc-real.js 0xYourAddress');
  process.exit(1);
}

const { checkKYC } = require('../lib/kyc');
const constants = require('../constants');
const { createPublicClient, http, defineChain } = require('viem');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const bypassMode = constants.DEV_BYPASS_KYC === 'true';

function safeStringify(value) {
  return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}

function nowIso() {
  return new Date().toISOString();
}

const captured = { warn: [], error: [] };
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  captured.warn.push(args.join(' '));
  originalWarn(...args);
};

console.error = (...args) => {
  captured.error.push(args.join(' '));
  originalError(...args);
};

const hashkeyTestnet = defineChain({
  id: 133,
  name: 'HashKey Chain Testnet',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.hsk.xyz'] },
  },
});

const KYC_SBT_ABI = [
  {
    name: 'isHuman',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'isValid', type: 'bool' },
      { name: 'level', type: 'uint8' },
    ],
  },
  {
    name: 'getKycInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'ensName', type: 'string' },
      { name: 'level', type: 'uint8' },
      { name: 'status', type: 'uint8' },
      { name: 'createTime', type: 'uint256' },
    ],
  },
];

async function printRawViemResults() {
  if (bypassMode) return;
  if (!constants.KYC_CONTRACT_ADDRESS || constants.KYC_CONTRACT_ADDRESS === ZERO_ADDRESS) return;

  const client = createPublicClient({
    chain: hashkeyTestnet,
    transport: http('https://testnet.hsk.xyz'),
  });

  console.log(`[RAW] [${nowIso()}] Reading isHuman via viem`);
  try {
    const rawIsHuman = await client.readContract({
      address: constants.KYC_CONTRACT_ADDRESS,
      abi: KYC_SBT_ABI,
      functionName: 'isHuman',
      args: [walletAddress],
    });
    console.log(`[RAW] isHuman result: ${safeStringify(rawIsHuman)}`);

    const isValid = Array.isArray(rawIsHuman)
      ? Boolean(rawIsHuman[0])
      : Boolean(rawIsHuman.isValid);

    if (isValid) {
      const rawKycInfo = await client.readContract({
        address: constants.KYC_CONTRACT_ADDRESS,
        abi: KYC_SBT_ABI,
        functionName: 'getKycInfo',
        args: [walletAddress],
      });
      console.log(`[RAW] getKycInfo result: ${safeStringify(rawKycInfo)}`);
    }
  } catch (err) {
    console.error(`[RAW] viem read failed: ${err.message}`);
  }
}

async function main() {
  console.log(`[${nowIso()}] KYC test starting`);

  await printRawViemResults();

  let result;
  try {
    result = await checkKYC(walletAddress);
  } catch (err) {
    console.error(`[KYC] checkKYC threw: ${err.message}`);
    process.exit(1);
  }

  let pathLabel = 'real-contract';
  if (bypassMode) {
    pathLabel = 'bypass';
  } else if (!constants.KYC_CONTRACT_ADDRESS || constants.KYC_CONTRACT_ADDRESS === ZERO_ADDRESS) {
    pathLabel = 'zero-address-fallback';
  } else {
    const combinedWarn = captured.warn.join(' ');
    const combinedErr = captured.error.join(' ');
    if (combinedWarn.includes('RPC read failed') || combinedErr.includes('RPC read failed')) {
      pathLabel = 'rpc-error-fallback';
    }
  }

  console.log(`[RESULT] isHuman=${result.isHuman} level=${result.level} status=${result.status} ensName=${result.ensName} path=${pathLabel}`);

  console.log('--- SUMMARY ---');
  console.log(`BYPASS_MODE=${constants.DEV_BYPASS_KYC}`);
  console.log(`CONTRACT_ADDRESS=${constants.KYC_CONTRACT_ADDRESS}`);
  console.log(`RESULT=${safeStringify(result)}`);
}

main().catch((err) => {
  console.error(`[KYC] Unhandled error: ${err.message}`);
  process.exit(1);
});
