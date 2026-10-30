/* ===================== LOGIN PAGE ===================== */

/* Brand mark shown on the login screen.
   - If the shop has uploaded its own logo in Settings → Shop Information,
     that image is used automatically.
   - Otherwise the built-in Mr Laundry hanger mark is drawn as inline SVG.
   Nothing here is hard-coded to a shop name: everything comes from Settings. */
function lgBrandMark(px = 46) {
  const s = DB.settings();
  const img = (s.logoImage || '').trim();
  const isBundledDefault = !img || img === 'assets/img/logo.jpeg';

  if (!isBundledDefault) {
    return `<img class="lg-mark-img" src="${img}" alt="${escapeHtml(s.shopName || 'Logo')}"
              style="height:${px}px;width:auto;max-width:${Math.round(px * 2.4)}px;object-fit:contain;"/>`;
  }
  return `<svg class="lg-mark-svg" viewBox="0 0 70 70" fill="none" style="height:${px}px;width:${px}px;"
              stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true">
      <path d="M35 8.5a4.2 4.2 0 1 1 4.2-4.2c0 2.4-2.2 3.3-3 5.2"/>
      <path d="M35 9.5v5"/>
      <path d="M5.8 34.2 30.6 19.7a9 9 0 0 1 8.8 0l24.8 14.5a4 4 0 0 1-2 7.5H7.8a4 4 0 0 1-2-7.5Z"/>
      <rect x="19.5" y="38" width="31" height="26" rx="5"/>
      <circle cx="35" cy="51" r="7.4"/>
    </svg>`;
}

/* "Mr Laundry" -> "MR" in navy + "LAUNDRY" in teal.
   Works for any shop name: the final word takes the accent colour. */
function lgWordmark(shopName, small) {
  const clean = (shopName || 'Laundry').trim().replace(/\s+/g, ' ');
  // auto-fit: shorter names can be big, longer client names step down a size
  const len = clean.length;
  let sizeClass = '';
  if (len > 26)      sizeClass = ' is-xs';
  else if (len > 19) sizeClass = ' is-sm';
  else if (len > 14) sizeClass = ' is-md';
  if (small) sizeClass += ' lg-wordmark-sm';

  const words = clean.split(' ');
  const inner = words.length === 1
    ? `<span class="lg-wm-accent">${escapeHtml(clean.toUpperCase())}</span>`
    : (() => { const last = words.pop();
        return `<span class="lg-wm-base">${escapeHtml(words.join(' ').toUpperCase())}</span> `
             + `<span class="lg-wm-accent">${escapeHtml(last.toUpperCase())}</span>`; })();

  return `<span class="lg-wordmark${sizeClass}">${inner}</span>`;
}

/* Turn whatever the client typed into a usable link + a tidy label. */
function lgFacebookUrl(raw) {
  let v = (raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  v = v.replace(/^\/+/, '');
  if (/^(www\.)?facebook\.com\//i.test(v)) return 'https://' + v.replace(/^www\./i, '');
  if (/^(www\.)?fb\.com\//i.test(v)) return 'https://' + v.replace(/^www\./i, '');
  return 'https://facebook.com/' + v;
}
function lgFacebookLabel(raw) {
  return (raw || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}
function lgTelHref(raw) {
  const digits = (raw || '').replace(/[^\d+]/g, '');
  return digits ? 'tel:' + digits : '';
}

function renderLogin() {
  const s = DB.settings();
  const brand = (typeof window !== 'undefined' && window._IT_BRAND) ? window._IT_BRAND : {};

  const shopName   = s.shopName || 'Laundry';
  const tagline    = s.tagline || '';
  const address    = (s.address || '').trim();
  const phone      = (s.phone || '').trim();
  const fbRaw      = (s.facebook || '').trim();
  const fbUrl      = lgFacebookUrl(fbRaw);
  const fbLabel    = lgFacebookLabel(fbRaw);
  const telHref    = lgTelHref(phone);

  const cloudEnabled = (typeof CLOUD !== 'undefined' && CLOUD.isEnabled() && CLOUD.isReady());

  /* ---- feature strip ---- */
  const feature = (icon, label) => `
    <div class="lg-feature">
      <span class="lg-feature-ico">${icon}</span>
      <span class="lg-feature-label">${label}</span>
    </div>`;

  const icoBox = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
  const icoCal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h2M14 14h2M8 17.5h2M14 17.5h2"/></svg>`;
  const icoCard = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><line x1="2.5" y1="10" x2="21.5" y2="10"/><line x1="6" y1="14.5" x2="10" y2="14.5"/></svg>`;
  const icoClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><polyline points="12 6.8 12 12.3 15.8 14.4"/></svg>`;

  const features = [
    feature(icoBox,   t('login.feature.track',   'Track<br>Orders')),
    feature(icoCal,   t('login.feature.pickup',  'Book<br>Pickup')),
    feature(icoCard,  t('login.feature.pay',     'Pay<br>Bills')),
    feature(icoClock, t('login.feature.updates', 'Real-Time<br>Updates')),
  ].join('');

  /* ---- bottom contact band ---- */
  const bandItems = [];
  if (address) {
    bandItems.push(`
      <div class="lg-band-item">
        <svg class="lg-band-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6.2-9 12-9 12s-9-5.8-9-12a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3.2"/></svg>
        <span>${escapeHtml(address).replace(/\n/g, '<br>')}</span>
      </div>`);
  }
  if (phone) {
    bandItems.push(`
      <a class="lg-band-item lg-band-link" href="${telHref}">
        <svg class="lg-band-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>
        <span>${escapeHtml(phone)}</span>
      </a>`);
  }
  if (fbRaw) {
    bandItems.push(`
      <a class="lg-band-item lg-band-link" href="${escapeHtml(fbUrl)}" target="_blank" rel="noopener">
        <svg class="lg-band-ico" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z"/></svg>
        <span>${escapeHtml(fbLabel)}</span>
      </a>`);
  }

  const html = `
  <div class="lg-root">

    <!-- ================= LEFT: BRAND HERO ================= -->
    <section class="lg-hero">
      <div class="lg-hero-photo" aria-hidden="true"></div>
      <div class="lg-hero-veil" aria-hidden="true"></div>

      <header class="lg-hero-top">
        <div class="lg-brand">
          <span class="lg-mark">${lgBrandMark(52)}</span>
          <div class="lg-brand-text">
            ${lgWordmark(shopName, false)}
            ${tagline ? `<div class="lg-brand-tag">${escapeHtml(tagline)}</div>` : ''}
          </div>
        </div>
        <div class="lg-hero-claim">
          <span>${t('login.claim1', 'Cleaner Clothes')}</span>
          <em></em>
          <span>${t('login.claim2', 'Happier You')}</span>
        </div>
      </header>

      <div class="lg-hero-body">
        <h1 class="lg-headline">
          ${t('login.welcome', 'Welcome to')}<br>
          <span class="lg-headline-accent"><bdi>${escapeHtml(shopName)}</bdi> <span class="lg-portal-word">${t('login.portal', 'Portal')}</span></span>
        </h1>
        <p class="lg-subcopy">
          ${t('login.subcopy', 'Manage your orders, track your laundry, and stay connected — all in one place.')}
        </p>
        <div class="lg-features">${features}</div>
      </div>

      <div class="lg-script" aria-hidden="true">${t('login.script', 'Your Laundry, Our Priority')}</div>

      ${bandItems.length ? `
      <footer class="lg-band">
        <svg class="lg-wave" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,64 L0,30 C260,62 520,-4 830,16 C1090,32 1260,24 1440,4 L1440,64 Z" fill="#0f2b46"/>
        </svg>
        <div class="lg-band-row">${bandItems.join('')}</div>
      </footer>` : ''}
    </section>

    <!-- ================= RIGHT: SIGN IN ================= -->
    <section class="lg-panel">
      <div class="lg-card">
        <div class="lg-card-brand">
          <span class="lg-mark lg-mark-sm">${lgBrandMark(46)}</span>
          <div class="lg-brand-text">
            ${lgWordmark(shopName, true)}
            ${tagline ? `<div class="lg-brand-tag">${escapeHtml(tagline)}</div>` : ''}
          </div>
        </div>

        <h2 class="lg-title">${t('login.signin', 'Sign In')}</h2>
        <p class="lg-lede">${t('login.lede', 'Please enter your credentials to continue.')}</p>

        <form id="loginForm" autocomplete="on">
          <label class="lg-label" for="lgUser">${t('login.username', 'Username')}</label>
          <div class="lg-input">
            <svg class="lg-input-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-1.8a5.2 5.2 0 0 0-5.2-5.2H9.2A5.2 5.2 0 0 0 4 19.2V21"/><circle cx="12" cy="7.3" r="4.1"/></svg>
            <input id="lgUser" name="username" autocomplete="username" required
                   placeholder="${t('login.usernameHint', 'e.g. your username')}" />
          </div>

          <label class="lg-label" for="lgPass">${t('login.password', 'Password')}</label>
          <div class="lg-input">
            <svg class="lg-input-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.2" y="10.4" width="15.6" height="10.4" rx="2.4"/><path d="M7.8 10.4V7.6a4.2 4.2 0 0 1 8.4 0v2.8"/></svg>
            <input id="lgPass" name="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
            <button type="button" class="lg-eye" id="lgEye" aria-label="Show password">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.8-6.6 10-6.6S22 12 22 12s-3.8 6.6-10 6.6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.9"/></svg>
            </button>
          </div>

          <button type="submit" class="lg-submit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5h3.2A2.3 2.3 0 0 1 20 5.8v12.4a2.3 2.3 0 0 1-2.3 2.3h-3.2"/><polyline points="9.6 16.4 14 12 9.6 7.6"/><line x1="14" y1="12" x2="3.6" y2="12"/></svg>
            <span>${t('login.signin', 'Sign In')}</span>
          </button>

          <button type="button" id="forgotBtn" class="lg-forgot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.6" y="10.5" width="14.8" height="9.6" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>
            <span>${t('login.forgot', 'Forgot Password?')}</span>
          </button>

          ${cloudEnabled ? `
          <button type="button" id="loginSyncBtn" class="lg-sync">
            ☁️ <span>${t('login.forcesync', 'Force Cloud Sync')}</span>
          </button>` : ''}
        </form>

        <!-- IT Department support — intentionally kept, do not remove -->
        <div class="lg-divider"></div>
        <div class="lg-support">
          <div class="lg-support-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h2.2a1 1 0 0 1 1 1v3.4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V14Z"/><path d="M20 14h-2.2a1 1 0 0 0-1 1v3.4a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1V14Z"/><path d="M20 19.4a2.6 2.6 0 0 1-2.6 2.6H13"/></svg>
            <span>${t('login.needHelp', 'Need Help? Contact IT Department')}</span>
          </div>
          <a class="lg-support-phone" href="${lgTelHref(brand.p)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>
            <span>${escapeHtml(brand.p || '')}</span>
          </a>
        </div>

        <div class="lg-divider"></div>
        <div class="lg-powered">
          <svg class="lg-powered-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <span class="lg-powered-txt">${t('login.poweredBy', 'Powered by:')}</span>
          <img class="lg-powered-badge" src="assets/img/celinesoft-badge.png" alt="" />
          <span class="lg-powered-name">${escapeHtml(brand.n || 'CelineSoft')}</span>
        </div>
      </div>

      ${bandItems.length ? `
      <div class="lg-mobile-band">
        ${bandItems.join('')}
      </div>` : ''}
    </section>
  </div>`;

  const appEl = $('#app');
  appEl.innerHTML = html;
  appEl.classList.add('lg-mounted');

  /* ---- password visibility ---- */
  const passEl = $('#lgPass');
  const eyeEl = $('#lgEye');
  if (eyeEl && passEl) {
    eyeEl.onclick = () => {
      const show = passEl.type === 'password';
      passEl.type = show ? 'text' : 'password';
      eyeEl.classList.toggle('is-on', show);
      eyeEl.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    };
  }

  $('#forgotBtn').onclick = () => { if (typeof openForgotPassword === 'function') openForgotPassword(); };

  if ($('#loginSyncBtn')) {
    $('#loginSyncBtn').onclick = async (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      const label = btn.querySelector('span');
      const original = label ? label.textContent : '';
      if (label) label.textContent = 'Syncing...';
      btn.disabled = true;
      try {
        await CLOUD.init();
        await CLOUD.pullAndMerge();
        CLOUD._initialMergeDone = true;
        toast('✅ Cloud Sync Complete! You can now log in.', 'success');
      } catch (err) {
        toast('Sync Error: ' + err.message, 'error');
      }
      if (label) label.textContent = original;
      btn.disabled = false;
    };
  }

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');

    let u = DB.login(f.get('username').trim(), f.get('password'));

    // If login fails, check if Cloud Sync is still initializing. If so, wait for it!
    if (!u && typeof CLOUD !== 'undefined' && CLOUD.isEnabled() && CLOUD.isReady() && !CLOUD._initialMergeDone) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '⏳ Syncing cloud data...';
      btn.disabled = true;
      try {
        await CLOUD.init();
        await CLOUD.pullAndMerge();
        CLOUD._initialMergeDone = true;
      } catch (err) {}
      btn.innerHTML = origHtml;
      btn.disabled = false;
      u = DB.login(f.get('username').trim(), f.get('password'));
    }

    if (!u) { toast(t('login.invalid') || 'Invalid username or password', 'error'); return; }
    toast(`Welcome, ${u.name}!`, 'success');

    // Branded boot screen while the workspace loads.
    // The page itself mounts first (behind the overlay), then the boot
    // screen fades out once its animation has had time to play.
    const target = u.role === 'admin' ? 'dashboard' : 'pos';
    const BOOT_MS = 1500;      // how long the animation is visible
    const MOUNT_DELAY = 260;   // let the boot screen paint before mounting

    if (window.BOOT) {
      BOOT.show({ min: BOOT_MS, status: `Signing in as ${u.name || u.username}` });
    }

    setTimeout(() => {
      app.go(target);
      if (window.BOOT) BOOT.hide();   // hide respects the minimum duration
    }, MOUNT_DELAY);
  };
}
