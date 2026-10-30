/* ============================================================
   OWNER DRAWINGS (Personal Withdrawals from Shop Money)
   - Track when owner takes shop money home (any source)
   - Separates personal use from business expenses
   - Shows balance by source: Cash, JazzCash, Easypaisa, Bank
   - Real profit calculation excludes drawings
   ============================================================ */

let drawingsFilter = { dateFrom: '', dateTo: '', source: 'all' };

function renderDrawings() {
  if (DB.currentUser().role !== 'admin') {
    if (typeof hasPermission === 'function' && !hasPermission('drawings')) {
      app.go('dashboard'); return;
    }
  }

  // Calculate balances by source
  const balances = calculateAllBalances();

  const content = `
    <h1 class="page-title">👤 Owner Drawings — Personal Withdrawals</h1>
    <p class="page-sub">Track money you take from shop for personal/home use. <b>This is NOT a business expense</b> — just keeping you informed of where money went.</p>

    <!-- Balance overview cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:18px;">
      <div class="stat-card" style="background:linear-gradient(135deg,#dcfce7,#f0fdf4);border-left:4px solid #22c55e;">
        <div class="ic" style="background:#22c55e;color:#fff;">💵</div>
        <div>
          <div class="lbl">Cash Drawer Balance</div>
          <div class="val" style="color:#16a34a;">${fmtMoney(balances.cash)}</div>
          <div class="lbl" style="font-size:10px;">Physical cash in shop</div>
        </div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,#fef3c7,#fffbeb);border-left:4px solid #f59e0b;">
        <div class="ic" style="background:#f59e0b;color:#fff;">📱</div>
        <div>
          <div class="lbl">JazzCash Balance</div>
          <div class="val" style="color:#d97706;">${fmtMoney(balances.jazzcash)}</div>
          <div class="lbl" style="font-size:10px;">Received − Withdrawn</div>
        </div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,#dbeafe,#eff6ff);border-left:4px solid #3b82f6;">
        <div class="ic" style="background:#3b82f6;color:#fff;">📱</div>
        <div>
          <div class="lbl">Easypaisa Balance</div>
          <div class="val" style="color:#2563eb;">${fmtMoney(balances.easypaisa)}</div>
          <div class="lbl" style="font-size:10px;">Received − Withdrawn</div>
        </div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,#e9d5ff,#f5f3ff);border-left:4px solid #8b5cf6;">
        <div class="ic" style="background:#8b5cf6;color:#fff;">🏦</div>
        <div>
          <div class="lbl">Bank Balance</div>
          <div class="val" style="color:#7c3aed;">${fmtMoney(balances.bank)}</div>
          <div class="lbl" style="font-size:10px;">Received − Withdrawn</div>
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:18px;">
      <div class="stat-card" style="background:linear-gradient(135deg,#fee2e2,#fef2f2);border-left:4px solid #ef4444;">
        <div class="ic" style="background:#ef4444;color:#fff;">📤</div>
        <div>
          <div class="lbl">Total Drawings Today</div>
          <div class="val" style="color:#dc2626;">${fmtMoney(balances.todayDrawings)}</div>
        </div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,#fed7aa,#fff7ed);border-left:4px solid #ea580c;">
        <div class="ic" style="background:#ea580c;color:#fff;">📅</div>
        <div>
          <div class="lbl">This Month Drawings</div>
          <div class="val" style="color:#c2410c;">${fmtMoney(balances.monthDrawings)}</div>
        </div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,#cffafe,#ecfeff);border-left:4px solid #06b6d4;">
        <div class="ic" style="background:#06b6d4;color:#fff;">📊</div>
        <div>
          <div class="lbl">Total Drawings (All Time)</div>
          <div class="val" style="color:#0891b2;">${fmtMoney(balances.totalDrawings)}</div>
        </div>
      </div>
    </div>

    <!-- Action bar -->
    <div class="filter-bar" style="margin-bottom:14px;">
      <button class="btn btn-success btn-lg" id="addDrawBtn">+ 📤 New Withdrawal (Ghar le jana)</button>
      <select id="dwSource" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <option value="all">All Sources</option>
        <option value="cash">💵 Cash Only</option>
        <option value="jazzcash">📱 JazzCash Only</option>
        <option value="easypaisa">📱 Easypaisa Only</option>
        <option value="bank">🏦 Bank Only</option>
      </select>
      <input type="date" id="dwFrom" placeholder="From"/>
      <input type="date" id="dwTo" placeholder="To"/>
      <button class="btn btn-secondary btn-sm" id="dwToday">Today</button>
      <button class="btn btn-secondary btn-sm" id="dwMonth">This Month</button>
      <button class="btn btn-ghost btn-sm" id="dwClear">Clear</button>
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th>Source</th>
            <th>Amount</th>
            <th>Purpose / Note</th>
            <th>By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="drawBody"></tbody>
      </table>
    </div>
  `;

  $('#app').innerHTML = renderLayout('drawings', content);
  bindLayout();

  $('#addDrawBtn').onclick = () => openDrawingForm();
  $('#dwSource').onchange = (e) => { drawingsFilter.source = e.target.value; renderDrawingsBody(); };
  $('#dwFrom').onchange = (e) => { drawingsFilter.dateFrom = e.target.value; renderDrawingsBody(); };
  $('#dwTo').onchange = (e) => { drawingsFilter.dateTo = e.target.value; renderDrawingsBody(); };
  $('#dwToday').onclick = () => { const t = isoDay(); drawingsFilter.dateFrom = t; drawingsFilter.dateTo = t; renderDrawings(); };
  $('#dwMonth').onclick = () => {
    const d = new Date(), y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0');
    drawingsFilter.dateFrom = `${y}-${m}-01`;
    drawingsFilter.dateTo = isoDay();
    renderDrawings();
  };
  $('#dwClear').onclick = () => { drawingsFilter = { dateFrom: '', dateTo: '', source: 'all' }; renderDrawings(); };
  $('#dwSource').value = drawingsFilter.source;
  $('#dwFrom').value = drawingsFilter.dateFrom;
  $('#dwTo').value = drawingsFilter.dateTo;

  renderDrawingsBody();
}

function renderDrawingsBody() {
  const all = DB.all('ownerDrawings');
  const filtered = all.filter(d => {
    if (drawingsFilter.source !== 'all' && d.source !== drawingsFilter.source) return false;
    const day = (d.date || (d.createdAt || '').slice(0,10));
    if (drawingsFilter.dateFrom && day < drawingsFilter.dateFrom) return false;
    if (drawingsFilter.dateTo && day > drawingsFilter.dateTo) return false;
    return true;
  }).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  if (!filtered.length) {
    $('#drawBody').innerHTML = `<tr><td colspan="6"><div class="empty" style="padding:40px;">
      <div class="emoji">📤</div>
      <h4>No withdrawals yet</h4>
      <p>Click "+ New Withdrawal" when you take money home for personal use.</p>
    </div></td></tr>`;
    return;
  }

  const sourceEmoji = { cash: '💵', jazzcash: '📱', easypaisa: '📱', bank: '🏦' };
  const sourceLabel = { cash: 'Cash', jazzcash: 'JazzCash', easypaisa: 'Easypaisa', bank: 'Bank' };

  const total = filtered.reduce((s,d) => s + (d.amount||0), 0);

  $('#drawBody').innerHTML = filtered.map(d => `
    <tr>
      <td>${escapeHtml(d.date || (d.createdAt||'').slice(0,10))}<br><small style="color:var(--text-soft);">${new Date(d.createdAt).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</small></td>
      <td>${sourceEmoji[d.source] || '💰'} <b>${escapeHtml(sourceLabel[d.source] || d.source)}</b></td>
      <td><b style="color:#dc2626;">− ${fmtMoney(d.amount)}</b></td>
      <td>${escapeHtml(d.purpose || '-')}${d.note ? `<br><small style="color:var(--text-soft);">${escapeHtml(d.note)}</small>` : ''}</td>
      <td><small>${escapeHtml(d.byName || d.by || '-')}</small></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${d.id}" title="Edit">✏️</button>
        <button class="btn btn-secondary btn-sm" data-act="print" data-id="${d.id}" title="Print receipt">🖨️</button>
        <button class="btn btn-danger btn-sm" data-act="del" data-id="${d.id}" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('') + `
    <tr style="background:#fef2f2;font-weight:800;font-size:15px;">
      <td colspan="2" style="text-align:right;padding:12px;">TOTAL DRAWINGS:</td>
      <td colspan="4" style="color:#dc2626;padding:12px;">− ${fmtMoney(total)}</td>
    </tr>
  `;

  $$('#drawBody [data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openDrawingForm(DB.get('ownerDrawings', id));
    else if (b.dataset.act === 'print') printDrawingReceipt(id);
    else if (b.dataset.act === 'del') {
      confirmDialog('Delete this withdrawal entry?', () => {
        if (typeof logAction === 'function') logAction('drawing.delete', `Rs.${DB.get('ownerDrawings', id)?.amount}`);
        DB.remove('ownerDrawings', id);
        toast('Withdrawal deleted', 'success');
        renderDrawings();
      });
    }
  });
}

/* ===== Add / Edit form ===== */
function openDrawingForm(existing) {
  const d = existing || {
    date: isoDay(),
    source: 'cash',
    amount: 0,
    purpose: '',
    note: ''
  };

  const balances = calculateAllBalances();

  openModal(`
    <h3>${existing ? '✏️ Edit' : '+ 📤 New'} Owner Withdrawal</h3>
    <p class="sub">Money jo aap shop se ghar ya personal use ke liye le rahe ho</p>

    <!-- Balance preview -->
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
      💡 <b>Current Balances:</b><br>
      💵 Cash: <b>${fmtMoney(balances.cash)}</b> &nbsp;|&nbsp;
      📱 JazzCash: <b>${fmtMoney(balances.jazzcash)}</b> &nbsp;|&nbsp;
      📱 Easypaisa: <b>${fmtMoney(balances.easypaisa)}</b> &nbsp;|&nbsp;
      🏦 Bank: <b>${fmtMoney(balances.bank)}</b>
    </div>

    <div class="form-row">
      <div class="field">
        <label>Date *</label>
        <input type="date" id="dDate" value="${escapeHtml(d.date)}"/>
      </div>
      <div class="field">
        <label>From Which Source? *</label>
        <select id="dSource" style="font-weight:700;">
          <option value="cash" ${d.source==='cash'?'selected':''}>💵 Cash (Drawer)</option>
          <option value="jazzcash" ${d.source==='jazzcash'?'selected':''}>📱 JazzCash</option>
          <option value="easypaisa" ${d.source==='easypaisa'?'selected':''}>📱 Easypaisa</option>
          <option value="bank" ${d.source==='bank'?'selected':''}>🏦 Bank Transfer</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="field">
        <label>Amount (Rs.) *</label>
        <input type="number" id="dAmount" value="${d.amount}" min="0" style="font-size:18px;font-weight:700;" autofocus/>
        <small id="dWarn" style="color:var(--danger);display:none;">⚠️ Amount exceeds available balance!</small>
      </div>
      <div class="field">
        <label>Purpose</label>
        <select id="dPurpose">
          <option value="">-- Select --</option>
          <option value="Weekly Home Cash" ${d.purpose==='Weekly Home Cash'?'selected':''}>🏠 Weekly Home Cash</option>
          <option value="Daily Home Cash" ${d.purpose==='Daily Home Cash'?'selected':''}>🏠 Daily Home Cash</option>
          <option value="Family Expense" ${d.purpose==='Family Expense'?'selected':''}>👨‍👩‍👧 Family Expense</option>
          <option value="Personal Use" ${d.purpose==='Personal Use'?'selected':''}>👤 Personal Use</option>
          <option value="Medical" ${d.purpose==='Medical'?'selected':''}>🏥 Medical</option>
          <option value="School Fees" ${d.purpose==='School Fees'?'selected':''}>🏫 School/Education</option>
          <option value="Shopping" ${d.purpose==='Shopping'?'selected':''}>🛍️ Shopping</option>
          <option value="Bills (Personal)" ${d.purpose==='Bills (Personal)'?'selected':''}>📃 Personal Bills</option>
          <option value="Other" ${d.purpose==='Other'?'selected':''}>📝 Other</option>
        </select>
      </div>
    </div>

    <div class="form-row cols-1">
      <div class="field">
        <label>Note (optional)</label>
        <input type="text" id="dNote" value="${escapeHtml(d.note||'')}" placeholder="e.g. Eid shopping, Beta ki fees"/>
      </div>
    </div>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px;border-radius:8px;font-size:12px;">
      ℹ️ <b>Note:</b> Yeh entry "Expense" mein NAHI hogi — ye apke profit calculation par effect nahi karega. Sirf ek record ke liye hai ke aap ne kahaan se kitna paisa nikala.
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success btn-lg" id="dSave">💾 ${existing ? 'Update' : 'Save Withdrawal'}</button>
    </div>
  `, { large: true, onOpen(m) {
    const amtEl = $('#dAmount', m);
    const srcEl = $('#dSource', m);
    const warnEl = $('#dWarn', m);

    function checkBalance() {
      const amount = +amtEl.value || 0;
      const src = srcEl.value;
      const available = balances[src] || 0;
      // If editing, add back the current amount to "available"
      const adjAvailable = existing ? available + (d.amount || 0) : available;
      if (amount > adjAvailable) {
        warnEl.style.display = 'block';
        warnEl.textContent = `⚠️ Only ${fmtMoney(adjAvailable)} available in ${src}!`;
      } else {
        warnEl.style.display = 'none';
      }
    }
    amtEl.oninput = checkBalance;
    srcEl.onchange = checkBalance;

    $('#dSave', m).onclick = () => {
      const date = $('#dDate', m).value;
      const source = srcEl.value;
      const amount = +amtEl.value || 0;
      const purpose = $('#dPurpose', m).value;
      const note = $('#dNote', m).value.trim();

      if (!date || amount <= 0) {
        toast('Enter date and amount', 'error');
        return;
      }

      const available = balances[source] || 0;
      const adjAvailable = existing ? available + (d.amount || 0) : available;
      if (amount > adjAvailable) {
        if (!confirm(`⚠️ Amount exceeds available balance!\n\nAvailable: ${fmtMoney(adjAvailable)}\nWithdrawing: ${fmtMoney(amount)}\n\nProceed anyway?`)) return;
      }

      const u = DB.currentUser();
      const data = {
        date, source, amount, purpose, note,
        by: u?.username || 'unknown',
        byName: u?.name || ''
      };

      if (existing) {
        DB.update('ownerDrawings', existing.id, data);
        if (typeof logAction === 'function') logAction('drawing.edit', `${source} Rs.${amount}`);
      } else {
        DB.insert('ownerDrawings', data);
        if (typeof logAction === 'function') logAction('drawing.add', `${source} Rs.${amount} (${purpose||'no purpose'})`);
      }

      try { SoundFX.play('cash'); } catch(e){}
      toast(`✅ Withdrawal recorded: ${fmtMoney(amount)} from ${source}`, 'success');
      closeModal();
      renderDrawings();
    };
  }});
}

/* ===== Print withdrawal receipt slip ===== */
function printDrawingReceipt(id) {
  const d = DB.get('ownerDrawings', id);
  if (!d) return;
  const s = DB.settings();
  const sourceLabel = { cash: 'Cash', jazzcash: 'JazzCash', easypaisa: 'Easypaisa', bank: 'Bank' };

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;width:300px;font-family:Arial;font-size:13px;color:#000;background:#fff;padding:12px;';
  div.innerHTML = `
    <div style="text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;">
      ${s.logoImage ? `<img src="${s.logoImage}" style="max-width:80px;max-height:60px;background:#000;padding:4px;border-radius:6px;"/>` : ''}
      <div style="font-size:16px;font-weight:800;margin-top:6px;">${escapeHtml(s.shopName || 'Laundry POS')}</div>
      <div style="font-size:10px;">${escapeHtml(s.address || '')}</div>
    </div>
    <div style="text-align:center;font-size:14px;font-weight:800;margin:6px 0;padding:6px;background:#000;color:#fff;">OWNER WITHDRAWAL</div>
    <table style="width:100%;font-size:12px;">
      <tr><td>Receipt #:</td><td style="text-align:right;"><b>${d.id.slice(-8).toUpperCase()}</b></td></tr>
      <tr><td>Date:</td><td style="text-align:right;">${new Date(d.createdAt).toLocaleString()}</td></tr>
      <tr><td>By:</td><td style="text-align:right;"><b>${escapeHtml(d.byName || d.by)}</b></td></tr>
      <tr><td>Purpose:</td><td style="text-align:right;">${escapeHtml(d.purpose || '-')}</td></tr>
    </table>
    <div style="border-top:1px dashed #000;margin:8px 0;"></div>
    <table style="width:100%;font-size:14px;">
      <tr><td>Source:</td><td style="text-align:right;"><b>${sourceLabel[d.source]}</b></td></tr>
      <tr style="font-size:18px;font-weight:800;background:#fee2e2;color:#991b1b;">
        <td style="padding:8px;">WITHDRAWN:</td>
        <td style="text-align:right;padding:8px;">${fmtMoney(d.amount)}</td>
      </tr>
      ${d.note ? `<tr><td>Note:</td><td style="text-align:right;font-size:11px;">${escapeHtml(d.note)}</td></tr>`:''}
    </table>
    <div style="text-align:center;margin-top:10px;font-size:10px;border-top:2px dashed #000;padding-top:8px;">
      Owner Drawing — Not a Business Expense<br>
      For personal record only
    </div>
  `;
  document.body.appendChild(div);
  if (typeof printElement === 'function') {
    printElement(div, { title: 'Withdrawal Receipt' }).finally(() => div.remove());
  } else {
    window.print();
    setTimeout(() => div.remove(), 500);
  }
}

/* ============================================================
   BALANCE CALCULATOR (smart — by payment source)
   ============================================================ */
function calculateAllBalances() {
  const orders = DB.all('orders');
  const expenses = DB.all('expenses');
  const drawings = DB.all('ownerDrawings');
  const today = isoDay();
  const monthKey = today.slice(0, 7);

  const received = { cash: 0, jazzcash: 0, easypaisa: 0, bank: 0, card: 0, cheque: 0, online: 0, credit: 0 };

  // Tally payments received (from paymentsLog + initial payment at booking)
  for (const o of orders) {
    if (Array.isArray(o.paymentsLog) && o.paymentsLog.length) {
      for (const p of o.paymentsLog) {
        const method = (p.method || 'cash').toLowerCase();
        received[method] = (received[method] || 0) + (p.amount || 0);
      }
      // Initial payment at booking (if any) — paid minus what's already in log
      const logged = o.paymentsLog.reduce((s,p) => s + (p.amount || 0), 0);
      const firstPay = (o.paid || 0) - logged;
      if (firstPay > 0) {
        const method = (o.paymentMethod || 'cash').toLowerCase();
        received[method] = (received[method] || 0) + firstPay;
      }
    } else if ((o.paid || 0) > 0) {
      // Legacy orders — all initial payment counts to paymentMethod
      const method = (o.paymentMethod || 'cash').toLowerCase();
      received[method] = (received[method] || 0) + (o.paid || 0);
    }
  }

  // Expenses are paid from CASH by default (could enhance later)
  const totalExp = expenses.reduce((s,e) => s + (e.amount || 0), 0);

  // Drawings by source
  const withdrawn = { cash: 0, jazzcash: 0, easypaisa: 0, bank: 0 };
  let todayDraw = 0, monthDraw = 0, totalDraw = 0;
  for (const d of drawings) {
    const amt = d.amount || 0;
    const src = d.source || 'cash';
    withdrawn[src] = (withdrawn[src] || 0) + amt;
    totalDraw += amt;
    const day = d.date || (d.createdAt || '').slice(0,10);
    if (day === today) todayDraw += amt;
    if (day.startsWith(monthKey)) monthDraw += amt;
  }

  return {
    // Balance by source (Received − Withdrawn)
    cash:      (received.cash || 0) - totalExp - withdrawn.cash,
    jazzcash:  (received.jazzcash || 0) - withdrawn.jazzcash,
    easypaisa: (received.easypaisa || 0) - withdrawn.easypaisa,
    bank:      (received.bank || 0) - withdrawn.bank,
    // Raw received (for reports)
    totalReceived: Object.values(received).reduce((s,v) => s+v, 0),
    receivedBySource: received,
    // Drawings summary
    todayDrawings: todayDraw,
    monthDrawings: monthDraw,
    totalDrawings: totalDraw,
    withdrawnBySource: withdrawn,
    // Expenses
    totalExpenses: totalExp
  };
}

window.calculateAllBalances = calculateAllBalances;
window.openDrawingForm = openDrawingForm;
window.printDrawingReceipt = printDrawingReceipt;
