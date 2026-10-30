/* ============================================================
   App router with permission-based access
   ============================================================ */
const app = {
  current: 'login',
  go(page) {
    const user0 = (typeof DB !== 'undefined' && DB.currentUser) ? DB.currentUser() : null;
    const tStart = performance.now();
    const basePage = String(page || '').split('?')[0];
    // Only wrappers that actually navigate (not the login screen) get timed.
    const timed = !!user0 && basePage !== 'login';

    // Pre-emptively show the compact brand loader ONLY for pages that have
    // historically been slow on this device. Fast pages are never interrupted.
    if (timed && window.BOOT && typeof BOOT.pageIsSlow === 'function' && BOOT.pageIsSlow(basePage)) {
      BOOT.quick({ status: BOOT.pageLabel(basePage), min: 420 });
    }

    try {
      return this._go(page);
    } finally {
      if (timed) {
        const ms = performance.now() - tStart;
        if (window.BOOT && typeof BOOT.pageMeasured === 'function') BOOT.pageMeasured(basePage, ms);
        if (window.BOOT && BOOT.quickHide) BOOT.quickHide(420);
      }
    }
  },

  _go(page) {
    console.log('Router: app.go called with page =', page);
    const user = DB.currentUser();
    if (page !== 'login' && !user) { this.current = 'login'; renderLogin(); return; }

    // Support "page?param=value" routing
    let param = null;
    if (page && page.includes('?')) {
      const [p, qs] = page.split('?');
      page = p;
      param = Object.fromEntries(new URLSearchParams(qs));
    }

    // Admin-only pages (no override possible)
    const adminOnly = ['users','settings','inbox','promoAdmin','marketing','delivery','reportBuilder','refundLog'];

    if (page !== 'login' && user.role !== 'admin') {
      if (adminOnly.includes(page)) {
        toast('Admin access only', 'error');
        // Redirect to first allowed page
        const allowed = (typeof getUserPermissions === 'function') ? getUserPermissions(user) : ['pos'];
        page = allowed[0] || 'pos';
      } else if (typeof hasPermission === 'function' && !hasPermission(page)) {
        toast('You don\u2019t have permission for this page. Contact admin.', 'error');
        const allowed = getUserPermissions(user);
        page = allowed[0] || 'pos';
      }
    }

    
    if (typeof isAppExpired === 'function' && isAppExpired()) {
      const blocked = ['pos'];
      if (blocked.includes(page)) {
        toast('Subscription Expired. Read-only mode active.', 'error');
        if (!this.current || this.current === 'login') page = 'dashboard';
        else return;
      }
    }
    
    this.current = page;
        try {
      switch(page) {
        case 'login':           return renderLogin();
        case 'dashboard':       return renderDashboard();
        case 'taskboard':       return renderTaskBoard();
        case 'pos':             return renderPOS();
        case 'orders':          return renderOrders();
        case 'customers':       return renderCustomers();
        case 'products':        return renderProducts();
        case 'expenses':        return renderExpenses();
        case 'reports':         return renderReports();
        case 'users':           return renderUsers();
        case 'settings':        return renderSettings();
        case 'vendors':         return renderVendors();
        case 'purchaseOrders':  return renderPurchaseOrders(param?.vendor);
        case 'ledger':          return renderLedger();
        case 'inventory':       return renderInventory();
        case 'cashbook':        return renderCashbook();
        case 'auditLog':        return renderAuditLog();
        case 'branches':        return renderBranches();
        case 'inbox':           return renderInbox();
        case 'promoAdmin':      return renderPromoAdmin();
        case 'marketing':       return renderMarketing();
        case 'claims':          return renderClaims();
        case 'delivery':        return renderDelivery();
        case 'drawings':        return renderDrawings();
        case 'reportBuilder':   return renderReportBuilder();
        default:                return renderDashboard();
      }
    } catch(err) {
      console.error('Routing error:', err);
      alert('Error loading page: ' + err.message);
    }

  }
};

// Boot



// Boot
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('mrLaundryTheme') || 'light';
  document.documentElement.dataset.theme = saved;

  const u = DB.currentUser();
  if (typeof initShortcuts === 'function') initShortcuts();

  // Pre-render the thermal invoice logo so printing is instant
  if (window.THERMAL) { try { THERMAL.prime(); } catch (e) {} }
  if (u && window.BOOT) {
    // returning user — show the brand boot while the workspace mounts
    BOOT.show({ min: 1200, status: 'Restoring your session' });
    setTimeout(() => { if (window.BOOT) BOOT.hide(); }, 120);
  }
  if (u) {
    // Land on first allowed page
    if (u.role === 'admin') {
      app.go('dashboard');
    } else {
      const allowed = (typeof getUserPermissions === 'function') ? getUserPermissions(u) : ['pos'];
      // Prefer dashboard > pos > first allowed
      if (allowed.includes('dashboard')) app.go('dashboard');
      else if (allowed.includes('pos')) app.go('pos');
      else app.go(allowed[0] || 'pos');
    }
  } else {
    app.go('login');
  }
});

/* TRIAL & SUBSCRIPTION MANAGEMENT */
const IT_ADMIN_PASSWORD = window._IT_BRAND.pwd;

function initTrialCheck() {
  let s = DB.settings();
  if (!s.trialStartDate) {
    s.trialStartDate = Date.now();
    // Default 15 days
    let tDays = typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.trialDays : 15;
    s.subscriptionExpiry = s.trialStartDate + (tDays * 24 * 60 * 60 * 1000);
    DB.saveSettings(s);
  }
  
  checkExpiry(true);
  
  // Periodically check expiry every hour
  setInterval(() => checkExpiry(false), 60 * 60 * 1000);
}


function checkExpiry(onLoad) {
  let s = DB.settings();
  if (s.lifetimeLicense === true) return;
  const expiry = Number(s.subscriptionExpiry) || 0;
  if (!expiry) {                       // no licence at all → expired, not unlimited
    if (app.current === 'pos') app.go('dashboard');
    return;
  }
  
  let now = Date.now();
  let timeDiff = s.subscriptionExpiry - now;
  let daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  if (timeDiff <= 0) {
    if (app.current === 'pos') app.go('dashboard');
  } else if (daysLeft <= 7 && onLoad) {
    setTimeout(() => {
      openModal(`
        <h3 style="color:#b91c1c;">⚠️ Subscription Expiring Soon</h3>
        <p>Your POS subscription will expire in <b>${daysLeft} days</b>.</p>
        <p>Please contact <b>${window._IT_BRAND.n}</b> and pay your maintenance fees to continue using the software uninterrupted.</p>
        <div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Dismiss</button></div>
      `);
    }, 2000);
  }
}

function openExtensionModal() {
  app.go('settings');
  setTimeout(() => {
    if(document.getElementById('openSubBtnTop')) document.getElementById('openSubBtnTop').click();
  }, 300);
}

initTrialCheck();

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1);
  if (hash && hash !== app.current) {
    app.go(hash);
  }
});
