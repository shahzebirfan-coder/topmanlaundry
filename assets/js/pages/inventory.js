/* ===================== INVENTORY / SUPPLIES ===================== */
function renderInventory() {
  const items = DB.all('inventory');
  const lowStock = items.filter(i => (i.stock||0) <= (i.minStock||0)).length;

  const content = `
    <h1 class="page-title">📦 Inventory (Maal / Supplies)</h1>
    <p class="page-sub">Track detergent, hangers, plastic covers, packaging, etc. Get alerts when stock runs low.</p>

    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:16px;">
      <div class="stat-card"><div class="ic b1">📦</div><div><div class="lbl">Total Items</div><div class="val">${items.length}</div></div></div>
      <div class="stat-card"><div class="ic b3">⚠️</div><div><div class="lbl">Low Stock Alert</div><div class="val" style="color:${lowStock>0?'var(--danger)':'var(--success)'};">${lowStock}</div></div></div>
      <div class="stat-card"><div class="ic b2">💰</div><div><div class="lbl">Total Stock Value</div><div class="val">${fmtMoney(items.reduce((s,i)=>s+(i.stock||0)*(i.unitCost||0),0))}</div></div></div>
    </div>

    <div class="filter-bar">
      <input id="invSearch" placeholder="🔍 Search supplies..." style="flex:1;min-width:240px;"/>
      <button class="btn btn-primary" id="addInvBtn">+ Add Supply Item</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Item</th><th>Unit</th><th>Current Stock</th><th>Min Stock</th>
          <th>Unit Cost</th><th>Stock Value</th><th>Last Updated</th><th>Actions</th>
        </tr></thead>
        <tbody id="invBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('inventory', content);
  bindLayout();
  $('#addInvBtn').onclick = () => openInventoryForm();
  $('#invSearch').oninput = renderInventoryBody;
  renderInventoryBody();
}

function renderInventoryBody() {
  const q = ($('#invSearch')?.value || '').toLowerCase();
  let items = DB.all('inventory').filter(i => !q || i.name.toLowerCase().includes(q));
  items.sort((a,b) => {
    const aLow = (a.stock||0) <= (a.minStock||0);
    const bLow = (b.stock||0) <= (b.minStock||0);
    if (aLow !== bLow) return aLow ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (!items.length) {
    $('#invBody').innerHTML = `<tr><td colspan="8"><div class="empty"><div class="emoji">📦</div><h4>No supplies yet</h4><p>Add items like detergent, hangers, plastic covers, etc.</p></div></td></tr>`;
    return;
  }

  $('#invBody').innerHTML = items.map(i => {
    const isLow = (i.stock||0) <= (i.minStock||0);
    return `<tr style="${isLow?'background:rgba(239,68,68,.05);':''}">
      <td><b>${escapeHtml(i.name)}</b>${i.autoDeduct?` <span class="badge" style="background:#dbeafe;color:#1e40af;">🔄 AUTO</span>`:''}${isLow?` <span class="badge due">⚠️ LOW</span>`:''}</td>
      <td>${escapeHtml(i.unit||'pcs')}</td>
      <td><b style="color:${isLow?'var(--danger)':'var(--text)'};font-size:15px;">${i.stock||0}</b></td>
      <td>${i.minStock||0}</td>
      <td>${fmtMoney(i.unitCost||0)}</td>
      <td><b>${fmtMoney((i.stock||0)*(i.unitCost||0))}</b></td>
      <td>${i.updatedAt?fmtDateShort(i.updatedAt):'-'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-success btn-sm" data-act="stock-in" data-id="${i.id}" title="Stock In">➕</button>
        <button class="btn btn-warning btn-sm" data-act="stock-out" data-id="${i.id}" title="Stock Out">➖</button>
        <button class="btn btn-secondary btn-sm" data-act="history" data-id="${i.id}" title="View Movement History">📜</button>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${i.id}">✏️</button>
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${i.id}">🗑️</button>`:''}
      </td>
    </tr>`;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openInventoryForm(DB.get('inventory', id));
    else if (b.dataset.act === 'stock-in') openStockMovement(id, 'in');
    else if (b.dataset.act === 'stock-out') openStockMovement(id, 'out');
    else if (b.dataset.act === 'history') openInventoryHistory(id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this supply item?', () => { DB.remove('inventory', id); renderInventoryBody(); });
  });
}

function openInventoryForm(existing) {
  const i = existing || { name:'', unit:'pcs', stock:0, minStock:5, unitCost:0 };
  openModal(`
    <h3>${existing?'Edit':'Add'} Supply Item</h3>
    <div class="form-row">
      <div class="field"><label>Item Name *</label><input id="iName" value="${escapeHtml(i.name)}" placeholder="e.g. Detergent, Hangers, Plastic Covers"/></div>
      <div class="field"><label>Unit</label><input id="iUnit" value="${escapeHtml(i.unit||'pcs')}" placeholder="pcs, kg, L, packs"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Current Stock</label><input type="number" id="iStock" value="${i.stock||0}" min="0" step="0.01"/></div>
      <div class="field"><label>Minimum Stock Alert</label><input type="number" id="iMin" value="${i.minStock||5}" min="0" step="0.01"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Unit Cost (Rs.)</label><input type="number" id="iCost" value="${i.unitCost||0}" min="0"/></div>
      <div class="field"><label>🔄 Auto-Deduct on Sale</label>
        <select id="iAuto">
          <option value="" ${!i.autoDeduct?'selected':''}>❌ Manual only (no auto-deduct)</option>
          <option value="hanger" ${i.autoDeduct==='hanger'?'selected':''}>🧥 Hanger — 1 per piece (only Hanger orders)</option>
          <option value="shopper" ${i.autoDeduct==='shopper'?'selected':''}>🛍️ Shopper — 1 per piece (every order)</option>
        </select>
      </div>
    </div>
    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:11px;color:var(--text-soft);margin-bottom:10px;">
      💡 <b>Auto-Deduct:</b> When enabled, this item is automatically reduced from stock every time a new order is created. Hangers only deduct for "Hanger" or "Both" packaging type. Shoppers deduct for every piece in every order.
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const name = $('#iName', m).value.trim();
      if (!name) { toast('Name required','error'); return; }
      const data = {
        name,
        unit: $('#iUnit', m).value.trim() || 'pcs',
        stock: +$('#iStock', m).value || 0,
        minStock: +$('#iMin', m).value || 0,
        unitCost: +$('#iCost', m).value || 0,
        autoDeduct: $('#iAuto', m).value || null,
        updatedAt: new Date().toISOString()
      };
      if (existing) DB.update('inventory', existing.id, data);
      else DB.insert('inventory', data);
      closeModal(); toast('Saved','success'); renderInventoryBody();
      if (typeof logAction === 'function') logAction(existing?'inventory.edit':'inventory.add', name);
    };
  }});
}

function openStockMovement(id, type) {
  const item = DB.get('inventory', id);
  openModal(`
    <h3>${type==='in'?'➕ Stock In':'➖ Stock Out'} — ${escapeHtml(item.name)}</h3>
    <p class="sub">Current stock: <b>${item.stock||0} ${item.unit||''}</b></p>
    <div class="form-row">
      <div class="field"><label>Quantity</label><input type="number" id="qty" value="1" min="0.01" step="0.01" autofocus/></div>
      <div class="field"><label>Note</label><input id="note" placeholder="e.g. Bought from XYZ shop"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-${type==='in'?'success':'warning'}" id="saveBtn">${type==='in'?'Add Stock':'Use Stock'}</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const qty = +$('#qty', m).value || 0;
      if (qty <= 0) { toast('Enter quantity','error'); return; }
      const newStock = type==='in' ? (item.stock||0) + qty : Math.max(0, (item.stock||0) - qty);
      DB.update('inventory', id, { stock: newStock, updatedAt: new Date().toISOString() });
      // Log movement
      DB.insert('inventoryMovements', { itemId: id, itemName: item.name, type, qty, note: $('#note', m).value.trim(), userId: DB.currentUser().id });
      closeModal(); toast(`Stock updated: ${newStock} ${item.unit||''}`, 'success'); renderInventoryBody();
      if (typeof logAction === 'function') logAction('inventory.'+type, `${item.name}: ${qty}`);
    };
  }});
}


function openInventoryHistory(itemId) {
  const item = DB.get('inventory', itemId);
  if (!item) return;
  const movements = DB.all('inventoryMovements')
    .filter(m => m.itemId === itemId)
    .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  const rows = movements.length ? movements.slice(0, 100).map(m => `
    <tr>
      <td>${fmtDate(m.createdAt)}</td>
      <td><span class="badge ${m.type==='in'?'paid':'due'}">${m.type==='in'?'➕ IN':'➖ OUT'}</span></td>
      <td><b>${m.qty} ${item.unit||''}</b></td>
      <td>${escapeHtml(m.note||'-')}</td>
      ${m.orderId?`<td><button class="btn btn-secondary btn-sm" onclick="closeModal();openInvoice('${m.orderId}')">👁️</button></td>`:'<td></td>'}
    </tr>
  `).join('') : '<tr><td colspan="5" class="empty"><div class="emoji">📜</div><p>No movements yet</p></td></tr>';

  const totalIn = movements.filter(m => m.type === 'in').reduce((s,m)=>s+(m.qty||0), 0);
  const totalOut = movements.filter(m => m.type === 'out').reduce((s,m)=>s+(m.qty||0), 0);

  openModal(`
    <h3>📜 ${escapeHtml(item.name)} — Movement History</h3>
    <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:120px;background:var(--surface-alt);padding:10px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:var(--text-soft);">Current Stock</div>
        <div style="font-size:20px;font-weight:800;color:${(item.stock||0)<=(item.minStock||0)?'var(--danger)':'var(--success)'};">${item.stock||0} ${item.unit||''}</div>
      </div>
      <div style="flex:1;min-width:120px;background:#d1fae5;padding:10px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:var(--text-soft);">Total Added</div>
        <div style="font-size:18px;font-weight:800;color:var(--success);">+${totalIn}</div>
      </div>
      <div style="flex:1;min-width:120px;background:#fee2e2;padding:10px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:var(--text-soft);">Total Used</div>
        <div style="font-size:18px;font-weight:800;color:var(--danger);">-${totalOut}</div>
      </div>
    </div>
    <table class="tbl">
      <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Note</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${movements.length > 100 ? `<div style="text-align:center;color:var(--text-soft);font-size:12px;margin-top:10px;">Showing latest 100 of ${movements.length} movements</div>` : ''}
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
  `, { large: true });
}
