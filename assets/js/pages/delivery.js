/* ===================== PICKUP & DELIVERY MODULE ===================== */
let deliveryFilter = { tab: 'requests', status: 'all', driverId: 'all' };

function renderDelivery() {
  const requests = DB.all('pickupRequests');
  const drivers = DB.all('drivers');
  const pending = requests.filter(r => r.status === 'pending').length;
  const assigned = requests.filter(r => r.status === 'assigned').length;
  const completed = requests.filter(r => r.status === 'completed').length;

  const content = `
    <h1 class="page-title">🚚 Pickup & Delivery</h1>
    <p class="page-sub">Manage home pickup requests and assign drivers for delivery service.</p>

    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:18px;">
      <div class="stat-card"><div class="ic b1">🚚</div><div><div class="lbl">Total Requests</div><div class="val">${requests.length}</div></div></div>
      <div class="stat-card"><div class="ic b3">⏳</div><div><div class="lbl">Pending Assign</div><div class="val" style="color:${pending>0?'var(--warning)':'var(--text)'};">${pending}</div></div></div>
      <div class="stat-card"><div class="ic b5">🛵</div><div><div class="lbl">On the Way</div><div class="val">${assigned}</div></div></div>
      <div class="stat-card"><div class="ic b2">✅</div><div><div class="lbl">Completed</div><div class="val">${completed}</div></div></div>
      <div class="stat-card"><div class="ic b4">👨‍✈️</div><div><div class="lbl">Active Drivers</div><div class="val">${drivers.filter(d => d.active!==false).length}</div></div></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn ${deliveryFilter.tab==='requests'?'btn-primary':'btn-secondary'}" id="tabReq">📋 Pickup Requests</button>
      <button class="btn ${deliveryFilter.tab==='drivers'?'btn-primary':'btn-secondary'}" id="tabDrv">👨‍✈️ Drivers</button>
      <button class="btn btn-success" id="newReqBtn" style="margin-left:auto;">+ New Pickup Request</button>
    </div>

    <div id="deliveryContent"></div>
  `;
  $('#app').innerHTML = renderLayout('delivery', content);
  bindLayout();

  $('#tabReq').onclick = () => { deliveryFilter.tab = 'requests'; renderDelivery(); };
  $('#tabDrv').onclick = () => { deliveryFilter.tab = 'drivers'; renderDelivery(); };
  $('#newReqBtn').onclick = () => openPickupRequestForm();

  if (deliveryFilter.tab === 'requests') renderRequestsTab();
  else renderDriversTab();
}

function renderRequestsTab() {
  const drivers = DB.all('drivers');
  const requests = [...DB.all('pickupRequests')].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  if (!requests.length) {
    $('#deliveryContent').innerHTML = `<div class="card"><div class="empty"><div class="emoji">📋</div><h4>No pickup requests yet</h4><p>Customers can request from the portal, or add manually with "+ New Pickup Request"</p></div></div>`;
    return;
  }

  const statusColors = {pending:'pending', assigned:'washing', picked:'ready', completed:'paid', cancelled:'cancelled'};

  $('#deliveryContent').innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Request #</th><th>Customer</th><th>Address</th><th>Pickup Time</th>
          <th>Driver</th><th>Status</th><th>Rating</th><th>Actions</th>
        </tr></thead>
        <tbody>${requests.map(r => `
          <tr>
            <td><b>#${r.id.slice(-6).toUpperCase()}</b></td>
            <td><b>${escapeHtml(r.customerName)}</b><br><small style="color:var(--text-soft);">${escapeHtml(r.customerPhone)}</small></td>
            <td style="font-size:12px;">${escapeHtml(r.address)}</td>
            <td><b>${escapeHtml(r.pickupDate||'-')}</b><br><small>${escapeHtml(r.pickupSlot||'-')}</small></td>
            <td>${r.driverId ? '🛵 '+escapeHtml((drivers.find(d=>d.id===r.driverId)||{}).name||'-') : '<span style="color:var(--text-soft);">Not assigned</span>'}</td>
            <td><span class="badge ${statusColors[r.status]||'pending'}">${r.status}</span></td>
            <td>${r.rating?('⭐'.repeat(r.rating)):'-'}</td>
            <td style="white-space:nowrap;">
              ${r.status === 'pending' ? `<button class="btn btn-success btn-sm" data-act="assign" data-id="${r.id}">👨‍✈️ Assign</button>` : ''}
              ${r.status === 'assigned' ? `<button class="btn btn-primary btn-sm" data-act="pickup" data-id="${r.id}">📦 Mark Picked Up</button>` : ''}
              ${r.status === 'picked' ? `<button class="btn btn-success btn-sm" data-act="deliver" data-id="${r.id}">✅ Complete</button>` : ''}
              <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${r.id}">✏️</button>
              ${DB.currentUser().role === 'admin' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${r.id}">🗑️</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    const act = b.dataset.act;
    if (act === 'assign') openAssignDriverDialog(id);
    else if (act === 'pickup') updateRequestStatus(id, 'picked');
    else if (act === 'deliver') openCompleteDeliveryDialog(id);
    else if (act === 'edit') openPickupRequestForm(DB.get('pickupRequests', id));
    else if (act === 'del') confirmDialog('Delete this request?', () => { DB.remove('pickupRequests', id); renderDelivery(); });
  });
}

function renderDriversTab() {
  const drivers = [...DB.all('drivers')].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  const requests = DB.all('pickupRequests');

  $('#deliveryContent').innerHTML = `
    <div class="filter-bar">
      <button class="btn btn-primary" id="addDrvBtn">+ Add Driver</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Name</th><th>Phone</th><th>Vehicle</th><th>Active</th>
          <th>Total Deliveries</th><th>Avg Rating</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${drivers.length ? drivers.map(d => {
            const myReqs = requests.filter(r => r.driverId === d.id);
            const completed = myReqs.filter(r => r.status === 'completed');
            const ratings = completed.filter(r => r.rating).map(r => r.rating);
            const avgRating = ratings.length ? (ratings.reduce((s,x)=>s+x,0)/ratings.length).toFixed(1) : '-';
            return `<tr>
              <td><b>${escapeHtml(d.name)}</b></td>
              <td>${escapeHtml(d.phone||'-')}</td>
              <td>${escapeHtml(d.vehicle||'-')}</td>
              <td>${d.active!==false ? '<span class="badge paid">Active</span>' : '<span class="badge cancelled">Inactive</span>'}</td>
              <td>${completed.length}</td>
              <td>${avgRating !== '-' ? avgRating + ' ⭐' : '-'}</td>
              <td>
                <button class="btn btn-secondary btn-sm" data-act="edit-drv" data-id="${d.id}">✏️</button>
                ${DB.currentUser().role==='admin' ? `<button class="btn btn-danger btn-sm" data-act="del-drv" data-id="${d.id}">🗑️</button>`:''}
              </td>
            </tr>`;
          }).join('') : '<tr><td colspan="7"><div class="empty"><div class="emoji">👨‍✈️</div><h4>No drivers added yet</h4></div></td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $('#addDrvBtn').onclick = () => openDriverForm();
  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit-drv') openDriverForm(DB.get('drivers', id));
    else if (b.dataset.act === 'del-drv') confirmDialog('Delete this driver?', () => { DB.remove('drivers', id); renderDelivery(); });
  });
}

function openPickupRequestForm(existing) {
  const r = existing || { customerName:'', customerPhone:'', address:'', pickupDate: isoDay(new Date(Date.now()+86400000)), pickupSlot:'10am-2pm', notes:'', status:'pending' };
  openModal(`
    <h3>${existing?'Edit':'+ New'} Pickup Request</h3>
    <div class="form-row">
      <div class="field"><label>Customer Name *</label><input id="rName" value="${escapeHtml(r.customerName)}"/></div>
      <div class="field"><label>Phone *</label><input id="rPhone" value="${escapeHtml(r.customerPhone)}" type="tel"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Pickup Address *</label><textarea id="rAddr" rows="2">${escapeHtml(r.address)}</textarea></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Pickup Date *</label><input type="date" id="rDate" value="${r.pickupDate}"/></div>
      <div class="field"><label>Time Slot</label>
        <select id="rSlot">
          <option value="9am-12pm" ${r.pickupSlot==='9am-12pm'?'selected':''}>🌅 9 AM - 12 PM</option>
          <option value="10am-2pm" ${r.pickupSlot==='10am-2pm'?'selected':''}>☀️ 10 AM - 2 PM</option>
          <option value="2pm-6pm" ${r.pickupSlot==='2pm-6pm'?'selected':''}>🌞 2 PM - 6 PM</option>
          <option value="6pm-9pm" ${r.pickupSlot==='6pm-9pm'?'selected':''}>🌆 6 PM - 9 PM</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Notes</label><textarea id="rNotes" rows="2" placeholder="Apartment #, landmarks, special instructions...">${escapeHtml(r.notes||'')}</textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveReqBtn">💾 Save</button>
    </div>
  `, { onOpen(m) {
    $('#saveReqBtn', m).onclick = () => {
      const data = {
        customerName: $('#rName', m).value.trim(),
        customerPhone: $('#rPhone', m).value.trim(),
        address: $('#rAddr', m).value.trim(),
        pickupDate: $('#rDate', m).value,
        pickupSlot: $('#rSlot', m).value,
        notes: $('#rNotes', m).value.trim(),
        status: r.status
      };
      if (!data.customerName || !data.customerPhone || !data.address) { toast('Name, phone & address required','error'); return; }
      if (existing) DB.update('pickupRequests', existing.id, data);
      else DB.insert('pickupRequests', data);
      closeModal(); toast('Saved','success');
      if (typeof logAction === 'function') logAction(existing?'pickup.edit':'pickup.add', data.customerName);
      renderDelivery();
    };
  }});
}

function openDriverForm(existing) {
  const d = existing || { name:'', phone:'', vehicle:'', license:'', active:true };
  openModal(`
    <h3>${existing?'Edit':'+ Add'} Driver</h3>
    <div class="form-row">
      <div class="field"><label>Name *</label><input id="dName" value="${escapeHtml(d.name)}"/></div>
      <div class="field"><label>Phone *</label><input id="dPhone" value="${escapeHtml(d.phone||'')}" type="tel"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Vehicle (e.g. Honda 70 - LXR 123)</label><input id="dVeh" value="${escapeHtml(d.vehicle||'')}"/></div>
      <div class="field"><label>License #</label><input id="dLic" value="${escapeHtml(d.license||'')}"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Status</label>
        <select id="dActive">
          <option value="true" ${d.active!==false?'selected':''}>✅ Active</option>
          <option value="false" ${d.active===false?'selected':''}>❌ Inactive</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveDrvBtn">Save</button>
    </div>
  `, { onOpen(m) {
    $('#saveDrvBtn', m).onclick = () => {
      const data = {
        name: $('#dName', m).value.trim(),
        phone: $('#dPhone', m).value.trim(),
        vehicle: $('#dVeh', m).value.trim(),
        license: $('#dLic', m).value.trim(),
        active: $('#dActive', m).value === 'true'
      };
      if (!data.name || !data.phone) { toast('Name & phone required','error'); return; }
      if (existing) DB.update('drivers', existing.id, data);
      else DB.insert('drivers', data);
      closeModal(); toast('Saved','success');
      renderDelivery();
    };
  }});
}

function openAssignDriverDialog(requestId) {
  const drivers = DB.all('drivers').filter(d => d.active !== false);
  if (!drivers.length) { toast('Add a driver first', 'error'); return; }

  openModal(`
    <h3>👨‍✈️ Assign Driver</h3>
    <p class="sub">Pick a driver for this pickup request.</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${drivers.map(d => `
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid var(--border);border-radius:10px;cursor:pointer;">
          <input type="radio" name="drv" value="${d.id}"/>
          <div style="flex:1;">
            <div style="font-weight:700;">🛵 ${escapeHtml(d.name)}</div>
            <div style="font-size:11px;color:var(--text-soft);">${escapeHtml(d.phone||'')} • ${escapeHtml(d.vehicle||'No vehicle')}</div>
          </div>
        </label>
      `).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="assignBtn">✅ Assign</button>
    </div>
  `, { onOpen(m) {
    $('#assignBtn', m).onclick = () => {
      const sel = m.querySelector('input[name="drv"]:checked');
      if (!sel) { toast('Pick a driver', 'error'); return; }
      DB.update('pickupRequests', requestId, {
        driverId: sel.value,
        status: 'assigned',
        assignedAt: new Date().toISOString()
      });
      closeModal(); toast('Driver assigned', 'success');
      if (typeof logAction === 'function') logAction('pickup.assign', requestId);
      renderDelivery();
    };
  }});
}

function updateRequestStatus(id, newStatus) {
  DB.update('pickupRequests', id, { status: newStatus, [newStatus + 'At']: new Date().toISOString() });
  toast('Status updated', 'success');
  renderDelivery();
}

function openCompleteDeliveryDialog(requestId) {
  openModal(`
    <h3>✅ Complete Delivery</h3>
    <p class="sub">Mark this delivery as complete and rate the driver.</p>
    <div class="field">
      <label>Customer Rating (optional)</label>
      <div style="display:flex;gap:8px;justify-content:center;font-size:36px;margin:10px 0;">
        ${[1,2,3,4,5].map(n => `<span class="rate-star" data-star="${n}" style="cursor:pointer;color:#ddd;">★</span>`).join('')}
      </div>
    </div>
    <div class="field"><label>Feedback (optional)</label><textarea id="dlvFb" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="cmpBtn">✅ Complete</button>
    </div>
  `, { onOpen(m) {
    let rating = 0;
    m.querySelectorAll('.rate-star').forEach(s => {
      s.onclick = () => {
        rating = +s.dataset.star;
        m.querySelectorAll('.rate-star').forEach((x,i) => x.style.color = i < rating ? '#f59e0b' : '#ddd');
      };
    });
    $('#cmpBtn', m).onclick = () => {
      DB.update('pickupRequests', requestId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        rating: rating || null,
        feedback: $('#dlvFb', m).value.trim()
      });
      closeModal(); toast('Delivery completed!', 'success');
      renderDelivery();
    };
  }});
}
