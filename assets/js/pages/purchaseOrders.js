/* ===================== PURCHASE ORDERS (Vendor Bills) ===================== */
let poFilter = { vendorId:'all', dateFrom:'', dateTo:'', status:'all' };

function renderPurchaseOrders(initVendorId) {
  if (initVendorId) poFilter.vendorId = initVendorId;
  const vendors = DB.all('vendors');

  const content = `
    <h1 class="page-title">📑 Purchase Orders</h1>
    <p class="page-sub">Track every batch of clothes sent to 3rd-party laundries & their weekly bills.</p>

    <div class="filter-bar">
      <select id="poVendor" style="min-width:220px;">
        <option value="all">All Vendors</option>
        ${vendors.map(v => `<option value="${v.id}" ${poFilter.vendorId===v.id?'selected':''}>🏭 ${escapeHtml(v.name)}</option>`).join('')}
      </select>
      <select id="poStatus">
        <option value="all">All Statuses</option>
        <option value="pending">⏳ Pending</option>
        <option value="received">📦 Received</option>
        <option value="invoiced">🧾 Invoiced</option>
        <option value="paid">✅ Paid</option>
      </select>
      <label>From <input type="date" id="poFrom" value="${poFilter.dateFrom}"/></label>
      <label>To <input type="date" id="poTo" value="${poFilter.dateTo}"/></label>
      <button class="btn btn-secondary btn-sm" id="poWeek">This Week</button>
      <button class="btn btn-secondary btn-sm" id="poMonth">This Month</button>
      <button class="btn btn-ghost btn-sm" id="poClear">Clear</button>
      <button class="btn btn-primary" id="addPoBtn" style="margin-left:auto;">+ New Purchase Order</button>
      <button class="btn btn-success" id="weeklyInvBtn">🧾 Generate Weekly Invoice</button>
    </div>

    <div id="poSummary"></div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>PO #</th><th>Vendor</th><th>Date</th><th>Items / Qty</th>
          <th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody id="poBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('purchaseOrders', content);
  bindLayout();

  $('#poVendor').onchange = e => { poFilter.vendorId = e.target.value; renderPOBody(); };
  $('#poStatus').onchange = e => { poFilter.status = e.target.value; renderPOBody(); };
  $('#poFrom').onchange   = e => { poFilter.dateFrom = e.target.value; renderPOBody(); };
  $('#poTo').onchange     = e => { poFilter.dateTo = e.target.value; renderPOBody(); };
  $('#poWeek').onclick    = () => { const d=new Date(); d.setDate(d.getDate()-6); poFilter.dateFrom = isoDay(d); poFilter.dateTo = isoDay(); renderPurchaseOrders(); };
  $('#poMonth').onclick   = () => { const d=new Date(); poFilter.dateFrom = isoDay(new Date(d.getFullYear(),d.getMonth(),1)); poFilter.dateTo = isoDay(); renderPurchaseOrders(); };
  $('#poClear').onclick   = () => { poFilter = { vendorId:'all', dateFrom:'', dateTo:'', status:'all' }; renderPurchaseOrders(); };
  $('#addPoBtn').onclick  = () => openPOForm();
  $('#weeklyInvBtn').onclick = openWeeklyInvoiceDialog;

  $('#poStatus').value = poFilter.status;
  renderPOBody();
}

function filteredPOs() {
  let list = [...DB.all('purchaseOrders')].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if (poFilter.vendorId !== 'all') list = list.filter(p => p.vendorId === poFilter.vendorId);
  if (poFilter.status !== 'all') list = list.filter(p => p.status === poFilter.status);
  if (poFilter.dateFrom) list = list.filter(p => p.date >= poFilter.dateFrom);
  if (poFilter.dateTo) list = list.filter(p => p.date <= poFilter.dateTo);
  return list;
}

function renderPOBody() {
  const pos = filteredPOs();
  const totalBilled = pos.reduce((s,p)=>s+(p.total||0),0);
  const totalPaid = pos.reduce((s,p)=>s+(p.paid||0),0);
  const totalDue = pos.reduce((s,p)=>s+(p.due||0),0);
  const totalQty = pos.reduce((s,p)=>s+p.items.reduce((q,i)=>q+(i.qty||0),0),0);

  $('#poSummary').innerHTML = `
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:14px;">
      <div class="stat-card"><div class="ic b1">📑</div><div><div class="lbl">POs</div><div class="val">${pos.length}</div></div></div>
      <div class="stat-card"><div class="ic b4">👕</div><div><div class="lbl">Total Items Sent</div><div class="val">${totalQty}</div></div></div>
      <div class="stat-card"><div class="ic b2">💰</div><div><div class="lbl">Billed by Vendor(s)</div><div class="val">${fmtMoney(totalBilled)}</div></div></div>
      <div class="stat-card"><div class="ic b3">✅</div><div><div class="lbl">Paid</div><div class="val" style="color:var(--success);">${fmtMoney(totalPaid)}</div></div></div>
      <div class="stat-card"><div class="ic b5">⏰</div><div><div class="lbl">Outstanding</div><div class="val" style="color:var(--danger);">${fmtMoney(totalDue)}</div></div></div>
    </div>
  `;

  if (!pos.length) {
    $('#poBody').innerHTML = `<tr><td colspan="9"><div class="empty"><div class="emoji">📑</div><h4>No purchase orders</h4><p>Create your first PO with the button above.</p></div></td></tr>`;
    return;
  }
  $('#poBody').innerHTML = pos.map(p => {
    const v = DB.get('vendors', p.vendorId) || { name:'-' };
    const qty = p.items.reduce((s,i)=>s+(i.qty||0),0);
    return `<tr>
      <td><b>${escapeHtml(p.poNo || '-')}</b></td>
      <td>🏭 ${escapeHtml(v.name)}</td>
      <td>${escapeHtml(p.date||'-')}</td>
      <td>${p.items.length} types • ${qty} pcs</td>
      <td><b>${fmtMoney(p.total)}</b></td>
      <td>${fmtMoney(p.paid)}</td>
      <td>${p.due>0?`<b style="color:var(--danger);">${fmtMoney(p.due)}</b>`:`<span class="badge paid">Paid</span>`}</td>
      <td><span class="badge ${p.status==='paid'?'paid':p.status==='pending'?'pending':p.status==='received'?'ready':'washing'}">${p.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="view" data-id="${p.id}">👁️</button>
        <button class="btn btn-secondary btn-sm" data-act="pay" data-id="${p.id}">💰</button>
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-secondary btn-sm" data-act="edit" data-id="${p.id}">✏️</button><button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}">🗑️</button>` : ''}
        <button class="btn btn-secondary btn-sm" data-act="print" data-id="${p.id}">🖨️</button>
      </td>
    </tr>`;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'view' || b.dataset.act === 'print') openPOInvoice(id, b.dataset.act === 'print');
    else if (b.dataset.act === 'edit') openPOForm(DB.get('purchaseOrders', id));
    else if (b.dataset.act === 'pay') openPOPayment(id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this purchase order?', () => { DB.remove('purchaseOrders', id); renderPOBody(); });
  });
}

/* ===== Create / Edit PO ===== */
function openPOForm(existing) {
  const vendors = DB.all('vendors');
  if (!vendors.length) { toast('Please add a vendor first','error'); app.go('vendors'); return; }

  const products = DB.all('products');
  const po = existing || {
    vendorId: poFilter.vendorId !== 'all' ? poFilter.vendorId : vendors[0].id,
    date: isoDay(),
    items: [],
    notes: '',
    paid: 0,
    status: 'pending'
  };

  const html = `
    <h3>${existing?'✏️ Edit':'➕ New'} Purchase Order</h3>
    <p class="sub">Record clothes sent to a 3rd-party laundry, along with vendor's rates.</p>

    <div class="form-row">
      <div class="field">
        <label>Vendor *</label>
        <select id="poVen">
          ${vendors.map(v => `<option value="${v.id}" ${po.vendorId===v.id?'selected':''}>🏭 ${escapeHtml(v.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>PO Date *</label>
        <input type="date" id="poDate" value="${po.date}"/>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0;">
      <div style="font-weight:700;">Items Sent</div>
      <div style="display:flex;gap:6px;">
        <select id="poProdPick" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;min-width:220px;">
          <option value="">+ Add from rate list...</option>
          ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${fmtMoney(p.price)}</option>`).join('')}
        </select>
        <button class="btn btn-secondary btn-sm" id="addCustomBtn">+ Custom Item</button>
      </div>
    </div>

    <table class="tbl" style="margin-bottom:8px;">
      <thead><tr><th>Item</th><th style="width:90px;">Qty</th><th style="width:110px;">Vendor Rate</th><th style="width:120px;">Subtotal</th><th></th></tr></thead>
      <tbody id="poItems"></tbody>
    </table>

    <div class="form-row">
      <div class="field"><label>Initial Payment (Rs.)</label><input type="number" id="poPaid" value="${po.paid||0}" min="0"/></div>
      <div class="field"><label>Status</label>
        <select id="poStatusSel">
          <option value="pending"  ${po.status==='pending'?'selected':''}>⏳ Pending (sent to vendor)</option>
          <option value="received" ${po.status==='received'?'selected':''}>📦 Received Back</option>
          <option value="invoiced" ${po.status==='invoiced'?'selected':''}>🧾 Vendor Invoiced</option>
          <option value="paid"     ${po.status==='paid'?'selected':''}>✅ Paid</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Notes</label><input id="poNotes" value="${escapeHtml(po.notes||'')}" placeholder="Bag #, special instructions, etc."/></div>
    </div>

    <div id="poTotals" style="background:var(--primary-light);padding:12px;border-radius:8px;margin:10px 0;font-weight:600;text-align:center;font-size:15px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">💾 Save Purchase Order</button>
    </div>
  `;

  openModal(html, { large: true, onOpen(m) {
    let items = (po.items || []).map(i => ({...i}));

    const renderItems = () => {
      $('#poItems', m).innerHTML = items.length ? items.map((it, i) => `
        <tr data-i="${i}">
          <td><input type="text" value="${escapeHtml(it.name)}" data-fld="name" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;"/></td>
          <td><input type="number" value="${it.qty}" min="1" data-fld="qty" style="width:80px;padding:6px;border:1px solid var(--border);border-radius:6px;"/></td>
          <td><input type="number" value="${it.rate}" min="0" data-fld="rate" style="width:100px;padding:6px;border:1px solid var(--border);border-radius:6px;"/></td>
          <td class="line"><b>${fmtMoney(it.qty * it.rate)}</b></td>
          <td><button class="btn btn-danger btn-sm" data-rm="${i}">🗑️</button></td>
        </tr>
      `).join('') : `<tr><td colspan="5" class="empty"><div class="emoji">📑</div><p>No items yet. Add from dropdown above.</p></td></tr>`;

      $$('#poItems input', m).forEach(inp => {
        inp.oninput = () => {
          const i = +inp.closest('tr').dataset.i;
          const fld = inp.dataset.fld;
          items[i][fld] = fld === 'name' ? inp.value : (+inp.value || 0);
          inp.closest('tr').querySelector('.line').innerHTML = '<b>'+fmtMoney(items[i].qty * items[i].rate)+'</b>';
          calcTotals();
        };
      });
      $$('[data-rm]', m).forEach(b => b.onclick = () => { items.splice(+b.dataset.rm, 1); renderItems(); calcTotals(); });
    };

    const calcTotals = () => {
      const total = items.reduce((s,i) => s + (i.qty * i.rate), 0);
      const paid = +$('#poPaid', m).value || 0;
      const due = Math.max(0, total - paid);
      const qty = items.reduce((s,i)=>s+(+i.qty||0),0);
      $('#poTotals', m).innerHTML = `
        Items: <b>${items.length}</b> types • <b>${qty}</b> pieces
        &nbsp;|&nbsp; Total: <b>${fmtMoney(total)}</b>
        &nbsp;|&nbsp; Paid: <b style="color:var(--success);">${fmtMoney(Math.min(paid,total))}</b>
        &nbsp;|&nbsp; Due: <b style="color:${due>0?'var(--danger)':'var(--success)'};">${fmtMoney(due)}</b>
      `;
    };

    renderItems(); calcTotals();

    $('#poPaid', m).oninput = calcTotals;

    $('#poProdPick', m).onchange = (e) => {
      if (!e.target.value) return;
      const p = DB.get('products', e.target.value);
      if (p) {
        items.push({ productId: p.id, name: p.name, qty: 1, rate: p.price });
        renderItems(); calcTotals();
      }
      e.target.value = '';
    };

    $('#addCustomBtn', m).onclick = () => {
      items.push({ name: 'Custom Item', qty: 1, rate: 0 });
      renderItems(); calcTotals();
    };

    $('#saveBtn', m).onclick = () => {
      items = items.filter(i => i.name && i.qty > 0);
      if (!items.length) { toast('Add at least one item','error'); return; }
      const total = items.reduce((s,i) => s + (i.qty * i.rate), 0);
      const paid = Math.min(total, Math.max(0, +$('#poPaid', m).value || 0));
      const due = total - paid;
      const data = {
        poNo: existing ? po.poNo : DB.nextPONumber(),
        vendorId: $('#poVen', m).value,
        date: $('#poDate', m).value,
        items, total, paid, due,
        status: $('#poStatusSel', m).value,
        notes: $('#poNotes', m).value.trim(),
        userId: DB.currentUser().id
      };
      if (existing) DB.update('purchaseOrders', existing.id, data);
      else DB.insert('purchaseOrders', data);
      closeModal(); toast('Purchase order saved','success'); renderPOBody();
    };
  }});
}

/* ===== Record payment to vendor ===== */
function openPOPayment(poId) {
  const po = DB.get('purchaseOrders', poId);
  if (!po) return;
  const v = DB.get('vendors', po.vendorId) || { name:'-' };
  openModal(`
    <h3>💰 Pay Vendor — ${escapeHtml(po.poNo)}</h3>
    <p class="sub">Vendor: <b>🏭 ${escapeHtml(v.name)}</b> • Date: ${po.date}</p>
    <div style="padding:10px;background:var(--surface-alt);border-radius:8px;margin-bottom:14px;">
      Total: <b>${fmtMoney(po.total)}</b> • Paid so far: <b>${fmtMoney(po.paid)}</b> •
      <span style="color:var(--danger);">Due: <b>${fmtMoney(po.due)}</b></span>
    </div>
    <div class="form-row">
      <div class="field"><label>Pay Now (Rs.)</label><input type="number" id="payAmt" value="${po.due}" min="0" max="${po.due}"/></div>
      <div class="field"><label>Update Status</label>
        <select id="statusSel">
          ${['pending','received','invoiced','paid'].map(s => `<option value="${s}" ${po.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="saveBtn">💾 Record Payment</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const amt = Math.max(0, +$('#payAmt', m).value || 0);
      const newPaid = Math.min(po.total, po.paid + amt);
      const newDue = po.total - newPaid;
      let status = $('#statusSel', m).value;
      if (newDue === 0 && status !== 'paid') status = 'paid';
      DB.update('purchaseOrders', poId, { paid: newPaid, due: newDue, status });
      closeModal(); toast(`Payment of ${fmtMoney(amt)} recorded`,'success'); renderPOBody();
    };
  }});
}

/* ===== View / Print single PO Invoice ===== */
function openPOInvoice(poId, autoPrint) {
  const po = DB.get('purchaseOrders', poId);
  if (!po) return;
  const v = DB.get('vendors', po.vendorId) || { name:'-' };
  const s = DB.settings();
  const itemsHtml = po.items.map(it => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;">${fmtMoney(it.rate)}</td>
      <td style="text-align:right;"><b>${fmtMoney(it.qty*it.rate)}</b></td>
    </tr>
  `).join('');

  openModal(`
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>📑 Purchase Order ${escapeHtml(po.poNo)}</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="printElement(this.closest('.modal').querySelector('.invoice-page') || this.closest('.modal').querySelector('#printArea'))">🖨️ Print</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
      </div>
    </div>
    <div class="invoice-page" id="invoiceArea" style="max-width:520px;font-family:Arial;">
      ${s.logoImage ? `<div style="text-align:center;margin-bottom:8px;"><img src="${s.logoImage}" style="max-width:140px;max-height:90px;object-fit:contain;background:#000;padding:6px;border-radius:6px;"/></div>` : `<div style="text-align:center;font-size:42px;">${s.logo||'🧺'}</div>`}
      <h2 style="text-align:center;">${escapeHtml(s.shopName)}</h2>
      <div style="text-align:center;font-size:11px;">${escapeHtml(s.address||'')} • 📞 ${escapeHtml(s.phone||'')}</div>
      <div class="line"></div>
      <div style="text-align:center;font-weight:700;font-size:16px;">PURCHASE ORDER</div>
      <div class="line"></div>
      <table style="font-size:12px;">
        <tr><td><b>PO Number:</b></td><td style="text-align:right;">${escapeHtml(po.poNo)}</td></tr>
        <tr><td><b>Date:</b></td><td style="text-align:right;">${escapeHtml(po.date)}</td></tr>
        <tr><td><b>Vendor:</b></td><td style="text-align:right;">${escapeHtml(v.name)}</td></tr>
        ${v.phone?`<tr><td><b>Phone:</b></td><td style="text-align:right;">${escapeHtml(v.phone)}</td></tr>`:''}
        ${v.contactPerson?`<tr><td><b>Contact:</b></td><td style="text-align:right;">${escapeHtml(v.contactPerson)}</td></tr>`:''}
      </table>
      <div class="line"></div>
      <table style="font-size:12px;width:100%;">
        <thead style="border-bottom:1px solid #000;"><tr><th style="text-align:left;">Item</th><th>Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="line"></div>
      <table style="font-size:12px;">
        <tr><td><b>TOTAL:</b></td><td style="text-align:right;font-size:14px;"><b>${fmtMoney(po.total)}</b></td></tr>
        <tr><td>Paid:</td><td style="text-align:right;">${fmtMoney(po.paid)}</td></tr>
        ${po.due>0?`<tr><td><b>Due:</b></td><td style="text-align:right;color:#a00;"><b>${fmtMoney(po.due)}</b></td></tr>`:''}
        <tr><td>Status:</td><td style="text-align:right;text-transform:uppercase;"><b>${po.status}</b></td></tr>
      </table>
      ${po.notes?`<div class="line"></div><div style="font-size:11px;font-style:italic;">📝 ${escapeHtml(po.notes)}</div>`:''}
      <div class="line"></div>
      <div style="text-align:center;font-size:10px;margin-top:8px;color:#666;">Generated by Laundry POS POS</div>
    </div>
  `, { large: true, onOpen(){
    if (autoPrint) setTimeout(() => { const inv = document.querySelector(".modal .invoice-page") || document.querySelector("#printArea"); if (inv) printElement(inv); }, 300);
  }});
}

/* ===== Weekly Consolidated Invoice for a Vendor ===== */
function openWeeklyInvoiceDialog() {
  const vendors = DB.all('vendors');
  if (!vendors.length) { toast('Add a vendor first','error'); return; }
  const today = new Date();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-6);

  openModal(`
    <h3>🧾 Generate Weekly Vendor Invoice</h3>
    <p class="sub">Pick a vendor and date range to generate a consolidated invoice.</p>
    <div class="form-row">
      <div class="field">
        <label>Vendor *</label>
        <select id="wiVen">${vendors.map(v=>`<option value="${v.id}">🏭 ${escapeHtml(v.name)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Preset</label>
        <select id="wiPreset">
          <option value="week">Last 7 days</option>
          <option value="thisweek">This week (Mon-today)</option>
          <option value="month">This month</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>From</label><input type="date" id="wiFrom" value="${isoDay(weekAgo)}"/></div>
      <div class="field"><label>To</label><input type="date" id="wiTo" value="${isoDay(today)}"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="genBtn">🧾 Generate Invoice</button>
    </div>
  `, { onOpen(m){
    $('#wiPreset', m).onchange = e => {
      const t = new Date();
      if (e.target.value === 'week') {
        const d = new Date(); d.setDate(d.getDate()-6);
        $('#wiFrom', m).value = isoDay(d); $('#wiTo', m).value = isoDay(t);
      } else if (e.target.value === 'thisweek') {
        const d = new Date(); const day = d.getDay(); const diff = day === 0 ? 6 : day-1;
        d.setDate(d.getDate()-diff);
        $('#wiFrom', m).value = isoDay(d); $('#wiTo', m).value = isoDay(t);
      } else if (e.target.value === 'month') {
        $('#wiFrom', m).value = isoDay(new Date(t.getFullYear(),t.getMonth(),1));
        $('#wiTo', m).value = isoDay(t);
      }
    };
    $('#genBtn', m).onclick = () => {
      const vendorId = $('#wiVen', m).value;
      const from = $('#wiFrom', m).value, to = $('#wiTo', m).value;
      closeModal();
      showWeeklyInvoice(vendorId, from, to);
    };
  }});
}

function showWeeklyInvoice(vendorId, from, to) {
  const v = DB.get('vendors', vendorId);
  const s = DB.settings();
  const pos = DB.all('purchaseOrders').filter(p => p.vendorId === vendorId && p.date >= from && p.date <= to)
    .sort((a,b) => (a.date||'').localeCompare(b.date||''));

  if (!pos.length) {
    toast('No purchase orders in this date range','warning');
    return;
  }

  // Aggregate by item name
  const itemSummary = {};
  let grandTotal = 0, grandPaid = 0;
  pos.forEach(p => {
    grandTotal += p.total;
    grandPaid += p.paid;
    p.items.forEach(it => {
      const k = it.name + '|' + it.rate;
      if (!itemSummary[k]) itemSummary[k] = { name: it.name, rate: it.rate, qty: 0, total: 0 };
      itemSummary[k].qty += it.qty;
      itemSummary[k].total += it.qty * it.rate;
    });
  });
  const grandDue = grandTotal - grandPaid;

  const summaryHtml = Object.values(itemSummary).map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td style="text-align:center;">${s.qty}</td>
      <td style="text-align:right;">${fmtMoney(s.rate)}</td>
      <td style="text-align:right;"><b>${fmtMoney(s.total)}</b></td>
    </tr>
  `).join('');

  const posListHtml = pos.map(p => `
    <tr>
      <td>${escapeHtml(p.poNo)}</td>
      <td>${escapeHtml(p.date)}</td>
      <td style="text-align:center;">${p.items.reduce((s,i)=>s+i.qty,0)} pcs</td>
      <td style="text-align:right;">${fmtMoney(p.total)}</td>
      <td style="text-align:right;">${fmtMoney(p.paid)}</td>
      <td style="text-align:right;color:${p.due>0?'#a00':'#080'};">${fmtMoney(p.due)}</td>
    </tr>
  `).join('');

  openModal(`
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>🧾 Weekly Invoice — ${escapeHtml(v.name)}</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="printElement(this.closest('.modal').querySelector('.invoice-page') || this.closest('.modal').querySelector('#printArea'))">🖨️ Print</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
      </div>
    </div>
    <div class="invoice-page" id="invoiceArea" style="max-width:700px;font-family:Arial;">
      ${s.logoImage ? `<div style="text-align:center;margin-bottom:8px;"><img src="${s.logoImage}" style="max-width:140px;max-height:90px;object-fit:contain;background:#000;padding:6px;border-radius:6px;"/></div>` : `<div style="text-align:center;font-size:42px;">${s.logo||'🧺'}</div>`}
      <h2 style="text-align:center;">${escapeHtml(s.shopName)}</h2>
      <div style="text-align:center;font-size:11px;">${escapeHtml(s.address||'')} • 📞 ${escapeHtml(s.phone||'')}</div>
      <div class="line"></div>
      <div style="text-align:center;font-weight:700;font-size:18px;">VENDOR INVOICE (Weekly Summary)</div>
      <div class="line"></div>

      <table style="font-size:12px;width:100%;">
        <tr>
          <td style="vertical-align:top;width:50%;"><b>Vendor:</b><br>🏭 ${escapeHtml(v.name)}<br>${escapeHtml(v.contactPerson||'')}<br>${escapeHtml(v.phone||'')}<br>${escapeHtml(v.address||'')}</td>
          <td style="vertical-align:top;text-align:right;width:50%;"><b>Period:</b><br>${escapeHtml(from)} → ${escapeHtml(to)}<br><b>Invoice Date:</b> ${isoDay()}<br><b>Total POs:</b> ${pos.length}</td>
        </tr>
      </table>
      <div class="line"></div>

      <div style="font-weight:700;margin:8px 0;">Item Summary</div>
      <table style="font-size:12px;width:100%;">
        <thead style="border-bottom:1px solid #000;"><tr><th style="text-align:left;">Item</th><th>Total Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${summaryHtml}</tbody>
      </table>
      <div class="line"></div>

      <div style="font-weight:700;margin:8px 0;">Purchase Orders in this Period</div>
      <table style="font-size:11px;width:100%;">
        <thead style="border-bottom:1px solid #000;"><tr><th style="text-align:left;">PO#</th><th>Date</th><th>Qty</th><th style="text-align:right;">Total</th><th style="text-align:right;">Paid</th><th style="text-align:right;">Due</th></tr></thead>
        <tbody>${posListHtml}</tbody>
      </table>
      <div class="line"></div>

      <table style="font-size:13px;width:100%;">
        <tr><td><b>GRAND TOTAL:</b></td><td style="text-align:right;font-size:16px;"><b>${fmtMoney(grandTotal)}</b></td></tr>
        <tr><td>Total Paid:</td><td style="text-align:right;color:#080;">${fmtMoney(grandPaid)}</td></tr>
        <tr><td><b>OUTSTANDING BALANCE:</b></td><td style="text-align:right;color:${grandDue>0?'#a00':'#080'};font-size:16px;"><b>${fmtMoney(grandDue)}</b></td></tr>
      </table>
      <div class="line"></div>
      <div style="text-align:center;font-size:11px;font-style:italic;">Authorized Signature: _______________________</div>
      <div style="text-align:center;font-size:10px;margin-top:14px;color:#666;">Generated on ${new Date().toLocaleString()} by Laundry POS POS</div>
    </div>
  `, { large: true });
}
