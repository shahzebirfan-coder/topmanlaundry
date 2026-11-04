
/* ===================== MARKETING STUDIO =====================
   WhatsApp image fix:
   wa.me/<phone>?text=... can ONLY carry text — no public WhatsApp URL can
   attach a file. So the branded JPG is now handed to the native OS share
   sheet (Web Share API with `files`) where WhatsApp receives the IMAGE
   already attached and the message as its caption. On desktop / browsers
   without file sharing we fall back to the exact-chat link + a helper modal
   (preview, download image, copy caption) so the ad can still be attached.
   ============================================================ */

const AI_PROMOS = [
  { 
    title: 'Carpet Cleaning Season', 
    desc: 'Offer a 50% discount on carpet and curtain washing when customers pay in advance. Great for weekend cash flow!',
    offerText: '50% OFF CARPETS',
    msg: 'Hi {name}! Special offer today: Get 50% OFF on all Carpet & Curtain washes if you book with Advance Payment! Use code {promo} at the counter.'
  },
  { 
    title: 'Buy 3 Get 1 Free', 
    desc: 'Encourage bulk orders. Send this to customers who usually only bring 1 or 2 items.',
    offerText: 'BUY 3 GET 1 FREE',
    msg: 'Hi {name}! We miss you at Laundry POS. Bring in 4 items this week and get the cheapest one washed entirely FREE! Use code {promo}.'
  },
  { 
    title: 'Sleeping Customer Revival', 
    desc: "Target customers who haven't visited in 45 days with a flat 20% discount.",
    offerText: '20% OFF EVERYTHING',
    msg: "Hello {name}, it's been a while! Come back to Laundry POS this week and get a flat 20% OFF your entire bill. Mention code {promo}."
  }
];

let mktState = {
  templateIdx: 0,
  uploadedImage: null,
  audience: 'sleeping', // all, sleeping, vip
  selectedPromo: '',
  offerText: '50% OFF CARPETS!'
};

/* ------------------------------------------------------------------
   1. Branded ad canvas — one shared generator used by BOTH
      "Download Branded Ad" and every WhatsApp "Send".
   ------------------------------------------------------------------ */
function mktDrawBrandedAd() {
  const img = mktState.uploadedImage;
  if (!img || typeof document === 'undefined') return null;

  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  if (!ctx) return null;
  const s = (typeof DB !== 'undefined' && DB.settings) ? DB.settings() : {};

  cvs.width = 1080;
  cvs.height = 1080; // Standard Insta/WhatsApp Square

  // Background (cover)
  const scale = Math.max(cvs.width / img.width, cvs.height / img.height);
  const x = (cvs.width / 2) - (img.width / 2) * scale;
  const y = (cvs.height / 2) - (img.height / 2) * scale;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  // Dim overlay
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, cvs.width, cvs.height);

  // Shop name / logo
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  ctx.font = '900 60px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🧺 ' + (s.shopName || 'Laundry POS'), 40, 80);

  // Sticker
  ctx.save();
  ctx.translate(60, cvs.height - 180);
  ctx.rotate(-5 * Math.PI / 180);

  const offerEl = (typeof $ === 'function') ? $('#mktOfferText') : null;
  const text = (offerEl && offerEl.value) || mktState.offerText || '50% OFF!';
  ctx.font = '900 70px sans-serif';
  const textWidth = ctx.measureText(text).width;

  ctx.shadowBlur = 15;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.fillStyle = '#ef4444';
  const bw = textWidth + 80, bh = 110, r = 55;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, bw, bh, r);
  } else {
    // Older browsers (and jsdom) have no roundRect — draw it manually.
    ctx.moveTo(r, 0); ctx.lineTo(bw - r, 0); ctx.quadraticCurveTo(bw, 0, bw, r);
    ctx.lineTo(bw, bh - r); ctx.quadraticCurveTo(bw, bh, bw - r, bh);
    ctx.lineTo(r, bh); ctx.quadraticCurveTo(0, bh, 0, bh - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
  }
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 40, 75);
  ctx.restore();

  // Phone bottom bar
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, cvs.height - 80, cvs.width, 80);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📞 Booking & Details: ' + (s.phone || ''), cvs.width / 2, cvs.height - 25);

  return cvs;
}

/* Synchronous on purpose: Web Share needs the click's transient user
   activation, so we must NOT await toBlob() before navigator.share(). */
function mktCanvasToJpegFile(cvs) {
  const dataUrl = cvs.toDataURL('image/jpeg', 0.9);
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], 'Topman_Promo_Ad.jpg', { type: 'image/jpeg' });
}

function mktDownloadCanvas(cvs) {
  if (!cvs) return;
  const a = document.createElement('a');
  a.href = cvs.toDataURL('image/jpeg', 0.9);
  a.download = 'MrLaundry_Promo.jpg';
  a.click();
  toast('Image downloaded! WhatsApp chat mein attach karein.', 'success');
}

function mktBuildMessage(template, name, promo) {
  return String(template || '')
    .replace(/\{name\}/g, name || '')
    .replace(/\{promo\}/g, promo || 'NO-CODE');
}

function mktCopyText(txt) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
    toast('✅ Caption copied', 'success');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast('✅ Caption copied', 'success')).catch(fallback);
  } else fallback();
}

function mktMarkSent(b, label) {
  if (!b) return;
  b.textContent = label || '✅ Sent';
  b.classList.replace('btn-success', 'btn-ghost');
  b.disabled = true;
}

/* Desktop / unsupported-browser fallback. Never auto-downloads or opens
   anything without the user pressing a button. */
function mktOpenAdFallback(cvs, msg, waUrl, btn) {
  let dataUrl = '';
  try { dataUrl = cvs.toDataURL('image/jpeg', 0.9); } catch (e) {}
  openModal(`
    <h3>📷 Ad image WhatsApp par bhejein</h3>
    <p class="sub">Is device par WhatsApp ko image seedha attach nahi kiya ja sakta — WhatsApp ke
      <code>wa.me</code> links sirf text le jate hain. Image download karke chat mein attach karein.</p>

    ${dataUrl ? `<div style="text-align:center;margin:10px 0;">
      <img src="${dataUrl}" alt="Branded ad" style="max-width:260px;max-height:260px;border-radius:10px;border:1px solid var(--border);box-shadow:0 6px 18px rgba(0,0,0,.15);"/>
    </div>` : ''}

    <div class="field">
      <label>Caption (copy karein)</label>
      <textarea id="mktCaption" rows="3" style="font-size:13px;line-height:1.4;">${escapeHtml(msg)}</textarea>
    </div>

    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.55;margin:10px 0;">
      💡 <b>Mobile par (Android Chrome / iPhone Safari):</b> "Send" dabate hi native share sheet
      khulti hai jisme ye image <b>pehle se attached</b> hoti hai aur upar wala text caption ban
      jata hai — bas WhatsApp → contact → Send dabayein.
    </div>

    <div class="modal-footer" style="flex-wrap:wrap;">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="mktFbDownload">⬇️ Download Ad</button>
      <button class="btn btn-secondary" id="mktFbCopy">📋 Copy Caption</button>
      <button class="btn btn-primary" id="mktFbOpen">💬 Open WhatsApp</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#mktFbDownload', m).onclick = () => mktDownloadCanvas(cvs);
    $('#mktFbCopy', m).onclick = () => mktCopyText(msg);
    $('#mktFbOpen', m).onclick = () => {
      window.open(waUrl, '_blank');
      closeModal();
      mktMarkSent(btn, '✅ Sent');
      try { if (typeof logAction === 'function') logAction('marketing.whatsappText', 'Ad fallback: exact chat opened'); } catch (e) {}
    };
  }});
}

function renderMarketing() {
  if (DB.currentUser().role !== 'admin') { toast('Admin only','error'); app.go('dashboard'); return; }

  const s = DB.settings();
  const promos = DB.all('promoCodes').filter(p => !p.expiresAt || new Date(p.expiresAt) > new Date());
  
  const content = `
    <h1 class="page-title">📢 Marketing Studio</h1>
    <p class="page-sub">Auto-brand images and run targeted WhatsApp campaigns.</p>

    <!-- AI IDEA BANNER -->
    <div style="background:linear-gradient(135deg, #fef08a, #fde047); padding:16px 20px; border-radius:12px; border-left:6px solid #eab308; display:flex; align-items:center; gap:16px; margin-bottom:20px;">
      <div style="font-size:32px;">💡</div>
      <div>
        <h3 style="margin:0 0 4px 0; color:#854d0e; font-size:16px;" id="mktIdeaTitle">...</h3>
        <p style="margin:0; color:#713f12; font-size:14px; font-weight:500;" id="mktIdeaDesc">...</p>
      </div>
      <button class="btn btn-primary" style="margin-left:auto; white-space:nowrap;" id="mktUseIdeaBtn">Use this Idea</button>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
      
      <!-- 1. AUTO BRANDING STUDIO -->
      <div class="card" style="border-top:4px solid #3b82f6;">
        <h3 style="margin:0 0 10px 0;">🎨 1. Auto-Branding Studio</h3>
        <p class="sub" style="margin-bottom:14px;">Upload a plain AI image. We'll stamp your logo & offer on it!</p>
        
        <div id="canvasWrap" style="background:#cbd5e1; height:250px; border-radius:8px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; margin-bottom:15px; border:2px dashed #94a3b8;">
          <img id="mktPreviewImg" src="" style="width:100%; height:100%; object-fit:cover; filter:brightness(0.8); display:none;" />
          <div id="mktPlaceholder" style="color:#64748b; font-weight:bold;">No Image Uploaded</div>
          <div id="mktOverlay" style="position:absolute; top:0; left:0; right:0; bottom:0; display:none; flex-direction:column; justify-content:space-between; padding:15px;">
            <div style="font-size:20px; font-weight:900; color:#fff; text-shadow:1px 1px 4px rgba(0,0,0,0.8);">${escapeHtml(s.shopName)}</div>
            <div id="mktBadgeText" style="background:#ef4444; color:#fff; padding:8px 16px; border-radius:30px; font-weight:900; font-size:22px; align-self:flex-start; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:2px solid #fff; transform:rotate(-5deg); margin-top:auto; margin-bottom:20px;">50% OFF!</div>
            <div style="background:rgba(0,0,0,0.7); color:#fff; padding:6px 12px; border-radius:6px; font-weight:bold; font-size:14px; align-self:center; width:100%; text-align:center; box-sizing:border-box;">📞 Booking: ${escapeHtml(s.phone||'')}</div>
          </div>
        </div>
        
        <!-- Hidden Canvas for Export (kept for backwards compatibility) -->
        <canvas id="mktExportCanvas" style="display:none;"></canvas>

        <div class="field">
          <label>Upload Background Image</label>
          <input type="file" id="mktImgUpload" accept="image/png, image/jpeg, image/webp" />
        </div>
        <div class="field">
          <label>Sticker Text</label>
          <input type="text" id="mktOfferText" value="50% OFF CARPETS!" />
        </div>
        <button class="btn btn-secondary btn-block" id="mktDownloadBtn" disabled>⬇️ Download Branded Ad (JPG)</button>
        <div id="mktImageStatus" style="font-size:12px;color:#b45309;margin-top:8px;line-height:1.5;">
          ⚠️ Abhi koi image nahi — WhatsApp par sirf text jayega.
        </div>
      </div>

      <!-- 2. WHATSAPP BLASTER -->
      <div class="card" style="border-top:4px solid #22c55e;">
        <h3 style="margin:0 0 10px 0;">🚀 2. WhatsApp Blaster</h3>
        
        <div class="form-row">
          <div class="field" style="margin:0;">
            <label>Target Audience</label>
            <select id="mktAudience">
              <option value="sleeping">Sleeping (No order in 30 days)</option>
              <option value="all">All Customers</option>
              <option value="vip">VIP / Loyalty Members</option>
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label>Link Promo Code (Optional)</label>
            <select id="mktPromo">
              <option value="">-- No Code --</option>
              ${promos.map(p => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.code)} (${p.discountPercent}%)</option>`).join('')}
            </select>
            <div style="font-size:10px;text-align:right;margin-top:2px;"><a href="#" onclick="app.go('promoAdmin')">+ Create Code</a></div>
          </div>
        </div>

        <div class="field">
          <label>Message (Variables: {name}, {promo})</label>
          <textarea id="mktMessage" rows="4" style="font-size:13px;line-height:1.4;">${escapeHtml(AI_PROMOS[0].msg)}</textarea>
        </div>

        <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:10px 12px;border-radius:8px;margin:0 0 12px;font-size:12px;line-height:1.55;">
          <label style="display:flex;gap:8px;align-items:flex-start;font-weight:700;cursor:pointer;">
            <input type="checkbox" id="mktAttachImage" checked style="margin-top:2px;"/>
            <span>📷 Branded ad image bhi bhejein (image + caption)</span>
          </label>
          <div style="margin-top:6px;color:#065f46;">
            WhatsApp ka <code>wa.me</code> link sirf <b>text</b> le jata hai, image nahi. Isliye mobile par
            <b>native share sheet</b> khulti hai jisme image pehle se attached hoti hai
            (WhatsApp → contact → Send). Desktop par image download + caption copy milta hai.
          </div>
          <div id="mktAttachState" style="margin-top:6px;font-weight:700;color:#b45309;">
            ⚠️ Image upload nahi hui — abhi sirf text jayega.
          </div>
        </div>

        <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
          <div style="background:#f8fafc; padding:8px 12px; font-size:12px; font-weight:bold; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between;">
            <span id="mktQueueTitle">Queue: 0 Customers</span>
          </div>
          <div style="max-height:200px; overflow-y:auto;">
            <table class="tbl" style="margin:0; font-size:12px;">
              <tbody id="mktQueueBody"></tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  `;

  $('#app').innerHTML = renderLayout('marketing', content);
  bindLayout();

  // Load Idea
  const loadIdea = (idx) => {
    mktState.templateIdx = idx;
    const idea = AI_PROMOS[idx];
    $('#mktIdeaTitle').textContent = idea.title;
    $('#mktIdeaDesc').textContent = idea.desc;
  };
  loadIdea(Math.floor(Math.random() * AI_PROMOS.length));

  $('#mktUseIdeaBtn').onclick = () => {
    const idea = AI_PROMOS[mktState.templateIdx];
    $('#mktOfferText').value = idea.offerText;
    mktState.offerText = idea.offerText;
    $('#mktMessage').value = idea.msg;
    updatePreview();
    renderQueue();
  };

  // Canvas Logic
  const updatePreview = () => {
    $('#mktBadgeText').textContent = $('#mktOfferText').value;
  };
  $('#mktOfferText').oninput = () => {
    mktState.offerText = $('#mktOfferText').value;
    updatePreview();
  };

  const markImageReady = () => {
    const msg = '✅ Branded ad ready — "Send" ab image ke saath jayega (mobile par share sheet khulegi).';
    const a = $('#mktImageStatus'), b = $('#mktAttachState');
    if (a) { a.textContent = msg; a.style.color = '#15803d'; }
    if (b) { b.textContent = '✅ Image attached hogi — caption neeche wala message ban jayega.'; b.style.color = '#15803d'; }
  };

  $('#mktImgUpload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        mktState.uploadedImage = img;
        $('#mktPreviewImg').src = img.src;
        $('#mktPreviewImg').style.display = 'block';
        $('#mktPlaceholder').style.display = 'none';
        $('#mktOverlay').style.display = 'flex';
        $('#mktDownloadBtn').disabled = false;
        $('#mktDownloadBtn').classList.replace('btn-secondary', 'btn-primary');
        markImageReady();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  $('#mktDownloadBtn').onclick = () => {
    const cvs = mktDrawBrandedAd();
    if (!cvs) { toast('Pehle image upload karein', 'error'); return; }
    mktDownloadCanvas(cvs);
  };

  // Blaster Logic
  const renderQueue = () => {
    mktState.audience = $('#mktAudience').value;
    const allCust = DB.all('customers').filter(c => c.id !== 'cu1' && c.phone);
    const orders = DB.all('orders');
    
    let target = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    
    allCust.forEach(c => {
      const cOrders = orders.filter(o => o.customerId === c.id);
      const lastOrder = cOrders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
      const lastDate = lastOrder ? lastOrder.createdAt : 'Never';
      
      if (mktState.audience === 'vip' && !c.loyaltyActive) return;
      // Customers with NO order at all are definitely "sleeping".
      // Comparing the string 'Never' > ISO date used to wrongly exclude them.
      if (mktState.audience === 'sleeping' && lastDate !== 'Never' && lastDate > thirtyDaysAgo) return;
      
      let daysAgo = 'Never';
      if (lastOrder) daysAgo = Math.floor((new Date() - new Date(lastDate)) / 86400000) + ' days ago';

      target.push({ c, daysAgo });
    });

    $('#mktQueueTitle').textContent = `Queue: ${target.length} Customers Found`;
    
    if (!target.length) {
      $('#mktQueueBody').innerHTML = '<tr><td style="text-align:center;padding:20px;">No customers fit this filter.</td></tr>';
      return;
    }

    $('#mktQueueBody').innerHTML = target.map(t => {
      // Clean phone
      let p = t.c.phone.replace(/[^\d+]/g, '');
      if (p.startsWith('0') && p.length===11) p = '92' + p.substring(1);
      if (p.startsWith('+')) p = p.substring(1);

      return `
      <tr>
        <td><b>${escapeHtml(t.c.name)}</b><br><span style="color:var(--text-soft);font-size:10px;">${escapeHtml(t.c.phone)}</span></td>
        <td>${t.daysAgo}</td>
        <td style="text-align:right;">
          <button class="btn btn-success btn-sm mkt-send-btn" data-name="${escapeHtml(t.c.name)}" data-phone="${p}">📱 Send</button>
        </td>
      </tr>
      `;
    }).join('');

    $$('.mkt-send-btn').forEach(b => {
      b.onclick = async () => {
        const msg = mktBuildMessage($('#mktMessage').value, b.dataset.name, $('#mktPromo').value);
        const waUrl = `https://wa.me/${b.dataset.phone}?text=${encodeURIComponent(msg)}`;
        const attach = $('#mktAttachImage') ? $('#mktAttachImage').checked : false;

        let cvs = null;
        if (attach) { try { cvs = mktDrawBrandedAd(); } catch (e) { cvs = null; } }
        if (attach && !cvs) {
          toast('📷 Ad image nahi mili — pehle background image upload karein. Abhi sirf text jayega.', 'warning');
        }

        /* Mobile: hand the REAL image to the OS share sheet. WhatsApp then
           appears as a target with the JPG attached and `text` as caption. */
        if (cvs && typeof navigator.share === 'function' && typeof File !== 'undefined') {
          try {
            const file = mktCanvasToJpegFile(cvs);
            const canShare = !navigator.canShare || navigator.canShare({ files: [file] });
            if (canShare) {
              await navigator.share({
                files: [file],
                text: msg,
                title: (DB.settings().shopName || 'Laundry POS') + ' — Special Offer'
              });
              mktMarkSent(b, '✅ Shared');
              try { if (typeof logAction === 'function') logAction('marketing.whatsappImage', `Ad image shared with ${b.dataset.name}`); } catch (e) {}
              return;
            }
          } catch (err) {
            if (err && err.name === 'AbortError') return; // user closed the share sheet
            // Unsupported / failed → fall through to the exact-chat fallback
          }
        }

        /* Desktop & older browsers: exact chat link (text) + helper modal */
        if (cvs) {
          mktOpenAdFallback(cvs, msg, waUrl, b);
        } else {
          window.open(waUrl, '_blank');
          mktMarkSent(b, '✅ Sent');
        }
      };
    });
  };

  $('#mktAudience').onchange = renderQueue;
  $('#mktMessage').oninput = renderQueue;
  $('#mktPromo').onchange = renderQueue;
  
  renderQueue();
}
