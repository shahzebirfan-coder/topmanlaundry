/* ===================== DAILY CASH RECONCILIATION ===================== */
function renderCashbook() {
  const today = isoDay();
  const content = `
    <h1 class="page-title">💵 Cash Book / Daily Reconciliation</h1>
    <p class="page-sub">End-of-day cash counting. Match expected cash vs actual cash to detect discrepancies.</p>

    <div class="filter-bar">
      <label>Date <input type="date" id="cbDate" value="${today}"/></label>
      <button class="btn btn-primary" id="closeDayBtn">📕 Close This Day</button>
    </div>

    <div id="cbContent"></div>
  `;
  $('#app').innerHTML = renderLayout('cashbook', content);
  bindLayout();
  $('#cbDate').onchange = renderCashbookContent;
  $('#closeDayBtn').onclick = openCloseDayDialog;
  renderCashbookContent();
}

/* ------------------------------------------------------------------
   Single source of truth for one day's cash movements.
   • Payments are counted on the day they were RECEIVED (paymentsLog.at),
     not the day the order was booked — so later collections land in the
     right drawer.
   • Owner withdrawals and cash expenses both leave the drawer.
   Used by the cash book, the day-closure dialog and the Z-report.
------------------------------------------------------------------ */
function cashFlowForDate(date) {
  const raw = { cash: 0, card: 0, bank: 0, cheque: 0, jazzcash: 0, easypaisa: 0, online: 0, other: 0 };
  let paymentCount = 0, cashPaymentCount = 0;

  const addPayment = (method, amount) => {
    if (!amount) return;
    const m = String(method || 'cash').toLowerCase();
    raw[m] = (raw[m] || 0) + amount;
    paymentCount++;
    if (m === 'cash') cashPaymentCount++;
  };

  for (const o of DB.all('orders')) {
    const log = Array.isArray(o.paymentsLog) ? o.paymentsLog : [];
    let logged = 0;
    for (const p of log) {
      const amt = p.amount || 0;
      logged += amt;
      if ((p.at || o.createdAt || '').slice(0, 10) === date) addPayment(p.method, amt);
    }
    // initial payment taken at booking (only for orders booked that day)
    if ((o.createdAt || '').slice(0, 10) === date) {
      const firstPay = (o.paid || 0) - logged;
      if (firstPay > 0) addPayment(o.paymentMethod, firstPay);
    }
  }

  const expenses = DB.all('expenses')
    .filter(e => (e.date || (e.createdAt || '').slice(0, 10)) === date);
  const cashExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const drawings = DB.all('ownerDrawings')
    .filter(d => (d.date || (d.createdAt || '').slice(0, 10)) === date && (d.source || 'cash') === 'cash');
  const cashDrawings = drawings.reduce((s, d) => s + (d.amount || 0), 0);

  const closures = DB.all('dayClosures')
    .filter(c => c.date === date)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const opening = closures[0] ? (closures[0].openingCash || 0) : 0;

  const cashIn  = raw.cash || 0;
  const totalIn = Object.values(raw).reduce((s, v) => s + v, 0);
  const expected = opening + cashIn - cashExpenses - cashDrawings;

  return { raw, cashIn, totalIn, cashExpenses, cashDrawings, expenses, drawings, closures, opening, expected, paymentCount, cashPaymentCount };
}

function renderCashbookContent() {
  const date = $('#cbDate').value || isoDay();
  const f = cashFlowForDate(date);
  const cardIn   = f.raw.card || 0;
  const bankIn   = f.raw.bank || 0;
  const chequeIn = f.raw.cheque || 0;
  const onlineIn = (f.raw.jazzcash || 0) + (f.raw.easypaisa || 0) + (f.raw.online || 0);
  const closures = f.closures;

  $('#cbContent').innerHTML = `
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));">
      <div class="stat-card"><div class="ic b1">📥</div><div><div class="lbl">Opening Cash</div><div class="val">${fmtMoney(f.opening)}</div></div></div>
      <div class="stat-card"><div class="ic b2">💵</div><div><div class="lbl">Cash Sales</div><div class="val" style="color:var(--success);">${fmtMoney(f.cashIn)}</div></div></div>
      <div class="stat-card"><div class="ic b3">💸</div><div><div class="lbl">Cash Expenses</div><div class="val" style="color:var(--danger);">${fmtMoney(f.cashExpenses)}</div></div></div>
      <div class="stat-card"><div class="ic b5">👤</div><div><div class="lbl">Owner Drawings</div><div class="val" style="color:#ea580c;">${fmtMoney(f.cashDrawings)}</div></div></div>
      <div class="stat-card"><div class="ic b4">📊</div><div><div class="lbl">Expected Cash in Drawer</div><div class="val" style="color:var(--primary);">${fmtMoney(f.expected)}</div></div></div>
    </div>

    <div style="display:grid;gap:20px;grid-template-columns:1fr 1fr;">
      <div class="card">
        <div class="card-header"><h3>💵 Cash Movement</h3></div>
        <table class="tbl">
          <tr><td>Opening Cash:</td><td style="text-align:right;"><b>${fmtMoney(f.opening)}</b></td></tr>
          <tr><td>+ Cash Sales (${f.cashPaymentCount} payment${f.cashPaymentCount === 1 ? '' : 's'}):</td><td style="text-align:right;color:var(--success);"><b>+${fmtMoney(f.cashIn)}</b></td></tr>
          <tr><td>− Cash Expenses (${f.expenses.length} item${f.expenses.length === 1 ? '' : 's'}):</td><td style="text-align:right;color:var(--danger);"><b>−${fmtMoney(f.cashExpenses)}</b></td></tr>
          <tr><td>− Owner Drawings (${f.drawings.length} withdrawal${f.drawings.length === 1 ? '' : 's'}):</td><td style="text-align:right;color:#ea580c;"><b>−${fmtMoney(f.cashDrawings)}</b></td></tr>
          <tr style="border-top:2px solid var(--border);"><td style="padding-top:10px;"><b>Expected Cash:</b></td><td style="text-align:right;padding-top:10px;font-size:18px;color:var(--primary);"><b>${fmtMoney(f.expected)}</b></td></tr>
        </table>
      </div>

      <div class="card">
        <div class="card-header"><h3>📊 All Payments Today</h3></div>
        <table class="tbl">
          <tr><td>💵 Cash:</td><td style="text-align:right;"><b>${fmtMoney(f.cashIn)}</b></td></tr>
          <tr><td>💳 Card:</td><td style="text-align:right;"><b>${fmtMoney(cardIn)}</b></td></tr>
          <tr><td>🏦 Bank Transfer:</td><td style="text-align:right;"><b>${fmtMoney(bankIn)}</b></td></tr>
          ${chequeIn ? `<tr><td>🧾 Cheque:</td><td style="text-align:right;"><b>${fmtMoney(chequeIn)}</b></td></tr>` : ''}
          <tr><td>📱 JazzCash/Easypaisa:</td><td style="text-align:right;"><b>${fmtMoney(onlineIn)}</b></td></tr>
          <tr style="border-top:2px solid var(--border);"><td style="padding-top:10px;"><b>Total Collected (${f.paymentCount} payment${f.paymentCount === 1 ? '' : 's'}):</b></td><td style="text-align:right;padding-top:10px;font-size:18px;color:var(--success);"><b>${fmtMoney(f.totalIn)}</b></td></tr>
        </table>
      </div>
    </div>

    ${closures.length ? `
      <div class="card" style="margin-top:20px;">
        <div class="card-header"><h3>📕 Day Closures for ${date}</h3></div>
        <table class="tbl">
          <thead><tr><th>Time</th><th>Closed By</th><th>Expected</th><th>Actual Counted</th><th>Difference</th><th>Note</th></tr></thead>
          <tbody>${closures.map(cl => {
            const diff = (cl.actualCash || 0) - (cl.expectedCash || 0);
            return `<tr>
              <td>${fmtDate(cl.createdAt)}</td>
              <td>${escapeHtml(cl.userName || '-')}</td>
              <td>${fmtMoney(cl.expectedCash)}</td>
              <td><b>${fmtMoney(cl.actualCash)}</b></td>
              <td><b style="color:${diff === 0 ? 'var(--success)' : (diff > 0 ? 'var(--warning)' : 'var(--danger)')};">${diff > 0 ? '+' : ''}${fmtMoney(diff)}</b></td>
              <td>${escapeHtml(cl.note || '-')}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    ` : ''}
  `;
}

function openCloseDayDialog() {
  const date = $('#cbDate').value || isoDay();
  const f = cashFlowForDate(date);
  const opening = f.opening;
  const cashIn = f.cashIn;
  const cashExpenses = f.cashExpenses;
  const cashDrawings = f.cashDrawings;
  const expected = f.expected;

  openModal(`
    <h3>📕 Close Day — ${date}</h3>
    <p class="sub">Count the actual cash in your drawer and enter it below. System will calculate the difference.</p>

    <div style="background:var(--primary-light);padding:14px;border-radius:10px;margin-bottom:14px;text-align:center;">
      <div style="font-size:12px;color:var(--text-soft);">Expected Cash in Drawer</div>
      <div style="font-size:28px;font-weight:900;color:var(--primary);">${fmtMoney(expected)}</div>
      <div style="font-size:11.5px;color:var(--text-soft);margin-top:6px;">
        Opening ${fmtMoney(opening)} + Cash ${fmtMoney(cashIn)} − Expenses ${fmtMoney(cashExpenses)} − Drawings ${fmtMoney(cashDrawings)}
      </div>
    </div>

    <div class="form-row">
      <div class="field"><label>Actual Cash Counted (Rs.) *</label><input type="number" id="actualCash" value="${expected}" min="0" autofocus style="font-size:18px;font-weight:700;"/></div>
      <div class="field"><label>Opening Cash for Tomorrow (Rs.)</label><input type="number" id="openTomorrow" value="${expected}" min="0"/></div>
    </div>
    <div id="diffLine" style="padding:12px;background:var(--surface-alt);border-radius:8px;margin-bottom:10px;text-align:center;font-weight:700;font-size:15px;"></div>
    <div class="form-row cols-1">
      <div class="field"><label>Notes (optional)</label><input id="closeNote" placeholder="e.g. Cashier handover, short by Rs.50, etc."/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-warning" id="printZBtn" style="display:none;">🖨️ Print Z-Report</button>
      <button class="btn btn-primary" id="saveBtn">📕 Save Closure</button>
    </div>
  `, { onOpen(m){
    const updateDiff = () => {
      const actual = +$('#actualCash', m).value || 0;
      const diff = actual - expected;
      let txt;
      if (diff === 0) txt = '<span style="color:var(--success);">✅ Cash matches perfectly!</span>';
      else if (diff > 0) txt = `<span style="color:var(--warning);">⚠️ Surplus: +${fmtMoney(diff)} (extra cash)</span>`;
      else txt = `<span style="color:var(--danger);">❌ Short by ${fmtMoney(Math.abs(diff))}</span>`;
      $('#diffLine', m).innerHTML = txt;
    };
    updateDiff();
    $('#actualCash', m).oninput = updateDiff;
    
    let savedClosureId = null;
    $('#saveBtn', m).onclick = () => {
      const actual = +$('#actualCash', m).value || 0;
      const openTomorrow = +$('#openTomorrow', m).value || 0;
      const closureData = {
        date,
        expectedCash: expected,
        actualCash: actual,
        difference: actual - expected,
        cashSales: cashIn,
        cashExpenses: cashExpenses,
        cashDrawings: cashDrawings,
        openingCash: openTomorrow,
        note: $('#closeNote', m).value.trim(),
        userId: DB.currentUser().id,
        userName: DB.currentUser().name
      };
      const rec = DB.insert('dayClosures', closureData);
      savedClosureId = rec.id;
      
      $('#saveBtn', m).style.display = 'none';
      $('#printZBtn', m).style.display = 'inline-flex';
      
      toast('Day closed successfully','success'); renderCashbookContent();
      if (typeof logAction === 'function') logAction('day.close', `${date}: ${fmtMoney(actual)}`);
      if (typeof triggerGDriveOnDayClose === 'function') triggerGDriveOnDayClose();
    };

    $('#printZBtn', m).onclick = () => {
      if (!savedClosureId) return;
      printZReport(savedClosureId);
      closeModal();
    };
  }});
}

function printZReport(closureId) {
  const closure = DB.get('dayClosures', closureId);
  if (!closure) return;
  const s = DB.settings();
  
  const html = `
    <div style="font-family:sans-serif;width:280px;padding:10px;color:#000;">
      <h2 style="text-align:center;margin:0;font-size:22px;font-weight:900;">${escapeHtml(s.shopName)}</h2>
      <div style="text-align:center;font-size:16px;font-weight:bold;margin:4px 0 10px;border-bottom:2px dashed #000;padding-bottom:4px;">
        Z-REPORT (DAY CLOSURE)
      </div>
      <div style="font-size:13px;margin-bottom:14px;border-bottom:1px dashed #000;padding-bottom:8px;">
        <b>Date:</b> ${closure.date}<br>
        <b>Time:</b> ${new Date(closure.createdAt).toLocaleTimeString()}<br>
        <b>Cashier:</b> ${escapeHtml(closure.userName)}
      </div>
      
      <table style="width:100%;font-size:14px;margin-bottom:10px;border-collapse:collapse;">
        <tr><td style="padding:2px 0;">Opening Cash</td><td style="text-align:right;">${fmtMoney(closure.expectedCash - closure.cashSales + closure.cashExpenses)}</td></tr>
        <tr><td style="padding:2px 0;">+ Cash Sales</td><td style="text-align:right;">${fmtMoney(closure.cashSales)}</td></tr>
        <tr><td style="padding:2px 0;">- Cash Expenses</td><td style="text-align:right;color:#000;">${fmtMoney(closure.cashExpenses)}</td></tr>
        <tr style="border-top:1px solid #000;"><td style="padding:6px 0;font-weight:bold;">Expected Drawer</td><td style="text-align:right;font-weight:bold;">${fmtMoney(closure.expectedCash)}</td></tr>
      </table>
      
      <div style="border:2px solid #000;border-radius:6px;padding:8px;margin-bottom:10px;">
        <table style="width:100%;font-size:15px;font-weight:bold;">
          <tr><td>Actual Counted:</td><td style="text-align:right;">${fmtMoney(closure.actualCash)}</td></tr>
          <tr><td style="padding-top:4px;">Difference:</td><td style="text-align:right;padding-top:4px;">${closure.difference < 0 ? '-' : (closure.difference > 0 ? '+' : '')}${fmtMoney(Math.abs(closure.difference))}</td></tr>
        </table>
      </div>

      <table style="width:100%;font-size:13px;margin-bottom:10px;">
        <tr><td><b>Opening for Tomorrow:</b></td><td style="text-align:right;">${fmtMoney(closure.openingCash)}</td></tr>
      </table>
      
      ${closure.note ? `<div style="font-size:12px;font-style:italic;margin-top:10px;border-top:1px dashed #000;padding-top:6px;">Notes: ${escapeHtml(closure.note)}</div>` : ''}
      
      <div style="text-align:center;font-size:10px;margin-top:14px;">
        End of Shift Report - Powered by Laundry POS POS
      </div>
    </div>
  `;
  
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  if (typeof printElement === 'function') printElement(wrap, { title: 'Z-Report' });
}
