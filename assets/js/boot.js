/* ============================================================
   BRAND BOOT SCREEN
   ============================================================
   Shown while the workspace loads after a successful sign-in.
   Everything is driven by Settings → Shop Information:
     • logo      → uploaded Brand Logo (falls back to the hanger mark)
     • name      → Shop Name
     • tagline   → Tagline
   Nothing here is hard-coded to a specific shop.
   ============================================================ */

window.BOOT = (function () {
  'use strict';

  var el = null;
  var shownAt = 0;
  var minMs = 850;
  var hideTimer = null;
  var maxTimer = null;

  /* ---------- identity helpers (self-contained) ---------- */

  function safeSettings() {
    try { return DB.settings() || {}; } catch (e) { return {}; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var HANGER_SVG = '<svg viewBox="0 0 70 70" fill="none" stroke="currentColor" stroke-width="3.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M35 8.5a4.2 4.2 0 1 1 4.2-4.2c0 2.4-2.2 3.3-3 5.2"/>' +
    '<path d="M35 9.5v5"/>' +
    '<path d="M5.8 34.2 30.6 19.7a9 9 0 0 1 8.8 0l24.8 14.5a4 4 0 0 1-2 7.5H7.8a4 4 0 0 1-2-7.5Z"/>' +
    '<rect x="19.5" y="38" width="31" height="26" rx="5"/>' +
    '<circle cx="35" cy="51" r="7.4"/></svg>';

  function markHtml(settings) {
    var img = String(settings.logoImage || '').trim();
    var isBundledDefault = !img || img === 'assets/img/logo.jpeg';
    if (!isBundledDefault) {
      return '<img class="boot-logo-img" src="' + escapeHtml(img) + '" alt="' +
             escapeHtml(settings.shopName || 'Logo') + '" />';
    }
    return HANGER_SVG;
  }

  function wordmarkHtml(shopName) {
    var clean = String(shopName || 'Laundry').trim().replace(/\s+/g, ' ');
    var words = clean.split(' ');
    if (words.length === 1) {
      return '<span class="boot-wm-accent">' + escapeHtml(clean.toUpperCase()) + '</span>';
    }
    var last = words.pop();
    return '<span class="boot-wm-base">' + escapeHtml(words.join(' ').toUpperCase()) + '</span> ' +
           '<span class="boot-wm-accent">' + escapeHtml(last.toUpperCase()) + '</span>';
  }

  function brandName() {
    return (window._IT_BRAND && window._IT_BRAND.n) ? window._IT_BRAND.n : 'CelineSoft';
  }

  /* ---------- render ---------- */

  /* Remove any overlay left behind mid-fade so two screens can never stack. */
  function clearStale() {
    var nodes = document.querySelectorAll('.boot-screen');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] !== el && nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  function show(opts) {
    opts = opts || {};
    if (el) { // already up — just extend the minimum
      shownAt = Date.now() - Math.min((opts.min || minMs) / 2, Date.now() - shownAt);
      return;
    }
    clearStale();
    minMs = typeof opts.min === 'number' ? opts.min : 850;

    var s = safeSettings();
    var shopName = s.shopName || 'Laundry';
    var tagline = (s.tagline || '').trim();
    var statusText = opts.status || 'Loading your workspace';

    var node = document.createElement('div');
    node.className = 'boot-screen';
    node.id = 'bootScreen';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.innerHTML =
      '<div class="boot-aura" aria-hidden="true"></div>' +
      '<div class="boot-grid" aria-hidden="true"></div>' +

      '<div class="boot-core">' +
        '<div class="boot-logo-wrap">' +
          '<svg class="boot-ring" viewBox="0 0 120 120" aria-hidden="true">' +
            '<circle class="boot-ring-track" cx="60" cy="60" r="55"/>' +
            '<circle class="boot-ring-spin" cx="60" cy="60" r="55"/>' +
          '</svg>' +
          '<div class="boot-logo">' + markHtml(s) + '</div>' +
        '</div>' +

        '<div class="boot-name">' + wordmarkHtml(shopName) + '</div>' +
        (tagline ? '<div class="boot-tagline">' + escapeHtml(tagline) + '</div>' : '') +

        '<div class="boot-status">' +
          '<span class="boot-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span class="boot-status-text">' + escapeHtml(statusText) + '</span>' +
        '</div>' +

        '<div class="boot-bar" aria-hidden="true"><i></i></div>' +
      '</div>' +

      '<div class="boot-foot">' +
        '<img class="boot-badge" src="assets/img/celinesoft-badge.png" alt="" />' +
        '<span>Powered by <b>' + escapeHtml(brandName()) + '</b></span>' +
      '</div>';

    document.body.appendChild(node);
    el = node;
    shownAt = Date.now();
    document.body.classList.add('boot-active');

    // hard safety net: never trap the user on the boot screen
    clearTimeout(maxTimer);
    maxTimer = setTimeout(function () { forceHide(); }, typeof opts.max === 'number' ? opts.max : 7000);

    // let the entrance animation settle before starting the exit
    requestAnimationFrame(function () { node.classList.add('is-on'); });
  }

  function doHide() {
    if (!el) return;
    var node = el;
    el = null;
    clearTimeout(maxTimer);
    node.classList.add('is-off');
    document.body.classList.remove('boot-active');
    setTimeout(function () {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }, 460);
  }

  function hide() {
    if (!el) return;
    clearTimeout(hideTimer);
    var wait = Math.max(0, minMs - (Date.now() - shownAt));
    hideTimer = setTimeout(doHide, wait);
  }

  function forceHide() {
    clearTimeout(hideTimer);
    doHide();
  }

  function isActive() { return !!el; }

  return { show: show, hide: hide, forceHide: forceHide, isActive: isActive };
})();

/* ============================================================
   COMPACT BRAND LOADER  (for in-app page loads)
   ============================================================
   A slim version of the boot screen used INSIDE the app.
   It only appears when something genuinely takes time — fast
   pages are left alone so navigation stays instant.

     BOOT.quick()                      → show now
     BOOT.quickAsync(fn, opts)         → show only if fn is slow
   ============================================================ */
(function () {
  'use strict';

  var qEl = null, qShownAt = 0, qTimer = null, qMaxTimer = null;

  function settings() {
    try { return DB.settings() || {}; } catch (e) { return {}; }
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function mark(s) {
    var img = String(s.logoImage || '').trim();
    if (img && img !== 'assets/img/logo.jpeg') {
      return '<img class="bq-logo-img" src="' + esc(img) + '" alt="" />';
    }
    return '<svg viewBox="0 0 70 70" fill="none" stroke="currentColor" stroke-width="3.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M35 8.5a4.2 4.2 0 1 1 4.2-4.2c0 2.4-2.2 3.3-3 5.2"/><path d="M35 9.5v5"/>' +
      '<path d="M5.8 34.2 30.6 19.7a9 9 0 0 1 8.8 0l24.8 14.5a4 4 0 0 1-2 7.5H7.8a4 4 0 0 1-2-7.5Z"/>' +
      '<rect x="19.5" y="38" width="31" height="26" rx="5"/><circle cx="35" cy="51" r="7.4"/></svg>';
  }
  function wordmark(name) {
    var w = String(name || 'Laundry').trim().split(/\s+/);
    if (w.length === 1) return '<span class="bq-wm-a">' + esc(w[0].toUpperCase()) + '</span>';
    var last = w.pop();
    return '<span class="bq-wm-b">' + esc(w.join(' ').toUpperCase()) + '</span> ' +
           '<span class="bq-wm-a">' + esc(last.toUpperCase()) + '</span>';
  }

  function quick(opts) {
    opts = opts || {};
    if (qEl) return;                        // already visible
    var s = settings();
    var node = document.createElement('div');
    node.className = 'bq-loader';
    node.id = 'brandQuickLoader';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.innerHTML =
      '<div class="bq-inner">' +
        '<span class="bq-mark">' + mark(s) + '</span>' +
        '<span class="bq-text">' +
          '<span class="bq-name">' + wordmark(s.shopName) + '</span>' +
          '<span class="bq-status">' + esc(opts.status || 'Loading…') + '</span>' +
        '</span>' +
        '<span class="bq-spin" aria-hidden="true"><i></i></span>' +
      '</div>' +
      '<div class="bq-bar" aria-hidden="true"><i></i></div>';
    document.body.appendChild(node);
    qEl = node;
    qShownAt = Date.now();
    requestAnimationFrame(function(){ node.classList.add('is-on'); });

    clearTimeout(qMaxTimer);
    qMaxTimer = setTimeout(function(){ forceQuickHide(); }, opts.max || 6000);
  }

  function doQuickHide() {
    if (!qEl) return;
    var node = qEl; qEl = null;
    clearTimeout(qMaxTimer);
    node.classList.add('is-off');
    setTimeout(function(){ if (node.parentNode) node.parentNode.removeChild(node); }, 320);
  }

  function quickHide(min) {
    if (!qEl) return;
    clearTimeout(qTimer);
    var wait = Math.max(0, (min == null ? 420 : min) - (Date.now() - qShownAt));
    qTimer = setTimeout(doQuickHide, wait);
  }

  function forceQuickHide() { clearTimeout(qTimer); doQuickHide(); }

  /* Run an async task; only surface the loader if it takes longer than `after`. */
  function quickAsync(task, opts) {
    opts = opts || {};
    var after = typeof opts.after === 'number' ? opts.after : 400;
    var shown = false;
    var t = setTimeout(function () {
      shown = true;
      quick({ status: opts.status, min: opts.min || 520 });
    }, after);
    return Promise.resolve()
      .then(task)
      .finally(function () {
        clearTimeout(t);
        if (shown) quickHide(opts.min || 520);
      });
  }

  var api = window.BOOT || {};
  api.quick = quick;
  api.quickHide = quickHide;
  api.forceQuickHide = forceQuickHide;
  api.quickAsync = quickAsync;
  window.BOOT = api;
})();

/* ============================================================
   ADAPTIVE PAGE TIMING
   ============================================================
   Every page render is timed. The compact loader is only shown
   for pages that actually take long on this device — so a fast
   app stays instant, and a slow one gets branded feedback
   instead of a frozen screen.
   ============================================================ */
(function () {
  'use strict';

  var STORE   = 'mrLaundryPageTiming';
  var SLOW_MS = 260;   // a page slower than this earns the loader next time

  var LABELS = {
    dashboard: 'Loading dashboard', pos: 'Opening new sale', orders: 'Loading orders',
    customers: 'Loading customers', products: 'Loading products', inventory: 'Loading inventory',
    expenses: 'Loading expenses', ledger: 'Loading ledger', cashbook: 'Loading cash book',
    reports: 'Building reports', delivery: 'Loading deliveries', claims: 'Loading claims',
    drawings: 'Loading drawings', vendors: 'Loading vendors', purchaseOrders: 'Loading purchase orders',
    branches: 'Loading branches', users: 'Loading users', auditLog: 'Loading activity log',
    taskboard: 'Loading task board', inbox: 'Loading inbox', promoAdmin: 'Loading promotions',
    marketing: 'Loading marketing', reportBuilder: 'Building report', settings: 'Loading settings',
    invoice: 'Preparing invoice', photos: 'Loading photos'
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(o) {
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
  }

  function pageIsSlow(page) {
    var t = load()[page];
    return !!t && t.avg > SLOW_MS;
  }

  function pageLabel(page) {
    return LABELS[page] || ('Loading ' + page);
  }

  /* Record a completed render (exponential moving average). */
  function pageMeasured(page, ms) {
    if (!page || !isFinite(ms) || ms < 0) return;
    var all = load();
    var rec = all[page] || { avg: ms, n: 0 };
    rec.avg = rec.n === 0 ? ms : (rec.avg * 0.7 + ms * 0.3);
    rec.n = Math.min((rec.n || 0) + 1, 50);
    rec.last = Math.round(ms);
    all[page] = rec;
    save(all);
  }

  function pageTimings() { return load(); }
  function resetPageTimings() { save({}); }

  var api = window.BOOT || {};
  api.pageIsSlow = pageIsSlow;
  api.pageLabel = pageLabel;
  api.pageMeasured = pageMeasured;
  api.pageTimings = pageTimings;
  api.resetPageTimings = resetPageTimings;
  window.BOOT = api;

  /* ---------- wrap genuine network waits ----------
     Cloud sync is the one place that is actually slow in real use.
     Surface the loader only if the operation runs past 450ms. */
  function wrapCloud() {
    if (!window.CLOUD || window.CLOUD.__bootWrapped) return;
    ['pullAndMerge', 'push', 'init'].forEach(function (fn) {
      var orig = window.CLOUD[fn];
      if (typeof orig !== 'function') return;
      window.CLOUD[fn] = function () {
        var self = this, args = arguments;
        var label = fn === 'push' ? 'Saving to cloud' : 'Syncing with cloud';
        return window.BOOT.quickAsync(function () {
          return orig.apply(self, args);
        }, { after: 450, min: 600, status: label });
      };
    });
    window.CLOUD.__bootWrapped = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapCloud);
  } else {
    wrapCloud();
  }
  // CLOUD may be created slightly later
  var tries = 0;
  var iv = setInterval(function () {
    wrapCloud();
    if (window.CLOUD && window.CLOUD.__bootWrapped) clearInterval(iv);
    if (++tries > 40) clearInterval(iv);
  }, 100);
})();
