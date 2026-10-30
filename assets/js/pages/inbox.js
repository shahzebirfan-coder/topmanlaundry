/* ===================== INBOX — Messages & Payment Proofs ===================== */
function renderInbox() {
  if (DB.currentUser().role !== 'admin') { app.go('dashboard'); return; }
  const messages = DB.all('messages');
  const proofs = DB.all('paymentProofs');
  const unreadMsgs = messages.filter(m => m.status === 'unread').length;
  const pendingProofs = proofs.filter(p => p.status === 'pending').length;
  const reviews = DB.all('reviews');

  const content = `
    <h1 class="page-title">📨 Inbox — Customer Messages & Payments</h1>
    <p class="page-sub">Review messages, payment proofs, and reviews from your customer portal.</p>

    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:18px;">
      <div class="stat-card"><div class="ic b1">💬</div><div><div class="lbl">Messages</div><div class="val">${messages.length}</div></div></div>
      <div class="stat-card"><div class="ic b3">📨</div><div><div class="lbl">Unread</div><div class="val" style="color:${unreadMsgs>0?'var(--danger)':'var(--success)'};">${unreadMsgs}</div></div></div>
      <div class="stat-card"><div class="ic b2">💳</div><div><div class="lbl">Payment Proofs</div><div class="val">${proofs.length}</div></div></div>
      <div class="stat-card"><div class="ic b3">⏰</div><div><div class="lbl">Pending Verify</div><div class="val" style="color:${pendingProofs>0?'var(--warning)':'var(--success)'};">${pendingProofs}</div></div></div>
      <div class="stat-card"><div class="ic b4">⭐</div><div><div class="lbl">Reviews</div><div class="val">${reviews.length}</div></div></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <button class="btn btn-primary" id="tabMsg">💬 Messages ${unreadMsgs?`<span style="background:#fff;color:var(--primary);padding:2px 8px;border-radius:10px;font-size:11px;margin-left:4px;">${unreadMsgs}</span>`:''}</button>
      <button class="btn btn-secondary" id="tabPay">💳 Payment Proofs ${pendingProofs?`<span style="background:var(--warning);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:4px;">${pendingProofs}</span>`:''}</button>
      <button class="btn btn-secondary" id="tabReviews">⭐ Reviews</button>
    </div>

    <div id="inboxContent"></div>
  `;
  $('#app').innerHTML = renderLayout('inbox', content);
  bindLayout();

  let activeTab = 'messages';
  const renderTab = () => {
    if (activeTab === 'messages') renderMessagesTab();
    else if (activeTab === 'payments') renderPaymentsTab();
    else if (activeTab === 'reviews') renderReviewsTab();
  };
  $('#tabMsg').onclick = () => { activeTab='messages'; updateTabs(); renderTab(); };
  $('#tabPay').onclick = () => { activeTab='payments'; updateTabs(); renderTab(); };
  $('#tabReviews').onclick = () => { activeTab='reviews'; updateTabs(); renderTab(); };

  const updateTabs = () => {
    ['tabMsg','tabPay','tabReviews'].forEach(id => {
      const btn = $('#'+id);
      btn.className = 'btn btn-secondary';
    });
    if (activeTab==='messages') $('#tabMsg').className='btn btn-primary';
    if (activeTab==='payments') $('#tabPay').className='btn btn-primary';
    if (activeTab==='reviews') $('#tabReviews').className='btn btn-primary';
  };
  renderTab();
}

function renderMessagesTab() {
  const msgs = [...DB.all('messages')].sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
  if (!msgs.length) {
    $('#inboxContent').innerHTML = `<div class="card"><div class="empty"><div class="emoji">📭</div><h4>No messages yet</h4></div></div>`;
    return;
  }
  $('#inboxContent').innerHTML = msgs.map(m => {
    const typeIcons = {complaint:'⚠️',request:'💬',question:'❓',feedback:'⭐',other:'📝'};
    const icon = typeIcons[m.type] || '📝';
    return `
      <div class="card" style="margin-bottom:10px;${m.status==='unread'?'border-left:4px solid var(--primary);background:var(--primary-light);':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-weight:800;font-size:15px;">${icon} ${escapeHtml(m.name)} ${m.status==='unread'?'<span class="badge due">NEW</span>':''}</div>
            <div style="font-size:12px;color:var(--text-soft);">📞 ${escapeHtml(m.phone)} • ${fmtDate(m.receivedAt)}</div>
          </div>
          <div style="display:flex;gap:6px;">
            ${(typeof getAutoReply === 'function' && getAutoReply(m.text)) ? `<button class="btn btn-warning btn-sm" onclick="window.open('https://wa.me/${cleanWAPhone(m.phone)}?text=${encodeURIComponent(getAutoReply(m.text))}','_blank')" title="${escapeHtml(getAutoReply(m.text))}">🤖 Auto-Reply</button>` : ''}
            <a href="https://wa.me/${cleanWAPhone(m.phone)}" target="_blank" class="btn btn-success btn-sm">📱 Reply via WhatsApp</a>
            <button class="btn btn-secondary btn-sm" data-act="mark-read" data-id="${m.id}">${m.status==='unread'?'✓ Mark Read':'Mark Unread'}</button>
            <button class="btn btn-danger btn-sm" data-act="del-msg" data-id="${m.id}">🗑️</button>
          </div>
        </div>
        <div style="background:var(--surface-alt);padding:12px;border-radius:8px;margin-top:10px;font-size:13px;white-space:pre-wrap;">${escapeHtml(m.text)}</div>
        ${m.orderId ? `<div style="font-size:11px;margin-top:8px;"><b>About Order:</b> <a href="#" onclick="closeModal();openInvoice('${m.orderId}');return false;">View Invoice</a></div>` : ''}
      </div>
    `;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    const m = DB.get('messages', id);
    if (b.dataset.act === 'mark-read') {
      DB.update('messages', id, { status: m.status==='unread'?'read':'unread' });
      renderMessagesTab();
    } else if (b.dataset.act === 'del-msg') {
      confirmDialog('Delete this message?', () => { DB.remove('messages', id); renderMessagesTab(); });
    }
  });
}

function renderPaymentsTab() {
  const proofs = [...DB.all('paymentProofs')].sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));
  if (!proofs.length) {
    $('#inboxContent').innerHTML = `<div class="card"><div class="empty"><div class="emoji">💳</div><h4>No payment proofs yet</h4></div></div>`;
    return;
  }
  $('#inboxContent').innerHTML = proofs.map(p => {
    const o = DB.get('orders', p.orderId) || {};
    const invNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + p.orderId.slice(-6).toUpperCase();
    const statusColors = {pending:'warning',verified:'success',rejected:'danger'};
    return `
      <div class="card" style="margin-bottom:10px;${p.status==='pending'?'border-left:4px solid var(--warning);background:#fef3c7;':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:800;font-size:15px;">💳 ${escapeHtml(p.payerName)} <span class="badge ${statusColors[p.status]||''}">${p.status.toUpperCase()}</span></div>
            <div style="font-size:12px;color:var(--text-soft);">Invoice: <b>${invNo}</b> • Amount: <b>${fmtMoney(p.amount)}</b> • ${fmtDate(p.submittedAt)}</div>
            ${p.txnId ? `<div style="font-size:12px;margin-top:4px;">TXN ID: <code>${escapeHtml(p.txnId)}</code></div>` : ''}
          </div>
          ${p.screenshot ? `<img src="${p.screenshot}" style="max-width:180px;max-height:200px;border-radius:8px;cursor:pointer;border:2px solid var(--border);" onclick="window.open('${p.screenshot}','_blank')"/>` : ''}
        </div>
        ${p.status === 'pending' ? `
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-success" data-act="verify" data-id="${p.id}">✅ Verify & Mark Invoice Paid</button>
            <button class="btn btn-danger" data-act="reject" data-id="${p.id}">❌ Reject Proof</button>
            <button class="btn btn-secondary btn-sm" data-act="view-inv" data-id="${p.orderId}">👁️ View Invoice</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'verify') {
      const p = DB.get('paymentProofs', id);
      const o = DB.get('orders', p.orderId);
      if (!o) { toast('Order not found','error'); return; }
      // Add p.amount to order's paid, reduce due
      const newPaid = Math.min(o.total, (o.paid||0) + p.amount);
      const newDue = o.total - newPaid;
      DB.update('orders', p.orderId, { paid: newPaid, due: newDue, isCredit: newDue > 0 });
      DB.update('paymentProofs', id, { status: 'verified', verifiedAt: new Date().toISOString(), verifiedBy: DB.currentUser().username });
      if (typeof logAction === 'function') logAction('payment.verify', `${fmtMoney(p.amount)} on INV-${o.invoiceNo||p.orderId.slice(-6)}`);
      toast(`✅ Payment verified! ${fmtMoney(p.amount)} added to ${o.invoiceNo?'INV-'+o.invoiceNo:p.orderId}`, 'success');
      renderPaymentsTab();
    } else if (b.dataset.act === 'reject') {
      confirmDialog('Reject this payment proof? Customer should be notified.', () => {
        DB.update('paymentProofs', id, { status: 'rejected' });
        renderPaymentsTab();
      });
    } else if (b.dataset.act === 'view-inv') {
      openInvoice(id);
    }
  });
}

function renderReviewsTab() {
  const reviews = [...DB.all('reviews')].sort((a,b)=>b.reviewedAt.localeCompare(a.reviewedAt));
  if (!reviews.length) {
    $('#inboxContent').innerHTML = `<div class="card"><div class="empty"><div class="emoji">⭐</div><h4>No reviews yet</h4></div></div>`;
    return;
  }
  const avgRating = reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length;
  const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5-Math.round(n));
  $("#inboxContent").innerHTML = `
    <div class="card" style="text-align:center;padding:20px;margin-bottom:14px;">
      <div style="font-size:32px;font-weight:900;">${avgRating.toFixed(1)} <span style="color:#f59e0b;">★</span></div>
      <div style="font-size:13px;color:var(--text-soft);">${reviews.length} reviews</div>
    </div>
  ` + reviews.map(r => {
    const c = DB.get("customers", r.customerId) || {};
    return `<div class="card" style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:700;">${escapeHtml(c.name||"Customer")}</div>
          <div style="font-size:18px;color:#f59e0b;margin:4px 0;">${stars(r.rating)}</div>
          <div style="font-size:12px;color:var(--text-soft);">${fmtDate(r.reviewedAt)}</div>
        </div>
      </div>
      ${r.comment ? `<div style="margin-top:8px;font-size:13px;background:var(--surface-alt);padding:10px;border-radius:8px;">${escapeHtml(r.comment)}</div>`:""}
    </div>`;
  }).join("");
}

function cleanWAPhone(phone) {
  let p = (phone||"").replace(/[^\d+]/g,"");
  if (p.startsWith("+")) p = p.substring(1);
  if (p.startsWith("0") && p.length === 11) p = "92" + p.substring(1);
  return p;
}
