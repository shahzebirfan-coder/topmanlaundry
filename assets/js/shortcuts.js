/* ============================================================
   Keyboard Shortcuts + Global Search (Ctrl+K)
   ============================================================ */

const SHORTCUTS = [
  { key: 'F2',  label: 'New Sale (POS)',     page: 'pos' },
  { key: 'F3',  label: 'Search Orders',      page: 'orders' },
  { key: 'F4',  label: 'Customers',          page: 'customers' },
  { key: 'F5',  label: 'Print Last Invoice', action: 'printLast' },
  { key: 'F6',  label: 'Dashboard',          page: 'dashboard' },
  { key: 'F7',  label: 'Quick Receive Payment', action: 'quickPay' },
  { key: 'F8',  label: 'Payment Ledger',     page: 'ledger', adminOnly: true },
  { key: 'F9',  label: 'Inventory',          page: 'inventory', adminOnly: true },
  { key: 'F10', label: 'Cash Book',          page: 'cashbook', adminOnly: true },
  { key: 'Esc', label: 'Close any dialog',   action: 'closeModal' }
];

function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K → global search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearch();
      return;
    }

    // Don't intercept when typing in inputs (except F-keys & Esc)
    const inField = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
    const isFnKey = /^F\d+$/.test(e.key);
    if (inField && !isFnKey && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      // utils.js already handles Esc in the capture phase (with the unsaved-data
      // guard). This is only a fallback for exotic focus situations.
      if (document.querySelector('.modal-backdrop')) {
        e.preventDefault();
        if (typeof attemptCloseModal === 'function') attemptCloseModal();
      }
      return;
    }

    const sc = SHORTCUTS.find(s => s.key === e.key);
    if (!sc) return;
    const user = DB.currentUser();
    if (!user) return;
    if (sc.adminOnly && user.role !== 'admin') return;

    e.preventDefault();
    if (sc.action === 'printLast') {
      const orders = DB.all('orders').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      if (orders[0]) openInvoice(orders[0].id, true);
      else toast('No orders to print','warning');
    } else if (sc.action === 'quickPay') {
      if (typeof openQuickPay === 'function') openQuickPay();
    } else if (sc.action === 'closeModal') {
      closeModal();
    } else if (sc.page) {
      app.go(sc.page);
    }
  });
}

function openShortcutsHelp() {
  const role = DB.currentUser()?.role || 'cashier';
  const visible = SHORTCUTS.filter(s => !s.adminOnly || role === 'admin');
  openModal(`
    <h3>⌨️ Keyboard Shortcuts</h3>
    <p class="sub">Speed up your work with these shortcuts.</p>
    <table class="tbl">
      <thead><tr><th style="width:120px;">Key</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td><kbd style="background:var(--surface-alt);padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-family:monospace;font-weight:700;">Ctrl + K</kbd></td><td>🔍 Global search (orders, customers, invoices)</td></tr>
        ${visible.map(s => `<tr><td><kbd style="background:var(--surface-alt);padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-family:monospace;font-weight:700;">${s.key}</kbd></td><td>${escapeHtml(s.label)}</td></tr>`).join('')}
      </tbody>
    </table>
    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:12px;margin-top:14px;color:var(--text-soft);">
      💡 Press <b>?</b> anytime to open this help.
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" onclick="closeModal()">Got it</button>
    </div>
  `);
}

/* ============================================================
   Global Search (Ctrl + K)
   ============================================================ */
function openGlobalSearch() {
  openModal(`
    <h3>🔍 Global Search</h3>
    <p class="sub">Search across orders, customers, products, and invoices.</p>
    <input id="gsInput" placeholder="Type to search... (invoice #, customer name, phone, product...)" autofocus
      style="width:100%;padding:14px 16px;font-size:15px;border:2px solid var(--primary);border-radius:10px;margin-bottom:14px;"/>
    <div id="gsResults" style="max-height:50vh;overflow-y:auto;"></div>
    <div style="font-size:11px;color:var(--text-soft);margin-top:10px;text-align:center;">
      Use ↑↓ arrows • Enter to open • Esc to close
    </div>
  `, { large: true, onOpen(m){
    const input = $('#gsInput', m);
    let results = [];
    let selected = 0;

    const doSearch = (q) => {
      results = [];
      if (!q || q.length < 1) { renderResults(); return; }
      const ql = q.toLowerCase();

      // Orders
      DB.all('orders').forEach(o => {
        const inv = (o.invoiceNo ? 'inv-'+o.invoiceNo : o.id.slice(-6)).toLowerCase();
        const c = DB.get('customers', o.customerId) || {};
        const matchInv = inv.includes(ql);
        const matchCust = (c.name||'').toLowerCase().includes(ql) || (c.phone||'').includes(q);
        if (matchInv || matchCust) {
          results.push({
            type: 'order',
            icon: '🧾',
            title: `INV-${o.invoiceNo||o.id.slice(-6).toUpperCase()} — ${c.name||'Walk-in'}`,
            subtitle: `${o.items.length} items • ${fmtMoney(o.total)} • ${o.status} • ${fmtDateShort(o.createdAt)}`,
            action: () => { closeModal(); openInvoice(o.id); }
          });
        }
      });

      // Customers
      DB.all('customers').forEach(c => {
        if (c.id === 'cu1') return;
        const m = (c.name||'').toLowerCase().includes(ql)
               || (c.phone||'').includes(q)
               || (c.loyaltyNo||'').toLowerCase().includes(ql);
        if (m) {
          results.push({
            type: 'customer',
            icon: '👤',
            title: c.name,
            subtitle: `📞 ${c.phone||'-'} ${c.loyaltyActive?`• ⭐ ${c.loyaltyNo}`:''}`,
            action: () => { closeModal(); if (DB.currentUser().role==='admin') openCustomerLedger(c.id); else openCustomerHistory(c.id); }
          });
        }
      });

      // Products
      DB.all('products').forEach(p => {
        if (p.name.toLowerCase().includes(ql)) {
          results.push({
            type: 'product',
            icon: p.image || '🧺',
            title: p.name,
            subtitle: `${fmtMoney(p.price)} • ${(DB.get('categories', p.category)||{}).name||''}`,
            action: () => { closeModal(); app.go('pos'); setTimeout(()=>{ if(typeof addToCart==='function') addToCart(p.id); }, 200); }
          });
        }
      });

      // Vendors
      DB.all('vendors').forEach(v => {
        if ((v.name||'').toLowerCase().includes(ql) || (v.phone||'').includes(q)) {
          results.push({
            type: 'vendor',
            icon: '🏭',
            title: v.name,
            subtitle: `📞 ${v.phone||'-'}`,
            action: () => { closeModal(); app.go('purchaseOrders?vendor='+v.id); }
          });
        }
      });

      results = results.slice(0, 30);
      selected = 0;
      renderResults();
    };

    const renderResults = () => {
      if (!results.length) {
        $('#gsResults', m).innerHTML = input.value ? `<div class="empty"><div class="emoji">🔍</div><p>No results found</p></div>` : `<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:13px;">Start typing to search...</div>`;
        return;
      }
      $('#gsResults', m).innerHTML = results.map((r, i) => `
        <div class="gs-row" data-i="${i}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;${i===selected?'background:var(--primary-light);':''}">
          <div style="font-size:24px;">${r.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;">${escapeHtml(r.title)}</div>
            <div style="font-size:12px;color:var(--text-soft);">${escapeHtml(r.subtitle)}</div>
          </div>
          <div style="font-size:10px;color:var(--text-soft);text-transform:uppercase;padding:2px 8px;background:var(--surface-alt);border-radius:10px;">${r.type}</div>
        </div>
      `).join('');
      $$('.gs-row', m).forEach(row => row.onclick = () => results[+row.dataset.i].action());
    };

    input.oninput = (e) => doSearch(e.target.value);
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { selected = Math.min(results.length-1, selected+1); renderResults(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { selected = Math.max(0, selected-1); renderResults(); e.preventDefault(); }
      else if (e.key === 'Enter' && results[selected]) { results[selected].action(); }
    };
    renderResults();
  }});
}
