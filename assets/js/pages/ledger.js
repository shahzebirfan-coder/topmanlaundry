/* ===================== CUSTOMER PAYMENT LEDGER ===================== */
let ledgerFilter = { search: '', onlyDue: true };

function renderLedger() {
  const content = `
    <h1 class="page-title">💰 Customer Payment Ledger</h1>
    <p class="page-sub">Track every customer's billed amount, payments received, and outstanding dues.</p>

    <div class="filter-bar">
      <input id="ledSearch" placeholder="🔍 Search by name, phone, or loyalty card..." style="flex:1;min-width:240px;" value="${escapeHtml(ledgerFilter.search)}"/>
      <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;">
        <input type="checkbox" id="onlyDue" ${ledgerFilter.onlyDue?'checked':''}/> 🔴 Only customers with dues
      </label>
      <button class="btn btn-secondary" id="exportLedger">📥 Export CSV</button>
    </div>

    <div id="ledgerSummary"></div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Customer</th>
          <th>Phone</th>
          <th>⭐ Loyalty</th>
          <th>Orders</th>
          <th>Total Billed</th>
          <th>Total Paid</th>
          <th>Outstanding</th>
          <th>Last Order</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="ledgerBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('ledger', content);
  bindLayout();

  $('#ledSearch').oninput = e => { ledgerFilter.search = e.target.value; renderLedgerBody(); };
  $('#onlyDue').onchange = e => { ledgerFilter.onlyDue = e.target.checked; renderLedgerBody(); };
  $('#exportLedger').onclick = exportLedgerCSV;
  renderLedgerBody();
}

function buildLedgerData() {
  const customers = DB.all('customers');
  const orders = DB.all('orders');
  return customers.map(c => {
    const myOrders = orders.filter(o => o.customerId === c.id);
    const billed = myOrders.reduce((s,o)=>s+(o.total||0), 0);
    const paid = myOrders.reduce((s,o)=>s+(o.paid||0), 0);
    const due = myOrders.reduce((s,o)=>s+(o.due||0), 0);
    const lastOrder = myOrders.length
      ? myOrders.reduce((a,b) => a.createdAt > b.createdAt ? a : b)
      : null;
    return {
      customer: c,
      orderCount: myOrders.length,
      billed, paid, due,
      lastOrderDate: lastOrder ? lastOrder.createdAt : null,
      orders: myOrders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
    };
  });
}

function renderLedgerBody() {
  const all = buildLedgerData();
  const q = (ledgerFilter.search || '').toLowerCase();
  let list = all.filter(row => {
    if (ledgerFilter.onlyDue && row.due <= 0) return false;
    if (row.orderCount === 0) return false;
    if (q) {
      const c = row.customer;
      if (!c.name.toLowerCase().includes(q)
        && !(c.phone||'').includes(q)
        && !(c.loyaltyNo||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a,b) => b.due - a.due);

  // Summary cards
  const totalDue = list.reduce((s,r)=>s+r.due,0);
  const totalBilled = list.reduce((s,r)=>s+r.billed,0);
  const totalPaid = list.reduce((s,r)=>s+r.paid,0);
  const dueCustomers = list.filter(r => r.due > 0).length;

  $('#ledgerSummary').innerHTML = `
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:16px;">
      <div class="stat-card"><div class="ic b4">👥</div><div><div class="lbl">Customers Shown</div><div class="val">${list.length}</div></div></div>
      <div class="stat-card"><div class="ic b1">🧾</div><div><div class="lbl">Total Billed</div><div class="val">${fmtMoney(totalBilled)}</div></div></div>
      <div class="stat-card"><div class="ic b2">✅</div><div><div class="lbl">Total Received</div><div class="val" style="color:var(--success);">${fmtMoney(totalPaid)}</div></div></div>
      <div class="stat-card"><div class="ic b3">🔴</div><div><div class="lbl">Outstanding Dues</div><div class="val" style="color:var(--danger);">${fmtMoney(totalDue)}</div></div></div>
      <div class="stat-card"><div class="ic b5">⚠️</div><div><div class="lbl">Customers w/ Due</div><div class="val">${dueCustomers}</div></div></div>
    </div>
  `;

  if (!list.length) {
    $('#ledgerBody').innerHTML = `<tr><td colspan="9"><div class="empty"><div class="emoji">${ledgerFilter.onlyDue?'✅':'👤'}</div><h4>${ledgerFilter.onlyDue?'No outstanding dues — all clear!':'No customers found'}</h4></div></td></tr>`;
    return;
  }

  $('#ledgerBody').innerHTML = list.map(r => {
    const c = r.customer;
    return `<tr>
      <td><b>${escapeHtml(c.name)}</b></td>
      <td>${escapeHtml(c.phone || '-')}</td>
      <td>${c.loyaltyActive ? `<span class="badge paid">⭐ ${escapeHtml(c.loyaltyNo)}</span>` : '-'}</td>
      <td>${r.orderCount}</td>
      <td><b>${fmtMoney(r.billed)}</b></td>
      <td style="color:var(--success);">${fmtMoney(r.paid)}</td>
      <td><b style="color:${r.due>0?'var(--danger)':'var(--success)'};font-size:14px;">${fmtMoney(r.due)}</b></td>
      <td>${r.lastOrderDate ? fmtDateShort(r.lastOrderDate) : '-'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" data-act="view" data-id="${c.id}">📜 Ledger</button>
        ${r.due > 0 ? `<button class="btn btn-success btn-sm" data-act="collect" data-id="${c.id}">💰 Collect</button>` : ''}
        ${c.phone ? `<button class="btn btn-secondary btn-sm" data-act="remind" data-id="${c.id}">📱 Remind</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    const act = b.dataset.act;
    if (act === 'view') openCustomerLedger(id);
    else if (act === 'collect') openCollectPayment(id);
    else if (act === 'remind') sendDueReminder(id);
  });
}

/* ===== Detailed ledger for one customer ===== */
function openCustomerLedger(custId) {
  const c = DB.get('customers', custId);
  const orders = DB.all('orders')
    .filter(o => o.customerId === custId)
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));

  let runningBalance = 0;
  const rows = orders.map(o => {
    const debit = o.total || 0;
    const credit = o.paid || 0;
    runningBalance += debit - credit;
    const invNo = o.invoiceNo ? `INV-${o.invoiceNo}` : '#' + o.id.slice(-6).toUpperCase();
    return `<tr>
      <td>${fmtDateShort(o.createdAt)}</td>
      <td><b>${escapeHtml(invNo)}</b></td>
      <td>${o.items.length} items / ${o.items.reduce((s,i)=>s+(i.qty||0),0)} pcs</td>
      <td><span class="badge ${o.status}">${o.status}</span></td>
      <td style="text-align:right;color:var(--danger);">${fmtMoney(debit)}</td>
      <td style="text-align:right;color:var(--success);">${fmtMoney(credit)}</td>
      <td style="text-align:right;"><b style="color:${runningBalance>0?'var(--danger)':'var(--success)'};">${fmtMoney(runningBalance)}</b></td>
      <td><button class="btn btn-secondary btn-sm" onclick="closeModal();openInvoice('${o.id}')">👁️</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="empty"><div class="emoji">📭</div><p>No orders yet</p></td></tr>`;

  const totalDue = orders.reduce((s,o)=>s+(o.due||0),0);
  const totalBilled = orders.reduce((s,o)=>s+(o.total||0),0);
  const totalPaid = orders.reduce((s,o)=>s+(o.paid||0),0);

  openModal(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <h3>📜 ${escapeHtml(c.name)} — Full Ledger ${c.isB2B ? `<span style="font-size:12px;background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;vertical-align:middle;margin-left:6px;">B2B</span>` : ''}</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:13px;color:var(--text-soft);margin-bottom:10px;">
          <div>📞 ${escapeHtml(c.phone||'-')}</div>
          ${c.loyaltyActive?`<div>⭐ ${escapeHtml(c.loyaltyNo)} (${c.loyaltyDiscountPercent}%)</div>`:''}
          ${c.isB2B?`<div style="color:#2563eb;">🏢 Corporate Discount: ${c.b2bDiscount||0}%</div>`:''}
          ${c.address?`<div>🏠 ${escapeHtml(c.address)}</div>`:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        ${totalDue > 0 ? `<button class="btn btn-warning" id="btnConsolidated" style="padding:6px 12px;font-size:13px;font-weight:bold;">🧾 Print Consolidated Bill</button>` : ''}
        ${c.isB2B ? `<button class="btn btn-primary" id="btnGenB2B" style="padding:6px 12px;font-size:13px;font-weight:bold;">📄 Generate Monthly Statement</button>` : ''}
      </div>
    </div>

    <div class="grid-stats" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;">
      <div class="stat-card" style="padding:12px;"><div><div class="lbl">Orders</div><div class="val" style="font-size:18px;">${orders.length}</div></div></div>
      <div class="stat-card" style="padding:12px;"><div><div class="lbl">Billed</div><div class="val" style="font-size:16px;">${fmtMoney(totalBilled)}</div></div></div>
      <div class="stat-card" style="padding:12px;"><div><div class="lbl">Paid</div><div class="val" style="font-size:16px;color:var(--success);">${fmtMoney(totalPaid)}</div></div></div>
      <div class="stat-card" style="padding:12px;"><div><div class="lbl">Outstanding</div><div class="val" style="font-size:16px;color:${totalDue>0?'var(--danger)':'var(--success)'};">${fmtMoney(totalDue)}</div></div></div>
    </div>

    <table class="tbl">
      <thead><tr>
        <th>Date</th><th>Invoice</th><th>Items</th><th>Status</th>
        <th style="text-align:right;">Debit (Billed)</th>
        <th style="text-align:right;">Credit (Paid)</th>
        <th style="text-align:right;">Balance</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="modal-footer">
      ${totalDue > 0 ? `<button class="btn btn-success" onclick="closeModal();openCollectPayment('${custId}')">💰 Collect Payment</button>` : ''}
      ${c.phone ? `<button class="btn btn-secondary" onclick="closeModal();sendDueReminder('${custId}')">📱 WhatsApp Reminder</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, { large: true });
}

/* ===== Collect payment — applies to oldest dues first ===== */
function openCollectPayment(custId) {
  const c = DB.get('customers', custId);
  const dueOrders = DB.all('orders')
    .filter(o => o.customerId === custId && (o.due||0) > 0)
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const totalDue = dueOrders.reduce((s,o)=>s+(o.due||0),0);

  if (totalDue === 0) { toast('No outstanding dues for this customer','warning'); return; }

  openModal(`
    <h3>💰 Collect Payment — ${escapeHtml(c.name)}</h3>
    <p class="sub">Total outstanding: <b style="color:var(--danger);font-size:18px;">${fmtMoney(totalDue)}</b> across ${dueOrders.length} invoice(s)</p>

    <div class="form-row">
      <div class="field">
        <label>Amount Received Now (Rs.) *</label>
        <input type="number" id="payAmt" value="${totalDue}" min="0" max="${totalDue}" style="font-size:18px;font-weight:700;"/>
      </div>
      <div class="field">
        <label>Payment Method</label>
        <select id="payMethod">
          <option value="cash">💵 Cash</option>
          <option value="card">💳 Card</option>
          <option value="bank">🏦 Bank Transfer</option>
          <option value="online">📱 JazzCash/Easypaisa</option>
        </select>
      </div>
    </div>

    <div style="background:var(--surface-alt);border-radius:8px;padding:10px;font-size:12px;margin-bottom:10px;">
      <b>How it applies:</b> Payment is automatically distributed to the <b>oldest unpaid invoices first</b>.
    </div>

    <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;">
      <table class="tbl" style="font-size:12px;">
        <thead><tr><th>Date</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead>
        <tbody>
          ${dueOrders.map(o => {
            const invNo = o.invoiceNo ? `INV-${o.invoiceNo}` : '#' + o.id.slice(-6).toUpperCase();
            return `<tr>
              <td>${fmtDateShort(o.createdAt)}</td>
              <td><b>${escapeHtml(invNo)}</b></td>
              <td>${fmtMoney(o.total)}</td>
              <td>${fmtMoney(o.paid)}</td>
              <td><b style="color:var(--danger);">${fmtMoney(o.due)}</b></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="collectBtn">✅ Record Payment</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#collectBtn', m).onclick = () => {
      let remaining = Math.max(0, Math.min(totalDue, +$('#payAmt', m).value || 0));
      if (remaining === 0) { toast('Enter amount','error'); return; }
      const initialAmount = remaining;

      const method = $('#payMethod', m).value || 'cash';
      const nowIso = new Date().toISOString();
      const user = DB.currentUser() || {};

      dueOrders.forEach(o => {
        if (remaining <= 0) return;
        const apply = Math.min(remaining, o.due);
        const newPaid = (o.paid||0) + apply;
        const newDue = Math.max(0, o.total - newPaid);

        // Keep the same audit trail the Orders page writes, so the money shows
        // up in the cash book / dashboard on the day it was actually collected.
        const paymentsLog = Array.isArray(o.paymentsLog) ? [...o.paymentsLog] : [];
        paymentsLog.push({
          id: 'pay_' + Date.now().toString(36) + Math.floor(Math.random()*1000),
          amount: apply,
          method,
          note: 'Collected from ledger',
          by: user.username || 'unknown',
          byName: user.name || '',
          at: nowIso
        });

        DB.update('orders', o.id, {
          paid: newPaid,
          due: newDue,
          isCredit: newDue > 0,
          paymentMethod: method,
          paymentsLog
        });
        remaining -= apply;
      });

      closeModal();
      if (typeof logAction === 'function') logAction('payment.receive', `${c.name}: ${fmtMoney(initialAmount)} across ${dueOrders.length} invoices`);
      toast(`Payment of ${fmtMoney(initialAmount)} recorded across ${dueOrders.length} invoice(s)`, 'success');
      renderLedgerBody();
    };
  }});
}

/* ===== WhatsApp Due Reminder ===== */
function sendDueReminder(custId) {
  const c = DB.get('customers', custId);
  if (!c.phone) { toast('Customer has no phone number', 'error'); return; }

  const dueOrders = DB.all('orders')
    .filter(o => o.customerId === custId && (o.due||0) > 0)
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const totalDue = dueOrders.reduce((s,o)=>s+(o.due||0),0);
  if (totalDue === 0) { toast('Customer has no outstanding dues','warning'); return; }

  const s = DB.settings();
  let phone = c.phone.replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) phone = phone.substring(1);
  if (phone.startsWith('0') && phone.length === 11) phone = '92' + phone.substring(1);

  const invList = dueOrders.map(o => {
    const invNo = o.invoiceNo ? `INV-${o.invoiceNo}` : '#' + o.id.slice(-6).toUpperCase();
    return `• ${invNo} (${fmtDateShort(o.createdAt)}) — ${fmtMoney(o.due)}`;
  }).join('\n');

  const msg = `Dear ${c.name},

This is a friendly payment reminder from ${s.shopName}.

You have an outstanding balance of *${fmtMoney(totalDue)}* across ${dueOrders.length} invoice(s):

${invList}

Kindly clear the dues at your earliest convenience.

Thank you!
${s.shopName}
📞 ${s.phone || ''}`;

  openModal(`
    <h3>📱 Payment Reminder — ${escapeHtml(c.name)}</h3>
    <p class="sub">Sending to: <b>${escapeHtml(c.phone)}</b> (WhatsApp: <code>+${phone}</code>)</p>
    <div class="field">
      <label>Message (you can edit before sending)</label>
      <textarea id="remMsg" rows="14" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;">${escapeHtml(msg)}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="copyBtn">📋 Copy</button>
      <button class="btn btn-success" id="sendBtn">📱 Open WhatsApp</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#copyBtn', m).onclick = () => {
      navigator.clipboard.writeText($('#remMsg', m).value)
        .then(() => toast('Message copied','success'));
    };
    $('#sendBtn', m).onclick = () => {
      const text = $('#remMsg', m).value;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
      toast('Opening WhatsApp...', 'success');
      closeModal();
    };
  }});
}

/* ===== Export Ledger as CSV ===== */
function exportLedgerCSV() {
  const data = buildLedgerData().filter(r => r.orderCount > 0);
  const rows = [['Customer','Phone','LoyaltyNo','Orders','Total Billed','Total Paid','Outstanding','Last Order Date']];
  data.forEach(r => {
    const c = r.customer;
    rows.push([
      c.name, c.phone||'', c.loyaltyNo||'',
      r.orderCount, r.billed, r.paid, r.due,
      r.lastOrderDate ? fmtDateShort(r.lastOrderDate) : ''
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(`mr-laundry-ledger-${isoDay()}.csv`, csv, 'text/csv');
  toast('Ledger exported','success');
}
