/* ===================== CLAIMS MANAGEMENT ===================== */
let claimsFilter = { search:'', type:'all', status:'all', dateFrom:'', dateTo:'' };

function renderClaims() {
  const claims = DB.all('claims');
  const totalCash = claims.filter(c => c.type === 'cash').reduce((s,c) => s+(c.cashAmount||0), 0);
  const totalVouchers = claims.filter(c => c.type === 'voucher').length;
  const totalNetLoss = claims.filter(c => c.type === 'cash').reduce((s,c) => s+(c.netLoss||c.cashAmount||0), 0);
  const pending = claims.filter(c => c.status === 'open').length;

  const content = `
    <h1 class="page-title">🛡️ Claims Management</h1>
    <p class="page-sub">Handle customer claims with two policies: Cash refund (30% with original slip) OR Free Laundry Vouchers (7 services without slip).</p>

    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:18px;">
      <div class="stat-card"><div class="ic b1">🛡️</div><div><div class="lbl">Total Claims</div><div class="val">${claims.length}</div></div></div>
      <div class="stat-card"><div class="ic b3">⏳</div><div><div class="lbl">Open Claims</div><div class="val" style="color:${pending>0?'var(--warning)':'var(--success)'};">${pending}</div></div></div>
      <div class="stat-card"><div class="ic b3">💰</div><div><div class="lbl">Cash Refunded</div><div class="val" style="color:var(--danger);">${fmtMoney(totalCash)}</div></div></div>
      <div class="stat-card"><div class="ic b3">📉</div><div><div class="lbl">Net Loss (Goodwill)</div><div class="val" style="color:var(--danger);">${fmtMoney(totalNetLoss)}</div></div></div>
      <div class="stat-card"><div class="ic b2">🎫</div><div><div class="lbl">Vouchers Issued</div><div class="val">${totalVouchers}</div></div></div>
    </div>

    <div class="filter-bar">
      <input id="cSearch" placeholder="🔍 Search by claim #, customer name, phone..." style="flex:1;min-width:240px;" value="${escapeHtml(claimsFilter.search)}"/>
      <select id="cType">
        <option value="all">All Types</option>
        <option value="cash">💰 Cash Refund (with slip)</option>
        <option value="voucher">🎫 Voucher (no slip)</option>
      </select>
      <select id="cStatus">
        <option value="all">All Statuses</option>
        <option value="open">⏳ Open</option>
        <option value="settled">✅ Settled</option>
        <option value="rejected">❌ Rejected</option>
      </select>
      <button class="btn btn-primary" id="newClaimBtn">+ New Claim</button>
      <button class="btn btn-secondary" id="vouchersBtn">🎫 View All Vouchers</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden;">
      <table class="tbl">
        <thead><tr>
          <th>Claim #</th><th>Date</th><th>Customer</th><th>Item Damaged</th>
          <th>Type</th><th>Settlement</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody id="claimsBody"></tbody>
      </table>
    </div>
  `;
  $('#app').innerHTML = renderLayout('claims', content);
  bindLayout();

  $('#cSearch').oninput = e => { claimsFilter.search = e.target.value; renderClaimsBody(); };
  $('#cType').onchange = e => { claimsFilter.type = e.target.value; renderClaimsBody(); };
  $('#cStatus').onchange = e => { claimsFilter.status = e.target.value; renderClaimsBody(); };
  $('#newClaimBtn').onclick = () => openClaimForm();
  $('#vouchersBtn').onclick = () => openVouchersList();
  $('#cType').value = claimsFilter.type;
  $('#cStatus').value = claimsFilter.status;
  renderClaimsBody();
}

function renderClaimsBody() {
  let claims = [...DB.all('claims')].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  if (claimsFilter.type !== 'all') claims = claims.filter(c => c.type === claimsFilter.type);
  if (claimsFilter.status !== 'all') claims = claims.filter(c => c.status === claimsFilter.status);
  if (claimsFilter.search) {
    const q = claimsFilter.search.toLowerCase();
    claims = claims.filter(c =>
      (c.claimNo||'').toLowerCase().includes(q) ||
      (c.customerName||'').toLowerCase().includes(q) ||
      (c.customerPhone||'').includes(q) ||
      (c.itemDescription||'').toLowerCase().includes(q)
    );
  }

  if (!claims.length) {
    $('#claimsBody').innerHTML = `<tr><td colspan="8"><div class="empty"><div class="emoji">🛡️</div><h4>No claims found</h4><p>Click "+ New Claim" to register one.</p></div></td></tr>`;
    return;
  }

  $('#claimsBody').innerHTML = claims.map(c => {
    const statusColor = {open:'pending', settled:'paid', rejected:'cancelled'}[c.status] || 'pending';
    const typeIcon = c.type === 'cash' ? '💰 Cash' : '🎫 Voucher';
    let settlement = '-';
    if (c.type === 'cash') settlement = `<b>${fmtMoney(c.cashAmount||0)}</b><br><small>${c.itemPercent||30}% of ${fmtMoney(c.itemPurchasePrice||0)}</small>`;
    else if (c.type === 'voucher') {
      const voucher = DB.all('vouchers').find(v => v.claimId === c.id);
      const used = voucher ? (voucher.usedCount||0) : 0;
      const total = voucher ? voucher.totalUses : (c.voucherUses||7);
      settlement = `<b>${escapeHtml(voucher?.voucherNo || '-')}</b><br><small>${used} / ${total} used</small>`;
    }
    return `<tr>
      <td><b>${escapeHtml(c.claimNo||'-')}</b></td>
      <td>${fmtDateShort(c.createdAt)}</td>
      <td><b>${escapeHtml(c.customerName)}</b><br><small style="color:var(--text-soft);">${escapeHtml(c.customerPhone||'-')}</small></td>
      <td>${escapeHtml(c.itemDescription||'-')}</td>
      <td>${typeIcon}</td>
      <td>${settlement}</td>
      <td><span class="badge ${statusColor}">${c.status}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" data-act="view" data-id="${c.id}">👁️</button>
        <button class="btn btn-secondary btn-sm" data-act="print" data-id="${c.id}">🖨️</button>
        ${c.status === 'open' && DB.currentUser().role === 'admin' ? `<button class="btn btn-success btn-sm" data-act="settle" data-id="${c.id}">✅ Settle</button>` : ''}
        ${DB.currentUser().role === 'admin' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${c.id}">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'view' || b.dataset.act === 'print') openClaimDocument(id, b.dataset.act === 'print');
    else if (b.dataset.act === 'settle') settleClaim(id);
    else if (b.dataset.act === 'del') confirmDialog('Delete this claim?', () => {
      DB.remove('claims', id);
      // Also delete linked voucher
      const v = DB.all('vouchers').find(x => x.claimId === id);
      if (v) DB.remove('vouchers', v.id);
      if (typeof logAction === 'function') logAction('claim.delete', id);
      renderClaims();
    });
  });
}

/* ===== New Claim Form ===== */
function openClaimForm() {
  const s = DB.settings();
  const policyPercent = s.claimPolicyPercent || 30;
  const voucherUses = s.claimVoucherFreeCount || 7;

  const html = `
    <h3>🛡️ Register New Claim</h3>
    <p class="sub">Help customer with their claim. Two policies available based on slip availability.</p>

    <div style="background:var(--surface-alt);padding:12px;border-radius:8px;margin-bottom:14px;font-size:12px;">
      <b>📋 Policies:</b><br>
      💰 <b>With Original Slip:</b> ${policyPercent}% cash refund of original purchase price.<br>
      🎫 <b>Without Slip:</b> Free laundry voucher for ${voucherUses} services.
    </div>

    <div class="form-row">
      <div class="field"><label>Customer Name *</label><input id="clName" autocomplete="off" placeholder="Customer's full name"/></div>
      <div class="field"><label>Contact Number *</label><input id="clPhone" type="tel" placeholder="03XX-XXXXXXX" autocomplete="off"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Linked Order (optional)</label>
        <select id="clOrder">
          <option value="">-- Not linked to specific order --</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Item Description / Damage Details *</label>
        <textarea id="clItem" rows="3" placeholder="e.g. White cotton shirt with collar damage, color fading on left sleeve..."></textarea>
      </div>
    </div>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:8px;margin:14px 0;">
      <div style="font-weight:700;margin-bottom:8px;">📋 Choose Claim Type:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <label class="claim-type-opt" style="display:flex;flex-direction:column;align-items:center;padding:14px;border:2px solid var(--border);border-radius:10px;cursor:pointer;background:var(--surface);">
          <input type="radio" name="clType" value="cash" checked style="margin-bottom:6px;"/>
          <span style="font-size:28px;">💰</span>
          <b style="font-size:13px;margin-top:4px;">Cash Refund</b>
          <span style="font-size:10px;color:var(--text-soft);text-align:center;">${policyPercent}% (with slip)</span>
        </label>
        <label class="claim-type-opt" style="display:flex;flex-direction:column;align-items:center;padding:14px;border:2px solid var(--border);border-radius:10px;cursor:pointer;background:var(--surface);">
          <input type="radio" name="clType" value="voucher" style="margin-bottom:6px;"/>
          <span style="font-size:28px;">🎫</span>
          <b style="font-size:13px;margin-top:4px;">Voucher</b>
          <span style="font-size:10px;color:var(--text-soft);text-align:center;">${voucherUses} free washes (no slip)</span>
        </label>
      </div>
    </div>

    <div id="cashSection">
      <div style="background:#fff3cd;border-left:4px solid #f59e0b;padding:10px;border-radius:8px;font-size:12px;color:#664d03;margin-bottom:12px;">
        💡 <b>How it works:</b> Customer brings ORIGINAL purchase slip from the 3rd-party shop where they bought the item. You verify the slip and refund 30% of THAT original price. (This may exceed our laundry charge — it's a goodwill expense.)
      </div>

      <div class="form-row cols-1">
        <div class="field"><label>📍 Shop Where Customer Bought the Item *</label>
          <input id="clShop" placeholder="e.g. Khaadi, Gul Ahmed, Sapphire, Generation, etc."/>
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label>🧾 Original Purchase Price from That Shop (Rs.) *</label>
          <input type="number" id="clPrice" placeholder="e.g. 10000" min="0" style="font-weight:700;font-size:16px;"/>
          <small style="color:var(--text-soft);">As shown on the original slip</small>
        </div>
        <div class="field">
          <label>Refund Percentage</label>
          <input type="number" id="clPct" value="${policyPercent}" min="0" max="100"/>
          <small style="color:var(--text-soft);">Default ${policyPercent}%</small>
        </div>
      </div>

      <div class="form-row cols-1">
        <div class="field">
          <label>💵 What Customer Paid Us for Laundry (Rs.)</label>
          <input type="number" id="clOurCharge" placeholder="e.g. 250" min="0"/>
          <small style="color:var(--text-soft);">For our records — helps calculate actual loss</small>
        </div>
      </div>

      <div class="field"><label>📸 Original 3rd-Party Slip Photo *</label>
        <label style="display:block;border:2px dashed var(--primary);border-radius:8px;padding:14px;text-align:center;cursor:pointer;background:var(--primary-light);">
          <input type="file" id="clSlip" accept="image/*" capture="environment" style="display:none;"/>
          <div style="font-size:24px;">📸</div>
          <div style="font-weight:700;font-size:13px;">Click to capture / upload original slip</div>
          <small style="color:var(--text-soft);">Required for cash refund verification</small>
        </label>
        <img id="clSlipPreview" style="display:none;max-width:100%;margin-top:8px;border-radius:8px;border:2px solid var(--primary);"/>
      </div>

      <div id="cashSummary" style="background:var(--primary-light);padding:14px;border-radius:8px;margin-bottom:10px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
          <div><b>Customer Paid Us:</b></div><div style="text-align:right;color:var(--success);"><b id="laundryPaidDisp">Rs. 0</b></div>
          <div><b>Refund to Customer:</b></div><div style="text-align:right;color:var(--danger);"><b id="cashAmount">Rs. 0</b></div>
          <div style="border-top:1px solid #999;padding-top:6px;"><b>📉 Net Loss to Shop:</b></div><div style="text-align:right;border-top:1px solid #999;padding-top:6px;color:var(--danger);"><b id="netLossAmount" style="font-size:18px;">Rs. 0</b></div>
        </div>
      </div>
    </div>

    <div id="voucherSection" style="display:none;">
      <div class="form-row">
        <div class="field"><label>Number of Free Washes</label><input type="number" id="clUses" value="${voucherUses}" min="1" max="50"/></div>
        <div class="field"><label>Valid for (days)</label><input type="number" id="clValid" value="${s.claimVoucherValidDays||180}" min="30"/></div>
      </div>
      <div style="background:var(--primary-light);padding:12px;border-radius:8px;text-align:center;font-weight:700;margin-bottom:10px;">
        🎫 Voucher will be auto-generated with unique number after save
      </div>
    </div>

    <div class="form-row cols-1">
      <div class="field"><label>Internal Notes (optional)</label><textarea id="clNotes" rows="2" placeholder="Notes for staff/admin"></textarea></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="saveClaimBtn">💾 Save & Print Claim Document</button>
    </div>
  `;

  openModal(html, { large: true, onOpen(m) {
    // Populate orders dropdown after phone entered
    const phoneInp = $('#clPhone', m);
    const nameInp = $('#clName', m);
    const orderSel = $('#clOrder', m);

    const updateOrders = () => {
      const phone = phoneInp.value.replace(/[^\d]/g, '');
      if (phone.length < 7) { orderSel.innerHTML = '<option value="">-- Not linked --</option>'; return; }
      // Find customer
      const cust = DB.all('customers').find(c => (c.phone||'').replace(/[^\d]/g,'') === phone);
      if (cust) {
        nameInp.value = nameInp.value || cust.name;
        const orders = DB.all('orders').filter(o => o.customerId === cust.id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,30);
        orderSel.innerHTML = '<option value="">-- Not linked --</option>' +
          orders.map(o => {
            const invNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + o.id.slice(-6).toUpperCase();
            return `<option value="${o.id}">${invNo} • ${fmtDateShort(o.createdAt)} • ${fmtMoney(o.total)}</option>`;
          }).join('');
      }
    };
    phoneInp.addEventListener('blur', updateOrders);

    // Tab switching
    const updateSection = () => {
      const type = m.querySelector('input[name="clType"]:checked').value;
      $('#cashSection', m).style.display = type === 'cash' ? 'block' : 'none';
      $('#voucherSection', m).style.display = type === 'voucher' ? 'block' : 'none';
      // Update visual selection
      m.querySelectorAll('.claim-type-opt').forEach(opt => {
        const checked = opt.querySelector('input').checked;
        opt.style.borderColor = checked ? 'var(--primary)' : 'var(--border)';
        opt.style.background = checked ? 'var(--primary-light)' : 'var(--surface)';
      });
    };
    m.querySelectorAll('input[name="clType"]').forEach(r => r.onchange = updateSection);
    updateSection();

    // Cash calculator
    const updateCash = () => {
      const price = +$('#clPrice', m).value || 0;
      const pct = +$('#clPct', m).value || 0;
      const ourCharge = +$('#clOurCharge', m).value || 0;
      const refund = Math.round(price * pct / 100);
      const netLoss = Math.max(0, refund - ourCharge);
      $('#cashAmount', m).textContent = fmtMoney(refund);
      $('#laundryPaidDisp', m).textContent = fmtMoney(ourCharge);
      $('#netLossAmount', m).textContent = fmtMoney(netLoss);
    };
    $('#clPrice', m).oninput = updateCash;
    $('#clPct', m).oninput = updateCash;
    $('#clOurCharge', m).oninput = updateCash;

    // Slip upload
    let slipDataUrl = null;
    $('#clSlip', m).onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > 1200) { h = h*1200/w; w = 1200; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          slipDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          const prev = $('#clSlipPreview', m);
          prev.src = slipDataUrl;
          prev.style.display = 'block';
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    };

    $('#saveClaimBtn', m).onclick = () => {
      const name = $('#clName', m).value.trim();
      const phone = $('#clPhone', m).value.trim();
      const item = $('#clItem', m).value.trim();
      const type = m.querySelector('input[name="clType"]:checked').value;

      if (!name || !phone || !item) { toast('Customer name, phone & item description required', 'error'); return; }

      const claim = {
        claimNo: DB.nextClaimNumber(),
        customerName: name,
        customerPhone: phone,
        linkedOrderId: $('#clOrder', m).value || null,
        itemDescription: item,
        type,
        status: 'settled',  // Mark settled immediately since voucher/refund is given
        notes: $('#clNotes', m).value.trim(),
        createdBy: DB.currentUser()?.username || '',
        branchId: (typeof getActiveBranchId === 'function') ? getActiveBranchId() : 'main'
      };

      if (type === 'cash') {
        const price = +$('#clPrice', m).value || 0;
        const pct = +$('#clPct', m).value || 30;
        if (price <= 0) { toast('Enter original purchase price','error'); return; }
        if (!slipDataUrl) { toast('Original slip photo required for cash refund','error'); return; }
        const ourCharge = +$('#clOurCharge', m).value || 0;
        claim.itemPurchasePrice = price;
        claim.itemPercent = pct;
        claim.cashAmount = Math.round(price * pct / 100);
        claim.ourLaundryCharge = ourCharge;
        claim.netLoss = Math.max(0, claim.cashAmount - ourCharge);
        claim.thirdPartyShop = $('#clShop', m).value.trim();
        claim.slipPhoto = slipDataUrl;
      } else {
        const uses = +$('#clUses', m).value || 7;
        const validDays = +$('#clValid', m).value || 180;
        claim.voucherUses = uses;
        claim.voucherValidDays = validDays;
      }

      const savedClaim = DB.insert('claims', claim);

      // If voucher type, create voucher
      if (type === 'voucher') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (claim.voucherValidDays || 180));
        const voucher = DB.insert('vouchers', {
          voucherNo: DB.nextVoucherNumber(),
          claimId: savedClaim.id,
          customerName: name,
          customerPhone: phone,
          totalUses: claim.voucherUses,
          usedCount: 0,
          usageHistory: [],
          issuedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: 'active'
        });
        // Auto-add expense entry
        if (typeof DB.insert === 'function') {
          DB.insert('expenses', {
            title: `Claim Voucher Issued: ${voucher.voucherNo}`,
            amount: 0, // Tracked as 0 since no immediate cash impact
            note: `Voucher for ${claim.voucherUses} free washes to ${name} (${phone})`,
            date: isoDay(),
            category: 'claims',
            branchId: claim.branchId || 'main'
          });
        }
      } else {
        // Cash claim → log as expense
        DB.insert('expenses', {
          title: `Claim Cash Refund: ${claim.claimNo}`,
          amount: claim.cashAmount,
          note: `${claim.itemPercent}% refund of ${fmtMoney(claim.itemPurchasePrice)} (purchased from ${claim.thirdPartyShop||'3rd-party shop'}) for ${name} — Net loss: ${fmtMoney(claim.netLoss)}`,
          date: isoDay(),
          category: 'claims',
          branchId: claim.branchId || 'main'
        });
      }

      if (typeof logAction === 'function') logAction('claim.create', `${savedClaim.claimNo}: ${type} for ${name}`);

      closeModal();
      toast(`Claim ${savedClaim.claimNo} created`, 'success');
      openClaimDocument(savedClaim.id, true);  // Print immediately
    };
  }});
}

/* ===== Claim Document (Voucher or Refund Receipt) ===== */
function openClaimDocument(claimId, autoPrint) {
  const claim = DB.get('claims', claimId);
  if (!claim) return;
  const s = DB.settings();
  const isVoucher = claim.type === 'voucher';
  const voucher = isVoucher ? DB.all('vouchers').find(v => v.claimId === claim.id) : null;

  const logoBlock = s.logoImage
    ? `<div style="text-align:center;margin-bottom:8px;"><img src="${s.logoImage}" style="max-width:140px;max-height:90px;object-fit:contain;background:#000;padding:6px;border-radius:6px;"/></div>`
    : `<div style="text-align:center;font-size:42px;">${s.logo||'🧺'}</div>`;

  let docHtml = '';
  if (isVoucher && voucher) {
    docHtml = buildVoucherDoc(claim, voucher, s, logoBlock);
  } else {
    docHtml = buildCashRefundDoc(claim, s, logoBlock);
  }

  openModal(`
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3>${isVoucher ? '🎫 Voucher' : '💰 Cash Refund Receipt'} — ${escapeHtml(claim.claimNo)}</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="printElement(this.closest('.modal').querySelector('.invoice-page') || this.closest('.modal').querySelector('#printArea'))">🖨️ Print</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
      </div>
    </div>
    <div id="printArea">
      <div class="print-slip">${docHtml}</div>
    </div>
  `, { large: true, onOpen(m) {
    if (autoPrint) setTimeout(() => { const inv = document.querySelector(".modal .invoice-page") || document.querySelector("#printArea"); if (inv) printElement(inv); }, 400);
  }});
}

function buildVoucherDoc(claim, voucher, s, logoBlock) {
  const expDate = new Date(voucher.expiresAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  return `
    <div class="invoice-page" style="max-width:560px;border:3px solid #4f7cff;background:linear-gradient(135deg,#fff,#f0f4ff);">
      ${logoBlock}
      <h2 style="font-size:22px;text-align:center;color:#4f7cff;">${escapeHtml(s.shopName)}</h2>
      <div class="sub">${escapeHtml(s.tagline||'')}<br>${escapeHtml(s.address||'')}<br>📞 ${escapeHtml(s.phone||'')}</div>
      <div style="text-align:center;font-weight:900;font-size:24px;letter-spacing:3px;border-top:2px solid #000;border-bottom:2px solid #000;padding:10px;margin:10px 0;background:#4f7cff;color:#fff;">
        🎫 FREE LAUNDRY VOUCHER
      </div>

      <div style="background:#fff;border:2px dashed #4f7cff;padding:14px;border-radius:10px;margin:14px 0;text-align:center;">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:2px;">Voucher Number</div>
        <div style="font-size:32px;font-weight:900;color:#4f7cff;font-family:monospace;letter-spacing:2px;margin:6px 0;">${escapeHtml(voucher.voucherNo)}</div>
        <div style="font-size:11px;color:#666;">Claim Ref: ${escapeHtml(claim.claimNo)}</div>
      </div>

      <table style="width:100%;font-size:13px;">
        <tr><td><b>Customer:</b></td><td style="text-align:right;">${escapeHtml(claim.customerName)}</td></tr>
        <tr><td><b>Phone:</b></td><td style="text-align:right;">${escapeHtml(claim.customerPhone)}</td></tr>
        <tr><td><b>Issue Date:</b></td><td style="text-align:right;">${fmtDateShort(voucher.issuedAt)}</td></tr>
        <tr><td><b>Valid Till:</b></td><td style="text-align:right;color:#a00;"><b>${expDate}</b></td></tr>
        <tr><td><b>Issued By:</b></td><td style="text-align:right;">${escapeHtml(claim.createdBy||'-')}</td></tr>
      </table>

      <div style="text-align:center;background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:14px;margin:14px 0;">
        <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px;">Free Washes Available</div>
        <div style="font-size:48px;font-weight:900;color:#92400e;line-height:1;">${voucher.totalUses}</div>
        <div style="font-size:11px;color:#92400e;">services</div>
      </div>

      <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px;margin:10px 0;">
        <div style="font-weight:700;font-size:12px;margin-bottom:6px;">📋 Item Damaged:</div>
        <div style="font-size:12px;">${escapeHtml(claim.itemDescription)}</div>
      </div>

      <!-- Usage tracking grid -->
      <div style="font-weight:700;font-size:12px;margin:10px 0 4px;">Usage Tracker (staff use):</div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(voucher.totalUses, 7)}, 1fr);gap:4px;">
        ${Array.from({length: voucher.totalUses}, (_,i) => `
          <div style="border:2px solid #000;padding:8px 4px;text-align:center;font-size:10px;font-weight:700;background:${i < voucher.usedCount ? '#22c55e' : '#fff'};color:${i < voucher.usedCount ? '#fff' : '#000'};">
            ${i < voucher.usedCount ? '✓' : (i+1)}
          </div>
        `).join('')}
      </div>

      <div style="font-size:10px;color:#666;text-align:center;margin-top:14px;font-style:italic;border-top:1px dashed #000;padding-top:8px;">
        ${escapeHtml(s.claimTerms || 'Voucher non-transferable. Cannot be exchanged for cash.')}
      </div>

      <div style="text-align:center;margin-top:14px;font-size:11px;">
        <div style="display:inline-block;border:2px dashed #000;padding:6px 14px;border-radius:6px;">
          Authorized Signature: _______________
        </div>
      </div>

      <div style="text-align:center;font-size:9px;color:#666;margin-top:10px;">Powered by Laundry POS POS</div>
    </div>
  `;
}

function buildCashRefundDoc(claim, s, logoBlock) {
  return `
    <div class="invoice-page" style="max-width:500px;border:3px solid #22c55e;">
      ${logoBlock}
      <h2 style="font-size:20px;text-align:center;">${escapeHtml(s.shopName)}</h2>
      <div class="sub">${escapeHtml(s.address||'')}<br>📞 ${escapeHtml(s.phone||'')}</div>
      <div style="text-align:center;font-weight:900;font-size:20px;letter-spacing:2px;border-top:2px solid #000;border-bottom:2px solid #000;padding:10px;margin:10px 0;background:#22c55e;color:#fff;">
        💰 CASH REFUND RECEIPT
      </div>

      <table style="width:100%;font-size:13px;">
        <tr><td><b>Claim No:</b></td><td style="text-align:right;"><b>${escapeHtml(claim.claimNo)}</b></td></tr>
        <tr><td><b>Date:</b></td><td style="text-align:right;">${fmtDate(claim.createdAt)}</td></tr>
        <tr><td><b>Customer:</b></td><td style="text-align:right;">${escapeHtml(claim.customerName)}</td></tr>
        <tr><td><b>Phone:</b></td><td style="text-align:right;">${escapeHtml(claim.customerPhone)}</td></tr>
        <tr><td><b>Processed By:</b></td><td style="text-align:right;">${escapeHtml(claim.createdBy||'-')}</td></tr>
      </table>
      <div class="line"></div>

      <div style="background:#f8faff;border:1px solid #ddd;border-radius:8px;padding:10px;margin:10px 0;">
        <div style="font-weight:700;font-size:12px;margin-bottom:6px;">📋 Item Damaged:</div>
        <div style="font-size:12px;">${escapeHtml(claim.itemDescription)}</div>
      </div>

      ${claim.thirdPartyShop ? `<div style="background:#dbeafe;border:1px solid #4f7cff;border-radius:8px;padding:10px;margin:10px 0;font-size:12px;">
        <b>📍 Originally Purchased From:</b> ${escapeHtml(claim.thirdPartyShop)}
      </div>` : ''}

      <div style="border:2px solid #000;border-radius:8px;padding:12px;margin:10px 0;background:#fef3c7;">
        <div style="font-weight:700;font-size:12px;margin-bottom:8px;text-align:center;text-decoration:underline;">REFUND CALCULATION</div>
        <table style="width:100%;font-size:13px;">
          <tr><td>Original Price (3rd-party shop):</td><td style="text-align:right;"><b>${fmtMoney(claim.itemPurchasePrice||0)}</b></td></tr>
          <tr><td>Refund Rate:</td><td style="text-align:right;"><b>× ${claim.itemPercent||30}%</b></td></tr>
          <tr style="border-top:1px solid #000;"><td style="padding-top:8px;"><b style="font-size:14px;">💵 REFUND TO CUSTOMER:</b></td><td style="text-align:right;padding-top:8px;"><b style="font-size:18px;color:#22c55e;">${fmtMoney(claim.cashAmount)}</b></td></tr>
        </table>
      </div>

      ${(claim.ourLaundryCharge || claim.netLoss) ? `<div style="background:#fee2e2;border:1px dashed #ef4444;border-radius:8px;padding:10px;margin:10px 0;font-size:11px;color:#7f1d1d;">
        <b>📊 Internal Record (Shop Use Only):</b><br>
        Customer paid us for laundry: <b>${fmtMoney(claim.ourLaundryCharge||0)}</b><br>
        Refund paid out: <b>${fmtMoney(claim.cashAmount)}</b><br>
        <b style="color:#a00;">Net Loss to Shop: ${fmtMoney(claim.netLoss||0)}</b> (goodwill expense)
      </div>` : ''}

      <div style="background:#d1fae5;padding:10px;border-radius:6px;margin:14px 0;text-align:center;font-size:12px;font-weight:700;color:#065f46;">
        ✅ Customer received their original slip back & ${fmtMoney(claim.cashAmount)} cash refund
      </div>

      ${claim.slipPhoto ? `<div style="text-align:center;margin:14px 0;"><div style="font-size:10px;color:#666;font-weight:700;">📸 Original 3rd-Party Slip (kept on file as proof):</div><img src="${claim.slipPhoto}" style="max-width:200px;border:2px solid #000;margin-top:4px;border-radius:4px;"/></div>` : ''}

      <div class="line"></div>
      <table style="width:100%;font-size:11px;">
        <tr>
          <td style="text-align:center;padding:14px 0;">
            <div style="border-top:1px solid #000;display:inline-block;padding-top:4px;width:140px;">Customer Signature</div>
          </td>
          <td style="text-align:center;padding:14px 0;">
            <div style="border-top:1px solid #000;display:inline-block;padding-top:4px;width:140px;">Shop Signature</div>
          </td>
        </tr>
      </table>

      <div style="text-align:center;font-size:9px;color:#666;margin-top:10px;">Powered by Laundry POS POS</div>
    </div>
  `;
}

/* ===== Settle / Close Claim ===== */
function settleClaim(claimId) {
  confirmDialog('Mark this claim as settled?', () => {
    DB.update('claims', claimId, { status: 'settled', settledAt: new Date().toISOString() });
    if (typeof logAction === 'function') logAction('claim.settle', claimId);
    toast('Claim marked settled', 'success');
    renderClaimsBody();
  });
}

/* ===== Vouchers List ===== */
function openVouchersList() {
  const vouchers = [...DB.all('vouchers')].sort((a,b) => (b.issuedAt||'').localeCompare(a.issuedAt||''));
  const rows = vouchers.length ? vouchers.map(v => {
    const expDate = new Date(v.expiresAt);
    const isExpired = expDate < new Date();
    const isUsedUp = (v.usedCount||0) >= v.totalUses;
    const status = isExpired ? 'EXPIRED' : isUsedUp ? 'USED UP' : 'ACTIVE';
    const statusBadge = isExpired || isUsedUp ? 'cancelled' : 'paid';
    return `<tr>
      <td><b>${escapeHtml(v.voucherNo)}</b></td>
      <td>${escapeHtml(v.customerName)}<br><small>${escapeHtml(v.customerPhone)}</small></td>
      <td>${fmtDateShort(v.issuedAt)}</td>
      <td>${fmtDateShort(v.expiresAt)}</td>
      <td><b>${v.usedCount||0} / ${v.totalUses}</b></td>
      <td><span class="badge ${statusBadge}">${status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="closeModal();openClaimDocument('${v.claimId}')">👁️ View</button>
        ${!isExpired && !isUsedUp ? `<button class="btn btn-success btn-sm" onclick="redeemVoucher('${v.id}')">✅ Use 1</button>` : ''}
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="empty"><div class="emoji">🎫</div><p>No vouchers issued yet</p></td></tr>';

  openModal(`
    <h3>🎫 All Claim Vouchers</h3>
    <p class="sub">Track usage of all issued free-laundry vouchers.</p>
    <table class="tbl">
      <thead><tr><th>Voucher #</th><th>Customer</th><th>Issued</th><th>Expires</th><th>Used</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
  `, { large: true });
}

/* ===== Redeem one wash from voucher ===== */
function redeemVoucher(voucherId) {
  const v = DB.get('vouchers', voucherId);
  if (!v) return;
  if ((v.usedCount||0) >= v.totalUses) { toast('Voucher already fully used','error'); return; }
  if (new Date(v.expiresAt) < new Date()) { toast('Voucher expired','error'); return; }

  confirmDialog(`Use 1 wash from ${v.voucherNo}? (${(v.usedCount||0)+1} / ${v.totalUses} after redemption)`, () => {
    const usage = v.usageHistory || [];
    usage.push({ date: new Date().toISOString(), by: DB.currentUser()?.username || '' });
    DB.update('vouchers', voucherId, {
      usedCount: (v.usedCount||0) + 1,
      usageHistory: usage
    });
    if (typeof logAction === 'function') logAction('voucher.redeem', `${v.voucherNo}: ${(v.usedCount||0)+1}/${v.totalUses}`);
    toast(`Voucher redeemed (${(v.usedCount||0)+1}/${v.totalUses})`, 'success');
    closeModal();
    openVouchersList();
  });
}
