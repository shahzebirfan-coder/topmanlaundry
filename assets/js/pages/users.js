/* ===================== USERS (Admin only) ===================== */
function renderUsers() {
  if (DB.currentUser().role !== 'admin') { app.go('dashboard'); return; }
  const content = `
    <h1 class="page-title">👥 Users & Permissions</h1>
    <p class="page-sub">Manage who can access the system and what each cashier can see.</p>

    <div class="filter-bar">
      <button class="btn btn-primary" id="addUserBtn">+ Add User</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Permissions</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody id="usrBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('users', content);
  bindLayout();
  $('#addUserBtn').onclick = () => openUserForm();
  renderUsersBody();
}

function renderUsersBody() {
  const users = DB.all('users');
  $('#usrBody').innerHTML = users.map(u => {
    const permCount = u.role === 'admin' ? 'All access' :
      (Array.isArray(u.permissions) ? u.permissions.length : 3) + ' permissions';
    return `
    <tr>
      <td><b>${escapeHtml(u.name)}</b></td>
      <td><code>${escapeHtml(u.username)}</code></td>
      <td><span class="badge ${u.role}">${u.role === 'admin' ? '👑 Admin' : '🧑‍💼 Cashier'}</span></td>
      <td>${u.role === 'admin'
        ? '<span style="color:var(--success);font-weight:600;">✅ All access</span>'
        : `<span style="font-size:12px;">${permCount}</span>`}</td>
      <td>${fmtDateShort(u.createdAt)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${u.id}">✏️ Edit</button>
        ${u.role !== 'admin' ? `<button class="btn btn-warning btn-sm" data-act="perms" data-id="${u.id}" title="Manage Permissions">🔐 Permissions</button>` : ''}
        <button class="btn btn-primary btn-sm" data-act="reset" data-id="${u.id}" title="Reset Password (admin override)">🔑 Reset Pass</button>
        ${u.id !== DB.currentUser().id ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${u.id}">🗑️</button>` : '<small style="color:var(--text-soft);">(you)</small>'}
      </td>
    </tr>
  `;
  }).join('');
  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openUserForm(DB.get('users', id));
    else if (b.dataset.act === 'perms') openPermissionsDialog(id);
    else if (b.dataset.act === 'reset') openAdminResetPassword(id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this user?', () => {
      if (typeof logAction === 'function') logAction('user.delete', id);
      DB.remove('users', id);
      renderUsersBody();
    });
  });
}

function openUserForm(existing) {
  const u = existing || { name:'', username:'', password:'', role:'cashier' };
  openModal(`
    <h3>${existing?'Edit':'Add'} User</h3>
    <div class="form-row">
      <div class="field"><label>Full Name *</label><input id="uName" value="${escapeHtml(u.name)}"/></div>
      <div class="field"><label>Username *</label><input id="uUser" value="${escapeHtml(u.username)}"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Password ${existing?'(leave blank to keep)':'*'}</label><input type="text" id="uPass" placeholder="${existing?'••••••••':''}"/></div>
      <div class="field"><label>Role</label>
        <select id="uRole">
          <option value="cashier" ${u.role==='cashier'?'selected':''}>🧑‍💼 Cashier</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>👑 Admin</option>
        </select>
      </div>
    </div>

    <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px;border-radius:8px;margin-top:10px;margin-bottom:12px;">
      <div style="font-weight:700;margin-bottom:6px;">🔐 Password Recovery (Optional but Recommended!)</div>
      <small style="color:var(--text-soft);display:block;margin-bottom:8px;">If you forget your password, you can recover it using this security question. Set this for every user!</small>
      <div class="form-row">
        <div class="field"><label>Security Question</label>
          <select id="uSecQ">
            <option value="">-- Choose a question --</option>
            <option value="mother" ${u.securityQuestion==='mother'?'selected':''}>👩 Mother's name?</option>
            <option value="city" ${u.securityQuestion==='city'?'selected':''}>🏙️ City you were born in?</option>
            <option value="school" ${u.securityQuestion==='school'?'selected':''}>🏫 First school name?</option>
            <option value="pet" ${u.securityQuestion==='pet'?'selected':''}>🐾 First pet's name?</option>
            <option value="favfood" ${u.securityQuestion==='favfood'?'selected':''}>🍔 Favorite food?</option>
            <option value="phone" ${u.securityQuestion==='phone'?'selected':''}>📱 Your old phone number?</option>
            <option value="custom" ${u.securityQuestion==='custom'?'selected':''}>✏️ Custom question</option>
          </select>
        </div>
        <div class="field"><label>Your Answer ${u.securityAnswer?'(already set)':''}</label><input type="text" id="uSecA" placeholder="${u.securityAnswer?'(leave blank to keep current)':'e.g. Fatima'}"/></div>
      </div>
      <div class="field" id="uSecCustomWrap" style="display:${u.securityQuestion==='custom'?'block':'none'};margin-top:8px;">
        <label>Your Custom Question</label>
        <input type="text" id="uSecCustom" value="${escapeHtml(u.securityQuestionCustom||'')}" placeholder="e.g. My favorite cricketer?"/>
      </div>
    </div>
    ${existing && u.role !== 'admin' ? `
      <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:12px;margin-top:10px;">
        💡 To manage what this cashier can see, click <b>"🔐 Permissions"</b> button in the users list.
      </div>
    ` : ''}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `, { onOpen(m){
    const secQSel = $('#uSecQ', m);
    const customWrap = $('#uSecCustomWrap', m);
    if (secQSel) secQSel.onchange = () => { customWrap.style.display = secQSel.value === 'custom' ? 'block' : 'none'; };
    $('#saveBtn', m).onclick = () => {
      const name = $('#uName', m).value.trim();
      const username = $('#uUser', m).value.trim();
      const password = $('#uPass', m).value;
      const role = $('#uRole', m).value;
      if (!name || !username || (!existing && !password)) { toast('All fields required','error'); return; }
      const dup = DB.all('users').find(x => x.username === username && x.id !== (existing?existing.id:null));
      if (dup) { toast('Username already exists','error'); return; }
      const data = { name, username, role };
      if (password) data.password = password;
      // Security question
      const secQ = $('#uSecQ', m).value;
      const secA = $('#uSecA', m).value.trim();
      const secCustom = $('#uSecCustom', m).value.trim();
      if (secQ) data.securityQuestion = secQ;
      if (secQ === 'custom') data.securityQuestionCustom = secCustom;
      if (secA) data.securityAnswer = secA.toLowerCase(); // store lowercase for case-insensitive match
      // New cashiers get default permissions
      if (!existing && role === 'cashier') {
        data.permissions = (typeof ALL_PERMISSIONS !== 'undefined')
          ? ALL_PERMISSIONS.filter(p => p.defaultCashier).map(p => p.id)
          : ['pos','orders','customers'];
      }
      if (existing) DB.update('users', existing.id, data);
      else DB.insert('users', { ...data, password });
      closeModal(); toast('Saved','success'); renderUsersBody();
      if (typeof logAction === 'function') logAction(existing?'user.edit':'user.add', name);
    };
  }});
}

/* ===== Permissions dialog ===== */
function openPermissionsDialog(userId) {
  const u = DB.get('users', userId);
  if (!u) return;
  if (u.role === 'admin') { toast('Admin already has all access','warning'); return; }

  const current = Array.isArray(u.permissions)
    ? u.permissions
    : (typeof ALL_PERMISSIONS !== 'undefined' ? ALL_PERMISSIONS.filter(p => p.defaultCashier).map(p => p.id) : ['pos','orders','customers']);

  // Group permissions
  const pageGroup = ALL_PERMISSIONS.filter(p => !p.sensitive);
  const sensitiveGroup = ALL_PERMISSIONS.filter(p => p.sensitive);

  const renderRow = (p) => `
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:${current.includes(p.id)?'var(--primary-light)':'var(--surface)'};margin-bottom:6px;">
      <input type="checkbox" data-perm="${p.id}" ${current.includes(p.id)?'checked':''} style="margin-top:3px;width:18px;height:18px;"/>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:13px;">${p.label}</div>
        <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">${escapeHtml(p.desc)}</div>
      </div>
    </label>
  `;

  openModal(`
    <h3>🔐 Permissions — ${escapeHtml(u.name)}</h3>
    <p class="sub">Choose what this cashier can access. Uncheck to hide.</p>

    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
      <button class="btn btn-secondary btn-sm" id="presetMin">📋 Minimum (POS only)</button>
      <button class="btn btn-secondary btn-sm" id="presetTeller">💵 Cashier + Daily Performance</button>
      <button class="btn btn-secondary btn-sm" id="presetSr">⭐ Senior Cashier</button>
      <button class="btn btn-secondary btn-sm" id="presetMgr">👔 Manager (almost admin)</button>
    </div>

    <div style="background:var(--surface-alt);padding:12px;border-radius:8px;margin-bottom:14px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;">📄 Page Access</div>
      ${pageGroup.map(renderRow).join('')}
    </div>

    <div style="background:#fef3c7;padding:12px;border-radius:8px;border-left:4px solid #f59e0b;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">⚠️ Sensitive Operations</div>
      <div style="font-size:11px;color:#92400e;margin-bottom:8px;">Grant carefully — these allow editing/deleting data.</div>
      ${sensitiveGroup.map(renderRow).join('')}
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="revokeAllBtn">⛔ Revoke All</button>
      <button class="btn btn-primary" id="savePermsBtn">💾 Save Permissions</button>
    </div>
  `, { large: true, onOpen(m) {
    // Live update background color on toggle
    m.querySelectorAll('input[data-perm]').forEach(cb => {
      cb.onchange = () => {
        const lbl = cb.closest('label');
        lbl.style.background = cb.checked ? 'var(--primary-light)' : 'var(--surface)';
      };
    });

    const applyPreset = (perms) => {
      m.querySelectorAll('input[data-perm]').forEach(cb => {
        cb.checked = perms.includes(cb.dataset.perm);
        cb.closest('label').style.background = cb.checked ? 'var(--primary-light)' : 'var(--surface)';
      });
    };

    $('#presetMin', m).onclick = () => applyPreset(['pos','orders','customers']);
    $('#presetTeller', m).onclick = () => applyPreset(['pos','orders','customers','dashboard','cashbook']);
    $('#presetSr', m).onclick = () => applyPreset(['pos','orders','customers','dashboard','cashbook','ledger','expenses','viewPhotos']);
    $('#presetMgr', m).onclick = () => applyPreset(['pos','orders','customers','dashboard','cashbook','ledger','expenses','reports','products','inventory','vendors','purchaseOrders','viewPhotos','editInvoice','editProducts']);
    $('#revokeAllBtn', m).onclick = () => {
      confirmDialog('Revoke ALL permissions? This cashier won\u2019t see ANY pages.', () => applyPreset([]));
    };

    $('#savePermsBtn', m).onclick = () => {
      const perms = Array.from(m.querySelectorAll('input[data-perm]:checked')).map(cb => cb.dataset.perm);
      setUserPermissions(userId, perms);
      closeModal();
      toast(`Permissions updated for ${u.name}`, 'success');
      if (typeof logAction === 'function') logAction('user.permissions', `${u.username}: ${perms.length} perms`);
      renderUsersBody();
    };
  }});
}
