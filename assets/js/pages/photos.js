/* ===================== ORDER PHOTOS — Dispute solver ===================== */
/* Cashier can attach photos to any order: camera, gallery, with labels.
   Photos are compressed to ~80KB each and stored as base64 in the order. */

const MAX_PHOTOS_PER_ORDER = 8;
const PHOTO_MAX_WIDTH = 1024;      // resize to this width
const PHOTO_QUALITY = 0.72;        // JPEG quality

/* === Open the photo manager modal for an order === */
function openOrderPhotos(orderId) {
  const o = DB.get('orders', orderId);
  if (!o) { toast('Order not found','error'); return; }
  const c = DB.get('customers', o.customerId) || { name:'Walk-in' };
  const invNo = o.invoiceNo ? `INV-${o.invoiceNo}` : '#' + o.id.slice(-6).toUpperCase();
  const photos = o.photos || [];

  openModal(`
    <h3>📷 Order Photos — ${invNo}</h3>
    <p class="sub">Customer: <b>${escapeHtml(c.name)}</b> ${c.phone?'• '+escapeHtml(c.phone):''}</p>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:12px;">
      💡 <b>Tip:</b> Snap photos of any stains, damages, or special details at booking time.
      This protects you from disputes later.
    </div>

    <!-- Add photo buttons -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      <label class="btn btn-primary" style="cursor:pointer;text-align:center;padding:16px 8px;">
        📸<br>Take Photo
        <input type="file" id="photoCam" accept="image/*" capture="environment" style="display:none;"/>
      </label>
      <label class="btn btn-secondary" style="cursor:pointer;text-align:center;padding:16px 8px;">
        🖼️<br>From Gallery
        <input type="file" id="photoGal" accept="image/*" multiple style="display:none;"/>
      </label>
      <button class="btn btn-secondary" id="addNoteBtn" style="padding:16px 8px;">
        ✏️<br>Add Note
      </button>
    </div>

    <div style="font-size:12px;color:var(--text-soft);margin-bottom:8px;">
      📊 ${photos.length} of ${MAX_PHOTOS_PER_ORDER} photos used
    </div>

    <div id="photoGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;min-height:120px;"></div>

    ${o.photoNotes ? `<div style="margin-top:14px;padding:10px;background:var(--surface-alt);border-radius:8px;font-size:13px;"><b>📝 Notes:</b><br>${escapeHtml(o.photoNotes)}</div>` : ''}

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, { large: true, onOpen(m) {
    renderPhotoGrid(orderId, m);

    $('#photoCam', m).onchange = (e) => handlePhotoFiles(e.target.files, orderId, m);
    $('#photoGal', m).onchange = (e) => handlePhotoFiles(e.target.files, orderId, m);
    $('#addNoteBtn', m).onclick = () => openPhotoNoteDialog(orderId);
  }});
}

/* === Render photo grid === */
function renderPhotoGrid(orderId, root) {
  const o = DB.get('orders', orderId);
  const photos = o.photos || [];
  const grid = $('#photoGrid', root);

  if (!photos.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-soft);">
      <div style="font-size:48px;opacity:.4;">📷</div>
      <p>No photos yet. Use the buttons above to add some.</p>
    </div>`;
    return;
  }

  grid.innerHTML = photos.map((p, i) => `
    <div style="position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#000;">
      <img src="${p.data}" style="width:100%;height:120px;object-fit:cover;display:block;cursor:pointer;" data-view="${i}"/>
      <div style="padding:6px 8px;background:var(--surface);font-size:11px;">
        <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.label || 'Photo '+(i+1))}</div>
        <div style="color:var(--text-soft);font-size:10px;">${fmtDateShort(p.addedAt)} • ${Math.round((p.size||0)/1024)} KB</div>
      </div>
      <button data-del="${i}" title="Delete" style="position:absolute;top:4px;right:4px;background:rgba(239,68,68,.95);color:#fff;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;">×</button>
      <button data-lbl="${i}" title="Edit label" style="position:absolute;top:4px;left:4px;background:rgba(255,255,255,.9);border:none;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;">✏️</button>
    </div>
  `).join('');

  $$('[data-view]', grid).forEach(img => img.onclick = () => openPhotoViewer(orderId, +img.dataset.view));
  $$('[data-del]', grid).forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    confirmDialog('Delete this photo?', () => {
      const ord = DB.get('orders', orderId);
      ord.photos.splice(+b.dataset.del, 1);
      DB.update('orders', orderId, { photos: ord.photos });
      toast('Photo deleted','success');
      renderPhotoGrid(orderId, root);
    });
  });
  $$('[data-lbl]', grid).forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const ord = DB.get('orders', orderId);
    const i = +b.dataset.lbl;
    const cur = ord.photos[i].label || '';
    const lbl = prompt('Photo label (e.g. "Stain on sleeve")', cur);
    if (lbl !== null) {
      ord.photos[i].label = lbl.trim();
      DB.update('orders', orderId, { photos: ord.photos });
      renderPhotoGrid(orderId, root);
    }
  });
}

/* === Handle file uploads (compress + save) === */
async function handlePhotoFiles(files, orderId, root) {
  if (!files || !files.length) return;
  const o = DB.get('orders', orderId);
  const current = (o.photos || []).length;
  const remaining = MAX_PHOTOS_PER_ORDER - current;
  if (remaining <= 0) { toast(`Max ${MAX_PHOTOS_PER_ORDER} photos per order`,'error'); return; }

  const toProcess = Array.from(files).slice(0, remaining);
  toast(`Processing ${toProcess.length} photo(s)...`, 'success');

  for (const file of toProcess) {
    try {
      const compressed = await compressImage(file);
      const label = await askForLabel(file.name);
      const ord = DB.get('orders', orderId);
      const photos = ord.photos || [];
      photos.push({
        data: compressed.dataUrl,
        size: compressed.size,
        label: label || '',
        addedAt: new Date().toISOString(),
        addedBy: DB.currentUser()?.username || ''
      });
      DB.update('orders', orderId, { photos });
    } catch (err) {
      console.error(err);
      toast('Failed to process photo','error');
    }
  }
  renderPhotoGrid(orderId, root);
  toast('Photos saved','success');
}

/* === Image compression using canvas === */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > PHOTO_MAX_WIDTH) {
          height = Math.round(height * (PHOTO_MAX_WIDTH / width));
          width = PHOTO_MAX_WIDTH;
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
        const size = Math.round(dataUrl.length * 0.75); // base64 size estimate
        resolve({ dataUrl, size });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* === Ask for photo label (non-blocking using modal) === */
function askForLabel(defaultText) {
  return new Promise((resolve) => {
    const sug = ['Stain', 'Tear / Damage', 'Discoloration', 'Front view', 'Back view', 'Special item'];
    const inner = document.createElement('div');
    inner.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    inner.innerHTML = `
      <div style="background:#fff;color:#000;border-radius:14px;padding:20px;max-width:380px;width:100%;">
        <h3 style="margin-bottom:8px;">Photo Label (optional)</h3>
        <p style="font-size:12px;color:#666;margin-bottom:12px;">Quick note about what this photo shows</p>
        <input id="lblInput" placeholder="e.g. Coffee stain on left sleeve" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;"/>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
          ${sug.map(s => `<button data-s="${s}" style="padding:4px 10px;border:1px solid #ddd;background:#f8f9ff;border-radius:14px;cursor:pointer;font-size:12px;">${s}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="skipBtn" style="padding:8px 14px;background:transparent;border:none;cursor:pointer;color:#666;">Skip</button>
          <button id="okBtn" style="padding:8px 18px;background:#4f7cff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(inner);
    const input = inner.querySelector('#lblInput');
    input.focus();
    inner.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { input.value = b.dataset.s; });
    const finish = (val) => { inner.remove(); resolve(val); };
    inner.querySelector('#okBtn').onclick = () => finish(input.value.trim());
    inner.querySelector('#skipBtn').onclick = () => finish('');
    input.onkeydown = (e) => { if (e.key === 'Enter') finish(input.value.trim()); };
  });
}

/* === Full screen photo viewer (with swipe) === */
function openPhotoViewer(orderId, startIndex) {
  const o = DB.get('orders', orderId);
  const photos = o.photos || [];
  if (!photos.length) return;
  let idx = startIndex || 0;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9998;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="position:absolute;top:14px;right:14px;display:flex;gap:8px;">
      <button id="dlBtn" style="background:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600;">📥 Download</button>
      <button id="closeBtn" style="background:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600;">✕ Close</button>
    </div>
    <div id="counter" style="color:#fff;font-size:14px;margin-bottom:8px;"></div>
    <img id="viewerImg" style="max-width:96vw;max-height:75vh;object-fit:contain;border-radius:8px;background:#000;"/>
    <div id="viewerLabel" style="color:#fff;margin-top:14px;font-size:15px;font-weight:600;text-align:center;max-width:90vw;"></div>
    <div style="display:flex;gap:14px;margin-top:14px;">
      <button id="prevBtn" style="background:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:700;">← Prev</button>
      <button id="nextBtn" style="background:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:700;">Next →</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const render = () => {
    const p = photos[idx];
    overlay.querySelector('#viewerImg').src = p.data;
    overlay.querySelector('#viewerLabel').textContent = (p.label || 'Photo '+(idx+1)) + ' — ' + fmtDate(p.addedAt);
    overlay.querySelector('#counter').textContent = `${idx+1} / ${photos.length}`;
  };
  render();

  const close = () => overlay.remove();
  overlay.querySelector('#closeBtn').onclick = close;
  overlay.querySelector('#prevBtn').onclick = () => { idx = (idx-1+photos.length)%photos.length; render(); };
  overlay.querySelector('#nextBtn').onclick = () => { idx = (idx+1)%photos.length; render(); };
  overlay.querySelector('#dlBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = photos[idx].data;
    a.download = `order-${orderId}-photo-${idx+1}.jpg`;
    a.click();
  };
  document.onkeydown = (e) => {
    if (e.key === 'Escape') { close(); document.onkeydown = null; }
    if (e.key === 'ArrowLeft') overlay.querySelector('#prevBtn').click();
    if (e.key === 'ArrowRight') overlay.querySelector('#nextBtn').click();
  };
}

/* === Text-only note dialog === */
function openPhotoNoteDialog(orderId) {
  const o = DB.get('orders', orderId);
  openModal(`
    <h3>📝 Order Note</h3>
    <p class="sub">Quick text note about garment condition, special instructions, etc.</p>
    <div class="field">
      <textarea id="noteInput" rows="5" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;" placeholder="e.g. Customer mentioned shirt has missing button. Coffee stain on left sleeve confirmed.">${escapeHtml(o.photoNotes||'')}</textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveNoteBtn">💾 Save Note</button>
    </div>
  `, { onOpen(m) {
    $('#saveNoteBtn', m).onclick = () => {
      DB.update('orders', orderId, { photoNotes: $('#noteInput', m).value.trim() });
      closeModal(); toast('Note saved','success');
      // refresh photo modal if open
      const order = DB.get('orders', orderId);
      if (order) openOrderPhotos(orderId);
    };
  }});
}
