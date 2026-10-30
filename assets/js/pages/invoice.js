/* ===================== INVOICE / RECEIPT ===================== */
function openInvoice(orderId, autoPrint) {
  const o = DB.get('orders', orderId);
  if (!o) { toast('Order not found','error'); return; }
  const c = DB.get('customers', o.customerId) || { name:'Walk-in Customer' };
  const cashier = DB.get('users', o.cashierId) || { name:'-' };
  const s = DB.settings();
  const invoiceNo = o.invoiceNo ? `INV-${o.invoiceNo}` : '#' + o.id.slice(-6).toUpperCase();
  const totalPcs = (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);
  const delTypeMap = {
    hanger: { icon: '🧥', label: 'HANGER' },
    fold:   { icon: '📦', label: 'FOLD' },
    both:   { icon: '🧺', label: 'BOTH / MIXED' }
  };
  const delTypeInfo = delTypeMap[(o.deliveryType||'').toLowerCase()] || delTypeMap.hanger;

  const qrData = (s.baseUrl ? s.baseUrl.replace(/\/$/, '') + '/invoice/' : '') + o.id;
  const dualCopy = s.printDualCopy !== false;

  const customerSlip = buildCustomerSlip(o, c, cashier, s, invoiceNo, totalPcs, delTypeInfo);
  const officeSlip = dualCopy ? buildOfficeSlip(o, c, cashier, s, invoiceNo, totalPcs, delTypeInfo) : '';

  openModal(`
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <h3>🧾 Invoice ${invoiceNo}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" id="photosBtn" title="Manage order photos (for disputes)">📷 Photos${(o.photos&&o.photos.length)?` (${o.photos.length})`:''}</button>
        ${c.phone ? `<button class="btn btn-success btn-sm" id="waBtn" title="Send invoice via WhatsApp">📱 WhatsApp</button>` : ''}
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-secondary btn-sm" id="customizeInv">⚙️ Customize</button><button class="btn btn-warning btn-sm" id="editFromInv">✏️ Edit</button>`:''}
        <button class="btn btn-secondary btn-sm" id="printCustomerOnly" title="Print only customer copy">🖨️ Customer Only</button>
        <button class="btn btn-primary btn-sm" id="printBoth" title="Print customer + office copy together">🖨️🖨️ Print Both</button>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button>
      </div>
    </div>

    ${dualCopy ? `
      <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;background:#f0f4ff;padding:14px;border-radius:10px;" class="no-print">
        <div style="flex:0 0 auto;">
          <div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;">📄 Customer Copy (Page 1)</div>
          ${customerSlip}
        </div>
        <div style="flex:0 0 auto;">
          <div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;">📋 Office Copy — Small (Page 2)</div>
          ${officeSlip}
        </div>
      </div>
    ` : `<div class="no-print" style="background:#f0f4ff;padding:14px;border-radius:10px;display:flex;justify-content:center;">${customerSlip}</div>`}

    <!-- Hidden print container -->
    <div id="printArea" class="print-only" style="display:none;">
      <div class="print-slip">${customerSlip}</div>
      ${dualCopy ? `<div class="print-page-break"></div><div class="print-slip">${officeSlip}</div>` : ''}
    </div>
  `, { large: true, onOpen(m) {
    drawInvoiceQRs(m, qrData || o.id, s);
    const editBtn = $('#editFromInv', m);
    if (editBtn) editBtn.onclick = () => { closeModal(); openEditInvoice(o.id); };
    const custBtn = $('#customizeInv', m);
    if (custBtn) custBtn.onclick = () => { closeModal(); openInvoiceCustomizer(orderId); };
    const recvBtn = m.querySelector('#recvFromInv');
    if (recvBtn) recvBtn.onclick = () => { closeModal(); setTimeout(() => openReceivePayment(orderId), 150); };
    const photosBtn = $('#photosBtn', m);
    if (photosBtn) photosBtn.onclick = () => { closeModal(); openOrderPhotos(o.id); };
    const waBtn = $('#waBtn', m);
    if (waBtn) waBtn.onclick = () => sendWhatsAppInvoice(o, c, s, invoiceNo, totalPcs, delTypeInfo);
    $('#printCustomerOnly', m).onclick = () => doPrint(false);
    $('#printBoth', m).onclick = () => doPrint(dualCopy);
    if (autoPrint) setTimeout(() => doPrint(dualCopy), 300);
  }});
}

function drawInvoiceQRs(root, data, s) {
  if (s.invoiceShowQR === false) return;
  $$('.invQR', root).forEach(canvas => {
    try { QRCode.toCanvas(canvas, data, { scale: 2, border: 1 }); } catch(e){}
  });
}

function doPrint(includeOffice) {
  // Find the print area in current modal
  const printArea = document.getElementById('printArea');
  if (!printArea) { alert('Print content not ready'); return; }

  // Build temporary element with only what we want to print
  const wrap = document.createElement('div');
  wrap.id = 'printWrapper';
  // Clone first slip (customer copy)
  const slips = printArea.querySelectorAll('.print-slip');
  if (slips.length > 0) wrap.appendChild(slips[0].cloneNode(true));
  // Add office copy only if requested
  if (includeOffice && slips.length > 1) {
    const breakDiv = document.createElement('div');
    breakDiv.className = 'print-page-break';
    wrap.appendChild(breakDiv);
    wrap.appendChild(slips[1].cloneNode(true));
  }

  // Use universal printElement helper
  if (typeof printElement === 'function') {
    printElement(wrap, { title: 'Invoice Print' });
  } else {
    alert('Print helper not loaded. Refresh page.');
  }
}

/* ============================================================
   INVOICE LOGO — thermal safe
   ============================================================
   Thermal printers are 1-bit, so the raw colour logo is not used
   directly. If a processed (monochrome, inverted-if-dark, trimmed)
   version is ready it is printed at a real physical size in mm.
   Otherwise we fall back to the client's logo with safe CSS.
   ============================================================ */
function buildInvoiceLogo(s, width, fontSize) {
  // No logo uploaded → print the shop name big, as before
  if (!s.logoImage) {
    return `<div style="text-align:center;font-size:${fontSize+18}px;font-weight:900;line-height:1.2;">${escapeHtml(s.shopName)}</div>`;
  }

  const isThermal = (s.invoicePaper === '58' || s.invoicePaper === '80' || !s.invoicePaper);
  const mono = s.invoiceLogoMono !== false;

  // Physical width in mm (thermal) so the size is correct on paper
  let mm = null, processed = null;
  if (typeof THERMAL !== 'undefined') {
    try {
      mm = THERMAL.targetMm(s);
      processed = THERMAL.cached(s);       // sync read; warms cache if missing
    } catch (e) { processed = null; }
  }

  const src = (mono && processed) ? processed : s.logoImage;

  // Thermal: size in mm. A4/laser: scale to the invoice width.
  const widthCss = (isThermal && mm)
    ? `width:${mm}mm;max-width:${mm}mm;`
    : `max-width:${Math.min(200, width * 0.6)}px;`;
  const heightCss = (isThermal && mm) ? `max-height:${Math.round(mm * 0.55)}mm;` : `max-height:100px;`;

  return `<div class="inv-logo-wrap" style="text-align:center;margin-bottom:8px;">` +
         `<img class="inv-logo" src="${src}" alt="${escapeHtml(s.shopName)}" ` +
         `style="${widthCss}${heightCss}object-fit:contain;background:#fff;padding:2px;` +
         `image-rendering:pixelated;filter:none;"/>` +
         `</div>`;
}

/* ============================================================
   CUSTOMER COPY (Page 1 — Full details)
   ============================================================ */
function buildCustomerSlip(o, c, cashier, s, invoiceNo, totalPcs, delTypeInfo) {
  const showLogo = s.invoiceShowLogo !== false;
  const showAddress = s.invoiceShowAddress !== false;
  const showPhone = s.invoiceShowPhone !== false;
  const showTagline = s.invoiceShowTagline !== false;
  const showCashier = s.invoiceShowCashier !== false;
  const showQR = s.invoiceShowQR !== false;
  const showDelType = s.invoiceShowDeliveryType !== false;
  const showItems = s.invoiceShowItemBreakdown !== false;
  const showPayMethod = s.invoiceShowPaymentMethod !== false;
  const showDiscount = s.invoiceShowDiscount !== false;
  const showNotes = s.invoiceShowNotes !== false;
  const showFooter = s.invoiceShowFooter !== false;
  const showEdited = s.invoiceShowEditedBadge !== false;
  const showQtyCircle = s.invoiceQtyCircle !== false;
  const showTerms = s.invoiceShowTerms === true;
  // Thermal sizing: 58mm rolls have far less room, so step the type down
  const narrow = (s.invoicePaper === '58');
  const fontSize = narrow
    ? Math.max(11, Math.min(20, (+s.invoiceFontSize || 13)))
    : Math.max(12, Math.min(24, (+s.invoiceFontSize || 13) + 2));
  const width = Math.max(280, Math.min(800, +s.invoiceWidth || 360));

  const itemsHtml = (o.items || []).map(it => `
    <tr>
      <td style="padding:6px 0;font-size:${fontSize+1}px;font-weight:bold;">${escapeHtml(it.name)}<br><span style="font-size:${fontSize-1}px;font-weight:normal;">${it.qty} × ${fmtMoney(it.price)}</span></td>
      <td style="text-align:right;padding:6px 0;font-size:${fontSize+1}px;font-weight:bold;">${fmtMoney(it.qty*it.price)}</td>
    </tr>
  `).join('');

  const logoBlock = showLogo ? buildInvoiceLogo(s, width, fontSize) : '';

  const totalDisc = (o.discount || ((o.manualDiscount||0) + (o.loyaltyDiscount||0)));
  const discountLines = showDiscount ? `
    ${o.manualDiscount>0 ? `<tr><td style="padding:6px 0;font-size:${fontSize+2}px;font-weight:900;color:#000;">🎉 Discount${o.discountType==='percent'?` (${o.discountValue}%)`:''}:</td><td style="text-align:right;padding:6px 0;font-size:${fontSize+2}px;font-weight:900;color:#000;">- ${fmtMoney(o.manualDiscount)}</td></tr>` : ''}
    ${o.loyaltyDiscount>0 ? `<tr><td style="padding:6px 0;font-size:${fontSize+2}px;font-weight:900;color:#000;">⭐ Loyalty (${o.loyaltyPercent||''}%):</td><td style="text-align:right;padding:6px 0;font-size:${fontSize+2}px;font-weight:900;color:#000;">- ${fmtMoney(o.loyaltyDiscount)}</td></tr>` : ''}
    ${(!o.manualDiscount && !o.loyaltyDiscount && totalDisc>0) ? `<tr><td style="padding:6px 0;font-size:${fontSize+2}px;font-weight:900;color:#000;">🎉 Discount:</td><td style="text-align:right;padding:6px 0;font-size:${fontSize+2}px;font-weight:900;color:#000;">- ${fmtMoney(totalDisc)}</td></tr>` : ''}
  ` : '';

  return `
    <div class="invoice-page invoice-customer" style="max-width:${width}px;font-size:${fontSize}px;background:#fff;padding:16px;">
      ${logoBlock}
      <div style="text-align:center;font-size:${fontSize}px;margin-bottom:12px;line-height:1.4;">
        ${showTagline && s.tagline ? '<b>'+escapeHtml(s.tagline)+'</b><br>':''}
        ${showAddress && s.address ? escapeHtml(s.address)+'<br>':''}
        ${showPhone && s.phone ? escapeHtml(s.phone):''}
      </div>
      
      <div style="text-align:center;font-size:${narrow ? fontSize : fontSize+2}px;font-weight:900;margin:12px 0;letter-spacing:${narrow ? '0' : '1px'};color:#000;padding:6px 0;white-space:nowrap;border-top:2px dashed #000;border-bottom:2px dashed #000;">★ CUSTOMER COPY ★</div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:inline-block;background:#fff;color:#000;border:2px solid #000;border-radius:10px;padding:8px 14px;flex:1;margin-right:12px;text-align:center;">
          <div style="font-size:${fontSize-2}px;font-weight:800;letter-spacing:1px;">INVOICE NO.</div>
          <div style="font-size:${fontSize+12}px;font-weight:900;line-height:1.2;letter-spacing:1px;">${invoiceNo}</div>
        </div>
        ${showQtyCircle ? `
          <div style="border:2px solid #000;border-radius:50%;min-width:70px;height:70px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#fff;color:#000;">
            <div style="font-size:${fontSize+10}px;font-weight:900;line-height:1;">${totalPcs}</div>
            <div style="font-size:${fontSize-4}px;font-weight:800;line-height:1;margin-top:2px;">PCS</div>
          </div>
        ` : ''}
      </div>

      ${showDelType ? `
        <div style="text-align:center;margin-bottom:16px;">
          <span style="font-size:${fontSize+2}px;font-weight:900;border:2px solid #000;border-radius:16px;padding:6px 20px;display:inline-block;">${delTypeInfo.icon} ${delTypeInfo.label}</span>
        </div>
      ` : ''}

      <table style="font-size:${fontSize+1}px;width:100%;border-collapse:collapse;margin-bottom:12px;line-height:1.5;">
        <tr><td style="padding:6px 0;border-top:1px dashed #000;font-weight:bold;">Booking Date</td><td style="text-align:right;padding:6px 0;border-top:1px dashed #000;">${fmtDate(o.createdAt)}</td></tr>
        ${o.deliveryDate? `<tr><td style="padding:6px 0;border-top:1px dashed #000;font-weight:bold;">Delivery Date</td><td style="text-align:right;padding:6px 0;border-top:1px dashed #000;color:#000;"><b>${escapeHtml(o.deliveryDate)}</b></td></tr>`:''}
        ${showCashier ? `<tr><td style="padding:6px 0;border-top:1px dashed #000;font-weight:bold;">Cashier</td><td style="text-align:right;padding:6px 0;border-top:1px dashed #000;">${escapeHtml(cashier.name)}</td></tr>`:''}
        <tr><td style="padding:6px 0;border-top:1px dashed #000;font-size:${fontSize+2}px;font-weight:bold;">Customer</td><td style="text-align:right;padding:6px 0;border-top:1px dashed #000;font-size:${fontSize+3}px;"><b>${escapeHtml(c.name)}</b></td></tr>
        ${c.phone? `<tr><td style="padding:6px 0;border-top:1px dashed #000;font-size:${fontSize+2}px;font-weight:bold;">Phone</td><td style="text-align:right;padding:6px 0;border-top:1px dashed #000;font-size:${fontSize+3}px;"><b>${escapeHtml(c.phone)}</b></td></tr>`:''}
      </table>

      ${showItems ? `
        <table style="font-size:${fontSize+1}px;width:100%;border-collapse:collapse;margin-bottom:10px;line-height:1.5;">
          <tr style="border-top:2px solid #000;border-bottom:2px solid #000;">
            <td style="padding:8px 0;font-weight:900;font-size:${fontSize+2}px;">ITEMS</td>
            <td style="text-align:right;padding:8px 0;font-weight:900;font-size:${fontSize+2}px;">TOTAL</td>
          </tr>
          ${itemsHtml}
        </table>
      ` : ''}

      <table style="font-size:${fontSize+2}px;width:100%;border-collapse:collapse;line-height:1.5;">
        <tr style="border-top:2px solid #000;"><td style="padding:8px 0;font-weight:bold;">Gross Total</td><td style="text-align:right;padding:8px 0;font-weight:bold;font-size:${fontSize+4}px;">${fmtMoney(o.subtotal)}</td></tr>
        ${discountLines}
        ${o.tax>0?`<tr><td style="padding:6px 0;">Tax</td><td style="text-align:right;padding:6px 0;">${fmtMoney(o.tax)}</td></tr>`:''}
        ${totalDisc>0?`<tr style="border-top:1px dashed #000;"><td style="padding:8px 0;font-weight:900;font-size:${fontSize+4}px;">NET TOTAL</td><td style="text-align:right;padding:8px 0;font-weight:900;font-size:${fontSize+6}px;">${fmtMoney(o.total)}</td></tr>`:''}
        <tr><td style="padding:6px 0;">Paid</td><td style="text-align:right;padding:6px 0;">${fmtMoney(o.paid)}</td></tr>
        ${o.due>0?`<tr><td style="padding:8px 0;font-size:${fontSize+4}px;font-weight:900;"><b style="color:#000;">Payment Due</b></td><td style="text-align:right;padding:8px 0;font-size:${fontSize+4}px;"><b style="color:#000;font-weight:900;">${fmtMoney(o.due)}</b></td></tr>`:''}
        ${o.due==0 && totalDisc==0?`<tr><td style="padding:8px 0;font-size:${fontSize+4}px;font-weight:900;"><b style="color:#000;">Payment</b></td><td style="text-align:right;padding:8px 0;font-size:${fontSize+4}px;"><b style="color:#000;font-weight:900;">${fmtMoney(o.total)}</b></td></tr>`:''}
      </table>

      ${showNotes && o.notes?`<div style="font-size:${fontSize}px;font-weight:bold;margin-top:16px;padding:8px;border:2px dashed #000;">📝 ${escapeHtml(o.notes)}</div>`:''}
      ${showTerms && s.invoiceTerms?`<div style="font-size:${fontSize-1}px;text-align:center;margin-top:16px;padding-top:12px;border-top:2px dashed #000;font-weight:bold;">${escapeHtml(s.invoiceTerms)}</div>`:''}
      
      ${showQR ? `<div style="text-align:center;margin-top:20px;"><canvas class="invQR"></canvas></div>` : ''}
            ${showFooter ? `<div style="text-align:center;font-size:${fontSize+2}px;font-weight:900;margin-top:16px;">${escapeHtml(s.invoiceFooter || '')}</div>` : ''}
      <div style="text-align:center; margin-top:15px; font-size:12px; color:#000; font-family:sans-serif;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <span style="vertical-align:middle; font-weight:bold;">Powered by CelineSoft</span>
      </div>
    </div>
  `;
}
/* ============================================================
   OFFICE COPY (Page 2 — Compact, paper-saving)
   ============================================================ */
function buildOfficeSlip(o, c, cashier, s, invoiceNo, totalPcs, delTypeInfo) {
  const width = Math.max(220, Math.min(400, +s.officeCopyWidth || 280));
  const fontSize = Math.max(10, Math.min(20, (+s.officeCopyFontSize || 11) + 2));

  return `
    <div class="invoice-page invoice-office" style="max-width:${width}px;font-size:${fontSize}px;padding:16px;background:#fff;border:1px dashed #ccc;">
      <div style="text-align:center;font-weight:900;font-size:${fontSize+8}px;margin-bottom:8px;color:#000;line-height:1.2;">
        ${escapeHtml(s.shopName)}
      </div>
      <div style="text-align:center;font-weight:900;font-size:${fontSize+2}px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;color:#000;">
        <hr style="flex:1; border:none; border-top:2px solid #000; margin-right:8px;">
        OFFICE COPY
        <hr style="flex:1; border:none; border-top:2px solid #000; margin-left:8px;">
      </div>

      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;background:#fff;color:#000;border:2px solid #000;border-radius:10px;padding:8px 24px;">
          <div style="font-size:${fontSize}px;font-weight:800;letter-spacing:1px;margin-bottom:2px;">INVOICE NO.</div>
          <div style="font-size:${fontSize+14}px;font-weight:900;line-height:1.1;">${invoiceNo}</div>
        </div>
      </div>

      <table style="font-size:${fontSize+1}px;width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:14px;background:#fff;line-height:1.5;">
        <tr><td style="border:1px solid #000;padding:6px 8px;font-weight:bold;">Booked:</td><td style="border:1px solid #000;padding:6px 8px;">${fmtDateShort(o.createdAt)}</td></tr>
        ${o.deliveryDate? `<tr><td style="border:1px solid #000;padding:6px 8px;font-weight:bold;">Delivery:</td><td style="border:1px solid #000;padding:6px 8px;color:#000;"><b>${escapeHtml(o.deliveryDate)}</b></td></tr>`:''}
        <tr><td style="border:1px solid #000;padding:6px 8px;font-weight:bold;">Customer:</td><td style="border:1px solid #000;padding:6px 8px;font-size:${fontSize+3}px;"><b>${escapeHtml(c.name)}</b></td></tr>
        ${c.phone? `<tr><td style="border:1px solid #000;padding:6px 8px;font-weight:bold;">Phone:</td><td style="border:1px solid #000;padding:6px 8px;font-size:${fontSize+2}px;"><b>${escapeHtml(c.phone)}</b></td></tr>`:''}
        <tr><td style="border:1px solid #000;padding:6px 8px;font-weight:bold;">By:</td><td style="border:1px solid #000;padding:6px 8px;">${escapeHtml(cashier.name)}</td></tr>
      </table>

      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <div style="flex:1;border:2px solid #000;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;background:#fff;">
          <div style="background:#fff;border-bottom:2px solid #000;color:#000;text-align:center;font-size:${fontSize}px;padding:6px 0;font-weight:900;">PIECES</div>
          <div style="text-align:center;font-size:${fontSize+10}px;font-weight:900;padding:8px 0;">${totalPcs}</div>
        </div>
        <div style="flex:2;border:2px solid #000;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;background:#fff;">
          <div style="background:#fff;border-bottom:2px solid #000;color:#000;text-align:center;font-size:${fontSize}px;padding:6px 0;font-weight:900;">PACKAGING</div>
          <div style="text-align:center;font-size:${fontSize+4}px;font-weight:900;padding:8px 0;display:flex;align-items:center;justify-content:center;gap:4px;">
             ${delTypeInfo.icon} ${delTypeInfo.label}
          </div>
        </div>
      </div>

      <div style="border:2px solid #000; border-radius:6px; padding:10px; background:#fff;">
        <table style="font-size:${fontSize+2}px;width:100%;border-collapse:collapse;line-height:1.5;">
          ${(o.items || []).map(it => `
            <tr><td style="padding:6px 0;font-weight:bold;">${escapeHtml(it.name)} <span style="font-size:${fontSize+4}px;float:right;">×${it.qty}</span></td></tr>
          `).join('')}
        </table>
        <div style="border-top:2px solid #000; margin-top:8px; padding-top:8px;">
          <table style="font-size:${fontSize+3}px;width:100%;border-collapse:collapse;line-height:1.5;">
            <tr><td style="padding:4px 0;">Gross</td><td style="text-align:right;padding:4px 0;font-weight:bold;">${fmtMoney(o.subtotal)}</td></tr>
            ${(o.discount||((o.manualDiscount||0)+(o.loyaltyDiscount||0)))>0 ? `<tr><td style="padding:4px 0;font-size:${fontSize+1}px;font-weight:900;color:#000;">Discount</td><td style="text-align:right;padding:4px 0;font-size:${fontSize+1}px;font-weight:900;color:#000;">-${fmtMoney(o.discount||((o.manualDiscount||0)+(o.loyaltyDiscount||0)))}</td></tr>
            <tr><td style="padding:4px 0;font-weight:900;">Net Total</td><td style="text-align:right;padding:4px 0;font-weight:900;">${fmtMoney(o.total)}</td></tr>` : `<tr><td style="padding:4px 0;">Total</td><td style="text-align:right;padding:4px 0;font-weight:bold;">${fmtMoney(o.total)}</td></tr>`}
            <tr><td style="padding:4px 0;">Paid</td><td style="text-align:right;padding:4px 0;font-weight:bold;">${fmtMoney(o.paid)}</td></tr>
            ${o.due>0?`<tr><td style="padding:4px 0;color:#000;font-weight:900;">Due</td><td style="text-align:right;padding:4px 0;color:#000;font-weight:900;">${fmtMoney(o.due)}</td></tr>`:''}
          </table>
        </div>
      </div>

      ${s.invoiceShowQR !== false ? `<div style="text-align:center;margin-top:16px;"><canvas class="invQR" style="max-width:90px;"></canvas></div>`:''}
    </div>
  `;
}
/* ============================================================
   WHATSAPP INVOICE
   ============================================================ */
function sendWhatsAppInvoice(o, c, s, invoiceNo, totalPcs, delTypeInfo) {
  if (!c.phone) { toast('Customer phone number missing', 'error'); return; }

  // Clean phone: digits only, with country code
  let phone = c.phone.replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) phone = phone.substring(1);
  // PK pattern: 03XXXXXXXXX (11 digits) -> 923XXXXXXXXX
  if (phone.startsWith('0') && phone.length === 11) phone = '92' + phone.substring(1);

  const itemsText = (o.items || [])
    .map(it => `• ${it.name} × ${it.qty} = ${fmtMoney(it.qty * it.price)}`)
    .join('\n');

  const template = s.whatsappTemplate || `Hello {name}, thank you for your order at {shop}!

Invoice: {invoice}
Total Pcs: {pcs}
Amount: {total}
Paid: {paid}
Due: {due}
Delivery: {delivery} ({type})

{footer}`;

  const vars = {
    '{name}':     c.name,
    '{shop}':     s.shopName,
    '{invoice}':  invoiceNo,
    '{pcs}':      totalPcs,
    '{items}':    itemsText,
    '{subtotal}': fmtMoney(o.subtotal),
    '{discount}': fmtMoney(o.discount || 0),
    '{total}':    fmtMoney(o.total),
    '{paid}':     fmtMoney(o.paid),
    '{due}':      fmtMoney(o.due),
    '{delivery}': o.deliveryDate || '-',
    '{type}':     delTypeInfo.label,
    '{phone}':    s.phone || '',
    '{address}':  s.address || '',
    '{footer}':   s.invoiceFooter || 'Thank You!'
  };

  let msg = template;
  Object.entries(vars).forEach(([k,v]) => { msg = msg.split(k).join(v); });

  // Open preview dialog so user can edit before sending
  openModal(`
    <h3>📱 Send Invoice via WhatsApp</h3>
    <p class="sub">Sending to: <b>${escapeHtml(c.name)}</b> (${escapeHtml(c.phone)}) → WhatsApp: <code>+${phone}</code></p>
    <div class="field">
      <label>Message Preview (you can edit before sending)</label>
      <textarea id="waMsg" rows="14" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;">${escapeHtml(msg)}</textarea>
    </div>
    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:12px;color:var(--text-soft);margin-bottom:14px;">
      💡 Clicking <b>Send</b> opens WhatsApp Web (on PC) or the WhatsApp app (on phone) with this message pre-filled. You just need to press the send arrow there.
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="copyBtn">📋 Copy Text</button>
      <button class="btn btn-success" id="sendBtn">📱 Open WhatsApp</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#copyBtn', m).onclick = () => {
      const text = $('#waMsg', m).value;
      navigator.clipboard.writeText(text).then(() => toast('Message copied to clipboard','success'));
    };
    $('#sendBtn', m).onclick = () => {
      const text = $('#waMsg', m).value;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      toast('Opening WhatsApp...', 'success');
      closeModal();
    };
  }});
}

/* ============================================================
   INVOICE CUSTOMIZER (admin)
   ============================================================ */
function openInvoiceCustomizer(reopenOrderId) {
  const s = DB.settings();
  const html = `
    <h3>⚙️ Customize Invoice</h3>
    <p class="sub">Control what's printed for customer copy & office copy.</p>

    <div class="form-row">
      <div class="field">
        <label>Customer Copy Font Size (px)</label>
        <input type="number" id="cfFont" value="${s.invoiceFontSize||13}" min="10" max="20"/>
      </div>
      <div class="field">
        <label>Customer Copy Width (px)</label>
        <select id="cfWidth">
          <option value="280" ${s.invoiceWidth==280?'selected':''}>280 — Thermal 58mm</option>
          <option value="360" ${(!s.invoiceWidth||s.invoiceWidth==360)?'selected':''}>360 — Thermal 80mm (default)</option>
          <option value="420" ${s.invoiceWidth==420?'selected':''}>420 — A6 paper</option>
          <option value="560" ${s.invoiceWidth==560?'selected':''}>560 — A5 paper</option>
          <option value="720" ${s.invoiceWidth==720?'selected':''}>720 — A4 paper</option>
        </select>
      </div>
    </div>

    <div class="card" style="padding:14px;margin-bottom:14px;background:var(--surface-alt);border:1px solid var(--border);">
      <div style="font-weight:700;margin-bottom:10px;">🖨️ Brand Logo on Invoice (Thermal)</div>
      <div class="form-row">
        <div class="field">
          <label>Printer Paper Width</label>
          <select id="cfPaper">
            <option value="58" ${s.invoicePaper==='58'?'selected':''}>58mm — small receipt</option>
            <option value="80" ${(!s.invoicePaper||s.invoicePaper==='80')?'selected':''}>80mm — standard (default)</option>
          </select>
          <small style="color:var(--text-soft);">58mm ≈ 48mm printable · 80mm ≈ 72mm printable</small>
        </div>
        <div class="field">
          <label>Page Margin (mm)</label>
          <select id="cfMargin">
            <option value="0" ${s.invoiceMarginMm==0?'selected':''}>0mm — edge to edge</option>
            <option value="2" ${(s.invoiceMarginMm==null||s.invoiceMarginMm==2)?'selected':''}>2mm — recommended</option>
            <option value="4" ${s.invoiceMarginMm==4?'selected':''}>4mm — safer for cheap printers</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Logo Width on Paper</label>
          <select id="cfLogoSize">
            <option value="40" ${s.invoiceLogoSize==40?'selected':''}>Small (40%)</option>
            <option value="62" ${(!s.invoiceLogoSize||s.invoiceLogoSize==62)?'selected':''}>Medium (62%) — recommended</option>
            <option value="80" ${s.invoiceLogoSize==80?'selected':''}>Large (80%)</option>
            <option value="100" ${s.invoiceLogoSize==100?'selected':''}>Full width (100%)</option>
          </select>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:4px;">
        <input type="checkbox" id="cfLogoMono" ${s.invoiceLogoMono!==false?'checked':''}/>
        <span><b>Thermal-optimise the logo</b>
          <small style="display:block;color:var(--text-soft);font-weight:400;margin-top:2px;">
            Converts to pure black &amp; white, flattens transparency to white, and auto-inverts dark logos so they never print as a black block.
          </small>
        </span>
      </label>
      <div id="logoPreviewBox" style="margin-top:12px;text-align:center;background:#fff;border:1px dashed var(--border);border-radius:8px;padding:10px;">
        <div style="font-size:11px;color:var(--text-soft);margin-bottom:8px;">Preview — exactly what the thermal head will burn</div>
        <div id="logoPreviewInner" style="min-height:40px;">…</div>
        <div id="logoPreviewMeta" style="font-size:11px;color:var(--text-soft);margin-top:8px;"></div>
      </div>
    </div>

    <div style="background:#fffbe6;border:1px solid #f59e0b;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-weight:700;margin-bottom:10px;">📋 Office Copy (Small slip for paper saving)</div>
      <label style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <input type="checkbox" id="cfDual" ${s.printDualCopy!==false?'checked':''}/>
        <b>Always print Customer + Office copy together</b>
      </label>
      <div class="form-row">
        <div class="field" style="margin:0;">
          <label>Office Copy Width (px)</label>
          <input type="number" id="cfOffW" value="${s.officeCopyWidth||280}" min="220" max="400"/>
        </div>
        <div class="field" style="margin:0;">
          <label>Office Copy Font Size (px)</label>
          <input type="number" id="cfOffF" value="${s.officeCopyFontSize||11}" min="9" max="14"/>
        </div>
      </div>
    </div>

    <div style="background:var(--surface-alt);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-weight:700;margin-bottom:10px;">👁️ What to Show on Customer Copy</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:13px;">
        ${invToggle('invoiceQtyCircle', '🔵 Big Quantity Circle', s.invoiceQtyCircle)}
        ${invToggle('invoiceShowDeliveryType', '📦 Hanger/Fold Type', s.invoiceShowDeliveryType)}
        ${invToggle('invoiceShowLogo', '🏷️ Shop Logo', s.invoiceShowLogo)}
        ${invToggle('invoiceShowTagline', '📝 Shop Tagline', s.invoiceShowTagline)}
        ${invToggle('invoiceShowAddress', '🏠 Shop Address', s.invoiceShowAddress)}
        ${invToggle('invoiceShowPhone', '📞 Shop Phone', s.invoiceShowPhone)}
        ${invToggle('invoiceShowCashier', '👤 Cashier Name', s.invoiceShowCashier)}
        ${invToggle('invoiceShowItemBreakdown', '📋 Item-by-Item List', s.invoiceShowItemBreakdown)}
        ${invToggle('invoiceShowDiscount', '💸 Discount Lines', s.invoiceShowDiscount)}
        ${invToggle('invoiceShowPaymentMethod', '💳 Payment Method', s.invoiceShowPaymentMethod)}
        ${invToggle('invoiceShowNotes', '📝 Order Notes', s.invoiceShowNotes)}
        ${invToggle('invoiceShowQR', '🔳 QR Code', s.invoiceShowQR)}
        ${invToggle('invoiceShowFooter', '💬 Footer Message', s.invoiceShowFooter)}
        ${invToggle('invoiceShowEditedBadge', '✏️ "Edited" Note', s.invoiceShowEditedBadge)}
        ${invToggle('invoiceShowTerms', '📜 Short T&C on Receipt', s.invoiceShowTerms)}
        ${invToggle('invoiceShowPortalTerms', '🌐 "Full T&C on Portal" Line', s.invoiceShowPortalTerms !== false)}
      </div>
    </div>

    <div class="form-row cols-1">
      <div class="field">
        <label>Footer Message</label>
        <input id="cfFooter" value="${escapeHtml(s.invoiceFooter||'')}"/>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field">
        <label>📜 Short Terms on Receipt <small style="color:var(--text-soft);font-weight:400;">(keep short to save paper!)</small></label>
        <textarea id="cfTerms" rows="2" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;">${escapeHtml(s.invoiceTerms||'')}</textarea>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field">
        <label>🌐 Full Terms &amp; Conditions (shown on Customer Portal page)
          <small style="color:var(--text-soft);font-weight:400;display:block;margin-top:2px;">Customers see this in a collapsible card on portal.html — no paper wasted! 📜</small>
        </label>
        <textarea id="cfPortalTerms" rows="10" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;line-height:1.6;">${escapeHtml(s.portalTerms||'')}</textarea>
      </div>
    </div>

    <div class="form-row cols-1">
      <div class="field">
        <label>📱 WhatsApp Message Template</label>
        <textarea id="cfWaTpl" rows="8" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:monospace;font-size:12px;">${escapeHtml(s.whatsappTemplate||'')}</textarea>
        <small style="color:var(--text-soft);">Variables: {name} {shop} {invoice} {pcs} {items} {subtotal} {discount} {total} {paid} {due} {delivery} {type} {phone} {address} {footer}</small>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      ${reopenOrderId ? `<button class="btn btn-secondary" id="reopenBtn">Save & Preview</button>` : ''}
      <button class="btn btn-primary" id="saveBtn">💾 Save Settings</button>
    </div>
  `;
  openModal(html, { large: true, onOpen(m) {
    /* ---- live thermal logo preview ---- */
    const renderLogoPreview = async () => {
      const box = $('#logoPreviewInner', m);
      const meta = $('#logoPreviewMeta', m);
      if (!box) return;
      const cur = DB.settings();
      const test = Object.assign({}, cur, {
        invoicePaper: $('#cfPaper', m).value,
        invoiceLogoSize: +($('#cfLogoSize', m).value || 62),
        invoiceLogoMono: $('#cfLogoMono', m).checked
      });

      if (!cur.logoImage) {
        box.innerHTML = '<div style="padding:10px;color:var(--text-soft);font-size:12px;">No logo uploaded — the shop NAME will be printed instead.</div>';
        if (meta) meta.textContent = '';
        return;
      }

      if (!test.invoiceLogoMono) {
        box.innerHTML = '<div style="padding:10px;color:var(--text-soft);font-size:12px;">Thermal optimisation is OFF — the original colour logo will print.<br><b>Warning:</b> dark logos may print as a solid black block.</div>';
        if (meta) meta.textContent = '';
        return;
      }

      box.innerHTML = '<div style="padding:10px;color:var(--text-soft);font-size:12px;">Preparing preview…</div>';
      try {
        if (typeof THERMAL === 'undefined') throw new Error('thermal module missing');
        THERMAL.clearCache();
        const res = await THERMAL.prepare(test, {});
        if (!res) throw new Error('could not process');
        const mm = THERMAL.targetMm(test);
        const dots = THERMAL.targetDots(test);
        box.innerHTML = '<img src="' + res.dataUrl + '" style="width:' + mm + 'mm;max-width:100%;image-rendering:pixelated;background:#fff;border:1px solid #eee;padding:2px;"/>';
        if (meta) {
          meta.innerHTML = '📐 ' + mm + 'mm wide on paper (' + dots + ' dots) · ' +
            res.w + '×' + res.h + 'px · ' +
            (res.inverted ? '🔄 auto-inverted (dark logo)' : '◻️ used as-is');
        }
      } catch (e) {
        box.innerHTML = '<div style="padding:10px;color:var(--danger);font-size:12px;">Preview unavailable: ' + escapeHtml(e.message) + '</div>';
      }
    };

    ['cfPaper', 'cfLogoSize'].forEach(id => {
      const el = $('#' + id, m);
      if (el) el.onchange = renderLogoPreview;
    });
    const monoEl = $('#cfLogoMono', m);
    if (monoEl) monoEl.onchange = renderLogoPreview;
    renderLogoPreview();

    const collect = () => {
      const patch = {
        invoiceFontSize: Math.max(10, Math.min(20, +$('#cfFont', m).value || 13)),
        invoiceWidth: +$('#cfWidth', m).value || 360,
        invoicePaper: $('#cfPaper', m).value === '58' ? '58' : '80',
        invoiceLogoSize: +($('#cfLogoSize', m).value || 62),
        invoiceLogoMono: $('#cfLogoMono', m).checked,
        invoiceMarginMm: +($('#cfMargin', m).value || 0),
        invoiceFooter: $('#cfFooter', m).value,
        invoiceTerms: $('#cfTerms', m).value,
        portalTerms: $('#cfPortalTerms', m).value,
        printDualCopy: $('#cfDual', m).checked,
        officeCopyWidth: +$('#cfOffW', m).value || 280,
        officeCopyFontSize: +$('#cfOffF', m).value || 11,
        whatsappTemplate: $('#cfWaTpl', m).value
      };
      $$('input[data-inv-toggle]', m).forEach(cb => { patch[cb.dataset.invToggle] = cb.checked; });
      return patch;
    };
    $('#saveBtn', m).onclick = () => { DB.saveSettings(collect()); toast('Invoice settings saved','success'); closeModal(); };
    const reopenBtn = $('#reopenBtn', m);
    if (reopenBtn) reopenBtn.onclick = () => { DB.saveSettings(collect()); toast('Saved','success'); closeModal(); setTimeout(()=>openInvoice(reopenOrderId), 100); };
  }});
}

function invToggle(key, label, currentVal) {
  const checked = currentVal === false ? '' : 'checked';
  return `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;">
    <input type="checkbox" data-inv-toggle="${key}" ${checked}/> ${label}
  </label>`;
}

/* ============================================================
   B2B ZERO-CASH DELIVERY CHALLAN (Thermal)
   ============================================================ */
function printChallan(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) return;
  const c = DB.get('customers', o.customerId) || { name: 'Customer' };
  const s = DB.settings();
  const challanNo = o.invoiceNo ? `CH-${o.invoiceNo}` : 'CH-' + o.id.slice(-6).toUpperCase();
  const totalPcs = (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0);
  
  const width = Math.max(280, Math.min(400, +s.invoiceWidth || 300));
  const fontSize = Math.max(12, Math.min(20, (+s.invoiceFontSize || 13)));

  const html = `
    <div style="font-family:'Courier New', Courier, monospace; width:${width}px; padding:10px; color:#000; box-sizing:border-box;">
      <div style="text-align:center; margin-bottom:12px; border-bottom:2px dashed #000; padding-bottom:8px;">
        <div style="font-size:${fontSize+6}px; font-weight:900; margin-bottom:4px;">${escapeHtml(s.shopName)}</div>
        <div style="font-size:${fontSize}px; font-weight:bold; background:#000; color:#fff; display:inline-block; padding:4px 8px; letter-spacing:1px;">DELIVERY CHALLAN</div>
      </div>
      
      <div style="font-size:${fontSize}px; line-height:1.5; margin-bottom:12px;">
        <b>Client:</b> ${escapeHtml(c.name)}<br>
        <b>Challan #:</b> ${challanNo}<br>
        <b>Date:</b> ${fmtDate(o.createdAt)}<br>
        <b>Type:</b> B2B / Corporate
      </div>
      
      <table style="width:100%; font-size:${fontSize}px; border-collapse:collapse; margin-bottom:14px; border-top:2px solid #000; border-bottom:2px solid #000;">
        <thead>
          <tr>
            <th style="text-align:left; padding:6px 0; border-bottom:1px dashed #000;">Item Description</th>
            <th style="text-align:right; padding:6px 0; border-bottom:1px dashed #000;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${(o.items||[]).map(it => `
            <tr>
              <td style="padding:6px 0; font-weight:bold;">${escapeHtml(it.name)}</td>
              <td style="text-align:right; font-weight:bold; font-size:${fontSize+2}px;">${it.qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="text-align:right; font-weight:900; font-size:${fontSize+2}px; margin-bottom:20px;">
        Total Pieces: ${totalPcs}
      </div>
      
      <div style="text-align:center; font-size:${fontSize-2}px; font-weight:bold; border:2px solid #000; padding:6px; margin-bottom:30px; border-radius:4px;">
        * ZERO CASH MEMO *<br>Billed to Monthly Statement
      </div>
      
      <div style="border-top:1px solid #000; text-align:center; padding-top:6px; font-size:${fontSize-1}px; font-weight:bold; margin-bottom:14px; width:80%; margin-left:10%;">
        Receiver Signature & Stamp
      </div>
    </div>
  `;

  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  if (typeof printElement === 'function') printElement(wrap, { title: 'Delivery Challan' });
}
window.printChallan = printChallan;
