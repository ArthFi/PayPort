(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var cfg = {
    appKey:      script.dataset.appKey      || '',
    amount:      script.dataset.amount      || '5.00',
    token:       script.dataset.token       || 'USDC',
    orderId:     script.dataset.orderId     || '',
    description: script.dataset.description || 'PayPort SDK Order',
    apiBase:     script.dataset.apiBase     || 'http://localhost:3001',
    buttonText:  script.dataset.buttonText  || 'Pay with HashKey',
  };

  if (!cfg.appKey) {
    console.error('[PayPort] Missing data-app-key attribute');
    return;
  }

  var btn = document.createElement('button');
  btn.textContent = cfg.buttonText;
  btn.setAttribute('data-payport-btn', 'true');

  Object.assign(btn.style, {
    display:        'inline-flex',
    alignItems:     'center',
    gap:            '8px',
    padding:        '12px 24px',
    background:     'transparent',
    border:         '1px solid #1A56FF',
    borderRadius:   '10px',
    color:          '#f1f5f9',
    fontFamily:     "'Inter', system-ui, sans-serif",
    fontSize:       '14px',
    fontWeight:     '500',
    cursor:         'pointer',
    transition:     'all 0.2s ease',
    letterSpacing:  '0.01em',
  });

  btn.onmouseenter = function () {
    btn.style.background = 'rgba(26, 86, 255, 0.12)';
    btn.style.boxShadow  = '0 0 0 1px #1A56FF';
  };
  btn.onmouseleave = function () {
    if (!btn.disabled) {
      btn.style.background = 'transparent';
      btn.style.boxShadow  = 'none';
    }
  };

  var target = document.querySelector('[data-payport="true"]');
  if (target) {
    target.appendChild(btn);
  } else {
    script.parentNode.insertBefore(btn, script.nextSibling);
  }

  var popup = null;
  var messageListener = null;

  function setLoading(loading) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Opening payment...' : cfg.buttonText;
    btn.style.opacity = loading ? '0.7' : '1';
    btn.style.cursor  = loading ? 'not-allowed' : 'pointer';
  }

  function setSuccess() {
    btn.textContent      = '✓ Payment Complete';
    btn.style.border     = '1px solid #22c55e';
    btn.style.color      = '#22c55e';
    btn.style.background = 'rgba(34, 197, 94, 0.08)';
    btn.disabled = false;
  }

  function setError(msg) {
    setLoading(false);
    console.error('[PayPort] Payment error:', msg);
  }

  function startPayment() {
    setLoading(true);

    if (messageListener) {
      window.removeEventListener('message', messageListener);
      messageListener = null;
    }

    var orderId = cfg.orderId || ('order_' + Date.now());

    fetch(cfg.apiBase + '/api/payment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key':    cfg.appKey,
      },
      body: JSON.stringify({
        amount:      cfg.amount,
        token:       cfg.token,
        orderId:     orderId,
        description: cfg.description,
      }),
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data.ok) {
        throw new Error(data.error || 'Payment creation failed');
      }

      var paymentUrl = data.paymentUrl;
      var paymentRequestId = data.paymentRequestId;

      var W = 480, H = 680;
      var left = Math.max(0, Math.floor((window.screen.width  / 2) - (W / 2)));
      var top  = Math.max(0, Math.floor((window.screen.height / 2) - (H / 2)));

      popup = window.open(
        paymentUrl,
        'payport_payment_' + Date.now(),
        'width=' + W + ',height=' + H + ',left=' + left + ',top=' + top + ',scrollbars=no,resizable=no,toolbar=no,menubar=no'
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        throw new Error('Popup was blocked. Please allow popups for this site.');
      }

      setLoading(false);

      messageListener = function (event) {
        if (!event.data || event.data.type !== 'hashpay:paid') return;
        window.removeEventListener('message', messageListener);
        messageListener = null;
        if (popup && !popup.closed) popup.close();
        setSuccess();
        showSuccessOverlay(cfg.amount, cfg.token);
        document.dispatchEvent(new CustomEvent('payport:success', {
          detail: { orderId: orderId, paymentRequestId: paymentRequestId, txHash: event.data.txHash },
        }));
      };
      window.addEventListener('message', messageListener);

      var pollPopup = setInterval(function () {
        if (!popup || popup.closed) {
          clearInterval(pollPopup);
          if (messageListener) {
            window.removeEventListener('message', messageListener);
            messageListener = null;
          }
          setLoading(false);
        }
      }, 500);
    })
    .catch(function (err) {
      setError(err.message);
      alert('[PayPort] ' + err.message);
    });
  }

  btn.addEventListener('click', startPayment);

  function showSuccessOverlay(amount, token) {
    var overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:       'fixed',
      top:            '0',
      left:           '0',
      right:          '0',
      bottom:         '0',
      background:     'rgba(0,0,0,0.85)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         '999999',
      fontFamily:     "'Inter', system-ui, sans-serif",
    });

    var card = document.createElement('div');
    Object.assign(card.style, {
      background:   '#111827',
      border:       '1px solid rgba(34,197,94,0.3)',
      borderRadius: '20px',
      padding:      '32px',
      textAlign:    'center',
      maxWidth:     '340px',
      width:        '90%',
      color:        '#f1f5f9',
    });

    card.innerHTML =
      '<div style="font-size:48px;color:#22c55e;margin-bottom:12px">✓</div>' +
      '<h3 style="font-size:20px;font-weight:700;margin:0 0 8px">Payment Confirmed</h3>' +
      '<p style="color:#94a3b8;margin:0 0 20px;font-family:monospace;font-size:16px">' + amount + ' ' + token + '</p>' +
      '<p style="color:#64748b;font-size:12px;margin:0 0 20px">Settled via HP2 on HashKey Chain</p>' +
      '<button id="payport-overlay-close" style="padding:10px 24px;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit">Done</button>';

    overlay.setAttribute('data-payport-overlay', 'true');
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    var closeBtn = document.getElementById('payport-overlay-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { overlay.remove(); });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 5000);
  }

})();
