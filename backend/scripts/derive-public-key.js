const { secp256k1 } = require('@noble/curves/secp256k1');
require('dotenv').config();

function normalizePrivateKey(value) {
  if (!value) {
    throw new Error('MERCHANT_PRIVATE_KEY is missing in environment');
  }

  const hex = value.trim().replace(/^0x/i, '');

  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('MERCHANT_PRIVATE_KEY must be a 32-byte hex string');
  }

  return Buffer.from(hex, 'hex');
}

function encodeDerLength(length) {
  if (length < 0x80) {
    return Buffer.from([length]);
  }

  const bytes = [];
  let remaining = length;

  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }

  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derSequence(parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), encodeDerLength(body.length), body]);
}

function derBitString(payload) {
  const body = Buffer.concat([Buffer.from([0x00]), payload]);
  return Buffer.concat([Buffer.from([0x03]), encodeDerLength(body.length), body]);
}

function toPem(der) {
  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  return [
    '-----BEGIN PUBLIC KEY-----',
    ...lines,
    '-----END PUBLIC KEY-----',
  ].join('\n');
}

function buildSpkiDer(uncompressedPublicKey) {
  const oidEcPublicKey = Buffer.from('06072a8648ce3d0201', 'hex');
  const oidSecp256k1 = Buffer.from('06052b8104000a', 'hex');

  const algorithmIdentifier = derSequence([oidEcPublicKey, oidSecp256k1]);
  const subjectPublicKey = derBitString(uncompressedPublicKey);

  return derSequence([algorithmIdentifier, subjectPublicKey]);
}

function main() {
  const privateKey = normalizePrivateKey(process.env.MERCHANT_PRIVATE_KEY);

  const compressed = Buffer.from(secp256k1.getPublicKey(privateKey, true));
  const uncompressed = Buffer.from(secp256k1.getPublicKey(privateKey, false));

  if (compressed.length !== 33) {
    throw new Error(`Compressed public key must be 33 bytes, got ${compressed.length}`);
  }

  if (uncompressed.length !== 65) {
    throw new Error(`Uncompressed public key must be 65 bytes, got ${uncompressed.length}`);
  }

  const spkiDer = buildSpkiDer(uncompressed);
  const pem = toPem(spkiDer);

  console.log('===== MERCHANT PUBLIC KEY =====');
  console.log('Compressed (hex, 33 bytes):');
  console.log(compressed.toString('hex'));
  console.log('');
  console.log('PEM (use this for HashKey registration):');
  console.log(pem);
  console.log('');
  console.log('Registration email: hsp_hackathon@hashkey.com');
}

try {
  main();
} catch (error) {
  console.error(`[derive-public-key] ${error.message}`);
  process.exit(1);
}
