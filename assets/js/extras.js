/* ============================================================
   QR Menu Generator + Auto-Reply Bot
   ============================================================ */

/* === QR Code Menu — Admin shows QR poster customers can scan === */
function openQRMenuPoster() {
  // Safety checks
  if (typeof DB === 'undefined') { alert('System not loaded. Refresh page.'); return; }
  if (typeof openModal !== 'function') { alert('UI not loaded. Refresh page.'); return; }
  if (typeof QRCode === 'undefined') { alert('QR library not loaded. Refresh page (Ctrl+Shift+R)'); return; }
  const s = DB.settings();
  let baseUrl = location.origin + location.pathname.replace(/\/[^\/]*$/, '/');
  // Handle file:// protocol — show warning
  if (location.protocol === 'file:') {
    alert('⚠️ QR Posters work best when hosted online. Upload to Netlify first.\n\nFor now, QR codes will use file:// URLs which only work on this device.');
  }
  const portalUrl = baseUrl + 'portal.html';
  const menuUrl = baseUrl + 'menu.html';
  const reviewsUrl = baseUrl + 'reviews.html';

  openModal(`
    <h3>📱 QR Code Posters</h3>
    <p class="sub">Print these QR codes and stick at your counter. Customers scan with phone camera.</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px;">
      <div class="qr-poster" data-url="${portalUrl}" data-title="Track Your Order" data-color="#4f7cff">
        <h4 style="text-align:center;margin:0 0 10px;color:#4f7cff;">📦 Track Your Order</h4>
        <canvas class="qr-canvas" data-url="${portalUrl}"></canvas>
        <div style="text-align:center;font-size:11px;margin-top:8px;color:#666;word-break:break-all;">${portalUrl}</div>
        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;" onclick="printQRPoster('${portalUrl}','📦 Track Your Order','#4f7cff')">🖨️ Print Poster</button>
      </div>

      <div class="qr-poster" data-url="${menuUrl}">
        <h4 style="text-align:center;margin:0 0 10px;color:#f59e0b;">📋 View Price List</h4>
        <canvas class="qr-canvas" data-url="${menuUrl}"></canvas>
        <div style="text-align:center;font-size:11px;margin-top:8px;color:#666;word-break:break-all;">${menuUrl}</div>
        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;" onclick="printQRPoster('${menuUrl}','📋 View Price List','#f59e0b')">🖨️ Print Poster</button>
      </div>

      <div class="qr-poster" data-url="${reviewsUrl}">
        <h4 style="text-align:center;margin:0 0 10px;color:#22c55e;">⭐ Read Reviews</h4>
        <canvas class="qr-canvas" data-url="${reviewsUrl}"></canvas>
        <div style="text-align:center;font-size:11px;margin-top:8px;color:#666;word-break:break-all;">${reviewsUrl}</div>
        <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;" onclick="printQRPoster('${reviewsUrl}','⭐ Read Reviews','#22c55e')">🖨️ Print Poster</button>
      </div>
    </div>

    <div style="background:var(--surface-alt);padding:12px;border-radius:8px;font-size:12px;margin-top:14px;">
      💡 <b>Tip:</b> Print these QR codes A4 size and laminate. Customers love scanning them with their phone camera!
    </div>

    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
  `, { large: true, onOpen(m) {
    setTimeout(() => {
      m.querySelectorAll('.qr-canvas').forEach(c => {
        try { QRCode.toCanvas(c, c.dataset.url, { scale: 5, border: 2 }); } catch(e){}
      });
    }, 100);
  }});
}

function printQRPoster(url, title, color) {
  const s = DB.settings();
  const w = window.open('', '_blank', 'width=600,height=800');
  w.document.write(`
    <!DOCTYPE html><html><head><title>QR Poster - ${title}</title>
    <script src="assets/js/qrcode.min.js"></` + `script>
    <style>
      body { font-family: Arial; text-align: center; padding: 40px; margin: 0; }
      .poster { border: 5px solid ${color}; border-radius: 20px; padding: 40px; max-width: 500px; margin: 0 auto; }
      .logo { background: #000; padding: 12px; border-radius: 12px; display: inline-block; }
      .logo img { max-height: 90px; max-width: 160px; }
      h1 { margin: 16px 0 8px; font-size: 36px; }
      h2 { color: ${color}; margin: 20px 0; font-size: 28px; }
      .qr-wrap { background: #fff; padding: 20px; border-radius: 16px; display: inline-block; margin: 20px 0; }
      .instructions { font-size: 18px; color: #444; margin-top: 20px; }
      .url { background: #f0f0f0; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; margin-top: 14px; }
      @media print { @page { margin: 0; } body { padding: 20px; } }
    </style></head>
    <body>
      <div class="poster">
        <div class="logo"><img src="assets/img/logo.jpeg" onerror="this.style.display='none'"/></div>
        <h1>${s.shopName}</h1>
        <h2>${title}</h2>
        <div class="qr-wrap"><canvas id="qr"></canvas></div>
        <div class="instructions">
          <b>📱 How to use:</b><br>
          1. Open Camera app on phone<br>
          2. Point at QR code<br>
          3. Tap the notification
        </div>
        <div class="url">${url}</div>
      </div>
      <script>
        window.onload = function() {
          if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(document.getElementById('qr'), '${url}', { scale: 8, border: 2 });
            setTimeout(() => window.print(), 500);
          }
        };
      </` + `script>
    </body></html>
  `);
  w.document.close();
}

/* ============================================================
   AUTO-REPLY BOT — When customer sends message, auto-suggest reply
   ============================================================ */
function getAutoReply(messageText) {
  if (DB.settings().autoReplyEnabled === false) return null;
  const rules = DB.all('autoReplyRules').filter(r => r.active);
  const text = messageText.toLowerCase();
  for (const rule of rules) {
    const triggers = rule.trigger.split('|').map(t => t.trim().toLowerCase());
    if (triggers.some(t => text.includes(t))) {
      return rule.reply;
    }
  }
  return null;
}

function openAutoReplyEditor() {
  if (DB.currentUser().role !== 'admin') return;
  const rules = DB.all('autoReplyRules');
  const s = DB.settings();

  openModal(`
    <h3>💬 Auto-Reply Rules</h3>
    <p class="sub">When customer message contains trigger words, system suggests this reply.</p>

    <label style="display:flex;align-items:center;gap:6px;margin-bottom:14px;padding:10px;background:var(--surface-alt);border-radius:8px;">
      <input type="checkbox" id="arEnabled" ${s.autoReplyEnabled!==false?'checked':''}/>
      <b>Auto-reply enabled</b>
    </label>

    <div id="rulesList">
      ${rules.map((r,i) => `
        <div class="ar-rule" style="background:var(--surface);padding:12px;border:1px solid var(--border);border-radius:8px;margin-bottom:10px;">
          <div class="form-row">
            <div class="field"><label>Trigger Words (use | for OR)</label><input data-fld="trigger" data-id="${r.id}" value="${escapeHtml(r.trigger)}"/></div>
            <div class="field"><label>Active</label>
              <select data-fld="active" data-id="${r.id}">
                <option value="true" ${r.active!==false?'selected':''}>✅ Yes</option>
                <option value="false" ${r.active===false?'selected':''}>❌ No</option>
              </select>
            </div>
          </div>
          <div class="field"><label>Reply Message</label><textarea data-fld="reply" data-id="${r.id}" rows="2">${escapeHtml(r.reply)}</textarea></div>
          <button class="btn btn-danger btn-sm" data-del="${r.id}">🗑️ Delete</button>
        </div>
      `).join('')}
    </div>

    <button class="btn btn-secondary" id="addRuleBtn">+ Add New Rule</button>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveRulesBtn">💾 Save All Rules</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#addRuleBtn', m).onclick = () => {
      const newRule = DB.insert('autoReplyRules', { trigger:'word|word2', reply:'Type your reply here...', active:true });
      closeModal(); openAutoReplyEditor();
    };
    m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      confirmDialog('Delete this rule?', () => {
        DB.remove('autoReplyRules', b.dataset.del);
        closeModal(); openAutoReplyEditor();
      });
    });
    $('#saveRulesBtn', m).onclick = () => {
      // Collect all rules
      const updates = {};
      m.querySelectorAll('[data-fld]').forEach(input => {
        const id = input.dataset.id;
        const fld = input.dataset.fld;
        if (!updates[id]) updates[id] = {};
        updates[id][fld] = fld === 'active' ? (input.value === 'true') : input.value;
      });
      Object.entries(updates).forEach(([id, data]) => DB.update('autoReplyRules', id, data));
      DB.saveSettings({ autoReplyEnabled: $('#arEnabled', m).checked });
      toast('Auto-reply rules saved','success');
      closeModal();
    };
  }});
}
