/* ===================== POS (NEW SALE) ===================== */
let posState = {
  cart: [],
  customerId: 'cu1',
  discountType: 'fixed',   // 'fixed' or 'percent'
  discountValue: 0,
  pickupDeliveryCharges: 0, // cashier-entered, added AFTER discount
  activeCategory: 'all',
  search: ''
};

function renderPOS() {
  const content = `
    <div class="pos-layout">
      <div class="pos-products">
        <div class="pos-search">
          <input id="posSearch" placeholder="🔍 ${t('pos.searchProducts')}" value="${escapeHtml(posState.search)}"/>
          <button class="btn btn-success" id="posQuickPay" title="${t('pos.receivePaymentTip')}">💰 ${t('pos.receivePayment')}</button>
          <button class="btn btn-secondary" id="addProductQuick">+ ${t('pos.quickAdd')}</button>
        </div>
        <div class="pos-categories" id="posCats"></div>
        <div class="product-grid" id="posGrid"></div>
      </div>

      <div class="pos-cart">
        <div class="cart-header">
          <h3>🛒 ${t('pos.currentSale')}</h3>
          <button class="btn btn-ghost btn-sm" id="clearCart">${t('pos.clear')}</button>
        </div>
        <div class="cart-customer">
          <span class="ic">👤</span>
          <span class="name" id="custName">${t('pos.walkin')}</span>
          <button class="btn btn-secondary btn-sm" id="chooseCustBtn">Change</button>
        </div>
        <div class="cart-items" id="cartItems"></div>
        <div class="cart-summary" id="cartSummary"></div>
      </div>
    </div>
  `;
  $('#app').innerHTML = renderLayout('pos', content);
  bindLayout();

  renderPosCats();
  renderPosGrid();
  renderCart();

  $('#posSearch').oninput = (e) => { posState.search = e.target.value; renderPosGrid(); };
  $('#clearCart').onclick = () => { posState.cart = []; posState.discountValue = 0; posState.pickupDeliveryCharges = 0; renderCart(); };
  $('#chooseCustBtn').onclick = openCustomerPicker;

  // Mobile: tap cart header to collapse/expand
  const cartEl = document.querySelector('.pos-cart');
  const cartHdr = document.querySelector('.cart-header');
  if (cartHdr && cartEl) {
    cartHdr.addEventListener('click', (e) => {
      // Don't collapse if user clicked the Clear button
      if (e.target.closest('button')) return;
      if (window.innerWidth <= 768) cartEl.classList.toggle('collapsed');
    });
    // Start collapsed on mobile
    if (window.innerWidth <= 768) cartEl.classList.add('collapsed');
  }
  $('#addProductQuick').onclick = openQuickAdd;
  $('#posQuickPay').onclick = () => openQuickPay();
}

function renderPosCats() {
  const cats = DB.all('categories');
  const html = `
    <div class="cat-chip ${posState.activeCategory==='all'?'active':''}" data-cat="all">
      <div class="cat-icon">📋</div>
      <span>${t('pos.allCategories')}</span>
    </div>
    ${cats.map(c => {
      const iconHtml = (c.image && (c.image.startsWith('data:') || c.image.startsWith('http')))
        ? `<img src="${c.image}" alt=""/>`
        : (c.icon || '🏷️');
      return `<div class="cat-chip ${posState.activeCategory===c.id?'active':''}" data-cat="${c.id}">
        <div class="cat-icon">${iconHtml}</div>
        <span>${escapeHtml(c.name)}</span>
      </div>`;
    }).join('')}
  `;
  $('#posCats').innerHTML = html;
  $$('.cat-chip').forEach(ch => ch.onclick = () => { posState.activeCategory = ch.dataset.cat; renderPosCats(); renderPosGrid(); });
}

function renderPosGrid() {
  const products = DB.all('products').filter(p => p.active !== false);
  const filtered = products.filter(p => {
    if (posState.activeCategory !== 'all' && p.category !== posState.activeCategory) return false;
    if (posState.search && !p.name.toLowerCase().includes(posState.search.toLowerCase())) return false;
    return true;
  });
  if (!filtered.length) {
    $('#posGrid').innerHTML = `<div class="empty" style="grid-column:1/-1;"><div class="emoji">🔍</div><h4>No products found</h4></div>`;
    return;
  }
  $('#posGrid').innerHTML = filtered.map(p => `
    <div class="product-tile" data-id="${p.id}">
      <div class="add-pill">+</div>
      <div class="img">${productImageHTML(p.image, 160)}</div>
      <div class="pname">${escapeHtml(p.name)}</div>
      <div class="pprice">${fmtMoney(p.price)}</div>
    </div>
  `).join('');
  $$('.product-tile').forEach(t => t.onclick = (ev) => {
    const tile = ev.currentTarget;
    addToCart(tile.dataset.id);
    // "Added" flash animation
    tile.classList.add('added');
    setTimeout(() => tile.classList.remove('added'), 500);
    // Subtle sound
    try { SoundFX.play('click'); } catch(e) {}
    // Pulse cart icon for feedback
    const cart = document.querySelector('.pos-cart');
    if (cart) {
      cart.style.transition = 'transform .2s ease';
      cart.style.transform = 'scale(1.015)';
      setTimeout(() => cart.style.transform = '', 200);
    }
  });
}

function addToCart(productId) {
  const p = DB.get('products', productId);
  if (!p) return;
  const existing = posState.cart.find(i => i.productId === productId);
  if (existing) existing.qty += 1;
  else posState.cart.push({ productId: p.id, name: p.name, image: p.image, price: p.price, originalPrice: p.price, qty: 1 });
  renderCart();
}

/* ===== Calculate cart totals (shared) ===== */
function calcCartTotals() {
  const subtotal = posState.cart.reduce((s,i) => s + i.price * i.qty, 0);
  const settings = DB.settings();
  const taxPercent = settings.taxPercent || 0;
  const cust = DB.get('customers', posState.customerId);

  // Manual discount
  let manualDiscount = 0;
  if (posState.discountType === 'percent') {
    manualDiscount = Math.round(subtotal * (posState.discountValue || 0) / 100);
  } else {
    manualDiscount = posState.discountValue || 0;
  }
  manualDiscount = Math.min(subtotal, Math.max(0, manualDiscount));

  // Loyalty discount (auto-applied if customer has loyalty card)
  let loyaltyDiscount = 0;
  let loyaltyPercent = 0;
  if (cust && cust.loyaltyActive && cust.loyaltyDiscountPercent > 0) {
    loyaltyPercent = cust.loyaltyDiscountPercent;
    loyaltyDiscount = Math.round((subtotal - manualDiscount) * loyaltyPercent / 100);
  }

  const totalDiscount = manualDiscount + loyaltyDiscount;
  const taxable = Math.max(0, subtotal - totalDiscount);
  const tax = Math.round(taxable * taxPercent / 100);

  /* Pick Up & Delivery Charges are deliberately OUTSIDE the subtotal:
     discount and tax are computed on items only, then charges are added
     at the very end. A percent discount can never reduce these charges. */
  const pickupDeliveryCharges = Math.max(0, Number(posState.pickupDeliveryCharges) || 0);
  const totalBeforeCharges = taxable + tax;
  const total = totalBeforeCharges + pickupDeliveryCharges;

  return { subtotal, manualDiscount, loyaltyDiscount, loyaltyPercent, totalDiscount,
           tax, taxPercent, pickupDeliveryCharges, totalBeforeCharges, total };
}

function renderCart() {
  /* FOCUS GUARD: a full re-render used to replace the discount <input> on
     every keystroke, so typing "50" produced only "5" and the cashier had to
     click again (or use the spinner). Remember the focused field + caret and
     put them back after every render — belt-and-braces for radio switches,
     item edits, cloud refreshes, etc. */
  const _ae = document.activeElement;
  const _focusId = (_ae && _ae.id && /^(INPUT|TEXTAREA|SELECT)$/.test(_ae.tagName)) ? _ae.id : null;
  let _selStart = null, _selEnd = null;
  let _restoringFocus = false;
  try {
    if (_focusId && typeof _ae.selectionStart === 'number') {
      _selStart = _ae.selectionStart; _selEnd = _ae.selectionEnd;
    }
  } catch (e) {}
  const _restoreFocus = () => {
    if (!_focusId) return;
    const again = document.getElementById(_focusId);
    if (!again) return;
    _restoringFocus = true;
    try { again.focus({ preventScroll: true }); } catch (e) {}
    _restoringFocus = false;
    /* onfocus normally selects all; that is suppressed while restoring,
       then the saved caret is put back exactly where it was. */
    try {
      if (_selStart != null && typeof again.setSelectionRange === 'function') {
        again.setSelectionRange(_selStart, _selEnd);
      }
    } catch (e) {}
  };

  const items = posState.cart;
  const cust = DB.get('customers', posState.customerId);
  
  // Loyalty expiry check
  if (cust && cust.loyaltyActive && cust.loyaltyExpiry && cust.loyaltyExpiry < isoDay()) {
    cust.loyaltyActive = false; // Expired for this transaction
    if (!posState._loyaltyWarned) {
      toast(`Loyalty card expired on ${fmtDateShort(cust.loyaltyExpiry)}`, 'error');
      posState._loyaltyWarned = true;
    }
  }

  const custLabel = cust
    ? `${cust.name}${cust.phone? ` • ${cust.phone}`:''}${cust.loyaltyActive? ` ⭐${cust.loyaltyDiscountPercent}%`: (cust.loyaltyExpiry && cust.loyaltyExpiry < isoDay() ? ' ❌ Expired' : '')}`
    : 'Walk-in Customer';
  $('#custName').textContent = custLabel;

  if (!items.length) {
    $('#cartItems').innerHTML = `<div class="cart-empty"><div class="emoji">🛒</div><div>Cart is empty<br><small>Tap a product to add it</small></div></div>`;
    $('#cartSummary').innerHTML = `<button class="btn btn-primary btn-block btn-lg" disabled>${t('pos.bookOrderArrow')}</button>`;
    _restoreFocus();
    return;
  }

  const cur = DB.settings().currency;
  $('#cartItems').innerHTML = items.map((it,i) => {
    const origPrice = it.originalPrice != null ? it.originalPrice : it.price;
    const priceChanged = it.price !== origPrice;
    return `
    <div class="cart-item">
      <div class="ci-img">${productImageHTML(it.image, 40)}</div>
      <div class="ci-info">
        <div class="ci-name">${escapeHtml(it.name)}${priceChanged?` <span title="Price edited (was ${fmtMoney(origPrice)})" style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:6px;">✏️ edited</span>`:''}</div>
        <div class="ci-price" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--text-soft);">${cur}</span>
          <input type="number" class="ci-price-input" data-i="${i}" value="${it.price}" min="0" step="1" title="Click to change price" style="width:72px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-weight:700;color:var(--primary);background:var(--surface);text-align:right;"/>
          <span style="font-size:11px;color:var(--text-soft);">× ${it.qty} =</span>
          <b>${fmtMoney(it.price*it.qty)}</b>
          ${priceChanged?`<button class="ci-reset" data-i="${i}" title="Reset to original price (${fmtMoney(origPrice)})" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--text-soft);text-decoration:underline;padding:0 2px;">↺ reset</button>`:''}
        </div>
      </div>
      <div class="qty-ctrl">
        <button data-act="minus" data-i="${i}">−</button>
        <input type="number" min="1" value="${it.qty}" data-i="${i}" />
        <button data-act="plus" data-i="${i}">+</button>
      </div>
      <button class="ci-rm" data-act="remove" data-i="${i}">🗑️</button>
    </div>`;
  }).join('');

  // Inline price editor
  $$('.ci-price-input').forEach(inp => {
    inp.onfocus = () => inp.select();
    const save = () => {
      const i = +inp.dataset.i;
      const newPrice = Math.max(0, parseFloat(inp.value) || 0);
      const it = posState.cart[i];
      if (it.originalPrice == null) it.originalPrice = it.price;
      it.price = newPrice;
      renderCart();
    };
    inp.onblur = save;
    inp.onkeydown = (e) => { if (e.key === 'Enter') { save(); } };
  });
  $$('.ci-reset').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    const it = posState.cart[i];
    if (it.originalPrice != null) { it.price = it.originalPrice; it.originalPrice = null; renderCart(); toast('Price reset','success'); }
  });

  $$('.qty-ctrl button, .ci-rm').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (b.dataset.act === 'plus') posState.cart[i].qty++;
    else if (b.dataset.act === 'minus') posState.cart[i].qty = Math.max(1, posState.cart[i].qty-1);
    else if (b.dataset.act === 'remove') posState.cart.splice(i,1);
    renderCart();
  });
  $$('.qty-ctrl input').forEach(inp => inp.onchange = () => {
    const i = +inp.dataset.i;
    posState.cart[i].qty = Math.max(1, parseInt(inp.value)||1);
    renderCart();
  });

  const tot = calcCartTotals();

  $('#cartSummary').innerHTML = `
    <div class="row"><span>Subtotal</span><span>${fmtMoney(tot.subtotal)}</span></div>

    <div style="background:var(--surface);border:1px dashed var(--border);border-radius:8px;padding:8px;margin:6px 0;">
      <div style="display:flex;gap:6px;margin-bottom:6px;">
        <label style="flex:1;display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;">
          <input type="radio" name="discType" value="fixed" ${posState.discountType==='fixed'?'checked':''}/> Fixed (${DB.settings().currency})
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;">
          <input type="radio" name="discType" value="percent" ${posState.discountType==='percent'?'checked':''}/> Percent (%)
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;color:var(--text-soft);flex:1;">Discount</span>
        <input type="text" id="discValueInput" value="${posState.discountValue}" min="0" step="any"
          inputmode="decimal" autocomplete="off" placeholder="0" title="Poora number aik baar mein likhein, e.g. 50"
          style="width:110px;text-align:right;padding:8px 10px;font-size:15px;font-weight:700;border:1px solid var(--border);border-radius:6px;background:var(--surface);" />
        <span id="discUnit" style="font-size:12px;width:14px;">${posState.discountType==='percent'?'%':''}</span>
      </div>
      <div id="discComputedRow" style="font-size:11px;color:var(--text-soft);text-align:right;margin-top:4px;display:${tot.manualDiscount>0?'block':'none'};">= − <span id="discComputedVal">${fmtMoney(tot.manualDiscount)}</span></div>
      <div id="discQuickRow" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">
        ${(posState.discountType==='percent' ? [5,10,25,50] : [50,100,200,500]).map(v => `<button type="button" class="disc-quick" data-v="${v}" style="font-size:11px;font-weight:700;padding:4px 9px;border:1px solid var(--border);border-radius:20px;background:var(--primary-light);color:var(--primary);cursor:pointer;">${posState.discountType==='percent'? v+'%' : cur+' '+v}</button>`).join('')}
        <button type="button" class="disc-quick" data-v="0" style="font-size:11px;font-weight:700;padding:4px 9px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-soft);cursor:pointer;">🧹 Clear</button>
      </div>
      <div style="font-size:10px;color:var(--text-soft);margin-top:5px;">💡 Poora number aik hi baar mein likhein (e.g. <b>50</b>) — cursor ab nahi hat-ta.</div>
    </div>

    <div class="row" id="loyaltyRow" style="color:var(--success);display:${tot.loyaltyDiscount>0?'flex':'none'};"><span id="loyaltyLabel">⭐ Loyalty (${tot.loyaltyPercent}%)</span><span id="loyaltyVal">− ${fmtMoney(tot.loyaltyDiscount)}</span></div>
    <div class="row" id="taxRow" style="display:${tot.taxPercent>0?'flex':'none'};"><span id="taxLabel">Tax (${tot.taxPercent}%)</span><span id="taxVal">${fmtMoney(tot.tax)}</span></div>

    <div style="background:var(--surface);border:1px dashed var(--border);border-radius:8px;padding:8px;margin:6px 0;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;flex:1;line-height:1.35;">🚚 <b>Pick Up &amp; Delivery Charges</b><br>
          <small style="color:var(--text-soft);">Open field — cashier enters amount. Added AFTER discount.</small></span>
        <input type="number" id="pdChargesInput" value="${tot.pickupDeliveryCharges}" min="0" step="any" placeholder="0"
          style="width:90px;text-align:right;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-weight:700;"/>
      </div>
    </div>
    <div class="row" id="pdSummaryRow" style="display:${tot.pickupDeliveryCharges>0?'flex':'none'};">
      <span>🚚 Pick Up &amp; Delivery Charges <small style="color:var(--text-soft);">(after discount)</small></span>
      <span id="pdSummaryVal">+ ${fmtMoney(tot.pickupDeliveryCharges)}</span>
    </div>

    <div class="row total"><span>Total</span><span class="v" id="cartTotalVal">${fmtMoney(tot.total)}</span></div>
    <button class="btn btn-primary btn-block btn-lg" id="checkoutBtn" style="margin-top:10px;">${t('pos.bookOrderArrow')}</button>
  `;
  /* One shared live updater: recalculates and touches ONLY the summary
     numbers. NO innerHTML replacement, so focus + caret never move. */
  const refreshCartTotals = () => {
    const t2 = calcCartTotals();
    const txt = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    const show = (id, on, mode) => { const el = $('#' + id); if (el) el.style.display = on ? mode : 'none'; };
    txt('discComputedVal', fmtMoney(t2.manualDiscount));
    show('discComputedRow', t2.manualDiscount > 0, 'block');
    txt('loyaltyLabel', '⭐ Loyalty (' + t2.loyaltyPercent + '%)');
    txt('loyaltyVal', '− ' + fmtMoney(t2.loyaltyDiscount));
    show('loyaltyRow', t2.loyaltyDiscount > 0, 'flex');
    txt('taxLabel', 'Tax (' + t2.taxPercent + '%)');
    txt('taxVal', fmtMoney(t2.tax));
    show('taxRow', t2.taxPercent > 0, 'flex');
    txt('pdSummaryVal', '+ ' + fmtMoney(t2.pickupDeliveryCharges));
    show('pdSummaryRow', t2.pickupDeliveryCharges > 0, 'flex');
    txt('cartTotalVal', fmtMoney(t2.total));
  };

  $$('input[name="discType"]').forEach(r => r.onchange = e => {
    posState.discountType = e.target.value;
    renderCart();                 // quick chips + % unit must change; focus guard restores caret
  });

  const discInp = $('#discValueInput');
  if (discInp) {
    discInp.onfocus = () => { if (_restoringFocus) return; try { discInp.select(); } catch (e) {} };
    discInp.oninput = e => {
      /* Keep the RAW text while typing ("5" -> "50"); never rewrite it here. */
      posState.discountValue = Math.max(0, parseFloat(e.target.value) || 0);
      refreshCartTotals();
    };
    discInp.onblur = e => {
      posState.discountValue = Math.max(0, parseFloat(e.target.value) || 0);
      e.target.value = posState.discountValue;   // normalise "050" -> 50
      refreshCartTotals();
    };
    discInp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); discInp.blur(); } };
  }

  /* One-tap quick values — still leaves the caret in the input. */
  $$('.disc-quick').forEach(btn => btn.onclick = () => {
    const v = Math.max(0, parseFloat(btn.dataset.v) || 0);
    posState.discountValue = v;
    if (discInp) {
      discInp.value = v;
      refreshCartTotals();
      try { discInp.focus({ preventScroll: true }); discInp.select(); } catch (e) {}
    }
  });

  const pdInp = $('#pdChargesInput');
  if (pdInp) {
    pdInp.onfocus = () => { if (_restoringFocus) return; try { pdInp.select(); } catch (e) {} };
    pdInp.oninput = e => {
      posState.pickupDeliveryCharges = Math.max(0, parseFloat(e.target.value) || 0);
      refreshCartTotals();
    };
    pdInp.onblur = e => {
      posState.pickupDeliveryCharges = Math.max(0, parseFloat(e.target.value) || 0);
      e.target.value = posState.pickupDeliveryCharges;
      refreshCartTotals();
    };
  }
  $('#checkoutBtn').onclick = openBookingForm;
  _restoreFocus();
}

/* ===== CUSTOMER PICKER ===== */
function openCustomerPicker() {
  const customers = DB.all('customers');
  const html = `
    <h3>Choose Customer</h3>
    <p class="sub">Search by name, phone, or loyalty number.</p>
    <div class="field">
      <input id="custSearch" placeholder="🔍 Search by name, phone, or loyalty card..." style="margin-bottom:10px;" />
    </div>
    <div id="custList" style="max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:8px;"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="closeBtn">Cancel</button>
      <button class="btn btn-primary" id="newCustBtn">+ Add New Customer</button>
    </div>
  `;
  openModal(html, { onOpen(m) {
    const renderList = (q='') => {
      const ql = q.toLowerCase();
      const filtered = customers.filter(c => !q
        || c.name.toLowerCase().includes(ql)
        || (c.phone||'').includes(q)
        || (c.loyaltyNo||'').toLowerCase().includes(ql));
      $('#custList', m).innerHTML = filtered.length ? filtered.map(c => `
        <div class="cust-row" data-id="${c.id}" style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <div style="width:38px;height:38px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary);">${(c.name||'?').charAt(0).toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <b>${escapeHtml(c.name)}</b>
            ${c.loyaltyActive?`<span class="badge paid" style="margin-left:6px;">⭐ ${escapeHtml(c.loyaltyNo)} • ${c.loyaltyDiscountPercent}%</span>`:''}
            <div style="font-size:12px;color:var(--text-soft);">${escapeHtml(c.phone || 'No phone')}</div>
          </div>
        </div>
      `).join('') : `<div class="empty"><div class="emoji">👤</div><p>No customer found</p></div>`;
      $$('.cust-row', m).forEach(r => r.onclick = () => { posState.customerId = r.dataset.id; closeModal(); renderCart(); });
    };
    renderList();
    $('#custSearch', m).oninput = e => renderList(e.target.value);
    $('#closeBtn', m).onclick = closeModal;
    $('#newCustBtn', m).onclick = () => openCustomerForm(null, (newC) => { posState.customerId = newC.id; renderCart(); });
  }});
}

/* ===== BOOKING FORM (Step 1 — order details) ===== */
function openBookingForm() {
  if (!posState.cart.length) return;
  const cust = DB.get('customers', posState.customerId) || { name:'Walk-in Customer', phone:'', address:'' };
  const tot = calcCartTotals();
  const defaultDays = DB.settings().defaultDeliveryDays || 2;
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'short', year:'numeric' });
  const bookingDateIso = isoDay(today);

  const html = `
    <h3>📝 ${t('book.title')}</h3>
    <p class="sub">Fill customer & delivery details, then choose payment.</p>

    <!-- Booking Info -->
    <div style="background:var(--surface-alt);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="font-size:12px;color:var(--text-soft);margin-bottom:4px;">📅 ${t('book.bookingDate')} (auto)</div>
      <div style="font-weight:700;font-size:15px;">${todayStr}</div>
    </div>

    <!-- Customer Form -->
    <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:10px 12px;border-radius:8px;margin-bottom:10px;font-size:12px;color:#1e40af;">
      💡 <b>Tip:</b> Type the customer's phone number — if they exist, all their details fill automatically!
    </div>
    <div class="form-row">
      <div class="field" style="position:relative;">
        <label>Contact Number *</label>
        <input id="bCustPhone" value="${escapeHtml(cust.phone||'')}" placeholder="03XX-XXXXXXX" autocomplete="off"/>
        <div id="custSuggest" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:280px;overflow-y:auto;z-index:1000;margin-top:4px;"></div>
      </div>
      <div class="field" style="position:relative;">
        <label>${t('book.customerName')} * <span id="custFoundBadge" style="display:none;font-size:11px;font-weight:700;color:var(--success);margin-left:6px;">✅ EXISTING CUSTOMER</span></label>
        <input id="bCustName" value="${escapeHtml(cust.name==='Walk-in Customer'?'':cust.name)}" placeholder="Full name" autocomplete="off"/>
        <div id="nameSuggest" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-height:280px;overflow-y:auto;z-index:1000;margin-top:4px;"></div>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field">
        <label>Address (optional)</label>
        <input id="bCustAddr" value="${escapeHtml(cust.address||'')}" placeholder="Home / shop address"/>
      </div>
    </div>

    <!-- Loyalty card -->
    <div class="form-row" style="background:var(--surface-alt);padding:10px;border-radius:8px;margin-bottom:14px;">
      <div class="field" style="margin:0;">
        <label>⭐ Loyalty Card (optional)</label>
        <input id="bLoyaltyNo" value="${escapeHtml(cust.loyaltyNo||'')}" placeholder="Loyalty card number"/>
      </div>
      <div class="field" style="margin:0;">
        <label>Loyalty Discount %</label>
        <input type="number" id="bLoyaltyPct" value="${cust.loyaltyDiscountPercent||0}" min="0" max="100"/>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-soft);margin-bottom:14px;">
      ✨ Tick "Activate Loyalty" to auto-apply this discount to ALL future orders for this customer.
      <label style="display:block;margin-top:6px;"><input type="checkbox" id="bLoyaltyActive" ${cust.loyaltyActive?'checked':''}/> Activate Loyalty</label>
      <button class="btn btn-ghost btn-sm" id="genLoyaltyBtn" style="margin-top:4px;">🎫 Auto-generate Loyalty Number</button>
    </div>

    <!-- Delivery -->
    <div class="form-row">
      <div class="field">
        <label>📅 Delivery in</label>
        <select id="bDeliveryDays">
          <option value="1" ${defaultDays==1?'selected':''}>1 day (tomorrow)</option>
          <option value="2" ${defaultDays==2?'selected':''}>2 days</option>
          <option value="3" ${defaultDays==3?'selected':''}>3 days</option>
          <option value="4" ${defaultDays==4?'selected':''}>4 days</option>
          <option value="5" ${defaultDays==5?'selected':''}>5 days</option>
          <option value="7">1 week</option>
          <option value="custom">Custom date...</option>
        </select>
      </div>
      <div class="field">
        <label>${t('book.deliveryDate')}</label>
        <input type="date" id="bDeliveryDate" value="${isoDay(new Date(Date.now()+defaultDays*86400000))}"/>
      </div>
    </div>

    <!-- Pick Up & Delivery Charges: OPEN field, cashier enters the amount -->
    <div class="form-row cols-1" style="margin-bottom:8px;">
      <div class="field">
        <label>🚚 Pick Up &amp; Delivery Charges <span style="font-weight:normal;color:var(--text-soft);">(optional — cashier enters amount)</span></label>
        <input type="number" id="bPdCharges" value="${tot.pickupDeliveryCharges}" min="0" step="any" placeholder="0"
          style="font-weight:700;" />
        <div style="font-size:11px;color:var(--text-soft);margin-top:5px;line-height:1.4;">
          ℹ️ Yeh charges <b>discount ke baad</b> add honge — in par koi manual / loyalty / % discount nahi lagega.
        </div>
      </div>
    </div>

    <!-- Packaging style -->
    <div class="form-row cols-1" style="margin-bottom:8px;">
      <div class="field">
        <label>📦 Packaging / Delivery Type *</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <label class="pack-opt" style="display:flex;flex-direction:column;align-items:center;padding:14px 6px;border:2px solid var(--border);border-radius:10px;cursor:pointer;background:var(--surface);">
            <input type="radio" name="bDelType" value="hanger" checked style="margin-bottom:6px;"/>
            <span style="font-size:28px;">🧥</span>
            <b style="font-size:13px;margin-top:4px;">${t('book.hanger')}</b>
            <span style="font-size:10px;color:var(--text-soft);">Keep on hangers</span>
          </label>
          <label class="pack-opt" style="display:flex;flex-direction:column;align-items:center;padding:14px 6px;border:2px solid var(--border);border-radius:10px;cursor:pointer;background:var(--surface);">
            <input type="radio" name="bDelType" value="fold" style="margin-bottom:6px;"/>
            <span style="font-size:28px;">📦</span>
            <b style="font-size:13px;margin-top:4px;">${t('book.fold')}</b>
            <span style="font-size:10px;color:var(--text-soft);">Fold & pack</span>
          </label>
          <label class="pack-opt" style="display:flex;flex-direction:column;align-items:center;padding:14px 6px;border:2px solid var(--border);border-radius:10px;cursor:pointer;background:var(--surface);">
            <input type="radio" name="bDelType" value="both" style="margin-bottom:6px;"/>
            <span style="font-size:28px;">🧺</span>
            <b style="font-size:13px;margin-top:4px;">${t('book.both')}</b>
            <span style="font-size:10px;color:var(--text-soft);">Choose per item</span>
          </label>
        </div>
      </div>
    </div>

    <div class="form-row cols-1">
      <div class="field">
        <label>Notes (optional)</label>
        <input id="bNotes" placeholder="e.g. Use no starch, urgent"/>
      </div>
    </div>

    <!-- Total summary -->
    <div style="background:var(--primary-light);padding:14px;border-radius:10px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>${fmtMoney(tot.subtotal)}</span></div>
      ${tot.manualDiscount>0?`<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--danger);"><span>Manual Discount</span><span>− ${fmtMoney(tot.manualDiscount)}</span></div>`:''}
      ${tot.loyaltyDiscount>0?`<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--success);"><span>⭐ Loyalty Discount</span><span>− ${fmtMoney(tot.loyaltyDiscount)}</span></div>`:''}
      ${tot.tax>0?`<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Tax</span><span>${fmtMoney(tot.tax)}</span></div>`:''}
      <div id="bPdLine" style="display:${tot.pickupDeliveryCharges>0?'flex':'none'};justify-content:space-between;font-size:13px;font-weight:700;">
        <span>🚚 Pick Up &amp; Delivery Charges <small style="font-weight:normal;color:var(--text-soft);">(after discount)</small></span>
        <span id="bPdVal">+ ${fmtMoney(tot.pickupDeliveryCharges)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:var(--primary);margin-top:6px;border-top:1px dashed rgba(0,0,0,.1);padding-top:6px;"><span>TOTAL</span><span id="bTotalVal">${fmtMoney(tot.total)}</span></div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="nextBtn">Next → Payment 💳</button>
    </div>
  `;
  openModal(html, { large: true, onOpen(m) {
    // ===== CUSTOMER AUTO-SUGGEST =====
    const phoneInp = $('#bCustPhone', m);
    const nameInp  = $('#bCustName', m);
    const addrInp  = $('#bCustAddr', m);
    const loyNoInp = $('#bLoyaltyNo', m);
    const loyPctInp = $('#bLoyaltyPct', m);
    const loyActInp = $('#bLoyaltyActive', m);
    const phoneSug = $('#custSuggest', m);
    const nameSug  = $('#nameSuggest', m);
    const foundBadge = $('#custFoundBadge', m);

    const fillCustomer = (c) => {
      nameInp.value  = c.name || '';
      phoneInp.value = c.phone || '';
      if (addrInp)  addrInp.value  = c.address || '';
      if (loyNoInp) loyNoInp.value = c.loyaltyNo || '';
      if (loyPctInp) loyPctInp.value = c.loyaltyDiscountPercent || 0;
      if (loyActInp) loyActInp.checked = !!c.loyaltyActive;
      foundBadge.style.display = 'inline-block';
      foundBadge.textContent = '✅ EXISTING CUSTOMER';
      foundBadge.style.color = 'var(--success)';
      phoneSug.style.display = 'none';
      nameSug.style.display = 'none';
      toast(`Customer found: ${c.name}`, 'success');
      // Highlight all filled fields briefly
      [phoneInp, nameInp, addrInp].forEach(el => {
        if (!el) return;
        el.style.transition = 'background 0.3s';
        el.style.background = '#d1fae5';
        setTimeout(() => { el.style.background = ''; }, 1200);
      });
    };

    const renderSuggestions = (container, matches, query) => {
      if (!matches.length) { container.style.display = 'none'; return; }
      const highlight = (text, q) => {
        if (!q) return escapeHtml(text);
        const i = String(text).toLowerCase().indexOf(q.toLowerCase());
        if (i < 0) return escapeHtml(text);
        return escapeHtml(text.substring(0,i)) + '<b style="background:#fde68a;">' + escapeHtml(text.substring(i, i+q.length)) + '</b>' + escapeHtml(text.substring(i+q.length));
      };
      container.innerHTML = matches.slice(0, 8).map(c => {
        const orderCount = DB.all('orders').filter(o => o.customerId === c.id).length;
        return `<div class="cust-sg" data-id="${c.id}" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary);">${(c.name||'?').charAt(0).toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;">${highlight(c.name||'-', query)}</div>
            <div style="font-size:11px;color:var(--text-soft);">${highlight(c.phone||'no phone', query)}${c.loyaltyActive?` • ⭐ ${escapeHtml(c.loyaltyNo)}`:''}${orderCount?` • ${orderCount} orders`:' • new'}</div>
          </div>
          ${c.loyaltyActive?`<span class="badge paid" style="font-size:10px;">${c.loyaltyDiscountPercent}%</span>`:''}
        </div>`;
      }).join('');
      container.style.display = 'block';
      container.querySelectorAll('.cust-sg').forEach(row => {
        row.addEventListener('mouseenter', () => row.style.background = 'var(--surface-alt)');
        row.addEventListener('mouseleave', () => row.style.background = 'transparent');
        row.onclick = () => {
          const c = DB.get('customers', row.dataset.id);
          if (c) {
            posState.customerId = c.id;
            fillCustomer(c);
          }
        };
      });
    };

    const searchByPhone = (q) => {
      if (!q || q.length < 2) { phoneSug.style.display = 'none'; foundBadge.style.display='none'; return; }
      const cleanQ = q.replace(/[^\d]/g, '');
      const customers = DB.all('customers').filter(c => c.id !== 'cu1');
      const matches = customers.filter(c => {
        const cleanPhone = (c.phone || '').replace(/[^\d]/g, '');
        return cleanPhone.includes(cleanQ) && cleanQ.length >= 2;
      });
      // Check for exact phone match
      const exact = matches.find(c => (c.phone||'').replace(/[^\d]/g,'') === cleanQ);
      if (exact && cleanQ.length >= 7) {
        // Auto-fill if exact phone match (or close to complete number)
        posState.customerId = exact.id;
        fillCustomer(exact);
        return;
      }
      renderSuggestions(phoneSug, matches, q);
    };

    const searchByName = (q) => {
      if (!q || q.length < 2) { nameSug.style.display = 'none'; return; }
      const ql = q.toLowerCase();
      const customers = DB.all('customers').filter(c => c.id !== 'cu1');
      const matches = customers.filter(c => (c.name||'').toLowerCase().includes(ql));
      renderSuggestions(nameSug, matches, q);
    };

    phoneInp.addEventListener('input', (e) => {
      foundBadge.style.display = 'none';
      searchByPhone(e.target.value);
    });
    phoneInp.addEventListener('focus', (e) => {
      if (e.target.value.length >= 2) searchByPhone(e.target.value);
    });
    nameInp.addEventListener('input', (e) => {
      foundBadge.style.display = 'none';
      searchByName(e.target.value);
    });
    nameInp.addEventListener('focus', (e) => {
      if (e.target.value.length >= 2) searchByName(e.target.value);
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!phoneInp.contains(e.target) && !phoneSug.contains(e.target)) phoneSug.style.display = 'none';
      if (!nameInp.contains(e.target) && !nameSug.contains(e.target)) nameSug.style.display = 'none';
    }, { once: true });

    // Pre-show badge if pre-selected customer is real
    if (cust && cust.id !== 'cu1' && cust.name && cust.name !== 'Walk-in Customer') {
      foundBadge.style.display = 'inline-block';
    }

    // ===== END CUSTOMER AUTO-SUGGEST =====

    // bind days → date
    const setDate = (days) => {
      $('#bDeliveryDate', m).value = isoDay(new Date(Date.now()+days*86400000));
    };
    $('#bDeliveryDays', m).onchange = (e) => {
      if (e.target.value !== 'custom') setDate(+e.target.value);
    };
    $('#genLoyaltyBtn', m).onclick = () => {
      $('#bLoyaltyNo', m).value = DB.nextLoyaltyNumber();
      if (+$('#bLoyaltyPct', m).value === 0) $('#bLoyaltyPct', m).value = DB.settings().defaultLoyaltyDiscountPercent || 10;
      $('#bLoyaltyActive', m).checked = true;
      toast('Loyalty number generated','success');
    };
    /* Charges are live: discount stays untouched, only the final total moves. */
    const refreshBookingPd = () => {
      const t2 = calcCartTotals();
      const line = $('#bPdLine', m);
      if (line) line.style.display = t2.pickupDeliveryCharges > 0 ? 'flex' : 'none';
      const pv = $('#bPdVal', m); if (pv) pv.textContent = '+ ' + fmtMoney(t2.pickupDeliveryCharges);
      const tv = $('#bTotalVal', m); if (tv) tv.textContent = fmtMoney(t2.total);
    };
    const bPd = $('#bPdCharges', m);
    if (bPd) {
      bPd.onfocus = () => bPd.select();
      bPd.oninput = e => { posState.pickupDeliveryCharges = Math.max(0, parseFloat(e.target.value)||0); refreshBookingPd(); };
      bPd.onblur  = () => { bPd.value = posState.pickupDeliveryCharges; refreshBookingPd(); };
    }

    $('#cancelBtn', m).onclick = closeModal;
    $('#nextBtn', m).onclick = () => {
      const name = $('#bCustName', m).value.trim();
      const phone = $('#bCustPhone', m).value.trim();
      if (!name) { toast('Customer name required','error'); return; }
      if (!phone) { toast('Contact number required','error'); return; }

      // Save / update customer
      let customer = DB.all('customers').find(c => c.phone === phone && c.id !== 'cu1');
      const custData = {
        name, phone,
        address: $('#bCustAddr', m).value.trim(),
        loyaltyNo: $('#bLoyaltyNo', m).value.trim(),
        loyaltyDiscountPercent: Math.max(0, +$('#bLoyaltyPct', m).value || 0),
        loyaltyActive: $('#bLoyaltyActive', m).checked
      };
      if (customer) customer = DB.update('customers', customer.id, custData);
      else customer = DB.insert('customers', custData);
      posState.customerId = customer.id;

      /* Final read so autofill / paste without an input event is not missed. */
      const bPdFinal = $('#bPdCharges', m);
      if (bPdFinal) posState.pickupDeliveryCharges = Math.max(0, parseFloat(bPdFinal.value) || 0);

      const deliveryTypeEl = m.querySelector('input[name="bDelType"]:checked');
      const orderMeta = {
        pickupDeliveryCharges: posState.pickupDeliveryCharges,
        deliveryDate: $('#bDeliveryDate', m).value,
        deliveryType: deliveryTypeEl ? deliveryTypeEl.value : 'hanger',
        notes: $('#bNotes', m).value.trim(),
        bookingDate: bookingDateIso
      };
      closeModal();
      openPaymentDialog(orderMeta);
    };
  }});
}

/* ===== PAYMENT (Step 2) ===== */
function openPaymentDialog(orderMeta) {
  const tot = calcCartTotals();
  const cust = DB.get('customers', posState.customerId);

  const html = `
    <h3>💳 Payment</h3>
    <p class="sub">Customer: <b>${escapeHtml(cust.name)}</b> • ${escapeHtml(cust.phone||'')}</p>

    <!-- Payment type tabs -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;">
      <button class="pay-tab active" data-type="paid">💵 Pay Now (Full)</button>
      <button class="pay-tab" data-type="advance">🟢 Advance Payment</button>
      <button class="pay-tab" data-type="partial">🟡 Partial Payment</button>
      <button class="pay-tab" data-type="credit">📋 Credit (Pay on Delivery)</button>
    </div>

    <div id="advanceHelper" style="display:none;background:#dcfce7;border-left:4px solid var(--success);padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:13px;">
      🟢 <b>Advance Payment:</b> Customer is paying a partial amount upfront, remaining will be collected on delivery. Set the advance amount below.
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-secondary btn-sm" data-adv="100">Rs. 100</button>
        <button class="btn btn-secondary btn-sm" data-adv="200">Rs. 200</button>
        <button class="btn btn-secondary btn-sm" data-adv="500">Rs. 500</button>
        <button class="btn btn-secondary btn-sm" data-adv="1000">Rs. 1000</button>
        <button class="btn btn-secondary btn-sm" data-adv="half">50% (${fmtMoney(Math.round(tot.total/2))})</button>
      </div>
    </div>

    <div class="form-row">
      <div class="field">
        <label>Payment Method</label>
        <select id="payMethod">
          <option value="cash">💵 Cash</option>
          <option value="card">💳 Card</option>
          <option value="bank">🏦 Bank Transfer</option>
          <option value="online">📱 JazzCash/Easypaisa</option>
          <option value="credit">📋 Credit (Pay on Delivery)</option>
        </select>
      </div>
      <div class="field">
        <label>Initial Order Status</label>
        <select id="payStatus">
          <option value="pending" selected>⏳ Pending</option>
          <option value="washing">🌀 Washing</option>
          <option value="press">👔 Press</option>
          <option value="ready">✅ Ready</option>
          <option value="delivered">📦 Delivered</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="field">
        <label>Total Amount</label>
        <input type="text" value="${fmtMoney(tot.total)}" readonly style="font-weight:700;font-size:16px;background:var(--primary-light);"/>
      </div>
      <div class="field">
        <label id="paidLbl">Amount Received Now</label>
        <input type="number" id="paidInput" value="${tot.total}" min="0"/>
      </div>
    </div>
    <div id="payBreakdown" style="background:var(--surface-alt);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.6;">
      <b>🧾 Bill breakdown</b><br>
      Subtotal ${fmtMoney(tot.subtotal)}
      ${tot.totalDiscount>0?` • Discount − ${fmtMoney(tot.totalDiscount)}`:''}
      ${tot.tax>0?` • Tax + ${fmtMoney(tot.tax)}`:''}
      ${tot.pickupDeliveryCharges>0?`<br><span style="color:var(--primary);font-weight:800;">🚚 Pick Up &amp; Delivery Charges (AFTER discount): + ${fmtMoney(tot.pickupDeliveryCharges)}</span>`:'<br><span style="color:var(--text-soft);">🚚 Pick Up &amp; Delivery Charges: ${fmtMoney(0)} (after discount)</span>'}
      <br><b>Total: ${fmtMoney(tot.total)}</b>
    </div>

    <div class="form-row cols-1" style="${DB.currentUser().role === 'admin' ? '' : 'display:none;'}">
      <div class="field">
        <label>🔙 Backdate Order <span style="font-weight:normal;color:#64748b;">(Optional - Leaves current date/time if empty)</span></label>
        <input type="datetime-local" id="backdateInput" />
      </div>
    </div>

    <div id="dueLine" style="padding:12px;background:var(--surface-alt);border-radius:8px;margin-bottom:10px;font-weight:600;text-align:center;font-size:15px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" id="backBtn">← Back</button>
      <button class="btn btn-success" id="confirmBtn">✅ Save & Print Invoice</button>
    </div>
  `;
  openModal(html, { large: true, onOpen(m) {
    let currentType = 'paid';
    const tabs = $$('.pay-tab', m);
    tabs.forEach(tb => tb.onclick = () => {
      tabs.forEach(x => x.classList.remove('active'));
      tb.classList.add('active');
      currentType = tb.dataset.type;
      $('#advanceHelper', m).style.display = currentType === 'advance' ? 'block' : 'none';
      if (currentType === 'paid')    { $('#paidInput', m).value = tot.total; $('#payMethod', m).value = 'cash'; $('#paidLbl', m).textContent = 'Amount Received'; }
      if (currentType === 'advance') { $('#paidInput', m).value = Math.min(tot.total, 200); $('#payMethod', m).value = 'cash'; $('#paidLbl', m).textContent = '🟢 Advance Amount'; }
      if (currentType === 'partial') { $('#paidInput', m).value = Math.round(tot.total/2); $('#payMethod', m).value = 'cash'; $('#paidLbl', m).textContent = '🟡 Partial Amount'; }
      if (currentType === 'credit')  { $('#paidInput', m).value = 0; $('#payMethod', m).value = 'credit'; $('#paidLbl', m).textContent = 'Amount Received (0 = Credit)'; }
      updateDue();
    });

    // Advance quick buttons
    $$('[data-adv]', m).forEach(b => b.onclick = () => {
      const v = b.dataset.adv;
      if (v === 'half') $('#paidInput', m).value = Math.round(tot.total/2);
      else $('#paidInput', m).value = Math.min(tot.total, +v);
      updateDue();
    });

    const updateDue = () => {
      const paid = Math.max(0, +$('#paidInput', m).value || 0);
      const due = tot.total - paid;
      let html;
      if (paid <= 0)                          html = `<span style="color:var(--warning);">📋 Credit Sale — Customer will pay ${fmtMoney(tot.total)} on delivery</span>`;
      else if (currentType === 'advance' && due > 0) html = `🟢 Advance Received: <b style="color:var(--success);">${fmtMoney(paid)}</b> • Balance on delivery: <b style="color:var(--danger);">${fmtMoney(due)}</b>`;
      else if (due > 0)                       html = `Due Amount: <span style="color:var(--danger);">${fmtMoney(due)}</span>`;
      else if (due < 0)                       html = `Change to Return: <span style="color:var(--success);">${fmtMoney(Math.abs(due))}</span>`;
      else                                    html = `✅ Fully Paid`;
      $('#dueLine', m).innerHTML = html;
    };
    updateDue();
    $('#paidInput', m).oninput = updateDue;

    $('#backBtn', m).onclick = () => { closeModal(); openBookingForm(); };

    $('#confirmBtn', m).onclick = () => {
      const paid = Math.max(0, +$('#paidInput', m).value || 0);
      const actualPaid = Math.min(tot.total, paid);
      const due = Math.max(0, tot.total - actualPaid);
      // Determine paymentType label
      let paymentType = 'paid';
      if (actualPaid === 0) paymentType = 'credit';
      else if (actualPaid < tot.total) paymentType = (currentType === 'advance') ? 'advance' : 'partial';

      const order = {
        invoiceNo: DB.nextInvoiceNumber(),
        items: posState.cart.map(i => ({ ...i, lineTotal: i.price * i.qty })),
        customerId: posState.customerId,
        subtotal: tot.subtotal,
        discount: tot.totalDiscount,
        manualDiscount: tot.manualDiscount,
        loyaltyDiscount: tot.loyaltyDiscount,
        loyaltyPercent: tot.loyaltyPercent,
        discountType: posState.discountType,
        discountValue: posState.discountValue,
        tax: tot.tax,
        pickupDeliveryCharges: tot.pickupDeliveryCharges,
        totalBeforeCharges: tot.totalBeforeCharges,
        total: tot.total,
        paid: actualPaid,
        createdAt: $('#backdateInput', m).value ? new Date($('#backdateInput', m).value).toISOString() : new Date().toISOString(),
        due,
        advance: paymentType === 'advance' ? actualPaid : 0,
        paymentType,
        isCredit: actualPaid === 0,
        status: $('#payStatus', m).value,
        paymentMethod: $('#payMethod', m).value,
        deliveryDate: orderMeta.deliveryDate,
        deliveryType: orderMeta.deliveryType,
        bookingDate: orderMeta.bookingDate,
        notes: orderMeta.notes,
        cashierId: DB.currentUser().id,
        cashierUsername: DB.currentUser().username,
        cashierName: DB.currentUser().name,
        branchId: (typeof getActiveBranchId === 'function') ? getActiveBranchId() : 'main'
      };
      const saved = DB.insert('orders', order);
      // Auto-deduct hangers & shoppers from inventory
      if (typeof autoDeductInventory === 'function') {
        try {
          const alerts = autoDeductInventory(saved);
          if (typeof showLowStockAlert === 'function' && alerts.length) showLowStockAlert(alerts);
        } catch(e) { console.warn('Inventory auto-deduct failed:', e); }
      }
      posState.cart = []; posState.discountValue = 0; posState.pickupDeliveryCharges = 0; posState.customerId = 'cu1';
      closeModal();
      toast('Order booked successfully!', 'success');
      openInvoice(saved.id);
    };
  }});
}

/* ===== QUICK ADD ===== */
function openQuickAdd() {
  const html = `
    <h3>Quick Add Custom Item</h3>
    <p class="sub">Add an unlisted item directly to this sale.</p>
    <div class="form-row">
      <div class="field"><label>Item Name</label><input id="qName" placeholder="e.g. Special Cleaning"/></div>
      <div class="field"><label>Price</label><input type="number" id="qPrice" placeholder="0"/></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="addBtn">Add to Cart</button>
    </div>
  `;
  openModal(html, { onOpen(m) {
    $('#cancelBtn', m).onclick = closeModal;
    $('#addBtn', m).onclick = () => {
      const name = $('#qName', m).value.trim();
      const price = +$('#qPrice', m).value;
      if (!name || price <= 0) { toast('Enter name & price','error'); return; }
      posState.cart.push({ productId: 'custom_'+Date.now(), name, image:'🧺', price, qty:1 });
      closeModal(); renderCart();
    };
  }});
}
