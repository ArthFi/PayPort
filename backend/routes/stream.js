
const { Router } = require('express');
const { createSSEHandler } = require('../sse');
const { getMerchantByAppKey } = require('../db');

const router = Router();

router.get('/stream', createSSEHandler(getMerchantByAppKey));

module.exports = router;
