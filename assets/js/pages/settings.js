/* ===================== SETTINGS ===================== */
function renderSettings() {
  if (DB.currentUser().role !== 'admin') { app.go('dashboard'); return; }
  const s = DB.settings();
  const lastBackup = localStorage.getItem('mrLaundryLastBackup');
  const lastBackupTxt = lastBackup ? new Date(lastBackup).toLocaleString() : 'Never';

  const content = `
    <h1 class="page-title">⚙️ Settings</h1>
    <p class="page-sub">Customize your shop info, loyalty defaults, and manage your data.</p>

    <!-- IT ADMIN DEMO & SUBSCRIPTION SECTION - TOP VISIBILITY -->
    <div class="card" style="margin-bottom:20px;background:#fef2f2;border:2px solid #ef4444;">
      <div class="card-header"><h3 style="color:#b91c1c;">📅 Demo & Subscription (IT Admin)</h3></div>
      ${(() => {
        const st = getLicenseState();
        const map = {
          lifetime: ['#ecfdf5', '#15803d', '🌟 Lifetime licence — never expires'],
          active:   ['#eff6ff', '#1d4ed8', `✅ Active — expires ${new Date(st.expiry).toLocaleString()} (${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left)`],
          expired:  ['#fef2f2', '#b91c1c', `❌ Expired on ${new Date(st.expiry).toLocaleDateString()} — POS blocked`],
          missing:  ['#fef2f2', '#b91c1c', '⚠️ No licence set — treated as expired']
        };
        const [bg, fg, text] = map[st.kind] || map.missing;
        return `<div style="background:${bg};color:${fg};padding:9px 12px;border-radius:8px;font-weight:700;font-size:12.5px;margin-bottom:12px;">
          ${text}${st.updated ? `<div style="font-weight:500;font-size:11px;opacity:.8;margin-top:3px;">Last change: ${escapeHtml(st.updated)}</div>` : ''}
        </div>`;
      })()}
      <p style="color:#991b1b;font-size:12px;margin-bottom:14px;">Manage subscription validity. Requires IT ADMIN PASSWORD.</p>
      <button class="btn btn-danger btn-block" id="openSubBtnTop">🔑 Manage Subscription</button>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start;">
      <div>
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🏪 Shop Information</h3></div>

          <div class="field" style="margin-bottom:18px;">
            <label>Brand Logo</label>
            <div style="display:flex;align-items:center;gap:16px;padding:14px;background:#000;border-radius:10px;">
              <div style="background:#000;padding:8px;border-radius:8px;">
                ${s.logoImage
                  ? `<img id="logoPreview" src="${s.logoImage}" style="width:120px;height:120px;object-fit:contain;display:block;"/>`
                  : `<div id="logoPreview" style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:60px;">${s.logo||'🧺'}</div>`}
              </div>
              <div style="flex:1;color:#fff;">
                <label class="btn btn-primary" style="cursor:pointer;display:inline-block;">
                  📤 Upload New Logo
                  <input type="file" id="logoFile" accept="image/*" style="display:none;"/>
                </label>
                <button class="btn btn-ghost" id="removeLogoBtn" style="color:#fff;border:1px solid #444;margin-left:8px;">Remove</button>
                <div style="font-size:11px;opacity:.7;margin-top:8px;">PNG, JPG, SVG. Best on dark background. Max 2MB.</div>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="field"><label>Shop Name</label><input id="sName" value="${escapeHtml(s.shopName)}"/></div>
            <div class="field"><label>Fallback Logo (emoji)</label><input id="sLogo" value="${escapeHtml(s.logo)}" maxlength="4" style="font-size:20px;text-align:center;"/></div>
          </div>
          <div class="form-row cols-1">
            <div class="field"><label>Tagline</label><input id="sTag" value="${escapeHtml(s.tagline||'')}"/></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Phone</label><input id="sPhone" value="${escapeHtml(s.phone||'')}"/></div>
            <div class="field"><label>Currency Symbol</label><input id="sCurrency" value="${escapeHtml(s.currency)}"/></div>
          </div>
          <div class="form-row cols-1">
            <div class="field"><label>Address</label><textarea id="sAddr" rows="2">${escapeHtml(s.address||'')}</textarea></div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Facebook Page</label>
              <input id="sFb" value="${escapeHtml(s.facebook||'')}" placeholder="facebook.com/yourpage"/>
              <small style="color:var(--text-soft);">Shown on the login screen. Paste a full URL or just the page name.</small>
            </div>
            <div class="field">
              <label>WhatsApp Number</label>
              <input id="sWa" value="${escapeHtml(s.whatsapp||s.phone||'')}" placeholder="03xx-xxxxxxx"/>
              <small style="color:var(--text-soft);">Leave blank to use the Phone number above.</small>
            </div>
          </div>
          <div class="form-row">
            <div class="field"><label>Tax Percent (%)</label><input type="number" id="sTax" value="${s.taxPercent||0}"/></div>
            <div class="field"><label>Invoice URL Base (for QR)</label><input id="sBase" value="${escapeHtml(s.baseUrl||'')}" placeholder="https://yourshop.com (optional)"/></div>
          </div>
          <div class="form-row cols-1">
            <div class="field"><label>Invoice Footer Message</label><input id="sFooter" value="${escapeHtml(s.invoiceFooter||'')}"/></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>⭐ Loyalty & Delivery Defaults</h3></div>
          <div class="form-row">
            <div class="field"><label>Loyalty Card Prefix</label><input id="sLoyPrefix" value="${escapeHtml(s.loyaltyPrefix||'MRL')}" maxlength="6" style="text-transform:uppercase;"/><small style="color:var(--text-soft);">Auto-generated cards look like: MRL-1001, MRL-1002…</small></div>
            <div class="field"><label>Default Loyalty Discount %</label><input type="number" id="sLoyPct" value="${s.defaultLoyaltyDiscountPercent||10}" min="0" max="100"/></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Default Delivery Days</label>
              <select id="sDeliveryDays">
                ${[1,2,3,4,5,7].map(n => `<option value="${n}" ${(s.defaultDeliveryDays||2)==n?'selected':''}>${n} day${n>1?'s':''}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Backup Reminder</label>
              <select id="sBackupReminder">
                <option value="true"  ${s.autoBackupReminder!==false?'selected':''}>✅ Show daily reminder</option>
                <option value="false" ${s.autoBackupReminder===false?'selected':''}>❌ Disabled</option>
              </select>
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" id="saveSetBtn">💾 Save All Settings</button>
      </div>

      <div>
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🧾 Invoice Customization</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Control what shows on printed invoices — font size, paper width, what details to display.</p>
          <button class="btn btn-primary btn-block" id="openInvCustBtn">⚙️ Open Invoice Customizer</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>📱 QR Posters for Counter</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Print QR posters — customers scan with phone camera to view price list, track orders, or read reviews.</p>
          <button class="btn btn-primary btn-block" id="openQRBtn">📱 Generate QR Posters</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🤖 Auto-Reply Rules</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">When customer sends a message with trigger words, system suggests reply automatically.</p>
          <button class="btn btn-primary btn-block" id="openARBtn">🤖 Configure Auto-Reply</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🌐 Customer Portal Settings</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Configure what customers see on the portal page.</p>
          <button class="btn btn-primary btn-block" id="openPortalCfg">🌐 Configure Portal</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>📱 WhatsApp Templates</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Customize auto-prompted messages sent when order status changes.</p>
          <button class="btn btn-primary btn-block" id="openWaTplBtn">📱 Customize WhatsApp Templates</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>☁️ Google Drive Backup</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Auto-save backups to your personal Google Drive.</p>
          <button class="btn btn-primary btn-block" id="openGDriveBtn">☁️ Configure Google Drive</button>
          <div id="gdriveStatus" style="font-size:11px;color:var(--text-soft);margin-top:8px;text-align:center;"></div>
        </div>

        <div class="card" style="margin-bottom:20px;background:linear-gradient(135deg,#fef3c7 0%,#fffbeb 100%);border:2px solid #f59e0b;">
          <div class="card-header"><h3>🔑 Master Recovery Code <span class="badge" style="background:${s.masterRecoveryCode?'#10b981':'#ef4444'};color:#fff;">${s.masterRecoveryCode?'✅ SET':'⚠️ NOT SET'}</span></h3></div>
          <p style="color:#78350f;font-size:12px;margin-bottom:14px;">
            🔐 <b>CRITICAL FOR LAUNCH!</b> A special PIN that resets any user password if forgotten. Like a bank PIN — keep safe!
          </p>
          <button class="btn btn-warning btn-block" id="openMasterCodeBtn" style="background:#f59e0b;color:#fff;border:none;font-weight:700;">
            🔑 ${s.masterRecoveryCode?'Change':'Set Up'} Master Recovery Code
          </button>
          ${s.masterRecoveryCode ? `<small style="display:block;text-align:center;color:#78350f;margin-top:8px;">Set on: ${new Date(s.masterRecoveryCodeSetAt||Date.now()).toLocaleDateString()}</small>` : ''}
        </div>

        <div class="card" style="margin-bottom:20px;">
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Real-time sync via Firebase. Premium feature. Contact IT Department to enable.</p>
          <button class="btn btn-primary btn-block" id="openCloudBtn">🔄 Configure Cloud Sync (IT Admin)</button>
          <div id="cloudStatus" style="font-size:11px;color:var(--text-soft);margin-top:8px;text-align:center;"></div>
        </div>

        
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🔄 Cloud Sync (Multi-Device)</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Real-time sync via Firebase. Premium feature. Contact IT Department to enable.</p>
          <button class="btn btn-primary btn-block" id="openCloudBtn">🔄 Configure Cloud Sync (IT Admin)</button>
          <div id="cloudStatus" style="font-size:11px;color:var(--text-soft);margin-top:8px;text-align:center;"></div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🏢 Multi-Branch</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Manage multiple shop locations from one system.</p>
          <button class="btn btn-primary btn-block" data-page="branches">🏢 Manage Branches</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>🔒 Storage Persistence</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Prevent browser from auto-clearing your data. Critical for online use!</p>
          <button class="btn btn-primary btn-block" id="checkStorageBtn">🔒 Check Storage Status</button>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>📷 Photo Cleanup</h3></div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:10px;">Automatically delete photos from delivered orders to save browser storage.</p>
          <div class="form-row">
            <div class="field" style="margin:0;">
              <label>Retention (days after delivery)</label>
              <input type="number" id="sPhotoDays" value="${s.photoRetentionDays||30}" min="1" max="365"/>
            </div>
            <div class="field" style="margin:0;">
              <label>Auto-Cleanup</label>
              <select id="sPhotoAuto">
                <option value="true"  ${s.photoAutoCleanup!==false?'selected':''}>✅ Enabled</option>
                <option value="false" ${s.photoAutoCleanup===false?'selected':''}>❌ Disabled</option>
              </select>
            </div>
          </div>
          <button class="btn btn-warning btn-block" id="cleanupNowBtn" style="margin-top:10px;">🧹 Clean Up Now</button>
          <div id="photoStorageInfo" style="font-size:11px;color:var(--text-soft);margin-top:8px;text-align:center;"></div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><h3>💾 Backup & Restore</h3></div>
          <div style="padding:10px;background:var(--surface-alt);border-radius:8px;margin-bottom:14px;font-size:12px;">
            <b>Last Backup:</b> ${lastBackupTxt}<br>
            <b>Total Records:</b><br>
            • Orders: ${DB.all('orders').length}<br>
            • Customers: ${DB.all('customers').length}<br>
            • Products: ${DB.all('products').length}
          </div>
          <p style="color:var(--text-soft);font-size:12px;margin-bottom:14px;">Your data lives in your browser. <b>Always keep a recent backup!</b></p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-success btn-lg" id="exportBtn">📥 Download Backup</button>
            <label class="btn btn-secondary" style="cursor:pointer;text-align:center;">
              📤 Restore from Backup
              <input type="file" id="importFile" accept="application/json" style="display:none;"/>
            </label>
            <hr style="margin:8px 0;border:none;border-top:1px solid var(--border);"/>
            <button class="btn btn-danger" id="resetBtn">⚠️ Reset All Data</button>
          </div>
        </div>
      </div>
    </div>
  `;
  $('#app').innerHTML = renderLayout('settings', content);
  bindLayout();

  let pendingLogoDataUrl = null;
  $('#logoFile').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Logo must be under 2 MB','error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      pendingLogoDataUrl = reader.result;
      const prev = $('#logoPreview');
      if (prev.tagName === 'IMG') prev.src = pendingLogoDataUrl;
      else prev.outerHTML = `<img id="logoPreview" src="${pendingLogoDataUrl}" style="width:120px;height:120px;object-fit:contain;display:block;"/>`;
      toast('Logo loaded — click Save to apply','success');
    };
    reader.readAsDataURL(file);
  };

  $('#removeLogoBtn').onclick = () => {
    pendingLogoDataUrl = '';
    const prev = $('#logoPreview');
    prev.outerHTML = `<div id="logoPreview" style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:60px;">${$('#sLogo').value || '🧺'}</div>`;
  };

  $('#saveSetBtn').onclick = () => {
    promptPasswordModal('Unlock Settings Save', (pwd) => {
      let itPwd = window._IT_BRAND.pwd;
    if (pwd !== itPwd) {
        toast('Incorrect IT ADMIN Password!', 'error');
        return;
      }
      const patch = {
        shopName: $('#sName').value.trim(),
      logo: $('#sLogo').value.trim() || '🧺',
      tagline: $('#sTag').value.trim(),
      phone: $('#sPhone').value.trim(),
      facebook: ($('#sFb')?.value || '').trim(),
      whatsapp: ($('#sWa')?.value || '').trim(),
      currency: $('#sCurrency').value.trim() || 'Rs.',
      address: $('#sAddr').value.trim(),
      taxPercent: Math.max(0, +$('#sTax').value || 0),
      baseUrl: $('#sBase').value.trim(),
      invoiceFooter: $('#sFooter').value.trim(),
      loyaltyPrefix: ($('#sLoyPrefix').value || 'MRL').toUpperCase(),
      defaultLoyaltyDiscountPercent: Math.max(0, +$('#sLoyPct').value || 0),
      defaultDeliveryDays: +$('#sDeliveryDays').value || 2,
      autoBackupReminder: $('#sBackupReminder').value === 'true',
      photoRetentionDays: Math.max(1, +($('#sPhotoDays')?.value || 30)),
      photoAutoCleanup: ($('#sPhotoAuto')?.value || 'true') === 'true'
    };
    if (pendingLogoDataUrl !== null) patch.logoImage = pendingLogoDataUrl;
    DB.saveSettings(patch);
    toast('Settings saved','success');
    renderSettings();
    });
  };

  $('#exportBtn').onclick = doBackup;
  $('#openInvCustBtn').onclick = () => openInvoiceCustomizer();
  if ($('#openPortalCfg')) $('#openPortalCfg').onclick = () => openPortalConfigDialog();
  if ($('#openQRBtn')) $('#openQRBtn').onclick = () => openQRMenuPoster();
  if ($('#openARBtn')) $('#openARBtn').onclick = () => openAutoReplyEditor();
  if ($('#checkStorageBtn')) $('#checkStorageBtn').onclick = () => showStorageStatus();
  if ($('#openWaTplBtn'))  $('#openWaTplBtn').onclick  = () => openWhatsAppTemplateEditor();
  if ($('#openGDriveBtn')) $('#openGDriveBtn').onclick = () => {
    promptPasswordModal('Access GDrive Settings', (pwd) => {
      let itPwd = window._IT_BRAND.pwd;
      if (pwd === itPwd) openGDriveManager();
      else toast('Incorrect IT ADMIN Password!', 'error');
    });
  };
  if ($('#openMasterCodeBtn')) $('#openMasterCodeBtn').onclick = () => openMasterCodeSetup();
  if ($('#openCloudBtn')) $('#openCloudBtn').onclick  = () => {
    promptPasswordModal('Access Cloud Sync Settings', (pwd) => {
      let itPwd = window._IT_BRAND.pwd;
      if (pwd === itPwd) openCloudSyncManager();
      else toast('Incorrect IT ADMIN Password!', 'error');
    });
  };
  if ($('#openSubBtnTop')) $('#openSubBtnTop').onclick = () => openSubscriptionManager();
  // Status indicators
  const gdEl = $('#gdriveStatus');
  if (gdEl) {
    if (GDRIVE.isConnected()) {
      const last = localStorage.getItem(GDRIVE.LAST_BACKUP_KEY);
      gdEl.innerHTML = `✅ Connected${last?' • Last backup: '+new Date(last).toLocaleString():''}`;
    } else gdEl.innerHTML = GDRIVE.getClientId() ? '⚠️ Configured but not connected' : '❌ Not set up';
  }
  const cEl = $('#cloudStatus');
  if (cEl) {
    if (CLOUD.isEnabled() && CLOUD.isReady()) {
      const last = localStorage.getItem(CLOUD.LAST_SYNC_KEY);
      cEl.innerHTML = `✅ Active • Shop ID: <b>${CLOUD.getShopId()}</b>${last?' • Last sync: '+new Date(last).toLocaleString():''}`;
    } else cEl.innerHTML = CLOUD.getConfig() ? '⏸️ Configured but paused' : '❌ Not set up';
  }

  $('#importFile').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      confirmDialog('This will REPLACE all current data with the backup. Continue?', () => {
        try { DB.importJSON(reader.result); toast('Restored! Reloading...','success'); setTimeout(()=>location.reload(), 800); }
        catch(err){ toast('Invalid backup file','error'); }
      });
    };
    reader.readAsText(file);
  };

  $('#resetBtn').onclick = () => {
    confirmDialog('⚠️ This will DELETE ALL DATA and restore defaults. Continue?', () => {
      DB.reset(); toast('Reset complete','success'); setTimeout(()=>location.reload(), 800);
    });
  };
}

/* Global backup helper — usable from topbar / banner too */
function doBackup() {
  downloadFile(`mr-laundry-backup-${isoDay()}.json`, DB.exportJSON());
  localStorage.setItem('mrLaundryLastBackup', new Date().toISOString());
  toast('Backup downloaded','success');
}

function openSubscriptionManager() {
  promptPasswordModal('Access Subscription Settings', (pwd) => {
    const itPwd = window._IT_BRAND.pwd;
    if (pwd !== itPwd) {
      toast('Incorrect IT ADMIN Password!', 'error');
      return;
    }
    renderSubscriptionModal();
  });
}

/* ------------------------------------------------------------------
   Licence state helpers — one source of truth for the whole app.
   A licence is either:
     • LIFETIME  (lifetimeLicense === true)
     • DATED     (subscriptionExpiry is a future/past timestamp)
     • MISSING   (neither)  → treated as EXPIRED, never as unlimited
------------------------------------------------------------------ */
function getLicenseState() {
  const s = DB.settings();
  const lifetime = s.lifetimeLicense === true;
  const expiry = Number(s.subscriptionExpiry) || 0;
  const now = Date.now();
  const daysLeft = expiry ? Math.ceil((expiry - now) / 86400000) : null;
  let kind = 'missing';
  if (lifetime) kind = 'lifetime';
  else if (expiry) kind = expiry > now ? 'active' : 'expired';

  let updated = '';
  if (s.licenseUpdatedAt) {
    updated = `${new Date(s.licenseUpdatedAt).toLocaleString()}${s.licenseUpdatedBy ? ' by ' + s.licenseUpdatedBy : ''}`;
  }
  return { lifetime, expiry, daysLeft, kind, updated, lifetimeSince: s.lifetimeGrantedAt || null };
}

function applyLicense(patch, note) {
  const s = DB.settings();
  const user = (DB.currentUser() || {});
  const next = Object.assign({}, patch, {
    licenseUpdatedAt: new Date().toISOString(),
    licenseUpdatedBy: user.name || user.username || 'IT Admin'
  });
  DB.saveSettings(next);
  try {
    if (typeof logAction === 'function') {
      logAction('license.change', note || JSON.stringify(patch));
    }
  } catch (e) {}
  return getLicenseState();
}

function renderSubscriptionModal() {
  const st = getLicenseState();
  const s = DB.settings();

  let cardBg = '#f1f5f9', cardBorder = '#e2e8f0', headline = '', detail = '';

  if (st.kind === 'lifetime') {
    cardBg = '#ecfdf5'; cardBorder = '#a7f3d0';
    headline = '<span style="color:#15803d;">🌟 Lifetime Active</span>';
    detail = 'This installation never expires.';
  } else if (st.kind === 'active') {
    cardBg = '#eff6ff'; cardBorder = '#bfdbfe';
    headline = new Date(st.expiry).toLocaleString();
    detail = `<span style="color:${st.daysLeft <= 7 ? '#b91c1c' : '#15803d'};font-weight:700;">${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} remaining</span>`;
  } else if (st.kind === 'expired') {
    cardBg = '#fef2f2'; cardBorder = '#fecaca';
    headline = `<span style="color:#b91c1c;">Expired ${new Date(st.expiry).toLocaleDateString()}</span>`;
    detail = `<span style="color:#b91c1c;font-weight:700;">${Math.abs(st.daysLeft)} day${Math.abs(st.daysLeft) === 1 ? '' : 's'} ago — POS is blocked</span>`;
  } else {
    cardBg = '#fef2f2'; cardBorder = '#fecaca';
    headline = '<span style="color:#b91c1c;">⚠ No licence set</span>';
    detail = '<span style="color:#b91c1c;">The app is treated as expired until a licence is applied.</span>';
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  openModal(`
    <h3>📅 Subscription Management</h3>

    <div style="background:${cardBg};border:1px solid ${cardBorder};padding:12px;border-radius:8px;margin-bottom:14px;">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:700;">Current licence</div>
      <div style="font-size:15px;font-weight:800;margin:2px 0 4px;">${headline}</div>
      <div style="font-size:12.5px;margin-bottom:6px;">${detail}</div>
      <div style="font-size:11.5px;color:#64748b;line-height:1.6;">
        <div><b>Lifetime flag:</b> ${st.lifetime ? '✅ ON' : '⬜ OFF'} &nbsp;•&nbsp; <b>Expiry:</b> ${st.expiry ? new Date(st.expiry).toLocaleString() : 'not set'}</div>
        ${st.updated ? `<div><b>Last change:</b> ${escapeHtml(st.updated)}</div>` : ''}
      </div>
    </div>

    <p style="font-size:13px;margin-bottom:8px;font-weight:600;">Extend from today:</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      <button class="btn btn-secondary ext-btn" data-days="15">15 Days</button>
      <button class="btn btn-secondary ext-btn" data-days="30">1 Month</button>
      <button class="btn btn-secondary ext-btn" data-days="60">2 Months</button>
      <button class="btn btn-secondary ext-btn" data-days="180">6 Months</button>
      <button class="btn btn-secondary ext-btn" data-days="365">1 Year</button>
    </div>

    <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:170px;">
        <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">Or set an exact expiry date</label>
        <input type="date" id="subExactDate" min="${todayIso}" value="${st.expiry && st.kind !== 'lifetime' ? new Date(st.expiry).toISOString().slice(0,10) : todayIso}"
               style="width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:8px;"/>
      </div>
      <button class="btn btn-primary" id="subExactApply">Apply Date</button>
    </div>

    <div style="border-top:1px solid #e2e8f0;padding-top:14px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-warning ext-btn" data-days="lifetime" style="background:#f59e0b;color:#fff;border:none;flex:1;min-width:200px;font-weight:bold;">🌟 Grant Lifetime License</button>
      ${st.lifetime ? `<button class="btn btn-danger" id="subRevokeLifetime" style="flex:1;min-width:200px;font-weight:bold;">🚫 Revoke Lifetime License</button>` : ''}
    </div>

    <p style="font-size:13px;margin-bottom:8px;">Or upload a License File (.lic / .json):</p>
    <label class="btn btn-primary" style="display:inline-block;cursor:pointer;">
      📄 Upload License File
      <input type="file" id="licenseFile" accept=".lic,.json,application/json" style="display:none;"/>
    </label>

    <div class="modal-footer" style="margin-top:20px;">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, {
    onOpen(m) {

      /* ---- preset day buttons ---- */
      m.querySelectorAll('.ext-btn').forEach(b => {
        b.onclick = () => {
          const d = b.getAttribute('data-days');
          if (d === 'lifetime') {
            const st2 = applyLicense({
              lifetimeLicense: true,
              subscriptionExpiry: null,
              lifetimeGrantedAt: new Date().toISOString()
            }, 'lifetime granted');
            toast('🌟 Lifetime licence applied', 'success');
            afterLicenseChange(st2);
          } else {
            const days = parseInt(d, 10);
            const expiry = Date.now() + days * 86400000;
            const st2 = applyLicense({
              lifetimeLicense: false,
              subscriptionExpiry: expiry,
              lifetimeGrantedAt: null
            }, `${days} days granted (expires ${new Date(expiry).toLocaleDateString()})`);
            toast(`✅ Validity set: ${days} days (until ${new Date(expiry).toLocaleDateString()})`, 'success');
            afterLicenseChange(st2);
          }
        };
      });

      /* ---- exact date ---- */
      const applyBtn = m.querySelector('#subExactApply');
      if (applyBtn) applyBtn.onclick = () => {
        const v = m.querySelector('#subExactDate').value;
        if (!v) { toast('Pick a date first', 'error'); return; }
        // end of the chosen day, so "today" still gives you the whole day
        const expiry = new Date(v + 'T23:59:59').getTime();
        if (!expiry || isNaN(expiry)) { toast('Invalid date', 'error'); return; }
        const st2 = applyLicense({
          lifetimeLicense: false,
          subscriptionExpiry: expiry,
          lifetimeGrantedAt: null
        }, `exact expiry set to ${v}`);
        toast(`✅ Expires on ${new Date(expiry).toLocaleString()}`, 'success');
        afterLicenseChange(st2);
      };

      /* ---- revoke lifetime ---- */
      const rev = m.querySelector('#subRevokeLifetime');
      if (rev) rev.onclick = () => {
        confirmDialog('Turn OFF the lifetime licence? The app will then need a dated licence.', () => {
          // give them 30 days from now so revoking never locks them out instantly
          const expiry = Date.now() + 30 * 86400000;
          const st2 = applyLicense({
            lifetimeLicense: false,
            subscriptionExpiry: expiry,
            lifetimeGrantedAt: null
          }, `lifetime revoked — ${new Date(expiry).toLocaleDateString()} applied`);
          toast('Lifetime removed — 30 days applied so you can set the real date', 'warning');
          afterLicenseChange(st2);
        });
      };

      /* ---- licence file upload (was silently failing before) ---- */
      const fileInput = m.querySelector('#licenseFile');
      fileInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          let data;
          try {
            data = JSON.parse(String(reader.result));
          } catch (err) {
            toast('❌ Not a valid licence file (bad JSON)', 'error');
            return;
          }

          const days = parseInt(data && (data.extensionDays || data.days || data.durationDays), 10);
          const absolute = data && (data.expiry || data.expiresAt || data.licenseExpiry);

          let expiry = 0, label = '';
          if (days > 0) {
            expiry = Date.now() + days * 86400000;
            label = `${days} days`;
          } else if (absolute) {
            const t = typeof absolute === 'number' ? absolute : Date.parse(absolute);
            if (!t || isNaN(t)) { toast('❌ Licence file has an unreadable expiry', 'error'); return; }
            expiry = t;
            label = new Date(t).toLocaleString();
          } else {
            toast('❌ Licence file has no extensionDays / expiry', 'error');
            return;
          }

          if (expiry <= Date.now()) {
            toast('❌ That licence is already expired', 'error');
            return;
          }

          const st2 = applyLicense({
            lifetimeLicense: false,
            subscriptionExpiry: expiry,
            lifetimeGrantedAt: null
          }, `licence file applied — ${label}`);
          toast(`✅ Licence applied: ${label} (until ${new Date(expiry).toLocaleDateString()})`, 'success');
          afterLicenseChange(st2);
        };
        reader.onerror = () => toast('❌ Could not read that file', 'error');
        reader.readAsText(file);
      };
    }
  });
}

/* Re-render in place (no page reload) so the success toast stays visible
   and the IT admin immediately sees the new state. */
function afterLicenseChange(st) {
  try { closeModal(); } catch (e) {}
  if (typeof renderSettings === 'function' && app.current === 'settings') renderSettings();
  if (st && (st.kind === 'expired' || st.kind === 'missing')) {
    setTimeout(() => toast('⚠️ Licence is not active — POS is blocked', 'error'), 600);
  }
}
