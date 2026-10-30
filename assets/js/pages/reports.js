/* ===================== REPORTS (with PDF export + brand logo) ===================== */
let reportRange = { from: '', to: '', preset: 'last30' };

function applyReportRange(preset) {
  const today = new Date();
  const iso = (d) => isoDay(d);
  let from = '', to = iso(today);
  switch (preset) {
    case 'today':       from = to; break;
    case 'yesterday': { const y = new Date(); y.setDate(y.getDate()-1); from = to = iso(y); break; }
    case 'last7':     { const d = new Date(); d.setDate(d.getDate()-6); from = iso(d); break; }
    case 'last30':    { const d = new Date(); d.setDate(d.getDate()-29); from = iso(d); break; }
    case 'thismonth': { from = iso(new Date(today.getFullYear(), today.getMonth(), 1)); break; }
    case 'lastmonth': {
      const fm = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const lm = new Date(today.getFullYear(), today.getMonth(), 0);
      from = iso(fm); to = iso(lm); break;
    }
    case 'thisyear':  { from = iso(new Date(today.getFullYear(), 0, 1)); break; }
    case 'lastyear':  {
      from = iso(new Date(today.getFullYear()-1, 0, 1));
      to = iso(new Date(today.getFullYear()-1, 11, 31)); break;
    }
    case 'all':       from = '1970-01-01'; break;
    default: return;
  }
  reportRange.from = from;
  reportRange.to = to;
  reportRange.preset = preset;
}

function renderReports() {
  if (!reportRange.from) applyReportRange('last30');

  const content = `
    <h1 class="page-title">📈 Reports</h1>
    <p class="page-sub">Sales, profit, top items — drill into any date range.</p>

    <!-- Date Range Filters -->
    <div style="background:var(--surface);border-radius:12px;padding:14px;margin-bottom:14px;border:1px solid var(--border);">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px;">📅 Date Range</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${[
          ['today','Today'],['yesterday','Yesterday'],['last7','Last 7 Days'],
          ['last30','Last 30 Days'],['thismonth','This Month'],['lastmonth','Last Month'],
          ['thisyear','This Year'],['lastyear','Last Year'],['all','All Time']
        ].map(([id,label]) => `
          <button class="r-range-btn ${reportRange.preset===id?'active':''}" data-range="${id}" style="padding:8px 14px;border:2px solid ${reportRange.preset===id?'var(--primary)':'var(--border)'};background:${reportRange.preset===id?'var(--primary)':'var(--surface)'};color:${reportRange.preset===id?'#fff':'var(--text)'};border-radius:10px;font-weight:700;font-size:12px;cursor:pointer;transition:all .2s ease;">${label}</button>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;">From <input type="date" id="rFrom" value="${reportRange.from}"/></label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;">To <input type="date" id="rTo" value="${reportRange.to}"/></label>
        <button class="btn btn-primary btn-sm" id="rApply">Apply Custom</button>
        <div style="margin-left:auto;display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" id="rExportCSV">📥 Export CSV</button>
          <button class="btn btn-warning btn-sm" id="rExportPDF">📄 Export PDF</button>
        </div>
      </div>
    </div>

    <div id="reportBody"></div>
  `;
  $('#app').innerHTML = renderLayout('reports', content);
  bindLayout();

  $$('.r-range-btn').forEach(b => b.onclick = () => {
    applyReportRange(b.dataset.range);
    renderReports();
  });
  $('#rApply').onclick = () => {
    reportRange.from = $('#rFrom').value;
    reportRange.to = $('#rTo').value;
    reportRange.preset = 'custom';
    renderReportBody();
  };
  $('#rExportCSV').onclick = exportReportCSV;
  $('#rExportPDF').onclick = exportReportPDF;
  renderReportBody();
}

function rangeOrders() {
  return DB.all('orders').filter(o => {
    const d = (o.createdAt||'').slice(0,10);
    return d >= reportRange.from && d <= reportRange.to;
  });
}
function rangeExpenses() {
  return DB.all('expenses').filter(e => {
    const d = e.date || (e.createdAt||'').slice(0,10);
    return d >= reportRange.from && d <= reportRange.to;
  });
}

function renderReportBody() {
  const orders = rangeOrders();
  const expenses = rangeExpenses();
  const revenue = orders.reduce((s,o)=>s+(o.total||0),0);
  const collected = orders.reduce((s,o)=>s+(o.paid||0),0);
  const due = orders.reduce((s,o)=>s+(o.due||0),0);
  const expTotal = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const profit = collected - expTotal;

  // Top products (using productImageHTML for proper rendering!)
  const itemMap = {};
  orders.forEach(o => (o.items||[]).forEach(it => {
    if (!itemMap[it.name]) itemMap[it.name] = { name: it.name, qty: 0, total: 0, image: it.image, productId: it.productId };
    itemMap[it.name].qty += it.qty;
    itemMap[it.name].total += it.qty * it.price;
  }));
  const top = Object.values(itemMap).sort((a,b)=>b.qty-a.qty).slice(0,10);

  // Daily breakdown
  const dailyMap = {};
  orders.forEach(o => {
    const k = (o.createdAt||'').slice(0,10);
    dailyMap[k] = (dailyMap[k]||0) + (o.total||0);
  });
  const dailyRows = Object.entries(dailyMap).sort().map(([k,v]) =>
    `<tr><td>${k}</td><td style="text-align:right;"><b>${fmtMoney(v)}</b></td></tr>`
  ).join('') || `<tr><td colspan="2" class="empty">No data</td></tr>`;

  // Expense category breakdown
  const expCatMap = {};
  expenses.forEach(e => {
    const cid = e.category || 'other';
    expCatMap[cid] = (expCatMap[cid] || 0) + (e.amount || 0);
  });
  const expCatRows = Object.entries(expCatMap).sort((a,b)=>b[1]-a[1]).map(([cid, amt]) => {
    const cat = (typeof getExpCategory === 'function') ? getExpCategory(cid) : { label: cid, color: '#6b7280' };
    const pct = expTotal > 0 ? (amt/expTotal*100).toFixed(1) : 0;
    return `<tr>
      <td><span style="background:${cat.color}20;color:${cat.color};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;">${cat.label}</span></td>
      <td style="text-align:right;"><b>${fmtMoney(amt)}</b></td>
      <td style="text-align:right;color:var(--text-soft);">${pct}%</td>
    </tr>`;
  }).join('') || `<tr><td colspan="3" class="empty">No expenses</td></tr>`;

  $('#reportBody').innerHTML = `
    <div class="grid-stats" style="margin-bottom:18px;">
      <div class="stat-card"><div class="ic b1">💰</div><div><div class="lbl">Revenue (Billed)</div><div class="val">${fmtMoney(revenue)}</div></div></div>
      <div class="stat-card"><div class="ic b2">✅</div><div><div class="lbl">Collected (Received)</div><div class="val" style="color:var(--success);">${fmtMoney(collected)}</div></div></div>
      <div class="stat-card"><div class="ic b3">⏰</div><div><div class="lbl">Outstanding Due</div><div class="val" style="color:var(--warning);">${fmtMoney(due)}</div></div></div>
      <div class="stat-card"><div class="ic b4">💸</div><div><div class="lbl">Expenses</div><div class="val" style="color:var(--danger);">${fmtMoney(expTotal)}</div></div></div>
      <div class="stat-card"><div class="ic ${profit>=0?'b2':'b3'}"">📊</div><div><div class="lbl">Net Profit</div><div class="val" style="color:${profit>=0?'var(--success)':'var(--danger)'}">${fmtMoney(profit)}</div></div></div>
      <div class="stat-card"><div class="ic b5">🛒</div><div><div class="lbl">Orders</div><div class="val">${orders.length}</div></div></div>
    </div>

    <div style="display:grid;gap:20px;grid-template-columns:1fr 1fr;">
      <div class="card">
        <div class="card-header"><h3>🏆 Top Selling Items</h3></div>
        <table class="tbl">
          <thead><tr><th></th><th>Item</th><th>Qty</th><th style="text-align:right;">Revenue</th></tr></thead>
          <tbody>
            ${top.length ? top.map(t => `<tr>
              <td style="width:56px;padding:6px;">
                <div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#e0e7ff,#fff);display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #eef1f7;margin:0 auto;">
                  ${typeof productImageHTML === 'function' ? productImageHTML(t.image, 44) : '🧺'}
                </div>
              </td>
              <td><b>${escapeHtml(t.name)}</b></td>
              <td>${t.qty}</td>
              <td style="text-align:right;"><b>${fmtMoney(t.total)}</b></td>
            </tr>`).join('') : `<tr><td colspan="4" class="empty">No data</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header"><h3>📂 Expense Categories</h3></div>
        <table class="tbl">
          <thead><tr><th>Category</th><th style="text-align:right;">Amount</th><th style="text-align:right;">%</th></tr></thead>
          <tbody>${expCatRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header"><h3>📅 Daily Sales Breakdown</h3></div>
      <table class="tbl">
        <thead><tr><th>Date</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${dailyRows}</tbody>
      </table>
    </div>
  `;
}

/* ===================== EXPORTS ===================== */
function exportReportCSV() {
  const orders = rangeOrders();
  const rows = [['OrderID','Date','Customer','Items','Subtotal','Discount','Tax','Total','Paid','Due','Status','PaymentMethod']];
  orders.forEach(o => {
    const c = DB.get('customers', o.customerId) || { name:'' };
    rows.push([
      o.invoiceNo ? 'INV-'+o.invoiceNo : o.id,
      o.createdAt, c.name,
      (o.items||[]).map(i => `${i.qty}x ${i.name}`).join(' | '),
      o.subtotal, o.discount, o.tax, o.total, o.paid, o.due, o.status, o.paymentMethod||''
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(`report-orders_${reportRange.from}_to_${reportRange.to}.csv`, csv, 'text/csv');
  toast('✅ CSV exported','success');
}

async function exportReportPDF() {
  const orders = rangeOrders();
  const expenses = rangeExpenses();
  const s = DB.settings();
  if (!orders.length && !expenses.length) { toast('No data to export', 'warning'); return; }

  const revenue = orders.reduce((s,o)=>s+(o.total||0),0);
  const collected = orders.reduce((s,o)=>s+(o.paid||0),0);
  const due = orders.reduce((s,o)=>s+(o.due||0),0);
  const expTotal = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const profit = collected - expTotal;

  // Top items
  const itemMap = {};
  orders.forEach(o => (o.items||[]).forEach(it => {
    if (!itemMap[it.name]) itemMap[it.name] = { name: it.name, qty: 0, total: 0 };
    itemMap[it.name].qty += it.qty;
    itemMap[it.name].total += it.qty * it.price;
  }));
  const top = Object.values(itemMap).sort((a,b)=>b.qty-a.qty).slice(0,15);

  // Expense categories
  const expCatMap = {};
  expenses.forEach(e => {
    const cid = e.category || 'other';
    expCatMap[cid] = (expCatMap[cid] || 0) + (e.amount || 0);
  });

  const logoHtml = s.logoImage
    ? `<img src="${s.logoImage}" style="max-width:80px;max-height:80px;object-fit:contain;background:#000;padding:6px;border-radius:8px;" alt="logo"/>`
    : `<div style="font-size:50px;">${s.logo||'🧺'}</div>`;

  const topRows = top.map(t => `<tr>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;"><b>${escapeHtml(t.name)}</b></td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${t.qty}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(t.total)}</td>
  </tr>`).join('') || '<tr><td colspan="3" style="padding:10px;text-align:center;color:#999;">No sales data</td></tr>';

  const expCatRows = Object.entries(expCatMap).sort((a,b)=>b[1]-a[1]).map(([cid, amt]) => {
    const cat = getExpCategory(cid);
    const pct = expTotal > 0 ? (amt/expTotal*100).toFixed(1) : 0;
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${cat.label}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(amt)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#666;">${pct}%</td>
    </tr>`;
  }).join('') || '<tr><td colspan="3" style="padding:10px;text-align:center;color:#999;">No expenses</td></tr>';

  const html = `
    <!DOCTYPE html>
    <html><head>
      <meta charset="utf-8">
      <title>Business Report — ${escapeHtml(s.shopName||'Laundry POS')}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #000; padding: 20px; margin: 0; }
        h1 { margin: 8px 0; font-size: 24px; }
        h2 { font-size: 15px; margin: 18px 0 8px; color: #4f7cff; border-bottom: 2px solid #4f7cff; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
        th { background: #4f7cff; color: #fff; padding: 8px; font-size: 11px; text-align: left; }
        th:nth-child(2), th:nth-child(3) { text-align: right; }
        .header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #4f7cff; padding-bottom: 14px; margin-bottom: 16px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
        .summary-card { background: #f8fafc; border: 1px solid #e5e9f2; border-radius: 8px; padding: 12px; }
        .summary-card .lbl { font-size: 10px; color: #666; text-transform: uppercase; font-weight: 700; }
        .summary-card .val { font-size: 18px; font-weight: 900; margin-top: 4px; }
        .profit { background: ${profit>=0?'#dcfce7':'#fee2e2'}; border-color: ${profit>=0?'#22c55e':'#ef4444'}; }
        .footer { text-align: center; font-size: 10px; color: #666; margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px; }
        @media print { body { padding: 10px; } .summary-grid { grid-template-columns: repeat(3, 1fr); } }
      </style>
    </head><body>
      <div class="header">
        ${logoHtml}
        <div style="flex:1;">
          <h1>${escapeHtml(s.shopName||'Laundry POS')}</h1>
          <div style="font-size:12px;color:#666;">${escapeHtml(s.address||'')}</div>
          <div style="font-size:12px;color:#666;">${escapeHtml(s.phone||'')}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#666;">
          <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
          <div><b>Period:</b> ${reportRange.from} to ${reportRange.to}</div>
          <div><b>By:</b> ${escapeHtml(DB.currentUser()?.name||'Admin')}</div>
        </div>
      </div>

      <h1 style="text-align:center;margin:20px 0;color:#4f7cff;">📈 BUSINESS REPORT</h1>

      <h2>💰 Financial Summary</h2>
      <div class="summary-grid">
        <div class="summary-card"><div class="lbl">Revenue (Billed)</div><div class="val">${fmtMoney(revenue)}</div></div>
        <div class="summary-card"><div class="lbl">Cash Collected</div><div class="val" style="color:#16a34a;">${fmtMoney(collected)}</div></div>
        <div class="summary-card"><div class="lbl">Outstanding Due</div><div class="val" style="color:#d97706;">${fmtMoney(due)}</div></div>
        <div class="summary-card"><div class="lbl">Total Expenses</div><div class="val" style="color:#dc2626;">${fmtMoney(expTotal)}</div></div>
        <div class="summary-card profit"><div class="lbl">Net Profit</div><div class="val" style="color:${profit>=0?'#16a34a':'#dc2626'};">${fmtMoney(profit)}</div></div>
        <div class="summary-card"><div class="lbl">Total Orders</div><div class="val">${orders.length}</div></div>
      </div>

      <h2>🏆 Top Selling Items (Top 15)</h2>
      <table>
        <thead><tr><th>Item Name</th><th>Quantity Sold</th><th>Revenue</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>

      <h2>📂 Expense Breakdown by Category</h2>
      <table>
        <thead><tr><th>Category</th><th>Amount</th><th>% of Total</th></tr></thead>
        <tbody>${expCatRows}</tbody>
      </table>

      <div class="footer">
        ${escapeHtml(s.shopName||'Laundry POS')} — Confidential Business Report<br>
        Generated by Laundry POS POS • ${new Date().toLocaleString()}
      </div>
    </body></html>
  `;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast('Pop-up blocked! Allow pop-ups to export PDF.', 'error'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 800);
  toast('📄 Print dialog opened — choose "Save as PDF"', 'success');
}
