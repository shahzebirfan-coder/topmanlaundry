/* ============================================================
   Portal Helpers — Payment, Messages, PDF, Push, Promo, Referrals
   ============================================================ */

/* ============================================================
   1. PAYMENT PROOF UPLOAD (Manual JazzCash/Easypaisa/Bank)
   ============================================================ */
function openPaymentProofDialog(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) return alert('Order not found');
  const c = DB.get('customers', o.customerId) || {};
  const s = DB.settings();
  // Fallback defaults so payment cards ALWAYS show even on fresh installs
  if (!s.jazzcashNumber) s.jazzcashNumber = '0302 8244803';
  if (!s.jazzcashName)   s.jazzcashName   = 'Shahzeb Vakani';
  if (!s.easypaisaNumber) s.easypaisaNumber = '0302 8244803';
  if (!s.easypaisaName)   s.easypaisaName   = 'Shahzeb Vakani';
  const invNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + o.id.slice(-6).toUpperCase();

  const html = `
    <div class="payment-modal">
      <h2 style="margin-bottom:6px;">💳 Pay ${pt('outstanding')}</h2>
      <p style="color:#666;margin-bottom:14px;">${invNo} — Amount Due: <b style="color:#ef4444;font-size:18px;">${fmtMoney(o.due)}</b></p>

      <div class="pay-options">
        ${s.jazzcashNumber ? `
          <div class="pay-card jc">
            <div class="pay-logo-img"><svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" style="height:36px;display:block;">
  <rect width="120" height="50" rx="8" fill="#ED1C24"/>
  <text x="60" y="22" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="14" fill="#FFFFFF">JAZZ</text>
  <text x="60" y="38" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="14" fill="#FFD700">CASH</text>
</svg></div>
            <div class="pay-details">
              <div class="pay-row"><span class="pay-lbl">Account Name:</span> <b>${escapeHtml(s.jazzcashName || 'Not set')}</b></div>
              <div class="pay-row"><span class="pay-lbl">Number:</span> <b><code>${escapeHtml(s.jazzcashNumber)}</code></b></div>
              <button class="pay-copy-big" data-copy="${escapeHtml(s.jazzcashNumber.replace(/\s/g,''))}">📋 Copy Number</button>
            </div>
          </div>
        `:''}

        ${s.easypaisaNumber ? `
          <div class="pay-card ep">
            <div class="pay-logo-img"><svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" style="height:36px;display:block;">
  <rect width="120" height="50" rx="8" fill="#00A551"/>
  <text x="60" y="32" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="18" fill="#FFFFFF">easypaisa</text>
</svg></div>
            <div class="pay-details">
              <div class="pay-row"><span class="pay-lbl">Account Name:</span> <b>${escapeHtml(s.easypaisaName || 'Not set')}</b></div>
              <div class="pay-row"><span class="pay-lbl">Number:</span> <b><code>${escapeHtml(s.easypaisaNumber)}</code></b></div>
              <button class="pay-copy-big" data-copy="${escapeHtml(s.easypaisaNumber.replace(/\s/g,''))}">📋 Copy Number</button>
            </div>
          </div>
        `:''}

        ${s.bankName ? `
          <div class="pay-card bank">
            <div class="pay-logo-img"><svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg" style="height:36px;display:block;">
  <rect width="120" height="50" rx="8" fill="#1E40AF"/>
  <text x="60" y="34" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="22" fill="#FFFFFF">🏦</text>
</svg></div>
            <div class="pay-details">
              <div class="pay-row"><span class="pay-lbl">Bank:</span> <b>${escapeHtml(s.bankName)}</b></div>
              <div class="pay-row"><span class="pay-lbl">Title:</span> <b>${escapeHtml(s.bankAccountTitle||'')}</b></div>
              <div class="pay-row"><span class="pay-lbl">Account/IBAN:</span> <b><code style="font-size:12px;">${escapeHtml(s.bankAccountNumber||'')}</code></b></div>
              <button class="pay-copy-big" data-copy="${escapeHtml(s.bankAccountNumber||'')}">📋 Copy Account</button>
            </div>
          </div>
        `:''}

        ${!s.jazzcashNumber && !s.easypaisaNumber && !s.bankName ? `
          <div style="padding:20px;text-align:center;background:#fef3c7;border-radius:10px;color:#92400e;">
            ⚠️ Payment details not configured yet. Please contact shop directly.
          </div>
        `:''}
      </div>

      <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:12px;border-radius:8px;margin:14px 0;font-size:13px;">
        💡 ${escapeHtml(s.paymentInstructions || 'Please pay and upload screenshot below.')}
      </div>

      <h3 style="margin-bottom:6px;font-size:16px;">📸 Upload Payment Screenshot</h3>
      <div class="upload-area" id="uploadArea">
        <div class="upload-inner">
          <div style="font-size:42px;">📷</div>
          <div style="font-weight:700;margin:6px 0;">Click to upload</div>
          <div style="font-size:11px;color:#666;">or drag screenshot here</div>
        </div>
        <input type="file" id="proofFile" accept="image/*" capture="environment" style="display:none;"/>
      </div>

      <img id="proofPreview" style="display:none;max-width:100%;border-radius:10px;margin-top:10px;border:2px solid #4f7cff;"/>

      <div class="form-row" style="margin-top:14px;">
        <div class="field"><label>Your Name</label><input id="payerName" value="${escapeHtml(c.name||'')}" placeholder="Full name"/></div>
        <div class="field"><label>Transaction ID (optional)</label><input id="txnId" placeholder="TXN12345"/></div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" id="submitProofBtn">✅ Submit Payment Proof</button>
      </div>
    </div>
  `;

  openPortalModal(html);

  // Copy buttons
  document.querySelectorAll('.pay-copy').forEach(btn => {
    btn.onclick = () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy', 1500);
    };
  });

  let proofDataUrl = null;
  const fileInp = document.getElementById('proofFile');
  const uploadArea = document.getElementById('uploadArea');
  const preview = document.getElementById('proofPreview');

  uploadArea.onclick = () => fileInp.click();
  uploadArea.ondragover = e => { e.preventDefault(); uploadArea.style.borderColor = '#4f7cff'; };
  uploadArea.ondragleave = () => uploadArea.style.borderColor = '#e5e9f2';
  uploadArea.ondrop = e => {
    e.preventDefault(); uploadArea.style.borderColor = '#e5e9f2';
    if (e.dataTransfer.files[0]) handleProofFile(e.dataTransfer.files[0]);
  };
  fileInp.onchange = e => { if (e.target.files[0]) handleProofFile(e.target.files[0]); };

  function handleProofFile(file) {
    if (!file.type.startsWith('image/')) { alert('Please upload an image'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      // Compress
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > 1200) { h = h * 1200/w; w = 1200; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        proofDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        preview.src = proofDataUrl;
        preview.style.display = 'block';
        uploadArea.style.display = 'none';
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('submitProofBtn').onclick = () => {
    const payerName = document.getElementById('payerName').value.trim();
    if (!proofDataUrl) { alert('Please upload screenshot first'); return; }
    if (!payerName) { alert('Please enter your name'); return; }

    DB.insert('paymentProofs', {
      orderId, customerId: o.customerId,
      payerName,
      txnId: document.getElementById('txnId').value.trim(),
      amount: o.due,
      screenshot: proofDataUrl,
      status: 'pending', // pending | verified | rejected
      submittedAt: new Date().toISOString()
    });

    closeModal();
    showPortalToast('✅ Payment proof submitted! We will verify and update within 30 minutes.', 'success');
  };
}

/* ============================================================
   2. SEND MESSAGE / COMPLAINT
   ============================================================ */
function openMessageDialog(customerId, orderId) {
  const c = customerId ? DB.get('customers', customerId) : null;
  const o = orderId ? DB.get('orders', orderId) : null;
  const invNo = o ? (o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + o.id.slice(-6).toUpperCase()) : '';

  const html = `
    <h2>💬 ${pt('send_message')}</h2>
    <p style="color:#666;margin-bottom:14px;font-size:13px;">${o ? 'About: '+invNo : 'Send us a message or complaint'}</p>

    <div class="form-row">
      <div class="field"><label>Your Name *</label><input id="msgName" value="${escapeHtml(c?.name || '')}"/></div>
      <div class="field"><label>Your Phone *</label><input id="msgPhone" value="${escapeHtml(c?.phone || '')}" type="tel"/></div>
    </div>
    <div class="field">
      <label>Message Type</label>
      <select id="msgType">
        <option value="complaint">⚠️ Complaint</option>
        <option value="request">💬 Special Request</option>
        <option value="question">❓ Question</option>
        <option value="feedback">⭐ Feedback / Suggestion</option>
        <option value="other">📝 Other</option>
      </select>
    </div>
    <div class="field">
      <label>Your Message *</label>
      <textarea id="msgText" rows="6" placeholder="Describe your issue, request, or feedback..."></textarea>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="submitMsgBtn">📤 Send Message</button>
    </div>
  `;

  openPortalModal(html);

  document.getElementById('submitMsgBtn').onclick = () => {
    const name = document.getElementById('msgName').value.trim();
    const phone = document.getElementById('msgPhone').value.trim();
    const text = document.getElementById('msgText').value.trim();
    if (!name || !phone || !text) { alert('Please fill all required fields'); return; }

    DB.insert('messages', {
      customerId: customerId || null,
      orderId: orderId || null,
      name, phone,
      type: document.getElementById('msgType').value,
      text,
      status: 'unread', // unread | read | replied
      receivedAt: new Date().toISOString()
    });

    closeModal();
    showPortalToast('✅ Message sent! We will reply via WhatsApp soon.', 'success');
  };
}

/* ============================================================
   3. DOWNLOAD INVOICE AS PDF (uses browser print → save as PDF)
   ============================================================ */
function downloadInvoicePDF(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) return;
  const c = DB.get('customers', o.customerId) || {};
  const s = DB.settings();
  const invNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + o.id.slice(-6).toUpperCase();
  const totalPcs = (o.items||[]).reduce((sum,i)=>sum+(i.qty||0),0);

  // Build print-friendly HTML in a new window
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { alert('Please allow popups to download'); return; }

  const itemsHtml = (o.items||[]).map(it => `
    <tr><td style="padding:6px 0;">${escapeHtml(it.name)}</td><td style="text-align:center;">×${it.qty}</td><td style="text-align:right;">${fmtMoney(it.price)}</td><td style="text-align:right;font-weight:700;">${fmtMoney(it.qty*it.price)}</td></tr>
  `).join('');

  w.document.write(`
    <!DOCTYPE html><html><head>
      <title>${invNo} - ${s.shopName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #000; }
        h1 { text-align: center; margin: 0; }
        .sub { text-align: center; font-size: 12px; color: #666; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; }
        .info td { padding: 4px 0; font-size: 13px; }
        .items th { border-bottom: 2px solid #000; padding: 8px 0; text-align: left; font-size: 13px; }
        .items td { border-bottom: 1px solid #eee; font-size: 13px; }
        .totals td { padding: 6px 0; font-size: 14px; }
        .total-line { font-size: 18px; font-weight: 900; border-top: 2px solid #000; }
        .qty-box { text-align: center; padding: 20px; margin: 14px 0; border: 3px solid #000; border-radius: 10px; }
        .qty-num { font-size: 42px; font-weight: 900; }
        .footer { text-align: center; font-size: 11px; color: #666; margin-top: 20px; }
        @media print { @page { margin: 10mm; } }
      </style>
    </head><body>
      <h1>${escapeHtml(s.shopName)}</h1>
      <div class="sub">${escapeHtml(s.tagline||'')}<br>${escapeHtml(s.address||'')} • 📞 ${escapeHtml(s.phone||'')}</div>
      <hr>
      <table class="info">
        <tr><td><b>Invoice:</b></td><td style="text-align:right;">${invNo}</td></tr>
        <tr><td><b>Date:</b></td><td style="text-align:right;">${fmtDate(o.createdAt)}</td></tr>
        ${o.deliveryDate ? `<tr><td><b>Delivery:</b></td><td style="text-align:right;">${o.deliveryDate}</td></tr>` : ''}
        <tr><td><b>Customer:</b></td><td style="text-align:right;">${escapeHtml(c.name||'-')}</td></tr>
        ${c.phone ? `<tr><td><b>Phone:</b></td><td style="text-align:right;">${escapeHtml(c.phone)}</td></tr>` : ''}
      </table>
      <div class="qty-box"><div style="font-size:11px;">TOTAL PIECES</div><div class="qty-num">${totalPcs}</div></div>
      <table class="items">
        <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <table class="totals" style="margin-top:10px;">
        <tr><td>Subtotal:</td><td style="text-align:right;">${fmtMoney(o.subtotal)}</td></tr>
        ${o.discount ? `<tr><td>Discount:</td><td style="text-align:right;">- ${fmtMoney(o.discount)}</td></tr>` : ''}
        <tr class="total-line"><td><b>TOTAL:</b></td><td style="text-align:right;"><b>${fmtMoney(o.total)}</b></td></tr>
        <tr><td>Paid:</td><td style="text-align:right;">${fmtMoney(o.paid)}</td></tr>
        ${o.due ? `<tr><td><b>Due:</b></td><td style="text-align:right;color:#a00;"><b>${fmtMoney(o.due)}</b></td></tr>` : ''}
      </table>
      <div class="footer">Thank you for choosing ${escapeHtml(s.shopName)}!<br>Generated from Customer Portal</div>
      <script>
        window.onload = () => { setTimeout(() => { window.print(); }, 300); };
      </script>
    </body></html>
  `);
  w.document.close();
}

/* ============================================================
   4. PUSH NOTIFICATIONS (Browser-based)
   ============================================================ */
async function enablePortalNotifications(customerId) {
  if (!('Notification' in window)) {
    alert('Notifications not supported in this browser');
    return;
  }
  if (Notification.permission === 'denied') {
    alert('Notifications were blocked. Please enable in browser settings.');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    showPortalToast('Notifications not enabled', 'warning');
    return;
  }
  // Save subscription
  const sub = {
    customerId,
    enabled: true,
    enabledAt: new Date().toISOString(),
    device: navigator.userAgent.substring(0, 100)
  };
  // Check existing
  const existing = DB.all('pushSubs').find(p => p.customerId === customerId && p.device === sub.device);
  if (!existing) DB.insert('pushSubs', sub);
  showPortalToast('🔔 Notifications enabled! You\u2019ll be notified when order is ready.', 'success');
}

/* Show local notification (when admin updates status, this triggers from sync) */
function showOrderNotification(title, body, orderId) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body, icon: 'assets/img/logo.jpeg',
    badge: 'assets/img/logo.jpeg', tag: 'order-' + orderId
  });
  n.onclick = () => {
    window.focus();
    window.location.href = 'portal.html?invoice=' + orderId;
    n.close();
  };
}

/* ============================================================
   5. PROMO CODES
   ============================================================ */
function validatePromoCode(code) {
  if (!code) return null;
  const promo = DB.all('promoCodes').find(p =>
    p.code.toUpperCase() === code.toUpperCase().trim() && p.active
  );
  if (!promo) return { error: 'Invalid promo code' };
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return { error: 'Promo code expired' };
  if (promo.maxUses && (promo.timesUsed || 0) >= promo.maxUses) return { error: 'Promo code limit reached' };
  return { ok: true, promo };
}

function applyPromoCode(promoId) {
  const promo = DB.get('promoCodes', promoId);
  if (promo) DB.update('promoCodes', promoId, { timesUsed: (promo.timesUsed||0) + 1 });
}

/* ============================================================
   6. REFERRAL CODES
   ============================================================ */
function getOrCreateReferralCode(customerId) {
  const c = DB.get('customers', customerId);
  if (!c) return null;
  if (c.referralCode) return c.referralCode;
  const phoneTail = (c.phone||'').replace(/[^\d]/g,'').slice(-4);
  const code = (c.name || 'CUST').replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,4) + phoneTail;
  DB.update('customers', customerId, { referralCode: code });
  return code;
}

function shareReferralViaWhatsApp(customerId) {
  const c = DB.get('customers', customerId);
  if (!c) return;
  const s = DB.settings();
  const code = getOrCreateReferralCode(customerId);
  const discount = s.referralDiscountPercent || 10;
  const portalUrl = location.origin + location.pathname.replace(/\/[^\/]*$/, '/portal.html');

  const msg = `🎁 *Special Offer from ${s.shopName}!*\n\nUse my referral code: *${code}*\n\nYou'll get *${discount}% OFF* on your first order!\n\n📱 Phone: ${s.phone}\n🔗 Track orders: ${portalUrl}\n\n${s.shopName} - ${s.tagline || ''}`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

/* ============================================================
   7. SHOP HOURS / "OPEN NOW" CHECKER
   ============================================================ */
function getShopOpenStatus() {
  /* Smart shop status — parses actual time + day.
     Supports formats like:
       "Mon-Sat: 9:00 AM - 9:00 PM"
       "Sunday: Closed"
       "Monday: 10:00 AM - 8:00 PM"
       "Mon-Fri: 9 AM - 9 PM, Sat: 10 AM - 6 PM, Sun: Closed"
  */
  const s = DB.settings();
  const hoursText = (s.shopHours || '').trim();
  if (!hoursText) return { open: true, msg: 'Open' };

  const now = new Date();
  const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
  const dayFull = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayShort = dayNames[now.getDay()];
  const todayFull = dayFull[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Helper: parse "9:00 AM" or "9 PM" -> minutes from midnight
  function parseTime(str) {
    if (!str) return null;
    const m = String(str).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2] || '0', 10);
    const period = m[3];
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 60 + min;
  }

  // Helper: does line apply to today?
  function lineAppliesToday(daySpec) {
    if (!daySpec) return false;
    const spec = daySpec.toLowerCase().trim();
    // Check single day match
    for (let i = 0; i < 7; i++) {
      if (spec === dayNames[i] || spec === dayFull[i]) {
        return i === now.getDay();
      }
    }
    // Check range like "mon-sat" or "monday-friday"
    const rangeMatch = spec.match(/^([a-z]+)\s*[-–]\s*([a-z]+)$/);
    if (rangeMatch) {
      let from = -1, to = -1;
      for (let i = 0; i < 7; i++) {
        if (rangeMatch[1].startsWith(dayNames[i]) || dayNames[i].startsWith(rangeMatch[1]) || rangeMatch[1] === dayFull[i]) from = i;
        if (rangeMatch[2].startsWith(dayNames[i]) || dayNames[i].startsWith(rangeMatch[2]) || rangeMatch[2] === dayFull[i]) to = i;
      }
      if (from >= 0 && to >= 0) {
        // Handle wrap-around (e.g. Fri-Mon)
        if (from <= to) return now.getDay() >= from && now.getDay() <= to;
        return now.getDay() >= from || now.getDay() <= to;
      }
    }
    // Check comma-separated days like "mon,wed,fri"
    if (spec.includes(',')) {
      const days = spec.split(',').map(d => d.trim());
      for (const d of days) {
        if (lineAppliesToday(d)) return true;
      }
    }
    return false;
  }

  // Split by newlines OR by commas-that-look-like-rule-separators
  // Try newlines first (most common)
  let lines = hoursText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  // If only one line and has multiple "X:" patterns, split by them
  if (lines.length === 1 && (lines[0].match(/[a-z]+(?:\s*[-–]\s*[a-z]+)?\s*:/gi) || []).length > 1) {
    // Split on commas that come before "Day:" patterns
    lines = lines[0].split(/,\s*(?=[a-z]+(?:\s*[-–]\s*[a-z]+)?\s*:)/i).map(l => l.trim());
  }

  for (const line of lines) {
    // Match "DaySpec: TimeRange" or "DaySpec: Closed"
    const m = line.match(/^([a-z][a-z\s\-–,]*?)\s*:\s*(.+)$/i);
    if (!m) continue;
    const daySpec = m[1].trim();
    const timeSpec = m[2].trim().toLowerCase();

    if (!lineAppliesToday(daySpec)) continue;

    // Line applies to today!
    if (timeSpec === 'closed' || timeSpec === 'off' || timeSpec === 'holiday') {
      return { open: false, msg: 'Closed Today' };
    }

    // Try to parse time range like "9:00 AM - 9:00 PM"
    const timeRange = timeSpec.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeRange) {
      const openMin = parseTime(timeRange[1]);
      let closeMin = parseTime(timeRange[2]);
      if (openMin == null || closeMin == null) continue;
      // Handle overnight (e.g. 10 PM - 2 AM)
      if (closeMin <= openMin) closeMin += 24 * 60;
      let nowM = nowMinutes;
      if (nowM < openMin && closeMin >= 24*60) nowM += 24*60;

      if (nowM >= openMin && nowM <= closeMin) {
        // Calculate time till close
        const minsTillClose = closeMin - nowM;
        if (minsTillClose <= 30) {
          return { open: true, msg: 'Closing in ' + minsTillClose + ' min' };
        }
        return { open: true, msg: 'Open Now' };
      } else {
        // Closed — calculate opening time
        if (nowM < openMin) {
          const minsTillOpen = openMin - nowM;
          if (minsTillOpen <= 60) return { open: false, msg: 'Opens in ' + minsTillOpen + ' min' };
          const h = Math.floor(openMin / 60), mm = openMin % 60;
          const period = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return { open: false, msg: 'Opens at ' + h12 + (mm ? ':' + String(mm).padStart(2,'0') : '') + ' ' + period };
        }
        return { open: false, msg: 'Closed Now' };
      }
    }
  }

  // No matching rule for today — assume open (don't lock customers out)
  return { open: true, msg: 'Open' };
}

/* ============================================================
   8. RATE / REVIEW
   ============================================================ */
function openReviewDialog(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) return;
  const existing = DB.all('reviews').find(r => r.orderId === orderId);

  const html = `
    <h2>⭐ ${pt('rate_order')}</h2>
    <p style="color:#666;margin-bottom:14px;">How was your experience?</p>

    <div class="star-rating" id="starRating" style="text-align:center;font-size:48px;margin:20px 0;cursor:pointer;">
      ${[1,2,3,4,5].map(n => `<span class="star" data-star="${n}" style="color:#e5e9f2;transition:.15s;">★</span>`).join('')}
    </div>

    <div class="field">
      <label>Comment (optional)</label>
      <textarea id="reviewText" rows="4" placeholder="Tell us about your experience...">${existing ? escapeHtml(existing.comment||'') : ''}</textarea>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="submitReviewBtn">⭐ Submit Review</button>
    </div>
  `;
  openPortalModal(html);

  let rating = existing?.rating || 0;
  const stars = document.querySelectorAll('.star');
  const paintStars = (n) => {
    stars.forEach((s, i) => s.style.color = i < n ? '#f59e0b' : '#e5e9f2');
  };
  paintStars(rating);
  stars.forEach(s => {
    s.onmouseover = () => paintStars(+s.dataset.star);
    s.onmouseout = () => paintStars(rating);
    s.onclick = () => { rating = +s.dataset.star; paintStars(rating); };
  });

  document.getElementById('submitReviewBtn').onclick = () => {
    if (rating === 0) { alert('Please select rating'); return; }
    const data = {
      orderId,
      customerId: o.customerId,
      rating,
      comment: document.getElementById('reviewText').value.trim(),
      reviewedAt: new Date().toISOString()
    };
    if (existing) DB.update('reviews', existing.id, data);
    else DB.insert('reviews', data);
    closeModal();
    showPortalToast('⭐ Thank you for your review!', 'success');
  };
}

/* ============================================================
   PORTAL MODAL & TOAST HELPERS
   ============================================================ */
function openPortalModal(innerHtml) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'portal-modal-backdrop';
  wrap.innerHTML = `<div class="portal-modal">${innerHtml}</div>`;
  wrap.onclick = (e) => { if (e.target === wrap) closeModal(); };
  document.body.appendChild(wrap);
}

function closeModal() {
  // Close portal modals
  document.querySelectorAll('.portal-modal-backdrop').forEach(el => el.remove());
  // Also close main app modals (in case both UIs are present)
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function showPortalToast(msg, type='success') {
  const colors = { success:'#22c55e', error:'#ef4444', warning:'#f59e0b' };
  const t = document.createElement('div');
  t.className = 'portal-toast';
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;border-left:4px solid ${colors[type]};padding:14px 20px;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.2);z-index:9999;font-weight:600;max-width:90vw;animation:toastSlide .2s ease;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; }, 3500);
  setTimeout(() => t.remove(), 4000);
}

/* ============================================================
   ADMIN: Configure Portal Settings
   ============================================================ */
function openPortalConfigDialog() {
  if (DB.currentUser().role !== 'admin') return;
  const s = DB.settings();
  const portalUrl = location.origin + location.pathname.replace(/\/[^\/]*$/, '/portal.html');

  openModal(`
    <h3>🌐 Customer Portal Configuration</h3>
    <p class="sub">Set what customers see on your tracking portal.</p>

    <div style="background:#dbeafe;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
      📱 <b>Portal URL:</b><br>
      <code style="background:#fff;padding:6px 10px;border-radius:6px;display:inline-block;margin-top:6px;font-size:12px;">${portalUrl}</code>
      <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${portalUrl}');toast('Copied','success');" style="margin-left:6px;">📋 Copy</button>
    </div>

    <div style="font-weight:700;margin:14px 0 8px;border-top:1px solid var(--border);padding-top:14px;">⏰ Shop Hours (shown on portal)</div>
    <div class="field">
      <textarea id="pcfgHours" rows="3" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;" placeholder="Mon-Sat: 9:00 AM - 9:00 PM&#10;Sunday: Closed">${escapeHtml(s.shopHours || '')}</textarea>
      <small style="color:var(--text-soft);">One line per day. Add "Sunday: Closed" to show closed badge on Sundays.</small>
    </div>

    <div style="font-weight:700;margin:14px 0 8px;border-top:1px solid var(--border);padding-top:14px;">💳 Payment Receiving Numbers</div>
    <div class="form-row">
      <div class="field"><label>JazzCash Account Name</label><input id="pcfgJCN" value="${escapeHtml(s.jazzcashName||'')}" placeholder="Shahzeb Vakani"/></div>
      <div class="field"><label>JazzCash Number</label><input id="pcfgJC" value="${escapeHtml(s.jazzcashNumber||'')}" placeholder="0302 8244803"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Easypaisa Account Name</label><input id="pcfgEPN" value="${escapeHtml(s.easypaisaName||'')}" placeholder="Shahzeb Vakani"/></div>
      <div class="field"><label>Easypaisa Number</label><input id="pcfgEP" value="${escapeHtml(s.easypaisaNumber||'')}" placeholder="0302 8244803"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Bank Name</label><input id="pcfgBN" value="${escapeHtml(s.bankName||'')}" placeholder="HBL / Meezan / etc."/></div>
      <div class="field"><label>Account Title</label><input id="pcfgBT" value="${escapeHtml(s.bankAccountTitle||'')}" placeholder="Laundry POS"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Bank Account Number / IBAN</label><input id="pcfgBA" value="${escapeHtml(s.bankAccountNumber||'')}" placeholder="PK00 ABCD..."/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Payment Instructions</label><textarea id="pcfgPI" rows="2" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:inherit;">${escapeHtml(s.paymentInstructions||'Please pay to the above account and upload screenshot below. We will verify within 30 minutes.')}</textarea></div>
    </div>

    <div style="font-weight:700;margin:14px 0 8px;border-top:1px solid var(--border);padding-top:14px;">🎁 Referral Settings</div>
    <div class="form-row">
      <div class="field"><label>Referral Discount % (for both)</label><input type="number" id="pcfgRD" value="${s.referralDiscountPercent||10}" min="0" max="50"/></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="savePortalCfg">💾 Save Portal Settings</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#savePortalCfg', m).onclick = () => {
      DB.saveSettings({
        shopHours: $('#pcfgHours', m).value.trim(),
        jazzcashName: $('#pcfgJCN', m).value.trim(),
        jazzcashNumber: $('#pcfgJC', m).value.trim(),
        easypaisaName: $('#pcfgEPN', m).value.trim(),
        easypaisaNumber: $('#pcfgEP', m).value.trim(),
        bankName: $('#pcfgBN', m).value.trim(),
        bankAccountTitle: $('#pcfgBT', m).value.trim(),
        bankAccountNumber: $('#pcfgBA', m).value.trim(),
        paymentInstructions: $('#pcfgPI', m).value.trim(),
        referralDiscountPercent: Math.max(0, +$('#pcfgRD', m).value || 10)
      });
      closeModal();
      toast('Portal settings saved','success');
      if (typeof logAction === 'function') logAction('portal.config', '');
    };
  }});
}


/* Global ESC handler — closes any open modal */
(function setupGlobalEsc() {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', function globalEscHandler(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      const portalOpen = document.querySelector('.portal-modal-backdrop');
      const mainOpen = document.querySelector('.modal-backdrop');
      if (portalOpen || mainOpen) {
        e.preventDefault();
        if (typeof closeModal === 'function') closeModal();
      }
    }
  });
})();
