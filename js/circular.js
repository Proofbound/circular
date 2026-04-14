/* ============================================================
   The Fortnightly Circular — Interactive Features
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initSigninStatus();
    initSubscribe();
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

      status.textContent = 'Subscribing\u2026';
      status.className = 'subscribe-form__status';

      fetch(apiUrl + '/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, product: 'circular', website: honeypot })
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
          }
        })
        .catch(function () {
          status.textContent = 'Could not reach the server. Please try again later.';
          status.className = 'subscribe-form__status subscribe-form__status--error';
        });
    });
  }
})();
