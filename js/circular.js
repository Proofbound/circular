/* ============================================================
   Karam & Sprague's Fortnightly Circular — Interactive Features
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initNavHighlight();
    initSmoothScroll();
    initDeepLinks();
    initShareControls();
    initMobileTocToggle();
    initSigninStatus();
    initSubscribe();
  });

  /* -- Nav-bar active section highlighting (index only) ------ */
  function initNavHighlight() {
    if (!document.querySelector('.page-layout')) return;

    var navLinks = document.querySelectorAll('.nav-bar__inner a[href^="#"]');
    var sections = [];
    navLinks.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var el = document.getElementById(id);
      if (el) sections.push({ id: id, el: el, link: link });
    });
    if (!sections.length) return;

    function setActive(id) {
      navLinks.forEach(function (l) { l.classList.remove('active'); });
      sections.forEach(function (s) {
        if (s.id === id) s.link.classList.add('active');
      });
    }

    if ('IntersectionObserver' in window) {
      var current = sections[0].id;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) current = entry.target.id;
        });
        setActive(current);
      }, { rootMargin: '-80px 0px -60% 0px' });
      sections.forEach(function (s) { observer.observe(s.el); });
    } else {
      // Fallback: throttled scroll listener
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(function () {
            var navH = getNavBarHeight();
            var best = sections[0].id;
            sections.forEach(function (s) {
              if (s.el.getBoundingClientRect().top <= navH + 20) best = s.id;
            });
            setActive(best);
            ticking = false;
          });
        }
      });
    }
  }

  /* -- Smooth scroll with sticky-header offset --------------- */
  function initSmoothScroll() {
    var navLinks = document.querySelectorAll('.nav-bar__inner a[href^="#"]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.scrollY - getNavBarHeight() - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
        history.replaceState(null, '', '#' + id);
      });
    });
  }

  /* -- Deep link handling on page load ----------------------- */
  function initDeepLinks() {
    var hash = location.hash;
    if (!hash) return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    requestAnimationFrame(function () {
      var top = target.getBoundingClientRect().top + window.scrollY - getNavBarHeight() - 16;
      window.scrollTo({ top: top, behavior: 'auto' });
      // Activate matching nav link
      var link = document.querySelector('.nav-bar__inner a[href="' + hash + '"]');
      if (link) {
        document.querySelectorAll('.nav-bar__inner a[href^="#"]').forEach(function (l) {
          l.classList.remove('active');
        });
        link.classList.add('active');
      }
    });
  }

  /* -- Share controls (article pages) ------------------------ */
  function initShareControls() {
    // Copy link button
    var copyBtn = document.querySelector('.share-controls__copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            showCopyFeedback(copyBtn, 'Copied!', true);
          }).catch(function () {
            showCopyFeedback(copyBtn, 'Copy the URL from your address bar', false);
          });
        } else {
          showCopyFeedback(copyBtn, 'Copy the URL from your address bar', false);
        }
      });
    }

    // X (Twitter) share buttons — dynamic URL
    document.querySelectorAll('.share-controls__x').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var url = encodeURIComponent(window.location.href);
        var text = encodeURIComponent(document.title);
        window.open('https://x.com/intent/tweet?url=' + url + '&text=' + text,
          '_blank', 'width=550,height=420,noopener');
      });
    });

    // Facebook share buttons — dynamic URL
    document.querySelectorAll('.share-controls__fb').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var url = encodeURIComponent(window.location.href);
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + url,
          '_blank', 'width=550,height=420,noopener');
      });
    });
  }

  function showCopyFeedback(btn, msg, success) {
    var original = btn.textContent;
    btn.textContent = msg;
    if (success) btn.classList.add('share-controls__copy--success');
    var delay = success ? 2000 : 3000;
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('share-controls__copy--success');
    }, delay);
  }

  /* -- Mobile TOC toggle (index only) ------------------------ */
  function initMobileTocToggle() {
    var toggle = document.querySelector('.toc-toggle');
    var toc = document.querySelector('.toc-sidebar');
    if (!toggle || !toc) return;

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toc.classList.toggle('toc-sidebar--open');
    });
  }

  /* -- Sign-in status (Netlify Functions connectivity) -------- */
  function initSigninStatus() {
    var links = document.querySelectorAll('[data-signin]');
    if (!links.length) return;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var opts = controller ? { signal: controller.signal } : {};
    if (controller) setTimeout(function () { controller.abort(); }, 3000);

    var isLocal = location.hostname === 'localhost' || location.protocol === 'file:';
    var base = isLocal ? 'http://localhost:8888' : 'https://proofbound-circular.netlify.app';
    fetch(base + '/.netlify/functions/hello', opts)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
      .then(function (data) {
        if (data && data.status === 'ok') {
          links.forEach(function (el) { el.classList.add('signin--live'); });
        }
      })
      .catch(function () { /* functions unavailable — button stays normal */ });
  }

  /* -- Subscribe modal --------------------------------------- */
  function initSubscribe() {
    var modal = document.getElementById('subscribe-modal');
    var form = document.getElementById('subscribe-form');
    var status = document.getElementById('subscribe-status');
    if (!modal || !form) return;

    var backdrop = modal.querySelector('.subscribe-modal__backdrop');
    var closeBtn = modal.querySelector('.subscribe-modal__close');
    var triggers = document.querySelectorAll('[data-subscribe]');

    function openModal() {
      modal.setAttribute('aria-hidden', 'false');
      var emailInput = form.querySelector('input[name="email"]');
      if (emailInput) emailInput.focus();
    }

    function closeModal() {
      modal.setAttribute('aria-hidden', 'true');
      status.textContent = '';
      status.className = 'subscribe-modal__status';
    }

    triggers.forEach(function (btn) {
      btn.addEventListener('click', openModal);
    });

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
    });

    var isLocal = location.hostname === 'localhost' || location.protocol === 'file:';
    var base = isLocal ? 'http://localhost:8888' : 'https://proofbound-circular.netlify.app';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[name="email"]').value.trim();
      var name = form.querySelector('input[name="name"]').value.trim();

      status.textContent = 'Subscribing\u2026';
      status.className = 'subscribe-modal__status';

      fetch(base + '/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, name: name })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            status.textContent = 'Thank you! You\u2019re subscribed.';
            status.className = 'subscribe-modal__status subscribe-modal__status--success';
            form.style.display = 'none';
          } else {
            status.textContent = result.data.error || 'Something went wrong.';
            status.className = 'subscribe-modal__status subscribe-modal__status--error';
          }
        })
        .catch(function () {
          status.textContent = 'Could not reach the server. Please try again later.';
          status.className = 'subscribe-modal__status subscribe-modal__status--error';
        });
    });
  }

  /* -- Helper ------------------------------------------------ */
  function getNavBarHeight() {
    var nav = document.querySelector('.nav-bar');
    return nav ? nav.offsetHeight : 0;
  }
})();
