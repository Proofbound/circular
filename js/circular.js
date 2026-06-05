/* ============================================================
   The Fortnightly Circular — Interactive Features
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initSigninStatus();
    initSubscribe();
    initUnsubscribe();
  });

  var cfg = window.__CIRCULAR__ || {};
  var supabase = null;
  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  /* -- Sign-in status (Platform API connectivity) ------------- */
  function initSigninStatus() {
    var links = document.querySelectorAll('[data-signin]');
    if (!links.length) return;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var opts = controller ? { signal: controller.signal } : {};
    if (controller) setTimeout(function () { controller.abort(); }, 3000);

    var apiUrl = cfg.platformApiUrl || 'https://proofbound.com/api/v1/platform';
    fetch(apiUrl + '/health', opts)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
      .then(function (data) {
        if (data && data.status === 'ok') {
          links.forEach(function (el) { el.classList.add('signin--live'); });
        }
      })
      .catch(function () { /* platform API unavailable */ });
  }

  /* -- Inline subscribe form (footer) ------------------------- */
  function initSubscribe() {
    var form = document.getElementById('subscribe-form');
    var status = document.getElementById('subscribe-status');
    if (!form || !status) return;

    var apiUrl = cfg.platformApiUrl || 'https://proofbound.com/api/v1/platform';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[name="email"]').value.trim();
      var honeypot = form.querySelector('input[name="website"]').value;
      var turnstileField = form.querySelector('[name="cf-turnstile-response"]');
      var turnstileToken = turnstileField ? turnstileField.value : '';

      if (cfg.turnstileSiteKey && !turnstileToken) {
        status.textContent = 'Please complete the verification challenge.';
        status.className = 'subscribe-form__status subscribe-form__status--error';
        return;
      }

      status.textContent = 'Subscribing\u2026';
      status.className = 'subscribe-form__status';

      var body = { email: email, product: 'circular', website: honeypot };
      if (turnstileToken) body.turnstile_token = turnstileToken;

      fetch(apiUrl + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            status.textContent = 'Thank you. You\u2019re subscribed.';
            status.className = 'subscribe-form__status subscribe-form__status--success';
            form.style.display = 'none';
          } else {
            status.textContent = (result.data && result.data.detail) || 'Something went wrong.';
            status.className = 'subscribe-form__status subscribe-form__status--error';
            if (window.turnstile) window.turnstile.reset();
          }
        })
        .catch(function () {
          status.textContent = 'Could not reach the server. Please try again later.';
          status.className = 'subscribe-form__status subscribe-form__status--error';
          if (window.turnstile) window.turnstile.reset();
        });
    });
  }

  /* -- Unsubscribe page (token-driven) ------------------------ */
  function initUnsubscribe() {
    var btn = document.getElementById('unsubscribe-confirm');
    if (!btn) return; // only present on the unsubscribe page

    var confirmBlock = document.getElementById('unsubscribe-confirm-block');
    var guidance = document.getElementById('unsubscribe-guidance');
    var emailEl = document.getElementById('unsubscribe-email');
    var status = document.getElementById('unsubscribe-status');

    var params = new URLSearchParams(window.location.search);
    var email = (params.get('email') || '').trim();
    var token = params.get('token') || '';
    var product = params.get('product') || 'circular';

    // Without a signed token (or an address) we cannot prove the request is the
    // subscriber's own, so we never offer a forgeable bare-email form. Show the
    // guidance state and stop. (textContent only — never innerHTML — so the
    // query param can't inject markup.)
    if (!email || !token) return;

    // Reveal the confirm state.
    if (guidance) guidance.hidden = true;
    if (confirmBlock) confirmBlock.hidden = false;
    if (emailEl) emailEl.textContent = email;

    var apiUrl = cfg.platformApiUrl || 'https://proofbound.com/api/v1/platform';

    btn.addEventListener('click', function () {
      btn.disabled = true; // guard against double-submit / rate-limit burn
      status.textContent = 'Unsubscribing…';
      status.className = 'subscribe-form__status';

      fetch(apiUrl + '/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, product: product, token: token })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { status: res.status, ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            status.textContent = 'You’ve been removed. You will receive no further numbers.';
            status.className = 'subscribe-form__status subscribe-form__status--success';
            btn.style.display = 'none';
          } else if (result.status === 400) {
            status.textContent = 'This unsubscribe link is invalid or has expired — please use the link in your latest issue.';
            status.className = 'subscribe-form__status subscribe-form__status--error';
            btn.style.display = 'none';
          } else {
            status.textContent = (result.data && result.data.detail) || 'Something went wrong. Please try again later.';
            status.className = 'subscribe-form__status subscribe-form__status--error';
            btn.disabled = false;
          }
        })
        .catch(function () {
          status.textContent = 'Could not reach the server. Please try again later.';
          status.className = 'subscribe-form__status subscribe-form__status--error';
          btn.disabled = false;
        });
    });
  }
})();
