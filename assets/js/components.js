/* ============================================================
   Shared layout & component renderers
   ============================================================ */

function renderLayout(activePage, contentHtml) {
  const user = DB.currentUser();
  const s = DB.settings();
  const greet = getGreeting();

  const allNavItems = [
    { id:'dashboard', icon:'📊', label:t('nav.dashboard') },
    { id:'taskboard', icon:'📋', label:'Task Board' },
    { id:'pos',       icon:'🛒', label:t('nav.pos') },
    { id:'orders',    icon:'📦', label:t('nav.orders') },
    { id:'customers', icon:'👤', label:t('nav.customers') },
    { id:'ledger',    icon:'💰', label:t('nav.ledger') },
    { id:'products',  icon:'🧺', label:t('nav.products') },
    { id:'expenses',  icon:'💸', label:t('nav.expenses'), children:[
        { tab:'list', icon:'📋', label:'List Expenses' },
        { tab:'add',  icon:'➕', label:'Add Expense' },
        { tab:'cats', icon:'📂', label:'Expense Category' },
      ] },
    { id:'reports',   icon:'📈', label:t('nav.reports') },
    { id:'inventory', icon:'📦', label:t('nav.inventory') },
    { id:'cashbook',  icon:'💵', label:t('nav.cashbook') },
    { id:'drawings',  icon:'👤', label:'Owner Drawings' },
    { id:'auditLog',  icon:'🔐', label:t('nav.auditLog') },
    { id:'vendors',   icon:'🏭', label:t('nav.vendors') },
    { id:'branches',  icon:'🏢', label:'Branches' },
    { id:'inbox',     icon:'📨', label:'Customer Inbox' },
    { id:'claims',    icon:'🛡️', label:'Claims' },
    { id:'delivery',  icon:'🚚', label:'Pickup & Delivery' },
    { id:'reportBuilder', icon:'📈', label:'Report Builder' },
    { id:'promoAdmin',icon:'🎁', label:'Promo Codes' },
    { id:'marketing', icon:'📢', label:'Marketing Studio' },
    { id:'purchaseOrders', icon:'📑', label:t('nav.purchaseOrders') },
    { id:'users',     icon:'👥', label:t('nav.users') },
    { id:'settings',  icon:'⚙️', label:t('nav.settings') },
  ];
  // Admin-only pages (cashier never sees these)
  const adminOnlyPages = ['users','settings'];
  // Filter based on user role + permissions
    const nav = allNavItems.filter(n => {
    const itOwnerNav = (typeof currentUserIsITOwner === 'function') && currentUserIsITOwner();
    if (!itOwnerNav && typeof isAppExpired === 'function' && isAppExpired() && n.id === 'pos') return false;
    if (user.role === 'admin') return true;
    if (adminOnlyPages.includes(n.id)) return false;
    return (typeof hasPermission === 'function') ? hasPermission(n.id) : ['pos','orders','customers'].includes(n.id);
  });

  const navHtml = nav.map(n => {
    const kids = (n.children && activePage === n.id)
      ? `<div class="nav-subgroup">${n.children.map(c => {
          const tabNow = (typeof expTab !== 'undefined') ? expTab : 'list';
          return `<div class="nav-sub ${tabNow === c.tab ? 'is-active' : ''}" data-exp-tab="${c.tab}">
            <span class="icon">${c.icon}</span> <span>${escapeHtml(c.label)}</span>
          </div>`;
        }).join('')}</div>`
      : '';
    return `
    <div class="nav-item ${activePage===n.id?'active':''}" data-page="${n.id}" data-tooltip="${escapeHtml(n.label)}">
      <span class="icon">${n.icon}</span> <span>${escapeHtml(n.label)}</span>
    </div>
    ${kids}`;
  }).join('');

  // Backup reminder logic (show on dashboard when admin and last backup is > 1 day ago)
  let bannerHtml = '';
  if (user.role === 'admin' && s.autoBackupReminder !== false && activePage === 'dashboard') {
    const last = localStorage.getItem('mrLaundryLastBackup');
    const ordersCount = DB.all('orders').length;
    const isStale = !last || (Date.now() - new Date(last).getTime()) > 24*60*60*1000;
    if (isStale && ordersCount > 0) {
      bannerHtml = `
        <div class="backup-banner">
          <div>⚠️ <b>Backup Reminder:</b> Your data lives in this browser. ${last ? 'Last backup was ' + new Date(last).toLocaleDateString() + '.' : 'You haven\u2019t backed up yet!'} Please download a backup now to keep your data safe.</div>
          <button onclick="doBackup()">📥 Backup Now</button>
        </div>
      `;
    }
  }


  /* IT Owner support session — always visible, impossible to miss. */
  let itOwnerBanner = '';
  const itOwnerCfg = (typeof itOwnerConfig === 'function') ? itOwnerConfig() : null;
  if (user && user.isITOwner && (!itOwnerCfg || itOwnerCfg.showBanner !== false)) {
    itOwnerBanner = `
      <div id="itOwnerBanner" style="background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff;padding:7px 15px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12.5px;font-weight:700;z-index:99998;">
        <div>🛠️ <b>IT OWNER SUPPORT SESSION</b> — signed in as ${escapeHtml(user.username)} • full admin rights • every action is audit-logged</div>
        <button type="button" onclick="DB.logout();app.go('login')" style="background:#fff;color:#4f46e5;border:none;padding:5px 12px;border-radius:6px;font-weight:800;cursor:pointer;">Exit IT session</button>
      </div>`;
  }

  let expiryBanner = '';
  if (typeof isAppExpired === 'function' && isAppExpired() && activePage !== 'login') {
    const cName = window._IT_BRAND.n;
    const cPhone = window._IT_BRAND.p;
    expiryBanner = `<div style="background:#ef4444;color:#fff;padding:8px 15px;text-align:center;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;align-items:center;z-index:99999;">
      <div>⚠️ Subscription Expired (Read-Only Mode). Contact ${cName} (${cPhone}) to renew.</div>
      <button onclick="if(typeof openExtensionModal==='function') openExtensionModal()" style="background:#fff;color:#ef4444;border:none;padding:5px 12px;border-radius:4px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);">🔑 Enter Code</button>
    </div>`;
  }

  return `
    ${itOwnerBanner}
    ${expiryBanner}
    <div class="layout ${document.body.classList.contains('sidebar-open') ? 'sidebar-open' : ''}">
      <aside class="sidebar">
        <div class="brand">
          ${brandLogoHTML(88)}
          <div>
            <div class="name">${escapeHtml(s.shopName)}</div>
            <div class="sub">${escapeHtml(s.tagline || 'POS System')}</div>
          </div>
        </div>
        <div class="nav-section">Main Menu</div>
        ${navHtml}
        <div class="nav-section" style="margin-top:18px">Account</div>
        <div class="nav-item" data-action="contactIT" title="Contact IT Department" style="color:#3b82f6;">
          <span class="icon">☎️</span> <span>Contact IT</span>
        </div>
        ${!user.isITOwner ? `<div class="nav-item" data-action="changePass" title="Change your password">
          <span class="icon">🔐</span> <span>Change Password</span>
        </div>` : ''}
        <div class="nav-item" data-action="logout">
          <span class="icon">🚪</span> <span>${t('nav.logout')}</span>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <button id="mobileMenuBtn" title="Menu">☰</button>
          <div class="greeting">
            <div class="hello">${greet.emoji} ${greet.text}, ${escapeHtml(user.name.split(' ')[0])}!</div>
            <div class="sub">${t('greet.welcome')} ${escapeHtml(s.shopName)} — ${t('greet.productive')} 💪</div>
          </div>
          <div class="actions">
            <button class="icon-btn" id="notifBell" title="Notifications">🔔</button>
            ${user.role==='admin' ? `<button class="icon-btn" id="backupBtn" title="Quick Backup">💾</button>` : ''}
            <button class="icon-btn" id="langToggle" title="Change language / زبان">🌐</button>
            <button class="icon-btn" id="shortcutsBtn" title="Keyboard shortcuts (?)">⌨️</button>
            <button class="icon-btn" id="searchBtn" title="Global Search (Ctrl+K)">🔍</button>
            <button class="icon-btn" id="themeToggle" title="Toggle theme">🌙</button>
            ${(typeof hasPermission === 'function' && hasPermission('pos')) ? `<button class="icon-btn" data-page="pos" title="New Sale">➕</button>` : ''}
            ${(typeof getActiveBranchName === 'function' && DB.all('branches').length > 1) ? `
              <div class="branch-chip" id="branchChip" title="Click to switch branch" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--primary-light);border-radius:30px;border:1px solid var(--primary);font-weight:700;font-size:12px;color:var(--primary);cursor:pointer;">
                🏢 ${escapeHtml(getActiveBranchName())}
              </div>
            ` : ''}
            ${(typeof CLOUD !== 'undefined' && CLOUD.isEnabled() && CLOUD.isReady()) ? '<button class="icon-btn" id="forceSyncBtn" title="Force Cloud Sync" style="color:var(--success);font-weight:bold;">☁️</button>' : ''}
            <div class="user-chip">
              <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
              <div>
                <div class="uname">${escapeHtml(user.name)}</div>
                <div class="urole">${user.role}</div>
              </div>
            </div>
          </div>
        </header>

        <div class="page" id="pageContent">
          ${bannerHtml}
          ${contentHtml}
        </div>
      </main>
    </div>
  `;
}

function bindLayout() {
  $$('.nav-item[data-page]').forEach(n => n.onclick = () => app.go(n.dataset.page));
  $$('.nav-sub[data-exp-tab]').forEach(n => n.onclick = (ev) => {
    ev.stopPropagation();
    if (typeof expTab !== 'undefined') expTab = n.dataset.expTab;
    app.go('expenses');
  });
  $$('[data-page]').forEach(n => n.onclick = () => app.go(n.dataset.page));
  $$('[data-action="changePass"]').forEach(n => n.onclick = () => {
    if (typeof openChangeMyPassword === 'function') openChangeMyPassword();
  });
  const contactBtn = document.querySelector('[data-action="contactIT"]');
  if (contactBtn) contactBtn.onclick = () => {
    const cName = window._IT_BRAND.n;
    const cPhone = window._IT_BRAND.p;
    const cEmail = window._IT_BRAND.e;
    const cTagline = window._IT_BRAND.t;
    openModal(`
      <div style="text-align:center;">
        <h3 style="margin-bottom:5px;">☎️ Contact IT Department</h3>
        <p style="font-size:13px; color:#64748b;">If you need assistance, please contact the IT Desk:</p>
      </div>
      <div style="background:#f1f5f9;padding:20px;border-radius:8px;margin-top:15px;text-align:center;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);">
        <div style="display:flex; align-items:center; justify-content:center; margin-bottom:5px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f7cff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          <span style="font-weight:900; font-size:22px; color:#0f172a; letter-spacing:0.5px;">CelineSoft</span>
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:20px;font-weight:600;">${cTagline}</div>
        
        <div style="background:#fff; border-radius:6px; padding:12px; border:1px solid #cbd5e1; text-align:left; font-size:14px; line-height:1.8;">
          <b>📞 Phone:</b> ${cPhone}<br>
          <b>✉️ Email:</b> ${cEmail}
        </div>
      </div>
      <div class="modal-footer" style="margin-top:20px; justify-content:center;">
        <button class="btn btn-primary" onclick="closeModal()" style="padding:10px 30px;">Close</button>
      </div>
    `);
  };
  $$('[data-action="logout"]').forEach(n => n.onclick = () => {
    if (typeof attemptLogout === 'function') attemptLogout(); else { DB.logout(); app.go('login'); }
  });

  const langBtn = $('#langToggle');
  if (langBtn) {
    langBtn.textContent = I18N.isUrdu() ? '🇬🇧' : '🌐';
    langBtn.title = I18N.isUrdu() ? 'Switch to English' : 'Roman Urdu mein tabdeel karein';
    langBtn.onclick = openLanguagePicker;
  }
  const shortcutsBtn = $('#shortcutsBtn');
  if (shortcutsBtn) shortcutsBtn.onclick = openShortcutsHelp;
  const searchBtn = $('#searchBtn');
  if (searchBtn) searchBtn.onclick = openGlobalSearch;
  // Mobile hamburger
  const mobMenu = $('#mobileMenuBtn');
  if (mobMenu) {
    mobMenu.onclick = (e) => {
      e.stopPropagation();
      document.body.classList.toggle('sidebar-open');
    };
  }
  // Close sidebar when nav item clicked (mobile)
  $$('.nav-item').forEach(n => n.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  }));
  // Click outside sidebar to close
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('sidebar-open')
        && !e.target.closest('.sidebar')
        && !e.target.closest('#mobileMenuBtn')) {
      document.body.classList.remove('sidebar-open');
    }
  });

  // Show low-stock badge on Inventory nav
  if (typeof getLowStockItems === 'function') {
    const lowCount = getLowStockItems().length;
    if (lowCount > 0) {
      const invNav = document.querySelector('.nav-item[data-page="inventory"]');
      if (invNav && !invNav.querySelector('.low-badge')) {
        const badge = document.createElement('span');
        badge.className = 'low-badge';
        badge.style.cssText = 'background:#ef4444;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:auto;animation:pulse-warn 1.5s ease infinite;';
        badge.textContent = lowCount;
        invNav.appendChild(badge);
      }
    }
  }

  // Notification bell
  const bell = $('#notifBell');
  if (bell) bell.onclick = () => openNotificationsPanel();

  const branchChip = $('#branchChip');
  if (branchChip) branchChip.onclick = () => { if (typeof openBranchSwitcher === 'function') openBranchSwitcher(); };
  const backupBtn = $('#backupBtn');
  if (backupBtn) backupBtn.onclick = doBackup;

  const themeBtn = $('#themeToggle');
  if (themeBtn) {
    const saved = localStorage.getItem('mrLaundryTheme') || 'light';
    document.documentElement.dataset.theme = saved;
    themeBtn.textContent = saved === 'dark' ? '☀️' : '🌙';
    themeBtn.onclick = () => {
      const cur = document.documentElement.dataset.theme || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('mrLaundryTheme', next);
      themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
    };
  }
}
