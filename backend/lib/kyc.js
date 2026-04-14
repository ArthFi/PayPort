
const { createPublicClient, http, defineChain } = require('viem');
const constants = require('../constants');

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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function bypassResult(walletAddress, reason) {
  if (reason) {
    console.warn(`[KYC] ${reason} Falling back to bypass for ${walletAddress}`);
  }
  return { isHuman: true, level: 2, status: 1, ensName: 'dev.hsk' };
}

async function withTimeout(promise, ms, message) {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkKYC(walletAddress) {
  if (constants.DEV_BYPASS_KYC === 'true') {
    console.log(`[KYC] DEV_BYPASS_KYC enabled — auto-approving ${walletAddress}`);
    return bypassResult(walletAddress);
  }

  const contractAddr = constants.KYC_CONTRACT_ADDRESS;
  if (!contractAddr || contractAddr === ZERO_ADDRESS) {
    if (constants.DEV_BYPASS_KYC === 'true') {
      return bypassResult(walletAddress, 'KYC_CONTRACT_ADDRESS is zero or missing.');
    }
    console.error('[KYC] KYC_CONTRACT_ADDRESS is zero/missing in live mode — failing closed');
    return { isHuman: false, level: 0, status: 0, ensName: '', path: 'zero-address-fail-closed' };
  }

  const client = createPublicClient({
    chain: hashkeyTestnet,
    transport: http('https://testnet.hsk.xyz'),
  });

  try {
    const isHumanResult = await withTimeout(client.readContract({
      address: contractAddr,
      abi: KYC_SBT_ABI,
      functionName: 'isHuman',
      args: [walletAddress],
    }), 5000, 'isHuman() timed out after 5s');

    const isValid = Array.isArray(isHumanResult)
      ? Boolean(isHumanResult[0])
      : Boolean(isHumanResult.isValid);
    const level = Array.isArray(isHumanResult)
      ? Number(isHumanResult[1])
      : Number(isHumanResult.level);

    if (!isValid) {
      return { isHuman: false, level: 0, status: 0, ensName: '' };
    }

    try {
      const kycInfoResult = await withTimeout(client.readContract({
        address: contractAddr,
        abi: KYC_SBT_ABI,
        functionName: 'getKycInfo',
        args: [walletAddress],
      }), 5000, 'getKycInfo() timed out after 5s');

      const ensName = Array.isArray(kycInfoResult) ? kycInfoResult[0] : kycInfoResult.ensName;
      const kycLevel = Array.isArray(kycInfoResult) ? kycInfoResult[1] : kycInfoResult.level;
      const status = Array.isArray(kycInfoResult) ? kycInfoResult[2] : kycInfoResult.status;

      return {
        isHuman: true,
        level: Number(kycLevel),
        status: Number(status),
        ensName: ensName || '',
      };
    } catch (infoErr) {
      console.warn('[KYC] getKycInfo call failed, using isHuman result:', infoErr.message);
      return { isHuman: true, level: Number(level), status: 1, ensName: '' };
    }
  } catch (err) {
    console.error(`[KYC] On-chain check failed for ${walletAddress}:`, err.message);
    if (constants.DEV_BYPASS_KYC === 'true') {
      console.warn('[KYC] RPC error, bypass enabled — returning bypass result');
      return bypassResult(walletAddress, 'RPC read failed.');
    }
    console.error('[KYC] RPC error in live mode — failing closed');
    return { isHuman: false, level: 0, status: 0, ensName: '', path: 'rpc-error-fail-closed' };
  }
}

module.exports = { checkKYC };
