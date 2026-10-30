/* ===================== ACTIVITY AUDIT LOG ===================== */
function logAction(action, details) {
  const user = DB.currentUser();
  if (!user) return;
  DB.insert('auditLog', {
    action,
    details: details || '',
    userId: user.id,
    userName: user.name,
    username: user.username,
    role: user.role,
    timestamp: new Date().toISOString()
  });
  // Auto-trim to last 5000 entries
  const log = DB.all('auditLog');
  if (log.length > 5000) {
    DB._data.auditLog = log.slice(-5000);
    DB.save();
  }
}

let auditFilter = { search:'', user:'all', action:'all', dateFrom:'', dateTo:'' };

function renderAuditLog() {
  const users = DB.all('users');
  const today = isoDay();
  if (!auditFilter.dateFrom) auditFilter.dateFrom = today;
  if (!auditFilter.dateTo) auditFilter.dateTo = today;

  const content = `
    <h1 class="page-title">🔐 Activity Log (Audit Trail)</h1>
    <p class="page-sub">Every important action is logged here for accountability.</p>

    <div class="filter-bar">
      <input id="alSearch" placeholder="🔍 Search action or details..." style="flex:1;min-width:240px;"/>
      <select id="alUser">
        <option value="all">All Users</option>
        ${users.map(u=>`<option value="${u.username}">${escapeHtml(u.name)}</option>`).join('')}
      </select>
      <select id="alAction">
        <option value="all">All Actions</option>
        <option value="login">🔓 Logins</option>
        <option value="logout">🚪 Logouts</option>
        <option value="order">📦 Orders</option>
        <option value="payment">💰 Payments</option>
        <option value="delete">🗑️ Deletes</option>
        <option value="edit">✏️ Edits</option>
        <option value="inventory">📦 Inventory</option>
        <option value="day">📕 Day Close</option>
      </select>
      <label>From <input type="date" id="alFrom" value="${auditFilter.dateFrom}"/></label>
      <label>To <input type="date" id="alTo" value="${auditFilter.dateTo}"/></label>
      <button class="btn btn-secondary btn-sm" id="alExport">📥 Export CSV</button>
      <button class="btn btn-warning btn-sm" id="alRefundLog">↩️ Refund Log</button>
    </div>

    <div id="alSummary"></div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th>
        </tr></thead>
        <tbody id="alBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('auditLog', content);
  bindLayout();

  $('#alSearch').oninput = e => { auditFilter.search = e.target.value; renderAuditBody(); };
  $('#alUser').onchange = e => { auditFilter.user = e.target.value; renderAuditBody(); };
  $('#alAction').onchange = e => { auditFilter.action = e.target.value; renderAuditBody(); };
  $('#alFrom').onchange = e => { auditFilter.dateFrom = e.target.value; renderAuditBody(); };
  $('#alTo').onchange = e => { auditFilter.dateTo = e.target.value; renderAuditBody(); };
  $('#alExport').onclick = exportAuditCSV;
  if ($('#alRefundLog')) $('#alRefundLog').onclick = () => openRefundLog();
  renderAuditBody();
}

function filteredAudit() {
  const all = [...DB.all('auditLog')].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  return all.filter(e => {
    const d = e.timestamp.slice(0,10);
    if (auditFilter.dateFrom && d < auditFilter.dateFrom) return false;
    if (auditFilter.dateTo && d > auditFilter.dateTo) return false;
    if (auditFilter.user !== 'all' && e.username !== auditFilter.user) return false;
    if (auditFilter.action !== 'all' && !e.action.toLowerCase().includes(auditFilter.action)) return false;
    if (auditFilter.search) {
      const q = auditFilter.search.toLowerCase();
      if (!e.action.toLowerCase().includes(q) && !(e.details||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function renderAuditBody() {
  const list = filteredAudit();
  const logins = list.filter(e=>e.action==='login').length;
  const deletes = list.filter(e=>e.action.includes('delete')).length;
  const edits = list.filter(e=>e.action.includes('edit')).length;

  $('#alSummary').innerHTML = `
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:14px;">
      <div class="stat-card"><div class="ic b1">📋</div><div><div class="lbl">Entries</div><div class="val">${list.length}</div></div></div>
      <div class="stat-card"><div class="ic b2">🔓</div><div><div class="lbl">Logins</div><div class="val">${logins}</div></div></div>
      <div class="stat-card"><div class="ic b3">✏️</div><div><div class="lbl">Edits</div><div class="val">${edits}</div></div></div>
      <div class="stat-card"><div class="ic b4">🗑️</div><div><div class="lbl">Deletes (Flagged)</div><div class="val" style="color:${deletes>0?'var(--danger)':'var(--text)'};">${deletes}</div></div></div>
    </div>
  `;

  if (!list.length) {
    $('#alBody').innerHTML = `<tr><td colspan="5"><div class="empty"><div class="emoji">📋</div><h4>No activity recorded</h4></div></td></tr>`;
    return;
  }

  $('#alBody').innerHTML = list.slice(0, 500).map(e => {
    const isDelete = e.action.includes('delete');
    const isEdit = e.action.includes('edit');
    return `<tr style="${isDelete?'background:rgba(239,68,68,.05);':''}">
      <td style="white-space:nowrap;font-size:12px;">${fmtDate(e.timestamp)}</td>
      <td><b>${escapeHtml(e.userName||e.username)}</b></td>
      <td><span class="badge ${e.role}">${e.role}</span></td>
      <td>${isDelete?'🗑️ ':isEdit?'✏️ ':''}${escapeHtml(e.action)}</td>
      <td>${escapeHtml(e.details||'')}</td>
    </tr>`;
  }).join('');

  if (list.length > 500) {
    $('#alBody').innerHTML += `<tr><td colspan="5" style="text-align:center;color:var(--text-soft);">Showing latest 500 of ${list.length} entries. Use filters to narrow down.</td></tr>`;
  }
}

function exportAuditCSV() {
  const list = filteredAudit();
  const rows = [['Timestamp','User','Username','Role','Action','Details']];
  list.forEach(e => rows.push([e.timestamp, e.userName||'', e.username, e.role, e.action, e.details||'']));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(`mr-laundry-audit-${isoDay()}.csv`, csv, 'text/csv');
  toast('Audit log exported','success');
}
