
const { EventEmitter } = require('events');

const paymentEmitter = new EventEmitter();
paymentEmitter.setMaxListeners(200);

function broadcastToMerchant(merchantId, data) {
  const payload = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  };
  paymentEmitter.emit(`merchant:${merchantId}`, payload);
}

function createSSEHandler(getMerchantByAppKey) {
  return function sseHandler(req, res) {
    const appKey = req.headers['x-app-key'] || req.query.key;

    if (!appKey) {
      return res.status(401).json({ ok: false, error: 'Missing x-app-key header or ?key= param' });
    }

    const merchant = getMerchantByAppKey(appKey);
    if (!merchant) {
      return res.status(401).json({ ok: false, error: 'Invalid app key' });
    }

    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const connectPayload = {
      type:       'connected',
      merchantId: merchant.id,
      timestamp:  new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(connectPayload)}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    const eventChannel = `merchant:${merchant.id}`;

    function onEvent(payload) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    paymentEmitter.on(eventChannel, onEvent);

    req.on('close', () => {
      paymentEmitter.removeListener(eventChannel, onEvent);
      clearInterval(heartbeat);
      res.end();
    });
  };
}

module.exports = {
  paymentEmitter,
  broadcastToMerchant,
  createSSEHandler,
};
