/* ===================== CUSTOMERS ===================== */
let custFilter = { search: '', loyaltyOnly: false };

function renderCustomers() {
  const content = `
    <h1 class="page-title">👤 Customers</h1>
    <p class="page-sub">Manage your customer database, loyalty cards, and view full order history.</p>

    <div class="filter-bar">
      <input id="custSearch" placeholder="🔍 Search by name, phone, or loyalty card..." style="flex:1;min-width:240px;" value="${escapeHtml(custFilter.search)}"/>
      <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;">
        <input type="checkbox" id="loyOnly" ${custFilter.loyaltyOnly?'checked':''}/> ⭐ Loyalty members only
      </label>
      <button class="btn btn-primary" id="addCustBtn">+ Add Customer</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Name</th><th>Phone</th><th>⭐ Loyalty</th><th>Discount</th>
          <th>Orders</th><th>Spent</th><th>Joined</th><th>Actions</th>
        </tr></thead>
        <tbody id="custBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('customers', content);
  bindLayout();

  $('#addCustBtn').onclick = () => openCustomerForm();
  $('#custSearch').oninput = e => { custFilter.search = e.target.value; renderCustomersBody(); };
  $('#loyOnly').onchange = e => { custFilter.loyaltyOnly = e.target.checked; renderCustomersBody(); };
  renderCustomersBody();
}

function renderCustomersBody() {
  const q = (custFilter.search || '').toLowerCase();
  let customers = DB.all('customers').filter(c => !q
    || c.name.toLowerCase().includes(q)
    || (c.phone||'').includes(q)
    || (c.loyaltyNo||'').toLowerCase().includes(q));
  if (custFilter.loyaltyOnly) customers = customers.filter(c => c.loyaltyActive);

  const orders = DB.all('orders');
  if (!customers.length) {
    $('#custBody').innerHTML = `<tr><td colspan="8"><div class="empty"><div class="emoji">👤</div><h4>No customers</h4></div></td></tr>`;
    return;
  }
  $('#custBody').innerHTML = customers.map(c => {
    const myOrders = orders.filter(o => o.customerId === c.id);
    const spent = myOrders.reduce((s,o)=>s+(o.total||0),0);
    return `<tr>
      <td><b>${escapeHtml(c.name)}</b></td>
      <td>${escapeHtml(c.phone || '-')}</td>
      <td>${c.loyaltyActive
        ? `<span class="badge paid">⭐ ${escapeHtml(c.loyaltyNo||'-')}</span>`
        : (c.loyaltyNo ? `<span class="badge cancelled">⭐ ${escapeHtml(c.loyaltyNo)} (inactive)</span>` : '-')}</td>
      <td>${c.loyaltyActive ? `<b>${c.loyaltyDiscountPercent}%</b>` : '-'}</td>
      <td>${myOrders.length}</td>
      <td><b>${fmtMoney(spent)}</b></td>
      <td>${fmtDateShort(c.createdAt)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="history" data-id="${c.id}">📜</button>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${c.id}">✏️</button>
        ${c.id !== 'cu1' && DB.currentUser().role==='admin' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${c.id}">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openCustomerForm(DB.get('customers', id));
    else if (b.dataset.act === 'history') openCustomerHistory(id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this customer? Their orders will remain.', () => { if (typeof logAction === 'function') logAction('customer.delete', id);
      DB.remove('customers', id); toast('Deleted','success'); renderCustomersBody(); });
  });
}

function openCustomerForm(existing, callback) {
  const c = existing || { name:'', phone:'', address:'', loyaltyNo:'', loyaltyDiscountPercent:0, loyaltyActive:false };
  const defaultPct = DB.settings().defaultLoyaltyDiscountPercent || 10;
  const html = `
    <h3>${existing? '✏️ Edit' : '➕ New'} Customer</h3>
    <p class="sub">Enter customer details. Loyalty fields are optional.</p>
    <div class="form-row">
      <div class="field"><label>Name *</label><input id="cName" value="${escapeHtml(c.name)}" required/></div>
      <div class="field"><label>Contact Number *</label><input id="cPhone" value="${escapeHtml(c.phone)}" placeholder="03XX-XXXXXXX" required/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Address</label><input id="cAddr" value="${escapeHtml(c.address)}"/></div>
    </div>

    <div style="background:var(--surface-alt);border-radius:10px;padding:14px;margin-top:10px;">
      <div style="font-weight:700;margin-bottom:10px;">🏢 Corporate / B2B Account</div>
      <label style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
        <input type="checkbox" id="cIsB2B" ${c.isB2B?'checked':''}/> Enable B2B Corporate Billing
      </label>
      <div class="form-row cols-1" id="b2bFields" style="display:${c.isB2B?'flex':'none'};">
        <div class="field"><label>Corporate Discount %</label><input type="number" id="cB2bDisc" value="${c.b2bDiscount||0}" min="0" max="100"/></div>
      </div>
    </div>

    <div style="background:var(--surface-alt);border-radius:10px;padding:14px;margin-top:10px;">
      <div style="font-weight:700;margin-bottom:10px;">⭐ Loyalty Card</div>
      <div class="form-row">
        <div class="field" style="margin:0;">
          <label>Loyalty Number</label>
          <div style="display:flex;gap:6px;">
            <input id="cLoyNo" value="${escapeHtml(c.loyaltyNo||'')}" placeholder="auto-generated"/>
            <button type="button" class="btn btn-secondary btn-sm" id="genBtn">🎫</button>
          </div>
        </div>
        <div class="field" style="margin:0;">
          <label>Discount %</label>
          <input type="number" id="cLoyPct" value="${c.loyaltyDiscountPercent || defaultPct}" min="0" max="100"/>
        </div>
        <div class="field" style="margin:0;">
          <label>Expiry Date</label>
          <input type="date" id="cLoyExp" value="${escapeHtml(c.loyaltyExpiry||'')}"/>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:10px;">
        <input type="checkbox" id="cLoyActive" ${c.loyaltyActive?'checked':''}/> Activate loyalty card (auto-apply discount on every order)
      </label>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">💾 Save</button>
    </div>
  `;
  openModal(html, { large: true, onOpen(m){
    $('#genBtn', m).onclick = () => { $('#cLoyNo', m).value = DB.nextLoyaltyNumber(); $('#cLoyActive', m).checked = true; toast('Loyalty number generated','success'); };
    $('#cIsB2B', m).onchange = (e) => { $('#b2bFields', m).style.display = e.target.checked ? 'flex' : 'none'; };
    $('#cancelBtn', m).onclick = closeModal;
    $('#saveBtn', m).onclick = () => {
      const name = $('#cName', m).value.trim();
      const phone = $('#cPhone', m).value.trim();
      if (!name) { toast('Name required','error'); return; }
      if (!phone) { toast('Contact number required','error'); return; }
      const data = {
        name, phone,
        address: $('#cAddr', m).value.trim(),
        loyaltyNo: $('#cLoyNo', m).value.trim(),
        loyaltyDiscountPercent: Math.max(0, +$('#cLoyPct', m).value || 0),
        loyaltyActive: $('#cLoyActive', m).checked,
        loyaltyExpiry: $('#cLoyExp', m).value,
        isB2B: $('#cIsB2B', m).checked,
        b2bDiscount: Math.max(0, +$('#cB2bDisc', m).value || 0)
      };
      let saved;
      if (existing) saved = DB.update('customers', existing.id, data);
      else saved = DB.insert('customers', data);
      closeModal(); toast(existing?'Updated':'Customer added','success');
      if (callback) callback(saved);
      else if ($('#custBody')) renderCustomersBody();
    };
  }});
}

function openCustomerHistory(custId) {
  const c = DB.get('customers', custId);
  const orders = DB.all('orders').filter(o => o.customerId === custId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const total = orders.reduce((s,o)=>s+(o.total||0),0);
  const due = orders.reduce((s,o)=>s+(o.due||0),0);

  const rows = orders.length ? orders.map(o => `
    <tr>
      <td><b>#${o.invoiceNo || o.id.slice(-6).toUpperCase()}</b></td>
      <td>${fmtDateShort(o.createdAt)}</td>
      <td>${o.items.length}</td>
      <td><span class="badge ${o.status}">${o.status}</span></td>
      <td><b>${fmtMoney(o.total)}</b></td>
      <td>${o.due>0?`<span class="badge due">Due ${fmtMoney(o.due)}</span>`:`<span class="badge paid">Paid</span>`}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="closeModal();openInvoice('${o.id}')">👁️ View</button></td>
    </tr>
  `).join('') : `<tr><td colspan="7" class="empty"><div class="emoji">📭</div><p>No orders yet</p></td></tr>`;

  openModal(`
    <h3>📜 ${escapeHtml(c.name)} — Order History</h3>
    <p class="sub">
      📞 ${escapeHtml(c.phone||'-')}
      ${c.loyaltyActive?` • ⭐ ${escapeHtml(c.loyaltyNo)} (${c.loyaltyDiscountPercent}%)`:''}
      • Total Spent: <b>${fmtMoney(total)}</b>
      ${due>0?` • Outstanding: <b style="color:var(--danger);">${fmtMoney(due)}</b>`:''}
    </p>
    <table class="tbl">
      <thead><tr><th>Invoice #</th><th>Date</th><th>Items</th><th>Status</th><th>Total</th><th>Payment</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
  `, { large: true });
}
