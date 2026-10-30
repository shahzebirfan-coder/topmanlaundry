/* ============================================================
   WhatsApp Status Notifications (one-click, FREE)
   When order status changes, show "Send WhatsApp?" popup.
   ============================================================ */

const WA_STATUS_TEMPLATES = {
  pending: {
    label: 'Pending',
    icon: '⏳',
    template: `Hello {name}, your order has been booked at {shop}.\n\nInvoice: {invoice}\nTotal Pcs: {pcs}\nAmount: {total}\nExpected Delivery: {delivery}\n\nThank you for choosing us!`
  },
  washing: {
    label: 'Washing',
    icon: '🌀',
    template: `Hello {name}, your clothes are now being washed 🌀\n\nInvoice: {invoice}\nExpected Delivery: {delivery}\n\nThank you,\n{shop}`
  },
  ready: {
    label: 'Ready for Pickup',
    icon: '✅',
    template: `Good news {name}! Your order is ready for pickup ✅\n\nInvoice: {invoice}\nTotal Pcs: {pcs}\nAmount: {total}\nDue: {due}\n\nPlease visit us at your convenience.\n📞 {phone}\n{shop}`
  },
  delivered: {
    label: 'Delivered',
    icon: '📦',
    template: `Thank you {name} for collecting your order from {shop}!\n\nInvoice: {invoice}\n\nWe hope you are satisfied with our service. ⭐⭐⭐⭐⭐\n\nLooking forward to serving you again!`
  },
  cancelled: {
    label: 'Cancelled',
    icon: '❌',
    template: `Hello {name}, your order {invoice} has been cancelled.\n\nIf this is incorrect, please contact us at {phone}.\n\nThank you,\n{shop}`
  }
};

function maybePromptWhatsAppOnStatus(orderId, newStatus, oldStatus) {
  if (newStatus === oldStatus) return;
  const s = DB.settings();
  if (s.whatsappAutoPrompt === false) return;

  const o = DB.get('orders', orderId);
  if (!o) return;
  const c = DB.get('customers', o.customerId);
  if (!c || !c.phone) return;

  const tpl = WA_STATUS_TEMPLATES[newStatus];
  if (!tpl) return;

  openWhatsAppStatusDialog(orderId, newStatus);
}

function openWhatsAppStatusDialog(orderId, status) {
  const o = DB.get('orders', orderId);
  const c = DB.get('customers', o.customerId) || {};
  if (!c.phone) { toast('No phone number for this customer','warning'); return; }
  const s = DB.settings();
  const tpl = WA_STATUS_TEMPLATES[status] || WA_STATUS_TEMPLATES.ready;

  const invoiceNo = o.invoiceNo ? `INV-${o.invoiceNo}` : '#' + o.id.slice(-6).toUpperCase();
  const totalPcs = (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);

  const vars = {
    '{name}':     c.name || 'Customer',
    '{shop}':     s.shopName,
    '{invoice}':  invoiceNo,
    '{pcs}':      totalPcs,
    '{total}':    fmtMoney(o.total),
    '{paid}':     fmtMoney(o.paid),
    '{due}':      fmtMoney(o.due),
    '{delivery}': o.deliveryDate || 'TBD',
    '{phone}':    s.phone || '',
    '{address}':  s.address || ''
  };

  let msg = tpl.template;
  Object.entries(vars).forEach(([k,v]) => { msg = msg.split(k).join(v); });

  // Clean phone for WhatsApp
  let phone = c.phone.replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) phone = phone.substring(1);
  if (phone.startsWith('0') && phone.length === 11) phone = '92' + phone.substring(1);

  openModal(`
    <div style="background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;padding:16px;border-radius:10px;margin-bottom:14px;text-align:center;">
      <div style="font-size:36px;">${tpl.icon}📱</div>
      <h3 style="color:#fff;margin:4px 0;font-size:18px;">Status Changed to: ${tpl.label}</h3>
      <div style="font-size:13px;opacity:.9;">Send WhatsApp notification to <b>${escapeHtml(c.name)}</b>?</div>
      <div style="font-size:11px;opacity:.8;margin-top:4px;">📞 +${phone}</div>
    </div>

    <div class="field">
      <label>Message (you can edit before sending)</label>
      <textarea id="waStatusMsg" rows="9" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;">${escapeHtml(msg)}</textarea>
    </div>

    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:12px;color:var(--text-soft);margin-bottom:12px;">
      💡 Clicking <b>Send</b> opens WhatsApp Web/App with this message pre-filled — you just press the send arrow.
    </div>

    <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px;">
      <input type="checkbox" id="waDontAsk"/> Don't ask again for status changes today
    </label>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Skip</button>
      <button class="btn btn-secondary" id="copyWaBtn">📋 Copy</button>
      <button class="btn btn-success btn-lg" id="sendWaBtn" style="padding:14px 24px;font-size:15px;">📱 Send WhatsApp Now</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#copyWaBtn', m).onclick = () => {
      navigator.clipboard.writeText($('#waStatusMsg', m).value)
        .then(() => toast('Copied to clipboard','success'));
    };
    $('#sendWaBtn', m).onclick = () => {
      const text = $('#waStatusMsg', m).value;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      // Log
      if (typeof logAction === 'function') {
        logAction('whatsapp.sent', `Status "${status}" → ${c.name} (INV-${o.invoiceNo||orderId.slice(-6)})`);
      }
      // Mark on order
      const sent = o.whatsappLog || [];
      sent.push({ status, sentAt: new Date().toISOString(), by: DB.currentUser()?.username });
      DB.update('orders', orderId, { whatsappLog: sent });
      // Save "don't ask"
      if ($('#waDontAsk', m).checked) {
        sessionStorage.setItem('mrLaundryWaPause', isoDay());
      }
      toast('Opening WhatsApp...', 'success');
      closeModal();
    };
  }});
}

/* Edit status templates from settings */
function openWhatsAppTemplateEditor() {
  const s = DB.settings();
  const overrides = s.whatsappStatusTemplates || {};

  openModal(`
    <h3>📱 WhatsApp Status Templates</h3>
    <p class="sub">Customize messages for each status. Use {name} {shop} {invoice} {pcs} {total} {paid} {due} {delivery} {phone} {address}.</p>

    <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:14px;padding:10px;background:var(--surface-alt);border-radius:8px;">
      <input type="checkbox" id="waAutoPrompt" ${s.whatsappAutoPrompt!==false?'checked':''}/>
      <b>Auto-prompt WhatsApp when order status changes</b>
    </label>

    ${Object.entries(WA_STATUS_TEMPLATES).map(([key, tpl]) => `
      <div class="field">
        <label>${tpl.icon} ${tpl.label}</label>
        <textarea data-tpl="${key}" rows="5" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:12px;">${escapeHtml(overrides[key] || tpl.template)}</textarea>
      </div>
    `).join('')}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="resetBtn">Reset to Defaults</button>
      <button class="btn btn-primary" id="saveBtn">💾 Save Templates</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#saveBtn', m).onclick = () => {
      const templates = {};
      $$('[data-tpl]', m).forEach(ta => {
        templates[ta.dataset.tpl] = ta.value;
        // Live-update WA_STATUS_TEMPLATES so it takes effect immediately
        if (WA_STATUS_TEMPLATES[ta.dataset.tpl]) {
          WA_STATUS_TEMPLATES[ta.dataset.tpl].template = ta.value;
        }
      });
      DB.saveSettings({
        whatsappStatusTemplates: templates,
        whatsappAutoPrompt: $('#waAutoPrompt', m).checked
      });
      toast('Templates saved','success');
      closeModal();
    };
    $('#resetBtn', m).onclick = () => {
      confirmDialog('Reset all templates to defaults?', () => {
        DB.saveSettings({ whatsappStatusTemplates: {} });
        toast('Reset done','success');
        closeModal();
      });
    };
  }});
}

/* Apply saved template overrides on load */
(function loadTemplateOverrides() {
  if (typeof DB === 'undefined') return;
  const s = DB.settings();
  const overrides = s.whatsappStatusTemplates || {};
  Object.entries(overrides).forEach(([key, val]) => {
    if (WA_STATUS_TEMPLATES[key]) WA_STATUS_TEMPLATES[key].template = val;
  });
})();

/* ===== WhatsApp Message Picker — cashier picks which message to send anytime ===== */
function openWhatsAppPicker(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) return;
  const c = DB.get('customers', o.customerId) || {};
  if (!c.phone) { toast('Customer has no phone number','warning'); return; }
  const invoiceNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + o.id.slice(-6).toUpperCase();
  const totalPcs = (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);

  // Build sent history
  const history = o.whatsappLog || [];
  const historyHtml = history.length
    ? '<div style="background:var(--surface-alt);padding:10px;border-radius:8px;margin-bottom:14px;font-size:12px;"><b>📜 Sent History:</b><br>' +
      history.map(h => `<div>✅ ${h.status} — ${fmtDate(h.sentAt)} by ${h.by || '?'}</div>`).join('') + '</div>'
    : '';

  openModal(`
    <h3>📱 Send WhatsApp to ${escapeHtml(c.name)}</h3>
    <p class="sub">Invoice ${invoiceNo} • ${totalPcs} pcs • ${escapeHtml(c.phone)}</p>

    ${historyHtml}

    <p style="font-size:13px;font-weight:700;margin-bottom:8px;">Choose message template:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${Object.entries(WA_STATUS_TEMPLATES).map(([key, tpl]) => `
        <button class="btn btn-secondary wa-pick" data-status="${key}" style="padding:14px 10px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <span style="font-size:24px;">${tpl.icon}</span>
          <b style="font-size:13px;">${tpl.label}</b>
        </button>
      `).join('')}
    </div>

    <button class="btn btn-warning btn-block" id="customBtn" style="margin-top:10px;">✏️ Write Custom Message</button>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    </div>
  `, { onOpen(m) {
    m.querySelectorAll('.wa-pick').forEach(b => b.onclick = () => {
      const status = b.dataset.status;
      closeModal();
      openWhatsAppStatusDialog(orderId, status);
    });
    $('#customBtn', m).onclick = () => {
      // Use generic invoice WhatsApp
      closeModal();
      if (typeof sendWhatsAppInvoice === 'function') {
        const s = DB.settings();
        const delTypeMap = {hanger:{label:'HANGER'},fold:{label:'FOLD'},both:{label:'BOTH'}};
        sendWhatsAppInvoice(o, c, s, invoiceNo, totalPcs, delTypeMap[o.deliveryType||'hanger']||{label:'HANGER'});
      }
    };
  }});
}
