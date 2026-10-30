/* ===================== CUSTOM REPORT BUILDER ===================== */
function renderReportBuilder() {
  if (DB.currentUser().role !== 'admin') { app.go('dashboard'); return; }
  const templates = DB.all('reportTemplates');

  const content = `
    <h1 class="page-title">📈 Custom Report Builder</h1>
    <p class="page-sub">Build any report you want — pick fields, filters, and group-by options.</p>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-header"><h3>🛠️ Build New Report</h3></div>

      <div class="form-row">
        <div class="field"><label>Data Source</label>
          <select id="rbSource">
            <option value="orders">📦 Orders / Invoices</option>
            <option value="customers">👤 Customers</option>
            <option value="expenses">💸 Expenses</option>
            <option value="claims">🛡️ Claims</option>
            <option value="auditLog">🔐 Activity Log</option>
            <option value="reviews">⭐ Reviews</option>
          </select>
        </div>
        <div class="field"><label>Date Range</label>
          <select id="rbRange">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 days</option>
            <option value="month" selected>Last 30 days</option>
            <option value="quarter">Last 90 days</option>
            <option value="year">Last 365 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
      </div>

      <div id="rbCustomDates" class="form-row" style="display:none;">
        <div class="field"><label>From</label><input type="date" id="rbFrom"/></div>
        <div class="field"><label>To</label><input type="date" id="rbTo"/></div>
      </div>

      <div class="form-row">
        <div class="field"><label>Group By</label>
          <select id="rbGroup">
            <option value="">No grouping (show all rows)</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="customer">Customer</option>
            <option value="cashier">Cashier</option>
            <option value="status">Status</option>
            <option value="paymentMethod">Payment Method</option>
            <option value="branch">Branch</option>
          </select>
        </div>
        <div class="field"><label>Sort By</label>
          <select id="rbSort">
            <option value="date_desc">Latest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Amount (high to low)</option>
            <option value="amount_asc">Amount (low to high)</option>
            <option value="count_desc">Count (high to low)</option>
          </select>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="runReportBtn">▶️ Run Report</button>
        <button class="btn btn-secondary" id="saveTplBtn">💾 Save as Template</button>
        <button class="btn btn-success" id="exportRBBtn">📥 Export CSV</button>
      </div>
    </div>

    ${templates.length ? `<div class="card" style="margin-bottom:18px;">
      <div class="card-header"><h3>📋 Saved Templates</h3></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${templates.map(t => `<button class="btn btn-secondary btn-sm" data-tpl="${t.id}">📊 ${escapeHtml(t.name)}</button>`).join('')}
      </div>
    </div>` : ''}

    <div id="rbResults"></div>
  `;
  $('#app').innerHTML = renderLayout('reportBuilder', content);
  bindLayout();

  $('#rbRange').onchange = (e) => {
    $('#rbCustomDates').style.display = e.target.value === 'custom' ? 'grid' : 'none';
  };
  $('#runReportBtn').onclick = runCustomReport;
  $('#exportRBBtn').onclick = exportCustomReportCSV;
  $('#saveTplBtn').onclick = saveReportTemplate;

  $$('[data-tpl]').forEach(b => b.onclick = () => {
    const tpl = DB.get('reportTemplates', b.dataset.tpl);
    if (!tpl) return;
    $('#rbSource').value = tpl.source;
    $('#rbRange').value = tpl.range;
    $('#rbGroup').value = tpl.group;
    $('#rbSort').value = tpl.sort;
    runCustomReport();
  });
}

function getReportDateRange(rangeKey) {
  const today = new Date();
  today.setHours(0,0,0,0);
  let from, to;
  if (rangeKey === 'today') { from = isoDay(); to = isoDay(); }
  else if (rangeKey === 'yesterday') {
    const y = new Date(); y.setDate(y.getDate()-1);
    from = to = isoDay(y);
  }
  else if (rangeKey === 'week') {
    const d = new Date(); d.setDate(d.getDate()-6);
    from = isoDay(d); to = isoDay();
  }
  else if (rangeKey === 'month') {
    const d = new Date(); d.setDate(d.getDate()-29);
    from = isoDay(d); to = isoDay();
  }
  else if (rangeKey === 'quarter') {
    const d = new Date(); d.setDate(d.getDate()-89);
    from = isoDay(d); to = isoDay();
  }
  else if (rangeKey === 'year') {
    const d = new Date(); d.setDate(d.getDate()-364);
    from = isoDay(d); to = isoDay();
  }
  else if (rangeKey === 'all') { from = '0000-01-01'; to = '9999-12-31'; }
  else {
    from = $('#rbFrom')?.value || isoDay();
    to = $('#rbTo')?.value || isoDay();
  }
  return { from, to };
}

let lastReportData = null;

function runCustomReport() {
  const source = $('#rbSource').value;
  const range = $('#rbRange').value;
  const group = $('#rbGroup').value;
  const sort = $('#rbSort').value;
  const { from, to } = getReportDateRange(range);

  // Get data
  let data = DB.all(source);
  const dateField = source === 'auditLog' ? 'timestamp' : (source === 'expenses' ? 'date' : 'createdAt');
  data = data.filter(d => {
    const dStr = (d[dateField] || '').slice(0,10);
    return dStr >= from && dStr <= to;
  });

  // Group?
  let rows = [];
  if (group) {
    const grouped = {};
    data.forEach(d => {
      let key = '';
      if (group === 'day')   key = (d[dateField]||'').slice(0,10);
      else if (group === 'week')  key = getWeekKey(d[dateField]);
      else if (group === 'month') key = (d[dateField]||'').slice(0,7);
      else if (group === 'customer') {
        const c = DB.get('customers', d.customerId);
        key = c ? c.name : 'Unknown';
      }
      else if (group === 'cashier') {
        const u = DB.get('users', d.cashierId);
        key = u ? u.name : 'Unknown';
      }
      else if (group === 'status') key = d.status || '-';
      else if (group === 'paymentMethod') key = d.paymentMethod || '-';
      else if (group === 'branch') {
        const b = DB.get('branches', d.branchId);
        key = b ? b.name : 'Main';
      }
      if (!grouped[key]) grouped[key] = { key, count:0, total:0, paid:0, due:0, items:[] };
      grouped[key].count++;
      grouped[key].total += (d.total || d.amount || 0);
      grouped[key].paid += (d.paid || 0);
      grouped[key].due += (d.due || 0);
      grouped[key].items.push(d);
    });
    rows = Object.values(grouped);
    if (sort === 'count_desc') rows.sort((a,b) => b.count - a.count);
    else if (sort === 'amount_desc') rows.sort((a,b) => b.total - a.total);
    else if (sort === 'amount_asc') rows.sort((a,b) => a.total - b.total);
    else rows.sort((a,b) => (b.key||'').localeCompare(a.key||''));
  } else {
    rows = data;
    if (sort === 'date_asc')  rows.sort((a,b) => (a[dateField]||'').localeCompare(b[dateField]||''));
    else if (sort === 'date_desc') rows.sort((a,b) => (b[dateField]||'').localeCompare(a[dateField]||''));
    else if (sort === 'amount_desc') rows.sort((a,b) => (b.total||b.amount||0) - (a.total||a.amount||0));
    else if (sort === 'amount_asc') rows.sort((a,b) => (a.total||a.amount||0) - (b.total||b.amount||0));
  }

  // Render
  const grandTotal = rows.reduce((s,r) => s + (group ? r.total : (r.total||r.amount||0)), 0);
  const totalCount = group ? rows.reduce((s,r) => s + r.count, 0) : rows.length;

  lastReportData = { source, range, group, sort, rows, from, to, grandTotal, totalCount };

  let tableHtml = '';
  if (group) {
    tableHtml = `<table class="tbl">
      <thead><tr><th>${group.toUpperCase()}</th><th>Count</th><th>Total Amount</th>${source==='orders'?'<th>Paid</th><th>Due</th>':''}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><b>${escapeHtml(r.key||'-')}</b></td>
          <td>${r.count}</td>
          <td><b>${fmtMoney(r.total)}</b></td>
          ${source==='orders'?`<td style="color:var(--success);">${fmtMoney(r.paid)}</td><td style="color:var(--danger);">${fmtMoney(r.due)}</td>`:''}
        </tr>`).join('')}
        <tr style="border-top:2px solid #000;font-weight:800;background:var(--surface-alt);">
          <td><b>TOTAL</b></td>
          <td><b>${totalCount}</b></td>
          <td><b>${fmtMoney(grandTotal)}</b></td>
          ${source==='orders'?'<td></td><td></td>':''}
        </tr>
      </tbody>
    </table>`;
  } else {
    tableHtml = renderRawRows(source, rows);
  }

  $('#rbResults').innerHTML = `
    <div class="card">
      <div class="card-header"><h3>📊 Report Results</h3>
        <div style="font-size:12px;color:var(--text-soft);">${from} → ${to} • ${totalCount} records • Total ${fmtMoney(grandTotal)}</div>
      </div>
      <div style="overflow-x:auto;">${tableHtml}</div>
    </div>
  `;
}

function renderRawRows(source, rows) {
  if (!rows.length) return '<div class="empty"><div class="emoji">📭</div><p>No data found</p></div>';
  if (source === 'orders') {
    return `<table class="tbl"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Status</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead><tbody>
      ${rows.slice(0,500).map(o => {
        const c = DB.get('customers', o.customerId) || {};
        return `<tr><td><b>INV-${o.invoiceNo||o.id.slice(-6)}</b></td><td>${fmtDateShort(o.createdAt)}</td><td>${escapeHtml(c.name||'-')}</td><td>${o.status}</td><td><b>${fmtMoney(o.total)}</b></td><td>${fmtMoney(o.paid)}</td><td style="color:var(--danger);">${fmtMoney(o.due)}</td></tr>`;
      }).join('')}
    </tbody></table>${rows.length>500?`<p style="text-align:center;color:var(--text-soft);">Showing 500 of ${rows.length}</p>`:''}`;
  } else if (source === 'expenses') {
    return `<table class="tbl"><thead><tr><th>Date</th><th>Title</th><th>Note</th><th>Amount</th></tr></thead><tbody>
      ${rows.slice(0,500).map(e => `<tr><td>${e.date}</td><td><b>${escapeHtml(e.title)}</b></td><td>${escapeHtml(e.note||'-')}</td><td><b>${fmtMoney(e.amount)}</b></td></tr>`).join('')}
    </tbody></table>`;
  } else if (source === 'claims') {
    return `<table class="tbl"><thead><tr><th>Claim#</th><th>Date</th><th>Customer</th><th>Type</th><th>Amount</th></tr></thead><tbody>
      ${rows.slice(0,500).map(c => `<tr><td><b>${escapeHtml(c.claimNo||'-')}</b></td><td>${fmtDateShort(c.createdAt)}</td><td>${escapeHtml(c.customerName)}</td><td>${c.type}</td><td><b>${fmtMoney(c.cashAmount||0)}</b></td></tr>`).join('')}
    </tbody></table>`;
  } else if (source === 'customers') {
    return `<table class="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Joined</th><th>Orders</th></tr></thead><tbody>
      ${rows.slice(0,500).map(c => {
        const orderCount = DB.all('orders').filter(o => o.customerId === c.id).length;
        return `<tr><td><b>${escapeHtml(c.name)}</b></td><td>${escapeHtml(c.phone||'-')}</td><td>${fmtDateShort(c.createdAt)}</td><td>${orderCount}</td></tr>`;
      }).join('')}
    </tbody></table>`;
  } else if (source === 'reviews') {
    return `<table class="tbl"><thead><tr><th>Date</th><th>Rating</th><th>Comment</th></tr></thead><tbody>
      ${rows.slice(0,500).map(r => `<tr><td>${fmtDateShort(r.reviewedAt)}</td><td>${'⭐'.repeat(r.rating||0)}</td><td>${escapeHtml(r.comment||'')}</td></tr>`).join('')}
    </tbody></table>`;
  } else if (source === 'auditLog') {
    return `<table class="tbl"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>
      ${rows.slice(0,500).map(a => `<tr><td style="font-size:11px;">${fmtDate(a.timestamp)}</td><td>${escapeHtml(a.userName||a.username)}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.details||'')}</td></tr>`).join('')}
    </tbody></table>`;
  }
  return '';
}

function getWeekKey(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function exportCustomReportCSV() {
  if (!lastReportData) { toast('Run a report first', 'error'); return; }
  const { rows, group } = lastReportData;
  if (!rows.length) return;

  let csv = '';
  if (group) {
    csv = 'Key,Count,Total,Paid,Due\n';
    rows.forEach(r => {
      csv += `"${(r.key||'').replace(/"/g,'""')}",${r.count},${r.total},${r.paid||0},${r.due||0}\n`;
    });
  } else {
    const keys = Object.keys(rows[0] || {});
    csv = keys.join(',') + '\n';
    rows.forEach(r => {
      csv += keys.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(',') + '\n';
    });
  }
  downloadFile(`mr-laundry-report-${isoDay()}.csv`, csv, 'text/csv');
  toast('Exported','success');
}

function saveReportTemplate() {
  const name = prompt('Template name:');
  if (!name) return;
  DB.insert('reportTemplates', {
    name,
    source: $('#rbSource').value,
    range: $('#rbRange').value,
    group: $('#rbGroup').value,
    sort: $('#rbSort').value
  });
  toast('Template saved','success');
  renderReportBuilder();
}
