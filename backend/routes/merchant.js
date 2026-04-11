
const { Router }  = require('express');
const { checkKYC } = require('../lib/kyc');
const {
  getMerchantByWallet,
  getMerchantByAppKey,
  createMerchant,
  getOrdersByMerchant,
  getRecentEvents,
} = require('../db');

const router = Router();


function requireAppKey(req, res, next) {
  const appKey = req.headers['x-app-key'];

  if (!appKey) {
    return res.status(401).json({ ok: false, error: 'Missing x-app-key header' });
  }

  const merchant = getMerchantByAppKey(appKey);
  if (!merchant) {
    return res.status(401).json({ ok: false, error: 'Invalid app key' });
  }

  req.merchant = merchant;
  next();
}


router.post('/register', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'walletAddress is required',
      });
    }

    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      return res.status(400).json({
        ok: false,
        error: 'walletAddress must be a valid 0x-prefixed Ethereum address (42 chars)',
      });
    }

    const existing = getMerchantByWallet(walletAddress);
    if (existing) {
      return res.status(200).json({
        ok: true,
        appKey: existing.app_key,
        walletAddress: existing.wallet_address,
        existing: true,
      });
    }

    const kyc = await checkKYC(walletAddress);
    if (!kyc.isHuman) {
      return res.status(403).json({
        ok: false,
        error: 'KYC_REQUIRED',
        message: 'Your wallet is not KYC verified on HashKey Chain.',
      });
    }

    const merchant = createMerchant(walletAddress);
    console.log(`[Merchant] Registered: ${walletAddress} → appKey ${merchant.app_key}`);

    return res.status(201).json({
      ok: true,
      appKey: merchant.app_key,
      walletAddress: merchant.wallet_address,
      kycLevel: kyc.level,
      existing: false,
    });
  } catch (err) {
    console.error('[Merchant] Registration error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


router.get('/me', requireAppKey, (req, res) => {
  try {
    const merchant = req.merchant;
    const orders   = getOrdersByMerchant(merchant.id);
    const events   = getRecentEvents(merchant.id, 5);

    return res.json({
      ok: true,
      merchant: {
        id:            merchant.id,
        walletAddress: merchant.wallet_address,
        appKey:        merchant.app_key,
        createdAt:     merchant.created_at,
      },
      orderCount:   orders.length,
      recentEvents: events,
    });
  } catch (err) {
    console.error('[Merchant] /me error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { router, requireAppKey };
