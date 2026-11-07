/* ===================== DASHBOARD ===================== */
function renderDashboard() {
  const orders = DB.all('orders');
  const customers = DB.all('customers');
  const expenses = DB.all('expenses');
  const today = isoDay();
  const monthKey = today.slice(0,7);

  // === TODAY ===
  const todayOrders   = orders.filter(o => o.createdAt.slice(0,10) === today);
  const todayInvoice  = todayOrders.reduce((s,o)=> s + (o.total||0), 0); // Total invoiced amount (revenue billed)
  const todayDue      = todayOrders.reduce((s,o)=> s + (o.due  ||0), 0);

  // === TODAY'S PAYMENTS (from paymentsLog across ALL orders, not just today's) ===
  // This catches old invoices where customer paid TODAY
  const todayPayments = [];
  for (const o of orders) {
    if (!Array.isArray(o.paymentsLog)) continue;
    for (const p of o.paymentsLog) {
      if ((p.at||'').slice(0,10) === today) {
        todayPayments.push({ ...p, orderId: o.id, invoiceNo: o.invoiceNo, customerId: o.customerId, orderTotal: o.total });
      }
    }
  }
  // Also count first-payment-at-creation for legacy orders (no paymentsLog yet)
  for (const o of todayOrders) {
    const logged = Array.isArray(o.paymentsLog) ? o.paymentsLog.reduce((s,p)=>s+(p.amount||0),0) : 0;
    const firstPay = (o.paid||0) - logged;
    if (firstPay > 0) {
      todayPayments.push({
        id: 'init_' + o.id,
        amount: firstPay,
        method: o.paymentMethod || 'cash',
        note: 'Initial payment at booking',
        at: o.createdAt,
        by: o.cashierUsername || o.createdBy || 'unknown',
        byName: o.cashierName || '',
        orderId: o.id, invoiceNo: o.invoiceNo, customerId: o.customerId, orderTotal: o.total
      });
    }
  }
  todayPayments.sort((a,b)=> (b.at||'').localeCompare(a.at||''));
  const todayReceived = todayPayments.reduce((s,p)=> s+(p.amount||0), 0);
  const todayExp      = expenses.filter(e => e.date === today).reduce((s,e)=> s + (e.amount||0), 0);
  const todayProfit   = todayReceived - todayExp;       // cash-basis profit (received minus expenses)
  const todaySales    = todayOrders.length;

  // === MONTH ===
  const monthOrders  = orders.filter(o => o.createdAt.slice(0,7) === monthKey);
  const monthInvoice = monthOrders.reduce((s,o)=> s + (o.total||0), 0);
  const monthReceived= monthOrders.reduce((s,o)=> s + (o.paid ||0), 0);
  const monthExp     = expenses.filter(e => (e.date||'').slice(0,7) === monthKey).reduce((s,e)=>s+(e.amount||0),0);
  const monthProfit  = monthReceived - monthExp;

  // === PIPELINE ===
    const pending = orders.filter(o => ['pending','washing','press'].includes(o.status)).length;
  const ready = orders.filter(o => o.status === 'ready').length;
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  
  const overdueOrders = orders.filter(o => o.status === 'ready' && (o.createdAt || '').slice(0, 10) < cutoffStr);
  overdueOrders.sort((a,b) => a.createdAt.localeCompare(b.createdAt));


  // === LAST 7 DAYS CHART ===
  const last7 = [];
  for (let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const k=isoDay(d);
    const sum = orders.filter(o=>o.createdAt.slice(0,10)===k).reduce((s,o)=>s+(o.total||0),0);
    last7.push({label: d.toLocaleDateString('en',{weekday:'short'}), value: sum, date:k});
  }
  const maxVal = Math.max(1, ...last7.map(d=>d.value));
  const chartEmpty = last7.every(d => !d.value);
  const chartBars = chartEmpty
    ? `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:34px 10px;color:var(--text-soft);">
         <div style="font-size:34px;opacity:.7;">📉</div>
         <div style="font-weight:700;font-size:14px;">No sales in the last 7 days</div>
         <div style="font-size:12.5px;">Start a new sale and your revenue trend will appear here.</div>
       </div>`
    : last7.map(d => `
    <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
      <div style="display:flex;flex-direction:column;justify-content:flex-end;height:140px;width:100%;padding:0 6px;">
        <div title="${fmtMoney(d.value)}" style="background:linear-gradient(180deg,#4f7cff,#6a5cff);height:${(d.value/maxVal)*100}%;min-height:4px;border-radius:6px 6px 0 0;"></div>
      </div>
      <div style="font-size:11px;color:var(--text-soft);margin-top:6px;">${d.label}</div>
      <div style="font-size:11px;font-weight:700;">${d.value? fmtMoney(d.value):'—'}</div>
    </div>
  `).join('');

  const recentOrders = [...orders].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,8);
  const recentRows = recentOrders.length ? recentOrders.map(o => {
    const c = DB.get('customers', o.customerId) || { name: 'Walk-in' };
    return `<tr>
      <td><b>#${o.id.slice(-6).toUpperCase()}</b></td>
      <td>${escapeHtml(c.name)}</td>
      <td>${o.items.length} items</td>
      <td><span class="badge ${o.status}">${o.status}</span></td>
      <td><b>${fmtMoney(o.total)}</b></td>
      <td>${fmtDate(o.createdAt)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" class="empty"><div class="emoji">📦</div><h4>No orders yet</h4><p>Make your first sale to see it here.</p></td></tr>`;

  const content = `
    <h1 class="page-title">📊 Dashboard — Today's Snapshot</h1>
    ${(() => {
      const s = DB.settings();
      const u = DB.currentUser();
      if (u && u.role === 'admin' && !s.masterRecoveryCode) {
        return `<div onclick="app.go('settings')" style="background:linear-gradient(135deg,#fee2e2,#fef3c7);border:2px solid #f59e0b;color:#78350f;padding:14px 18px;border-radius:12px;margin-bottom:18px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:250px;">
            <div style="font-weight:800;font-size:15px;margin-bottom:4px;">🔑 Set Up Master Recovery Code (Important!)</div>
            <div style="font-size:13px;">If you forget your password, this code lets you reset it. Click to set up in Settings → Master Recovery Code.</div>
          </div>
          <button class="btn btn-warning" style="background:#f59e0b;color:#fff;border:none;font-weight:700;">Set Up Now →</button>
        </div>`;
      }
      return '';
    })()}
    <p class="page-sub">${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>

    ${(() => {
      if (typeof getLowStockItems !== 'function') return '';
      const lowItems = getLowStockItems();
      if (!lowItems.length) return '';
      const outItems = lowItems.filter(i => (i.stock||0) === 0);
      const lowOnly = lowItems.filter(i => (i.stock||0) > 0);
      const isCritical = outItems.length > 0;
      const bgColor = isCritical ? '#fee2e2' : '#fef3c7';
      const borderColor = isCritical ? '#ef4444' : '#f59e0b';
      const textColor = isCritical ? '#991b1b' : '#92400e';
      const icon = isCritical ? '🚨' : '⚠️';
      const title = isCritical ? 'OUT OF STOCK!' : 'LOW STOCK ALERT';
      const itemsList = lowItems.map(i => `<b>${escapeHtml(i.name)}</b> (${i.stock} ${i.unit||'pcs'} left, min ${i.minStock})`).join(', ');
      return `<div style="background:${bgColor};border:2px solid ${borderColor};color:${textColor};padding:14px 18px;border-radius:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;animation:${isCritical?'pulse-warn 1.5s ease infinite':'none'};">
        <div style="flex:1;min-width:250px;">
          <div style="font-weight:800;font-size:15px;margin-bottom:4px;">${icon} ${title}</div>
          <div style="font-size:13px;">${itemsList}</div>
          <div style="font-size:12px;margin-top:6px;opacity:.85;">Order more supplies before you run out!</div>
        </div>
        <button onclick="app.go('inventory')" style="background:${borderColor};color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">📦 Manage Inventory</button>
      </div>
      <style>@keyframes pulse-warn { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.4); } 50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } }</style>`;
    })()}

    <!-- TODAY'S KEY METRICS - Clean 6-card layout -->
    <div class="section-title">📅 Today's Performance</div>

    <!-- Row 1: Money flow -->
    <div class="dash-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:14px;">
      <div class="stat-card stat-clickable" onclick="app.go('orders')" style="background:linear-gradient(135deg,#dbeafe,#eff6ff);border-left:4px solid #4f7cff;">
        <div class="ic" style="background:#4f7cff;color:#fff;">💰</div>
        <div>
          <div class="lbl">Today's Sales</div>
          <div class="val">${fmtMoney(todayInvoice)}</div>
          <div class="lbl" style="font-size:10px;">Total billed today</div>
        </div>
      </div>

      <div class="stat-card stat-clickable" onclick="app.go('cashbook')" style="background:linear-gradient(135deg,#dcfce7,#f0fdf4);border-left:4px solid #22c55e;">
        <div class="ic" style="background:#22c55e;color:#fff;">✅</div>
        <div>
          <div class="lbl">Cash Received</div>
          <div class="val" style="color:#16a34a;">${fmtMoney(todayReceived)}</div>
          <div class="lbl" style="font-size:10px;">Actually collected (drawer)</div>
        </div>
      </div>

      <div class="stat-card stat-clickable" onclick="if(typeof openQuickPay==='function')openQuickPay();else app.go('orders')" style="background:linear-gradient(135deg,#fef3c7,#fffbeb);border-left:4px solid #f59e0b;">
        <div class="ic" style="background:#f59e0b;color:#fff;">⏰</div>
        <div>
          <div class="lbl">Outstanding Due</div>
          <div class="val" style="color:#d97706;">${fmtMoney(todayDue)}</div>
          <div class="lbl" style="font-size:10px;">Unpaid balance ${todayDue>0?'(Click to collect)':''}</div>
        </div>
      </div>
    </div>

    <!-- Row 2: Performance & insights -->
    <div class="dash-row" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:20px;">
      <div class="stat-card stat-clickable" onclick="app.go('expenses')" style="background:linear-gradient(135deg,#fee2e2,#fef2f2);border-left:4px solid #ef4444;">
        <div class="ic" style="background:#ef4444;color:#fff;">💸</div>
        <div>
          <div class="lbl">Today's Expenses</div>
          <div class="val" style="color:#dc2626;">${fmtMoney(todayExp)}</div>
          <div class="lbl" style="font-size:10px;">All outflows</div>
        </div>
      </div>

      <div class="stat-card stat-clickable" onclick="app.go('reports')" style="background:linear-gradient(135deg,${todayProfit>=0?'#d1fae5,#ecfdf5':'#fee2e2,#fef2f2'});border-left:4px solid ${todayProfit>=0?'#10b981':'#ef4444'};">
        <div class="ic" style="background:${todayProfit>=0?'#10b981':'#ef4444'};color:#fff;">📈</div>
        <div>
          <div class="lbl">Net Profit Today</div>
          <div class="val" style="color:${todayProfit>=0?'#059669':'#dc2626'};">${fmtMoney(todayProfit)}</div>
          <div class="lbl" style="font-size:10px;">Received minus Expenses</div>
        </div>
      </div>

      <div class="stat-card stat-clickable" onclick="app.go('orders')" style="background:linear-gradient(135deg,#e9d5ff,#f5f3ff);border-left:4px solid #8b5cf6;">
        <div class="ic" style="background:#8b5cf6;color:#fff;">🛒</div>
        <div>
          <div class="lbl">Total Orders Today</div>
          <div class="val" style="color:#7c3aed;">${todaySales}</div>
          <div class="lbl" style="font-size:10px;">Number of bookings</div>
        </div>
      </div>
    </div>

    ${(pending > 0 || ready > 0) ? `
      <div onclick="app.go('orders')" style="background:linear-gradient(135deg,#e0e7ff,#eff6ff);border:1px solid #c7d2fe;border-radius:12px;padding:12px 18px;margin-bottom:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;transition:transform .2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:26px;">⏳</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:#3730a3;">${pending} in progress • <span style="color:#059669;">${ready} ready for pickup</span></div>
            <div style="font-size:12px;color:#6366f1;">Click to view all active orders</div>
          </div>
        </div>
        <div style="font-weight:700;color:#4f7cff;font-size:13px;">View All -></div>
      </div>
    ` : ''}

    ${overdueOrders.length > 0 ? `
      <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:18px;border-top:4px solid #ef4444;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
        <h3 style="margin:0 0 10px 0;color:#b91c1c;display:flex;align-items:center;gap:6px;font-size:16px;">⚠️ Overdue / Uncollected Orders (${overdueOrders.length})</h3>
        <p style="font-size:12px;color:#475569;margin-bottom:12px;">These orders have been "Ready" for more than 14 days.</p>
        <div style="overflow-x:auto;">
          <table class="tbl" style="width:100%;font-size:13px;">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Booked Date</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
            <tbody>
              ${overdueOrders.map(o => {
                const c = DB.get('customers', o.customerId) || {};
                const days = Math.floor((new Date() - new Date(o.createdAt)) / 86400000);
                const phoneWa = (c.phone||'').replace(/[^\d+]/g, '');
                const waNum = phoneWa.startsWith('0') && phoneWa.length===11 ? '92'+phoneWa.substring(1) : (phoneWa.startsWith('+') ? phoneWa.substring(1) : phoneWa);
                const msg = encodeURIComponent(`Hi ${c.name}, this is a gentle reminder from Laundry POS that your order (INV-${o.invoiceNo||o.id.slice(-6).toUpperCase()}) has been ready for ${days} days. Please collect it soon!`);
                return `<tr>
                  <td><b>INV-${o.invoiceNo || o.id.slice(-6).toUpperCase()}</b>${o.location ? `<br><span style="font-size:10px;background:#fef08a;padding:2px 4px;border-radius:4px;border:1px solid #f59e0b;">📍 ${escapeHtml(o.location)}</span>` : ''}</td>
                  <td>${escapeHtml(c.name)}<br><small style="color:var(--text-soft);">${escapeHtml(c.phone||'-')}</small></td>
                  <td>${fmtDateShort(o.createdAt)}<br><small style="color:#ef4444;font-weight:bold;">${days} days ago</small></td>
                  <td><span class="badge cancelled" style="font-size:10px;">Overdue</span></td>
                  <td style="text-align:right;">
                    <a href="https://wa.me/${waNum}?text=${msg}" target="_blank" class="btn btn-success btn-sm" style="padding:4px 8px;font-size:11px;text-decoration:none;">📱 Warn</a>
                    <button class="btn btn-ghost btn-sm" onclick="app.go('orders')">View</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <!-- THIS MONTH - 4 essential cards only -->
    <div class="section-title">🗓️ This Month (${new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})})</div>
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">
      <div class="stat-card">
        <div class="ic b1">💰</div>
        <div><div class="lbl">Sales</div><div class="val">${fmtMoney(monthInvoice)}</div></div>
      </div>
      <div class="stat-card">
        <div class="ic b2">✅</div>
        <div><div class="lbl">Received</div><div class="val" style="color:var(--success);">${fmtMoney(monthReceived)}</div></div>
      </div>
      <div class="stat-card">
        <div class="ic ${monthProfit>=0?'b2':'b3'}">📊</div>
        <div><div class="lbl">Net Profit</div><div class="val" style="color:${monthProfit>=0?'var(--success)':'var(--danger)'}">${fmtMoney(monthProfit)}</div></div>
      </div>
      <div class="stat-card">
        <div class="ic b5">📦</div>
        <div><div class="lbl">Orders</div><div class="val">${monthOrders.length}</div></div>
      </div>
    </div>

    <!-- MONEY FLOW BY SOURCE (Cash / JazzCash / Easypaisa / Bank) -->
    ${(() => {
      if (typeof calculateAllBalances !== 'function') return '';
      const b = calculateAllBalances();
      return `
        <div class="section-title">💰 Money Balance by Source</div>
        <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:18px;">
          <div class="stat-card stat-clickable" onclick="app.go('drawings')" style="background:linear-gradient(135deg,#dcfce7,#f0fdf4);border-left:4px solid #22c55e;">
            <div class="ic" style="background:#22c55e;color:#fff;">💵</div>
            <div>
              <div class="lbl">Cash Drawer</div>
              <div class="val" style="color:#16a34a;">${fmtMoney(b.cash)}</div>
              <div class="lbl" style="font-size:10px;">Available for withdrawal</div>
            </div>
          </div>
          <div class="stat-card stat-clickable" onclick="app.go('drawings')" style="background:linear-gradient(135deg,#fef3c7,#fffbeb);border-left:4px solid #f59e0b;">
            <div class="ic" style="background:#f59e0b;color:#fff;">📱</div>
            <div>
              <div class="lbl">JazzCash</div>
              <div class="val" style="color:#d97706;">${fmtMoney(b.jazzcash)}</div>
              <div class="lbl" style="font-size:10px;">Available for withdrawal</div>
            </div>
          </div>
          <div class="stat-card stat-clickable" onclick="app.go('drawings')" style="background:linear-gradient(135deg,#dbeafe,#eff6ff);border-left:4px solid #3b82f6;">
            <div class="ic" style="background:#3b82f6;color:#fff;">📱</div>
            <div>
              <div class="lbl">Easypaisa</div>
              <div class="val" style="color:#2563eb;">${fmtMoney(b.easypaisa)}</div>
              <div class="lbl" style="font-size:10px;">Available for withdrawal</div>
            </div>
          </div>
          <div class="stat-card stat-clickable" onclick="app.go('drawings')" style="background:linear-gradient(135deg,#e9d5ff,#f5f3ff);border-left:4px solid #8b5cf6;">
            <div class="ic" style="background:#8b5cf6;color:#fff;">🏦</div>
            <div>
              <div class="lbl">Bank</div>
              <div class="val" style="color:#7c3aed;">${fmtMoney(b.bank)}</div>
              <div class="lbl" style="font-size:10px;">Available for withdrawal</div>
            </div>
          </div>
        </div>

        ${b.monthDrawings > 0 ? `
          <div onclick="app.go('drawings')" style="background:linear-gradient(135deg,#fff7ed,#ffedd5);border:1px solid #fdba74;border-radius:12px;padding:12px 18px;margin-bottom:18px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="font-size:26px;">👤</div>
              <div>
                <div style="font-weight:700;font-size:14px;color:#9a3412;">You withdrew <b>${fmtMoney(b.monthDrawings)}</b> from shop this month</div>
                <div style="font-size:12px;color:#c2410c;">Today: ${fmtMoney(b.todayDrawings)} • Click to view all withdrawals</div>
              </div>
            </div>
            <div style="font-weight:700;color:#ea580c;font-size:13px;">View Drawings →</div>
          </div>
        ` : ''}
      `;
    })()}

    <div style="display:grid;gap:20px;grid-template-columns:2fr 1fr;">
      <div class="card">
        <div class="card-header"><h3>📈 Revenue — Last 7 Days</h3></div>
        <div style="display:flex;align-items:flex-end;gap:6px;">${chartBars}</div>
      </div>
      <div class="card">
        <div class="card-header"><h3>⚡ Quick Actions</h3></div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-primary btn-lg" data-page="pos">🛒 Start New Sale</button>
          <button class="btn btn-success btn-lg" onclick="openQuickPay()">💰 Receive Payment</button>
          <button class="btn btn-warning btn-lg" onclick="openDrawingForm()">👤 Take Money Home (Withdrawal)</button>
          <button class="btn btn-secondary" data-page="orders">📦 View All Orders</button>
          <button class="btn btn-secondary" data-page="customers">👤 Manage Customers</button>
          <button class="btn btn-secondary" data-page="expenses">💸 Add Expense</button>
          <button class="btn btn-secondary" data-page="reports">📈 Sales Reports</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <h3>💰 Today's Payments Received <span style="color:var(--success);font-size:18px;">(${fmtMoney(todayReceived)})</span></h3>
        <span class="badge" style="background:var(--success);color:#fff;">${todayPayments.length} payment${todayPayments.length===1?'':'s'}</span>
      </div>
      ${todayPayments.length ? `
        <div style="overflow-x:auto;">
        <table class="tbl">
          <thead><tr><th>Time</th><th>Invoice</th><th>Customer</th><th>Method</th><th>Cashier</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${todayPayments.map(p => {
              const c = DB.get('customers', p.customerId) || { name:'Walk-in' };
              const inv = p.invoiceNo ? `INV-${p.invoiceNo}` : '#'+p.orderId.slice(-6).toUpperCase();
              const emoji = ({cash:'💵',card:'💳',bank:'🏦',jazzcash:'📱',easypaisa:'📱',cheque:'📃',online:'🌐',credit:'📋'}[p.method] || '💰');
              return `<tr>
                <td>${new Date(p.at).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</td>
                <td><b>${escapeHtml(inv)}</b></td>
                <td>${escapeHtml(c.name)}</td>
                <td>${emoji} <span style="text-transform:capitalize;">${escapeHtml(p.method||'cash')}</span>${p.note?`<br><small style="color:var(--text-soft);">${escapeHtml(p.note)}</small>`:''}</td>
                <td><small>${escapeHtml(p.byName || p.by || '-')}</small></td>
                <td style="text-align:right;font-weight:700;color:var(--success);">${fmtMoney(p.amount)}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#dcfce7;font-weight:800;font-size:15px;">
              <td colspan="5" style="padding:10px;text-align:right;">GRAND TOTAL COLLECTED TODAY:</td>
              <td style="text-align:right;padding:10px;color:#065f46;">${fmtMoney(todayReceived)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      ` : '<div class="empty" style="padding:30px;"><div class="emoji">💰</div><h4>No payments received yet today</h4><p>Use the Orders page → Quick Receive Payment button.</p></div>'}
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header"><h3>🕒 Recent Orders</h3>
        <button class="btn btn-secondary btn-sm" data-page="orders">View All →</button>
      </div>
      <table class="tbl">
        <thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
        <tbody>${recentRows}</tbody>
      </table>
    </div>
  `;

  $('#app').innerHTML = renderLayout('dashboard', content);
  bindLayout();
}
