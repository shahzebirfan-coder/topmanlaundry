function renderTaskBoard() {
  const content = `
    <h1 class="page-title">📋 Task Board</h1>
    <p class="page-sub">Live view for washing team: what to wash today and urgent deadlines.</p>

    <div class="filter-bar" style="justify-content:space-between;">
      <div style="font-size:14px;font-weight:bold;color:var(--text-soft);">
        📅 Today: ${fmtDateShort(new Date().toISOString())}
      </div>
      <button class="btn btn-secondary" id="printTaskBoardBtn">🖨️ Print Tasks</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px;margin-top:14px;">
      
      <!-- WASHING LIST -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="background:#334155;color:#fff;padding:12px 14px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
          <span>🌀 TO WASH & IRON</span>
          <span id="washCountBadge" style="background:#fff;color:#334155;padding:2px 8px;border-radius:12px;font-size:12px;">0</span>
        </div>
        <div id="washingList" style="padding:10px;display:flex;flex-direction:column;gap:10px;max-height:600px;overflow-y:auto;"></div>
      </div>

      <!-- DEADLINES TODAY -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;border-top:4px solid #ea580c;">
        <div style="background:#ea580c;color:#fff;padding:12px 14px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;">
          <span>🚨 DELIVERIES TODAY</span>
          <span id="deadlineCountBadge" style="background:#fff;color:#ea580c;padding:2px 8px;border-radius:12px;font-size:12px;">0</span>
        </div>
        <div id="deadlineList" style="padding:10px;display:flex;flex-direction:column;gap:10px;max-height:600px;overflow-y:auto;"></div>
      </div>

    </div>
  `;

  $('#app').innerHTML = renderLayout('taskboard', content);
  bindLayout();

  $('#printTaskBoardBtn').onclick = () => printTaskBoard();
  
  renderTaskBoardData();
}

function renderTaskBoardData() {
  const orders = DB.all('orders');
  const todayStr = isoDay();

  // 1. Washing List: orders where status === 'washing' or 'pending'
  const toWashOrders = orders.filter(o => ['washing', 'pending'].includes(o.status));
  toWashOrders.sort((a,b) => (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999'));

  // 2. Deadlines Today: orders where deliveryDate === today
  const deadlineOrders = orders.filter(o => o.deliveryDate === todayStr);

  $('#washCountBadge').textContent = `${toWashOrders.length} Orders`;
  $('#deadlineCountBadge').textContent = `${deadlineOrders.length} Orders`;

  const renderItem = (o) => {
    const isDeadlineTomorrow = o.deliveryDate === isoDay(new Date(Date.now() + 86400000));
    const isDeadlineToday = o.deliveryDate === todayStr;
    const isLate = o.deliveryDate && o.deliveryDate < todayStr;
    
    let delColor = '#64748b';
    if (isLate) delColor = '#b91c1c';
    else if (isDeadlineToday) delColor = '#ea580c';
    else if (isDeadlineTomorrow) delColor = '#ca8a04';

    const inv = o.invoiceNo ? `INV-${o.invoiceNo}` : `#${o.id.slice(-6).toUpperCase()}`;
    const totalPcs = o.items.reduce((s,it) => s + it.qty, 0);
    const itemNames = o.items.map(it => `${it.name} ×${it.qty}`).join(', ');

    return `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div>
          <div style="font-weight:900;font-size:16px;color:#0f172a;margin-bottom:4px;">${inv}</div>
          <div style="font-size:13px;color:#475569;"><b>${totalPcs} pcs</b> (${escapeHtml(itemNames)})</div>
          <div style="font-size:12px;color:${delColor};font-weight:bold;margin-top:4px;">Delivery: ${o.deliveryDate ? escapeHtml(o.deliveryDate) : 'Not Set'}</div>
        </div>
        <div>
          ${['pending','washing'].includes(o.status) 
            ? `<button class="btn btn-success btn-sm" onclick="app.go('orders'); setTimeout(()=>openStatusChange('${o.id}'),200);" style="padding:8px 12px;font-weight:bold;">✅ Ready</button>`
            : `<span style="background:#dcfce7;color:#15803d;padding:4px 8px;border-radius:4px;font-weight:bold;font-size:12px;">✅ Ready</span>`
          }
        </div>
      </div>
    `;
  };

  $('#washingList').innerHTML = toWashOrders.length ? toWashOrders.map(renderItem).join('') : '<div style="text-align:center;padding:20px;color:var(--text-soft);font-size:13px;">No pending washing tasks! 🎉</div>';
  
  $('#deadlineList').innerHTML = deadlineOrders.length ? deadlineOrders.map(renderItem).join('') : '<div style="text-align:center;padding:20px;color:var(--text-soft);font-size:13px;">No deliveries due today.</div>';
}

function printTaskBoard() {
  const s = DB.settings();
  const orders = DB.all('orders');
  const todayStr = isoDay();
  const toWashOrders = orders.filter(o => ['washing', 'pending'].includes(o.status));
  toWashOrders.sort((a,b) => (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999'));

  if (!toWashOrders.length) { toast('Nothing to print!','warning'); return; }

  const html = `
    <div style="font-family:sans-serif;width:280px;padding:10px;color:#000;">
      <h2 style="text-align:center;margin:0;font-size:20px;">${escapeHtml(s.shopName)}</h2>
      <div style="text-align:center;font-size:14px;font-weight:bold;margin:4px 0 10px;border-bottom:2px dashed #000;padding-bottom:4px;">
        WASHING TASK BOARD<br>
        <span style="font-size:12px;font-weight:normal;">${new Date().toLocaleString('en-GB')}</span>
      </div>
      
      ${toWashOrders.map(o => {
        const inv = o.invoiceNo ? `INV-${o.invoiceNo}` : `#${o.id.slice(-6).toUpperCase()}`;
        const totalPcs = o.items.reduce((s,it) => s + it.qty, 0);
        return `
          <div style="border-bottom:1px solid #aaa;padding:6px 0;margin-bottom:4px;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-size:16px;font-weight:900;">[ ] ${inv}</div>
              <div style="font-size:13px;font-weight:bold;">${totalPcs} pcs</div>
            </div>
            <div style="font-size:12px;margin-top:4px;">
              ${o.items.map(it => `${it.qty}x ${escapeHtml(it.name)}`).join(', ')}
            </div>
            ${o.deliveryDate ? `<div style="font-size:11px;font-weight:bold;margin-top:4px;color:#000;">Due: ${escapeHtml(o.deliveryDate)}</div>` : ''}
          </div>
        `;
      }).join('')}
      
      <div style="text-align:center;font-size:11px;margin-top:14px;font-weight:bold;">
        Total Orders to Wash: ${toWashOrders.length}
      </div>
    </div>
  `;
  
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  if (typeof printElement === 'function') printElement(wrap, { title: 'Task Board' });
}
