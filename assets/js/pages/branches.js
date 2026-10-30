/* ===================== MULTI-BRANCH SUPPORT ===================== */
/* Each branch has its own ID; orders/expenses tagged with branchId.
   "All Branches" view aggregates everything for the owner. */

function renderBranches() {
  if (DB.currentUser().role !== 'admin') { app.go('dashboard'); return; }

  const branches = DB.all('branches');
  const orders = DB.all('orders');
  const expenses = DB.all('expenses');

  const content = `
    <h1 class="page-title">🏢 Branches</h1>
    <p class="page-sub">Manage all your shop locations. Orders & expenses can be tagged per branch.</p>

    <div class="filter-bar">
      <button class="btn btn-primary" id="addBranchBtn">+ Add Branch</button>
      <div style="margin-left:auto;font-size:13px;color:var(--text-soft);">
        Active branch: <b style="color:var(--primary);">${getActiveBranchName()}</b>
        <button class="btn btn-secondary btn-sm" id="switchBtn" style="margin-left:8px;">🔄 Switch</button>
      </div>
    </div>

    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
      ${branches.map(b => {
        const bo = orders.filter(o => (o.branchId||'main') === b.id);
        const rev = bo.reduce((s,o)=>s+(o.total||0),0);
        const exp = expenses.filter(e => (e.branchId||'main') === b.id).reduce((s,e)=>s+(e.amount||0),0);
        return `
          <div class="card">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,${b.color||'#4f7cff'},#6a5cff);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;">🏢</div>
              <div style="flex:1;">
                <div style="font-weight:800;font-size:15px;">${escapeHtml(b.name)}</div>
                <div style="font-size:11px;color:var(--text-soft);">${escapeHtml(b.address||'-')}</div>
              </div>
              ${b.isActive ? '<span class="badge paid">ACTIVE</span>' : ''}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;font-size:12px;">
              <div style="background:var(--surface-alt);padding:8px;border-radius:6px;text-align:center;">
                <div style="color:var(--text-soft);">Orders</div>
                <div style="font-weight:800;">${bo.length}</div>
              </div>
              <div style="background:var(--surface-alt);padding:8px;border-radius:6px;text-align:center;">
                <div style="color:var(--text-soft);">Revenue</div>
                <div style="font-weight:800;color:var(--success);">${fmtMoney(rev)}</div>
              </div>
              <div style="background:var(--surface-alt);padding:8px;border-radius:6px;text-align:center;">
                <div style="color:var(--text-soft);">Expenses</div>
                <div style="font-weight:800;color:var(--danger);">${fmtMoney(exp)}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:10px;">
              <button class="btn btn-secondary btn-sm" data-act="switch" data-id="${b.id}" style="flex:1;">🔄 Use This</button>
              <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${b.id}">✏️</button>
              ${b.id !== 'main' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${b.id}">🗑️</button>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="card-header"><h3>📊 Branch Comparison</h3></div>
      <table class="tbl">
        <thead><tr><th>Branch</th><th>Orders</th><th>Revenue</th><th>Collected</th><th>Outstanding</th><th>Expenses</th><th>Net Profit</th></tr></thead>
        <tbody>
          ${branches.map(b => {
            const bo = orders.filter(o => (o.branchId||'main') === b.id);
            const rev = bo.reduce((s,o)=>s+(o.total||0),0);
            const paid = bo.reduce((s,o)=>s+(o.paid||0),0);
            const due = bo.reduce((s,o)=>s+(o.due||0),0);
            const exp = expenses.filter(e => (e.branchId||'main') === b.id).reduce((s,e)=>s+(e.amount||0),0);
            const profit = paid - exp;
            return `<tr>
              <td><b>🏢 ${escapeHtml(b.name)}</b></td>
              <td>${bo.length}</td>
              <td><b>${fmtMoney(rev)}</b></td>
              <td style="color:var(--success);">${fmtMoney(paid)}</td>
              <td style="color:var(--danger);">${fmtMoney(due)}</td>
              <td>${fmtMoney(exp)}</td>
              <td><b style="color:${profit>=0?'var(--success)':'var(--danger)'};">${fmtMoney(profit)}</b></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('branches', content);
  bindLayout();

  $('#addBranchBtn').onclick = () => openBranchForm();
  $('#switchBtn').onclick = openBranchSwitcher;
  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'switch') { setActiveBranch(id); toast(`Switched to ${DB.get('branches', id).name}`, 'success'); renderBranches(); }
    else if (b.dataset.act === 'edit') openBranchForm(DB.get('branches', id));
    else if (b.dataset.act === 'del') confirmDialog('Delete this branch? Its orders will remain in records.', () => { DB.remove('branches', id); renderBranches(); });
  });
}

function openBranchForm(existing) {
  const b = existing || { name:'', address:'', phone:'', color:'#4f7cff' };
  openModal(`
    <h3>${existing?'Edit':'Add'} Branch</h3>
    <div class="form-row">
      <div class="field"><label>Branch Name *</label><input id="bName" value="${escapeHtml(b.name)}" placeholder="e.g. Main Branch, Gulshan, DHA"/></div>
      <div class="field"><label>Phone</label><input id="bPhone" value="${escapeHtml(b.phone||'')}"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Address</label><input id="bAddr" value="${escapeHtml(b.address||'')}"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Color (for charts)</label><input type="color" id="bColor" value="${b.color||'#4f7cff'}"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `, { onOpen(m){
    $('#saveBtn', m).onclick = () => {
      const name = $('#bName', m).value.trim();
      if (!name) { toast('Name required','error'); return; }
      const data = {
        name,
        address: $('#bAddr', m).value.trim(),
        phone: $('#bPhone', m).value.trim(),
        color: $('#bColor', m).value
      };
      if (existing) DB.update('branches', existing.id, data);
      else DB.insert('branches', data);
      closeModal(); toast('Saved','success'); renderBranches();
      if (typeof logAction === 'function') logAction(existing?'branch.edit':'branch.add', name);
    };
  }});
}

function openBranchSwitcher() {
  const branches = DB.all('branches');
  const active = getActiveBranchId();
  openModal(`
    <h3>🔄 Switch Active Branch</h3>
    <p class="sub">All new orders will be tagged to the selected branch.</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${branches.map(b => `
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid ${active===b.id?'var(--primary)':'var(--border)'};border-radius:10px;cursor:pointer;background:${active===b.id?'var(--primary-light)':'var(--surface)'};">
          <input type="radio" name="br" value="${b.id}" ${active===b.id?'checked':''}/>
          <div style="flex:1;">
            <div style="font-weight:700;">🏢 ${escapeHtml(b.name)}</div>
            <div style="font-size:11px;color:var(--text-soft);">${escapeHtml(b.address||'-')}</div>
          </div>
        </label>
      `).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="okBtn">✅ Switch</button>
    </div>
  `, { onOpen(m){
    $('#okBtn', m).onclick = () => {
      const sel = m.querySelector('input[name="br"]:checked');
      if (sel) {
        setActiveBranch(sel.value);
        toast(`Switched to ${DB.get('branches', sel.value).name}`, 'success');
        if (typeof logAction === 'function') logAction('branch.switch', sel.value);
      }
      closeModal();
      if (typeof app !== 'undefined') app.go(app.current);
    };
  }});
}

/* ===== Helper functions ===== */
function getActiveBranchId() {
  const stored = sessionStorage.getItem('mrLaundryActiveBranch');
  if (stored && DB.get('branches', stored)) return stored;
  // Default to first branch
  const branches = DB.all('branches');
  return branches[0]?.id || 'main';
}
function setActiveBranch(id) {
  sessionStorage.setItem('mrLaundryActiveBranch', id);
}
function getActiveBranchName() {
  const b = DB.get('branches', getActiveBranchId());
  return b ? b.name : 'Main Branch';
}
