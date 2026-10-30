/* ===================== PROMO CODES (Admin) ===================== */
function renderPromoAdmin() {
  if (DB.currentUser().role !== 'admin') { app.go('dashboard'); return; }
  const codes = DB.all('promoCodes');
  const content = `
    <h1 class="page-title">🎁 Promo Codes</h1>
    <p class="page-sub">Create discount codes for customers. They can apply during booking.</p>

    <div class="filter-bar">
      <button class="btn btn-primary" id="addPromoBtn">+ Create Promo Code</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Used / Max</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="promoBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('promoAdmin', content);
  bindLayout();
  $('#addPromoBtn').onclick = () => openPromoForm();
  renderPromoBody();
}

function renderPromoBody() {
  const codes = DB.all('promoCodes');
  if (!codes.length) {
    $('#promoBody').innerHTML = `<tr><td colspan="7"><div class="empty"><div class="emoji">🎁</div><h4>No promo codes yet</h4><p>Create your first one!</p></div></td></tr>`;
    return;
  }
  $('#promoBody').innerHTML = codes.map(p => {
    const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
    const maxedOut = p.maxUses && (p.timesUsed||0) >= p.maxUses;
    const status = !p.active ? 'cancelled' : expired ? 'cancelled' : maxedOut ? 'cancelled' : 'paid';
    const statusText = !p.active ? 'INACTIVE' : expired ? 'EXPIRED' : maxedOut ? 'MAXED OUT' : 'ACTIVE';
    return `<tr>
      <td><code style="font-weight:800;font-size:14px;">${escapeHtml(p.code)}</code></td>
      <td>${p.discountType === 'percent' ? '% Percent' : 'Rs. Fixed'}</td>
      <td><b>${p.discountType === 'percent' ? p.discountValue + '%' : fmtMoney(p.discountValue)}</b></td>
      <td>${p.timesUsed||0} / ${p.maxUses || '∞'}</td>
      <td>${p.expiresAt ? fmtDateShort(p.expiresAt) : 'Never'}</td>
      <td><span class="badge ${status}">${statusText}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="copy" data-code="${escapeHtml(p.code)}">📋 Copy</button>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${p.id}">✏️</button>
        <button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openPromoForm(DB.get('promoCodes', id));
    else if (b.dataset.act === 'del') confirmDialog('Delete this promo code?', () => { DB.remove('promoCodes', id); renderPromoBody(); });
    else if (b.dataset.act === 'copy') {
      navigator.clipboard.writeText(b.dataset.code);
      toast('Copied: '+b.dataset.code, 'success');
    }
  });
}

function openPromoForm(existing) {
  const p = existing || { code:'', discountType:'percent', discountValue:10, maxUses:0, expiresAt:'', active:true };
  openModal(`
    <h3>${existing?'Edit':'Create'} Promo Code</h3>
    <div class="form-row">
      <div class="field"><label>Code *</label><input id="pCode" value="${escapeHtml(p.code)}" placeholder="EID25" style="text-transform:uppercase;font-weight:700;"/></div>
      <div class="field"><label>Active</label>
        <select id="pActive">
          <option value="true" ${p.active?'selected':''}>✅ Yes</option>
          <option value="false" ${!p.active?'selected':''}>❌ No</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>Discount Type</label>
        <select id="pType">
          <option value="percent" ${p.discountType==='percent'?'selected':''}>% Percent</option>
          <option value="fixed" ${p.discountType==='fixed'?'selected':''}>Rs. Fixed</option>
        </select>
      </div>
      <div class="field"><label>Discount Value *</label><input type="number" id="pValue" value="${p.discountValue}" min="0"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Max Uses (0 = unlimited)</label><input type="number" id="pMax" value="${p.maxUses||0}" min="0"/></div>
      <div class="field"><label>Expires (optional)</label><input type="date" id="pExp" value="${p.expiresAt||''}"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const code = $('#pCode', m).value.trim().toUpperCase();
      const value = +$('#pValue', m).value;
      if (!code || value <= 0) { toast('Code & value required','error'); return; }
      const data = {
        code,
        discountType: $('#pType', m).value,
        discountValue: value,
        maxUses: +$('#pMax', m).value || 0,
        expiresAt: $('#pExp', m).value || '',
        active: $('#pActive', m).value === 'true'
      };
      if (existing) DB.update('promoCodes', existing.id, data);
      else DB.insert('promoCodes', { ...data, timesUsed: 0 });
      closeModal(); toast('Saved','success'); renderPromoBody();
    };
  }});
}
