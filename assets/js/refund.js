/* ============================================================
   Refund / Void with Required Reason
   Cashier cannot delete/void without selecting a reason.
   ============================================================ */

const REFUND_REASONS = [
  { id: 'customer_cancelled', label: '🙅 Customer Cancelled' },
  { id: 'duplicate', label: '🔁 Duplicate Entry' },
  { id: 'pricing_mistake', label: '💸 Pricing Mistake' },
  { id: 'damage_discovered', label: '🛡️ Damage Discovered at Pickup' },
  { id: 'wrong_items', label: '❌ Wrong Items Added' },
  { id: 'payment_failed', label: '💳 Payment Method Failed' },
  { id: 'customer_complaint', label: '😟 Customer Complaint' },
  { id: 'cashier_error', label: '⚠️ Cashier Error' },
  { id: 'system_test', label: '🧪 System Test (Admin)' },
  { id: 'other', label: '📝 Other (specify)' }
];

/* Show void/delete confirmation with reason */
function confirmVoidWithReason(orderId, actionType, callback) {
  const o = DB.get('orders', orderId);
  if (!o) return;
  const invNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + o.id.slice(-6).toUpperCase();
  const isDelete = actionType === 'delete';
  const c = DB.get('customers', o.customerId) || {};

  openModal(`
    <h3 style="color:var(--danger);">${isDelete ? '🗑️ Delete' : '↩️ Void/Refund'} Order ${invNo}</h3>
    <p class="sub">⚠️ This action is permanent and logged. Please select a reason.</p>

    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;margin-bottom:14px;font-size:13px;">
      <b>Customer:</b> ${escapeHtml(c.name||'-')}<br>
      <b>Amount:</b> ${fmtMoney(o.total)}<br>
      <b>Paid:</b> ${fmtMoney(o.paid)}<br>
      <b>Status:</b> ${o.status}
    </div>

    <div class="field">
      <label>Reason *</label>
      <select id="voidReason" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;">
        <option value="">-- Select a reason --</option>
        ${REFUND_REASONS.map(r => `<option value="${r.id}">${r.label}</option>`).join('')}
      </select>
    </div>

    <div class="field" id="otherReasonField" style="display:none;">
      <label>Specify Reason *</label>
      <textarea id="otherReason" rows="2" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;" placeholder="Describe the reason..."></textarea>
    </div>

    <div class="field">
      <label>Additional Notes (optional)</label>
      <textarea id="voidNotes" rows="2" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;" placeholder="Any extra details..."></textarea>
    </div>

    ${o.paid > 0 ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:10px;border-radius:8px;margin-bottom:14px;font-size:12px;color:#92400e;">
      💰 <b>Refund Required:</b> Customer paid <b>${fmtMoney(o.paid)}</b>. Confirm you have returned this amount before proceeding.
    </div>` : ''}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirmVoidBtn">${isDelete ? '🗑️ Delete Permanently' : '↩️ Void Order'}</button>
    </div>
  `, { onOpen(m) {
    const sel = $('#voidReason', m);
    sel.onchange = () => {
      $('#otherReasonField', m).style.display = sel.value === 'other' ? 'block' : 'none';
    };

    $('#confirmVoidBtn', m).onclick = () => {
      const reasonId = sel.value;
      if (!reasonId) { toast('Please select a reason', 'error'); return; }

      let reasonText = REFUND_REASONS.find(r => r.id === reasonId).label;
      if (reasonId === 'other') {
        const other = $('#otherReason', m).value.trim();
        if (!other) { toast('Please specify the reason', 'error'); return; }
        reasonText = '📝 Other: ' + other;
      }

      const notes = $('#voidNotes', m).value.trim();

      // Save refund record before deleting
      DB.insert('refundReasons', {
        orderId: orderId,
        invoiceNo: o.invoiceNo,
        customerId: o.customerId,
        customerName: c.name,
        actionType: actionType,
        reasonId: reasonId,
        reasonText: reasonText,
        notes: notes,
        amount: o.total,
        paidAmount: o.paid,
        cashierId: DB.currentUser().id,
        cashierName: DB.currentUser().name
      });

      // Log
      if (typeof logAction === 'function') {
        logAction(`order.${actionType}`, `${invNo} (${fmtMoney(o.total)}) — Reason: ${reasonText}${notes?' | '+notes:''}`);
      }
      if (typeof checkSuspiciousActivity === 'function') {
        checkSuspiciousActivity(`order.${actionType}`, `${invNo} ${fmtMoney(o.total)} - ${reasonText}`);
      }

      closeModal();
      if (callback) callback();
      toast(`Order ${isDelete?'deleted':'voided'} (${reasonText})`, 'success');
    };
  }});
}

/* View all refunds/voids for admin */
function openRefundLog() {
  if (DB.currentUser().role !== 'admin') return;
  const refunds = [...DB.all('refundReasons')].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  const totalRefunded = refunds.reduce((s,r) => s + (r.paidAmount||0), 0);

  const rows = refunds.length ? refunds.slice(0, 200).map(r => `
    <tr>
      <td style="font-size:11px;">${fmtDate(r.createdAt)}</td>
      <td><b>${escapeHtml(r.invoiceNo ? 'INV-' + r.invoiceNo : '-')}</b></td>
      <td>${escapeHtml(r.customerName||'-')}</td>
      <td><span class="badge ${r.actionType==='delete'?'cancelled':'pending'}">${r.actionType.toUpperCase()}</span></td>
      <td>${escapeHtml(r.reasonText)}</td>
      <td><b>${fmtMoney(r.amount)}</b></td>
      <td style="color:var(--danger);">${fmtMoney(r.paidAmount)}</td>
      <td>${escapeHtml(r.cashierName||r.cashierId)}</td>
    </tr>
  `).join('') : '<tr><td colspan="8" class="empty"><div class="emoji">📋</div><p>No refunds/voids yet</p></td></tr>';

  openModal(`
    <h3>📋 Refund / Void Log</h3>
    <p class="sub">Complete audit trail of all voided and deleted orders.</p>

    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
      <div style="flex:1;min-width:120px;background:var(--surface-alt);padding:10px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:var(--text-soft);">Total Voided</div>
        <div style="font-size:20px;font-weight:800;">${refunds.length}</div>
      </div>
      <div style="flex:1;min-width:140px;background:#fee2e2;padding:10px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:var(--text-soft);">Amount Refunded</div>
        <div style="font-size:18px;font-weight:800;color:var(--danger);">${fmtMoney(totalRefunded)}</div>
      </div>
    </div>

    <div style="overflow-x:auto;">
      <table class="tbl">
        <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Action</th><th>Reason</th><th>Amount</th><th>Refunded</th><th>Cashier</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
  `, { large: true });
}
