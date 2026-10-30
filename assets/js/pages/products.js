/* ===================== PRODUCTS & CATEGORIES ===================== */
let prodFilter = { search:'', category:'all' };

function renderProducts() {
  const content = `
    <h1 class="page-title">🧺 Products & Rate List</h1>
    <p class="page-sub">Add, edit, or quickly update prices for all your laundry services.</p>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start;">
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-header" style="padding:16px 20px;">
          <h3>Rate List</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input id="prodSearch" placeholder="🔍 Search..." style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;" value="${escapeHtml(prodFilter.search)}"/>
            <select id="prodCat" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;">
              <option value="all">All Categories</option>
              ${DB.all('categories').map(c => `<option value="${c.id}" ${prodFilter.category===c.id?'selected':''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" id="addProdBtn">+ Add Product</button>
            <button class="btn btn-success btn-sm" id="bulkImgBtn" title="Upload images for many products quickly">📷 Bulk Image Manager</button>
            ${DB.currentUser().role==='admin' ? `<button class="btn btn-warning btn-sm" id="importRateBtn" title="Replace all products with Laundry POS official rate list">📋 Import Rate List</button>`:''}
          </div>
        </div>
        <div style="padding:8px 16px;font-size:12px;color:var(--text-soft);border-bottom:1px solid var(--border);background:var(--surface-alt);">
          💡 Tip: Click any price below to edit it instantly. Press Enter to save.
        </div>
        <table class="tbl">
          <thead><tr><th></th><th>Name</th><th>Category</th><th style="width:140px;">Price</th><th style="width:140px;">Max (range)</th><th>Status</th><th style="width:160px;">Actions</th></tr></thead>
          <tbody id="prodBody"></tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header"><h3>Categories</h3><button class="btn btn-primary btn-sm" id="addCatBtn">+ Add</button></div>
        <div id="catList"></div>
      </div>
    </div>
  `;
  $('#app').innerHTML = renderLayout('products', content);
  bindLayout();
  $('#addProdBtn').onclick = () => openProductForm();
  $('#bulkImgBtn').onclick = () => openBulkImageManager();
  $('#addCatBtn').onclick = () => openCategoryForm();
  $('#prodSearch').oninput = e => { prodFilter.search = e.target.value; renderProductsBody(); };
  $('#prodCat').onchange = e => { prodFilter.category = e.target.value; renderProductsBody(); };
  const importBtn = $('#importRateBtn');
  if (importBtn) importBtn.onclick = importRateList;
  renderProductsBody();
  renderCategoriesList();
}

function importRateList() {
  confirmDialog('⚠️ This will REPLACE all products with the official Laundry POS rate list (Gents, Ladies, Others). Your customers, orders, and expenses will NOT be affected. Continue?', () => {
    DB._data.products = getMrLaundryRateList();
    DB._data.categories = [
      { id: 'cgents',  name: 'Gents Wear',  icon: '👔' },
      { id: 'cladies', name: 'Ladies Wear', icon: '🥻' },
      { id: 'cothers', name: 'Others',      icon: '🧺' },
      { id: 'cpress',  name: 'Press / Ironing', icon: '♨️' }
    ];
    DB.save();
    toast('Rate list imported! '+DB.all('products').length+' items loaded.','success');
    renderProductsBody();
    renderCategoriesList();
  });
}

function renderProductsBody() {
  const q = (prodFilter.search || '').toLowerCase();
  const cats = Object.fromEntries(DB.all('categories').map(c => [c.id, c]));
  let products = DB.all('products');
  if (prodFilter.category !== 'all') products = products.filter(p => p.category === prodFilter.category);
  if (q) products = products.filter(p => p.name.toLowerCase().includes(q));

  if (!products.length) {
    $('#prodBody').innerHTML = `<tr><td colspan="7"><div class="empty"><div class="emoji">🧺</div><h4>No products</h4></div></td></tr>`;
    return;
  }
  $('#prodBody').innerHTML = products.map(p => {
    const cat = cats[p.category] || { name:'-', icon:'' };
    return `<tr data-id="${p.id}">
      <td style="width:60px;text-align:center;padding:6px;"><div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#e0e7ff,#fff);display:flex;align-items:center;justify-content:center;margin:0 auto;overflow:hidden;">${productImageHTML(p.image, 48)}</div></td>
      <td><b>${escapeHtml(p.name)}</b></td>
      <td>${cat.icon} ${escapeHtml(cat.name)}</td>
      <td><input class="rate-edit" data-fld="price" type="number" value="${p.price}" min="0" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-weight:700;color:var(--primary);background:var(--surface);"/></td>
      <td><input class="rate-edit" data-fld="priceMax" type="number" value="${p.priceMax||''}" min="0" placeholder="—" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);"/></td>
      <td>${p.active===false ? '<span class="badge cancelled">Hidden</span>' : '<span class="badge paid">Active</span>'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${p.id}">✏️</button>
        <button class="btn btn-secondary btn-sm" data-act="toggle" data-id="${p.id}">${p.active===false?'👁️':'🙈'}</button>
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}">🗑️</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  // Inline edit
  $$('.rate-edit').forEach(inp => {
    const save = () => {
      const tr = inp.closest('tr');
      const id = tr.dataset.id;
      const fld = inp.dataset.fld;
      let val = inp.value === '' ? null : Math.max(0, parseFloat(inp.value) || 0);
      const patch = {};
      patch[fld] = val;
      DB.update('products', id, patch);
      inp.style.boxShadow = '0 0 0 3px rgba(34,197,94,.3)';
      setTimeout(()=>inp.style.boxShadow='', 600);
    };
    inp.onblur = save;
    inp.onkeydown = (e) => { if (e.key === 'Enter') { save(); inp.blur(); toast('Price saved','success'); } };
  });

  $$('[data-act]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (b.dataset.act === 'edit') openProductForm(DB.get('products', id));
    else if (b.dataset.act === 'toggle') { const p = DB.get('products', id); DB.update('products', id, { active: p.active===false }); renderProductsBody(); }
    else if (b.dataset.act === 'del') confirmDialog('Delete this product?', () => { if (typeof logAction === 'function') logAction('product.delete', id);
      DB.remove('products', id); toast('Deleted','success'); renderProductsBody(); });
  });
}

function renderCategoriesList() {
  const cats = DB.all('categories');
  $('#catList').innerHTML = cats.length ? cats.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid var(--border);">
      <div><span style="font-size:18px;">${c.icon}</span> <b>${escapeHtml(c.name)}</b></div>
      <div>
        <button class="btn btn-ghost btn-sm" data-act="cedit" data-id="${c.id}">✏️</button>
        ${DB.currentUser().role==='admin' ? `<button class="btn btn-ghost btn-sm" data-act="cdel" data-id="${c.id}">🗑️</button>` : ''}
      </div>
    </div>
  `).join('') : `<div class="empty"><p>No categories</p></div>`;
  $$('[data-act="cedit"]').forEach(b => b.onclick = () => openCategoryForm(DB.get('categories', b.dataset.id)));
  $$('[data-act="cdel"]').forEach(b => b.onclick = () => confirmDialog('Delete this category? Products in it will remain.', () => { DB.remove('categories', b.dataset.id); renderCategoriesList(); }));
}

function openProductForm(existing) {
  const p = existing || { name:'', category:'', price:0, priceMax:null, image:'🧺', active:true };
  const cats = DB.all('categories');
  const html = `
    <h3>${existing?'Edit':'Add'} Product</h3>
    <div class="form-row">
      <div class="field"><label>Name *</label><input id="pName" value="${escapeHtml(p.name)}"/></div>
      <div class="field" style="grid-column:span 2;">
        <label>📸 Product Image</label>
        <div style="display:flex;gap:14px;align-items:flex-start;">
          <div id="pImgPreview" style="width:100px;height:100px;border-radius:12px;background:linear-gradient(135deg,#e0e7ff,#fff);border:2px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
            ${productImageHTML(p.image, 100)}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn btn-primary btn-sm" id="pImgUploadBtn">📤 Upload Photo</button>
              <button type="button" class="btn btn-secondary btn-sm" id="pImgEmojiBtn">😀 Use Emoji</button>
              <button type="button" class="btn btn-ghost btn-sm" id="pImgClearBtn" title="Remove image">🗑️</button>
            </div>
            <input type="file" id="pImgFile" accept="image/*" style="display:none;"/>
            <input type="text" id="pImg" value="${escapeHtml(p.image||'🧺')}" placeholder="Emoji or image data" style="font-size:13px;font-family:monospace;"/>
            <small style="color:var(--text-soft);">Upload a small product photo (auto-resized to 200x200). Or use an emoji.</small>
          </div>
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>Price (Rs.) *</label><input type="number" id="pPrice" value="${p.price}"/></div>
      <div class="field"><label>Max Price (for ranges, optional)</label><input type="number" id="pPriceMax" value="${p.priceMax||''}" placeholder="e.g. 1000 for 800-1000"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field">
        <label>Category</label>
        <select id="pCat">${cats.map(c => `<option value="${c.id}" ${p.category===c.id?'selected':''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-ghost" id="cancelBtn">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `;
  openModal(html, { large: true, onOpen(m){
    // Image controls
    const fileInput = $('#pImgFile', m);
    const imgInput = $('#pImg', m);
    const preview = $('#pImgPreview', m);
    const refreshPreview = () => { preview.innerHTML = productImageHTML(imgInput.value || '🧺', 100); };
    $('#pImgUploadBtn', m).onclick = () => fileInput.click();
    $('#pImgEmojiBtn', m).onclick = () => openEmojiPicker((emoji) => { imgInput.value = emoji; refreshPreview(); });
    $('#pImgClearBtn', m).onclick = () => { imgInput.value = '🧺'; refreshPreview(); };
    imgInput.oninput = refreshPreview;
    fileInput.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)','error'); return; }
      try {
        const dataUrl = await resizeImageToDataURL(f, 200, 200, 0.85);
        imgInput.value = dataUrl;
        refreshPreview();
        toast('✅ Image uploaded — click Save','success');
      } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
    };

    $('#cancelBtn', m).onclick = closeModal;
    $('#saveBtn', m).onclick = () => {
      const name = $('#pName', m).value.trim();
      const price = +$('#pPrice', m).value;
      if (!name || price < 0) { toast('Enter name & price','error'); return; }
      const maxV = $('#pPriceMax', m).value;
      const data = {
        name, price,
        priceMax: maxV === '' ? null : Math.max(0, +maxV || 0),
        category: $('#pCat', m).value,
        image: $('#pImg', m).value || '🧺',
        active: true
      };
      if (existing) DB.update('products', existing.id, data);
      else DB.insert('products', data);
      closeModal(); toast('Saved','success'); renderProductsBody();
    };
  }});
}

function openCategoryForm(existing) {
  const c = existing || { name:'', icon:'🧺', image:'' };
  openModal(`
    <h3>${existing?'Edit':'Add'} Category</h3>
    <div class="form-row">
      <div class="field"><label>Name *</label><input id="cName" value="${escapeHtml(c.name)}"/></div>
      <div class="field"><label>Emoji (fallback)</label><input id="cIcon" value="${escapeHtml(c.icon||'')}" maxlength="4" style="font-size:20px;text-align:center;"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field">
        <label>📸 Category Image (optional)</label>
        <div style="display:flex;gap:14px;align-items:flex-start;">
          <div id="cImgPreview" style="width:90px;height:90px;border-radius:14px;background:linear-gradient(135deg,#e0e7ff,#fff);border:2px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
            ${productImageHTML(c.image || c.icon, 90)}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="cImgUploadBtn">📤 Upload</button>
              <button type="button" class="btn btn-ghost btn-sm" id="cImgClearBtn">🗑️ Use Emoji</button>
            </div>
            <input type="file" id="cImgFile" accept="image/*" style="display:none;"/>
            <input type="hidden" id="cImg" value="${escapeHtml(c.image||'')}"/>
            <small style="color:var(--text-soft);">Upload a small icon photo. Shows in category chips.</small>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBtn">Save</button>
    </div>
  `, { onOpen(m){
    const fileInput = $('#cImgFile', m);
    const imgInput = $('#cImg', m);
    const preview = $('#cImgPreview', m);
    const refresh = () => { preview.innerHTML = productImageHTML(imgInput.value || $('#cIcon', m).value || '🧺', 90); };
    $('#cImgUploadBtn', m).onclick = () => fileInput.click();
    $('#cImgClearBtn', m).onclick = () => { imgInput.value = ''; refresh(); };
    $('#cIcon', m).oninput = refresh;
    fileInput.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)','error'); return; }
      try {
        const dataUrl = await resizeImageToDataURL(f, 200, 200, 0.85);
        imgInput.value = dataUrl; refresh();
        toast('✅ Category image uploaded','success');
      } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
    };
    $('#saveBtn', m).onclick = () => {
      const name = $('#cName', m).value.trim();
      if (!name) { toast('Name required','error'); return; }
      const data = {
        name,
        icon: $('#cIcon', m).value || '🏷️',
        image: $('#cImg', m).value || ''
      };
      if (existing) DB.update('categories', existing.id, data); else DB.insert('categories', data);
      closeModal(); renderCategoriesList();
      // Refresh POS if open
      if (typeof renderPosCats === 'function' && document.getElementById('posCats')) renderPosCats();
    };
  }});
}

/* ===================== BULK IMAGE MANAGER =====================
   Grid of all products. Click any product → instant image upload.
   Super fast for setting up all 125 items.
*/
function openBulkImageManager() {
  const cats = DB.all('categories');
  let activeCat = 'all';
  let searchQ = '';

  const buildHtml = () => `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">
      <input id="bimSearch" placeholder="🔍 Search products..." value="${escapeHtml(searchQ)}" style="flex:1;min-width:200px;padding:10px;border:1px solid var(--border);border-radius:8px;"/>
      <select id="bimCat" style="padding:10px;border:1px solid var(--border);border-radius:8px;">
        <option value="all" ${activeCat==='all'?'selected':''}>All Categories</option>
        ${cats.map(c => `<option value="${c.id}" ${activeCat===c.id?'selected':''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <div id="bimStats" style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:10px;border-radius:8px;font-size:13px;margin-bottom:14px;"></div>
    <div id="bimGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;max-height:500px;overflow-y:auto;padding:4px;"></div>
    <input type="file" id="bimFile" accept="image/*" style="display:none;"/>
  `;

  openModal(`
    <h3>📷 Bulk Image Manager — Set product images quickly</h3>
    <p class="sub">Click any product to upload an image. Auto-resized & saved.</p>
    ${buildHtml()}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, { large: true, onOpen(m) {
    let pendingProductId = null;

    const renderGrid = () => {
      const all = DB.all('products');
      const filtered = all.filter(p => {
        if (activeCat !== 'all' && p.category !== activeCat) return false;
        if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
        return true;
      });
      const withImg = all.filter(p => p.image && (p.image.startsWith('data:') || p.image.startsWith('http'))).length;
      $('#bimStats', m).innerHTML = `📊 <b>${withImg}</b> of <b>${all.length}</b> products have real images (${Math.round(withImg/all.length*100)}%). Click any tile to upload!`;
      $('#bimGrid', m).innerHTML = filtered.map(p => {
        const hasImg = p.image && (p.image.startsWith('data:') || p.image.startsWith('http'));
        return `<div class="bim-tile" data-id="${p.id}" style="background:#fff;border:2px solid ${hasImg?'#10b981':'#e5e9f2'};border-radius:12px;padding:10px;text-align:center;cursor:pointer;transition:.15s;position:relative;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
          ${hasImg ? '<div style="position:absolute;top:4px;right:4px;background:#10b981;color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;">✓</div>' : ''}
          <div style="width:80px;height:80px;margin:0 auto 6px;border-radius:10px;background:linear-gradient(135deg,#e0e7ff,#fff);display:flex;align-items:center;justify-content:center;overflow:hidden;">${productImageHTML(p.image, 80)}</div>
          <div style="font-weight:700;font-size:12px;line-height:1.2;height:30px;overflow:hidden;">${escapeHtml(p.name)}</div>
          <div style="font-size:11px;color:#4f7cff;font-weight:700;">Rs. ${p.price}</div>
        </div>`;
      }).join('') || '<div class="empty" style="grid-column:1/-1;padding:30px;"><div class="emoji">🔍</div><h4>No products match</h4></div>';

      m.querySelectorAll('.bim-tile').forEach(t => t.onclick = () => {
        pendingProductId = t.dataset.id;
        $('#bimFile', m).value = ''; // reset
        $('#bimFile', m).click();
      });
    };

    $('#bimSearch', m).oninput = (e) => { searchQ = e.target.value; renderGrid(); };
    $('#bimCat', m).onchange = (e) => { activeCat = e.target.value; renderGrid(); };

    $('#bimFile', m).onchange = async (e) => {
      const f = e.target.files[0];
      if (!f || !pendingProductId) return;
      if (f.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)','error'); return; }
      try {
        const dataUrl = await resizeImageToDataURL(f, 200, 200, 0.85);
        DB.update('products', pendingProductId, { image: dataUrl });
        const p = DB.get('products', pendingProductId);
        toast(`✅ Image set for ${p.name}`, 'success');
        renderGrid();
      } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
    };

    renderGrid();
  }});
}
window.openBulkImageManager = openBulkImageManager;
