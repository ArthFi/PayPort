
const crypto = require('crypto');
const { secp256k1 } = require('@noble/curves/secp256k1');
const constants = require('../constants');


function canonicalJSON(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return JSON.stringify(obj);
  if (typeof obj === 'string') return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalJSON(item));
    return `[${items.join(',')}]`;
  }

  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalJSON(obj[key])}`);
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(obj);
}

function sha256hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signES256K(claims, privateKeyHex) {
  const header = { alg: 'ES256K', typ: 'JWT' };

  const b64header = base64url(JSON.stringify(header));
  const b64claims = base64url(JSON.stringify(claims));
  const signingInput = `${b64header}.${b64claims}`;

  const msgHash = crypto.createHash('sha256')
    .update(signingInput, 'utf8')
    .digest();

  const privateKeyBytes = Buffer.from(privateKeyHex.replace(/^0x/, ''), 'hex');
  if (privateKeyBytes.length !== 32) {
    throw new Error('MERCHANT_PRIVATE_KEY must be a 32-byte hex value');
  }

  const compactSig = Buffer.from(secp256k1.sign(msgHash, privateKeyBytes).toCompactRawBytes());

  const b64sig = base64url(compactSig);

  return `${b64header}.${b64claims}.${b64sig}`;
}

function getTokenAddress(token) {
  const tokenCfg = constants.TOKEN_CONFIG?.[token];
  if (tokenCfg?.address) return tokenCfg.address;
  throw new Error(`Unsupported token for cart mandate: ${token}. Configure TOKEN_CONFIG_JSON in backend/.env.`);
}

function getTokenCoin(token) {
  const tokenCfg = constants.TOKEN_CONFIG?.[token];
  if (tokenCfg?.coin) return tokenCfg.coin;
  throw new Error(`Unsupported token for cart mandate: ${token}. Configure TOKEN_CONFIG_JSON in backend/.env.`);
}


async function buildCartMandate({
  merchantName,
  cartId,
  paymentRequestId,
  amount,
  token,
  description,
  toAddress,
  expiryHours = 2,
}) {
  const now = Date.now();
  const iatSec = Math.floor(now / 1000);
  const expSec = iatSec + expiryHours * 3600;
  const expiry = new Date(now + expiryHours * 3600 * 1000);

  const contractAddress = getTokenAddress(token);
  const coin = getTokenCoin(token);

  const contents = {
    id: cartId,
    user_cart_confirmation_required: true,
    merchant_name: merchantName,
    cart_expiry: expiry.toISOString(),
    payment_request: {
      method_data: [
        {
          supported_methods: 'https://www.x402.org/',
          data: {
            supported_methods: 'https://www.x402.org/',
            x402Version: 2,
            network: 'hashkey-testnet',
            chain_id: 133,
            contract_address: contractAddress,
            pay_to: toAddress,
            coin,
          },
        },
      ],
      details: {
        id: paymentRequestId,
        display_items: [
          {
            label: description || 'Payment',
            amount: {
              currency: 'USD',
              value: amount,
            },
          },
        ],
        total: {
          label: 'Total',
          amount: {
            currency: 'USD',
            value: amount,
          },
        },
      },
    },
  };

  const cartHash = sha256hex(canonicalJSON(contents));

  const claims = {
    iss: merchantName,
    sub: merchantName,
    aud: 'HashkeyMerchant',
    iat: iatSec,
    exp: expSec,
    jti: `JWT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cart_hash: cartHash,
  };

  const jwt = signES256K(claims, constants.MERCHANT_PRIVATE_KEY);

  const cartMandate = {
    contents,
    merchant_authorization: jwt,
  };

  return { cartMandate, jwt };
}

module.exports = {
  buildCartMandate,
  canonicalJSON,
  sha256hex,
  getTokenAddress,
  getTokenCoin,
};
