/* ===================== VENDORS (3rd Party Laundries) ===================== */
function renderVendors() {
  const content = `
    <h1 class="page-title">🏭 Vendors (3rd Party Laundries)</h1>
    <p class="page-sub">Manage the laundries / dry cleaners you outsource work to. Each vendor has their own purchase orders & weekly invoices.</p>

    <div class="filter-bar">
      <input id="venSearch" placeholder="🔍 Search vendor by name or phone..." style="flex:1;min-width:240px;"/>
      <button class="btn btn-primary" id="addVenBtn">+ Add Vendor</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Vendor Name</th><th>Contact Person</th><th>Phone</th>
          <th>Total POs</th><th>Total Billed</th><th>Total Paid</th><th>Outstanding</th><th>Actions</th>
        </tr></thead>
        <tbody id="venBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('vendors', content);
  bindLayout();
  $('#addVenBtn').onclick = () => openVendorForm();
  $('#venSearch').oninput = renderVendorsBody;
  renderVendorsBody();
}

function vendorTotals(vendorId) {
  const pos = DB.all('purchaseOrders').filter(p => p.vendorId === vendorId);
  const billed = pos.reduce((s,p)=>s+(p.total||0),0);
  const paid = pos.reduce((s,p)=>s+(p.paid||0),0);
  const v = DB.get('vendors', vendorId) || {};
  const opening = v.openingBalance || 0;
  return { count: pos.length, billed, paid, due: (billed + opening) - paid, opening };
}

function renderVendorsBody() {
  const q = ($('#venSearch')?.value || '').toLowerCase();
  let vendors = DB.all('vendors').filter(v => !q || v.name.toLowerCase().includes(q) || (v.phone||'').includes(q));
  if (!vendors.length) {
    $('#venBody').innerHTML = `<tr><td colspan="8"><div class="empty"><div class="emoji">🏭</div><h4>No vendors yet</h4><p>Add the 3rd-party laundries you work with.</p></div></td></tr>`;
    return;
  }
  $('#venBody').innerHTML = vendors.map(v => {
    const t = vendorTotals(v.id);
    return `<tr>
      <td><b>${escapeHtml(v.name)}</b></td>
      <td>${escapeHtml(v.contactPerson||'-')}</td>
      <td>${escapeHtml(v.phone||'-')}</td>
      <td>${t.count}</td>
      <td><b>${fmtMoney(t.billed)}</b></td>
      <td style="color:var(--success);">${fmtMoney(t.paid)}</td>
      <td><b style="color:${t.due>0?'var(--danger)':'var(--success)'};">${fmtMoney(t.due)}</b></td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="view" data-id="${v.id}">👁️ POs</button>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${v.id}">✏️</button>
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${v.id}">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openVendorForm(DB.get('vendors', id));
    else if (b.dataset.act === 'view') app.go('purchaseOrders?vendor='+id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this vendor? Their purchase orders will remain in records.', () => { DB.remove('vendors', id); renderVendorsBody(); });
  });
}

function openVendorForm(existing) {
  const v = existing || { name:'', contactPerson:'', phone:'', address:'', openingBalance:0 };
  openModal(`
    <h3>${existing?'✏️ Edit':'➕ New'} Vendor</h3>
    <p class="sub">A vendor is a 3rd-party laundry you send clothes to.</p>
    <div class="form-row">
      <div class="field"><label>Vendor / Laundry Name *</label><input id="vName" value="${escapeHtml(v.name)}"/></div>
      <div class="field"><label>Contact Person</label><input id="vPerson" value="${escapeHtml(v.contactPerson||'')}"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Phone</label><input id="vPhone" value="${escapeHtml(v.phone||'')}" placeholder="03XX-XXXXXXX"/></div>
      <div class="field"><label>Opening Balance (Old Dues — Rs.)</label><input type="number" id="vOpening" value="${v.openingBalance||0}"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Address</label><input id="vAddr" value="${escapeHtml(v.address||'')}"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">💾 Save</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const name = $('#vName', m).value.trim();
      if (!name) { toast('Name required','error'); return; }
      const data = {
        name,
        contactPerson: $('#vPerson', m).value.trim(),
        phone: $('#vPhone', m).value.trim(),
        address: $('#vAddr', m).value.trim(),
        openingBalance: Math.max(0, +$('#vOpening', m).value || 0)
      };
      if (existing) DB.update('vendors', existing.id, data);
      else DB.insert('vendors', data);
      closeModal(); toast('Saved','success'); renderVendorsBody();
    };
  }});
}
