/* ============================================================
   Google Drive Auto-Backup
   Uses Google Identity Services + Drive API (free).
   First-time: requires user to enter their own Google Cloud Client ID.
   ============================================================ */

const GDRIVE = {
  CLIENT_ID_KEY: 'mrLaundryGDriveClientId',
  TOKEN_KEY: 'mrLaundryGDriveToken',
  FOLDER_KEY: 'mrLaundryGDriveFolderId',
  LAST_BACKUP_KEY: 'mrLaundryGDriveLastBackup',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  FOLDER_NAME: 'Laundry POS POS Backups',

  isConfigured() { return !!localStorage.getItem(this.CLIENT_ID_KEY); },
  isConnected()  { return !!this.getToken(); },
  getClientId()  { return localStorage.getItem(this.CLIENT_ID_KEY) || ''; },
  setClientId(id){ localStorage.setItem(this.CLIENT_ID_KEY, id); },
  getToken()     {
    const raw = localStorage.getItem(this.TOKEN_KEY);
    if (!raw) return null;
    try {
      const t = JSON.parse(raw);
      if (t.expiresAt && t.expiresAt < Date.now()) return null;
      return t;
    } catch(e) { return null; }
  },
  setToken(token, expiresIn) {
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify({
      token, expiresAt: Date.now() + (expiresIn-60)*1000
    }));
  },
  disconnect() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.FOLDER_KEY);
  },

  /* Load Google Identity Services script */
  async loadGSI() {
    if (window.google?.accounts?.oauth2) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  /* Sign in with OAuth */
  async connect() {
    const clientId = this.getClientId();
    if (!clientId) throw new Error('Client ID not configured');
    await this.loadGSI();
    return new Promise((resolve, reject) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPE,
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else { this.setToken(resp.access_token, resp.expires_in||3600); resolve(resp); }
        }
      });
      tc.requestAccessToken({ prompt: 'consent' });
    });
  },

  async authedFetch(url, opts={}) {
    const t = this.getToken();
    if (!t) throw new Error('Not connected');
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = 'Bearer ' + t.token;
    const r = await fetch(url, opts);
    if (r.status === 401) { this.disconnect(); throw new Error('Token expired — please reconnect'); }
    return r;
  },

  /* Get or create backup folder */
  async ensureFolder() {
    const cached = localStorage.getItem(this.FOLDER_KEY);
    if (cached) return cached;
    // Search
    const q = encodeURIComponent(`name='${this.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const r = await this.authedFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    const data = await r.json();
    if (data.files && data.files.length) {
      localStorage.setItem(this.FOLDER_KEY, data.files[0].id);
      return data.files[0].id;
    }
    // Create
    const cr = await this.authedFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
    const folder = await cr.json();
    localStorage.setItem(this.FOLDER_KEY, folder.id);
    return folder.id;
  },

  /* Upload backup JSON */
  async uploadBackup() {
    if (!this.isConnected()) throw new Error('Not connected to Google Drive');
    const folderId = await this.ensureFolder();
    const filename = `mr-laundry-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    const content = DB.exportJSON();

    // Multipart upload
    const boundary = '-------MrLaundryBoundary' + Date.now();
    const metadata = { name: filename, parents: [folderId], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) + `\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      content + `\r\n--${boundary}--`;

    const r = await this.authedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    if (!r.ok) throw new Error('Upload failed: ' + r.status);
    const file = await r.json();
    localStorage.setItem(this.LAST_BACKUP_KEY, new Date().toISOString());
    return file;
  },

  /* List backup files */
  async listBackups() {
    const folderId = await this.ensureFolder();
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const r = await this.authedFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`);
    const data = await r.json();
    return data.files || [];
  },

  /* Download a backup */
  async downloadBackup(fileId) {
    const r = await this.authedFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return await r.text();
  },

  /* Delete old backups (keep last N) */
  async pruneOldBackups(keep) {
    const files = await this.listBackups();
    if (files.length <= keep) return 0;
    const toDel = files.slice(keep);
    for (const f of toDel) {
      try { await this.authedFetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method:'DELETE' }); }
      catch(e){}
    }
    return toDel.length;
  }
};

/* ===== UI: Google Drive Setup & Manager ===== */
function openGDriveManager() {
  const connected = GDRIVE.isConnected();
  const last = localStorage.getItem(GDRIVE.LAST_BACKUP_KEY);
  const clientId = GDRIVE.getClientId();
  const s = DB.settings();

  openModal(`
    <h3>☁️ Google Drive Backup</h3>
    <p class="sub">Auto-save backups to your personal Google Drive. Your data stays YOURS.</p>

    ${!clientId ? `
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
        ⚠️ <b>One-time setup required.</b> You need a free Google Cloud "Client ID" to connect.
        <button class="btn btn-primary btn-sm" id="setupGuideBtn" style="margin-top:8px;">📖 Show Setup Guide</button>
      </div>
    ` : ''}

    <div class="field">
      <label>Google Cloud OAuth Client ID</label>
      <input id="gdClientId" value="${escapeHtml(clientId)}" placeholder="xxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"/>
      <small style="color:var(--text-soft);">Looks like: <code>123456789012-abc...apps.googleusercontent.com</code></small>
    </div>

    <div style="padding:12px;background:${connected?'#d1fae5':'#fee2e2'};border-radius:8px;margin-bottom:14px;text-align:center;font-weight:600;">
      ${connected ? '✅ Connected to Google Drive' : '❌ Not connected'}
      ${last ? `<br><span style="font-size:11px;font-weight:400;">Last backup: ${new Date(last).toLocaleString()}</span>` : ''}
    </div>

    <div style="background:var(--surface-alt);border-radius:8px;padding:12px;margin-bottom:14px;">
      <div style="font-weight:700;margin-bottom:8px;">⚙️ Auto-Backup Settings</div>
      <div class="form-row">
        <div class="field" style="margin:0;">
          <label>Schedule</label>
          <select id="gdSchedule">
            <option value="off"    ${(s.gdriveSchedule||'daily')==='off'?'selected':''}>❌ Off (manual only)</option>
            <option value="daily"  ${(s.gdriveSchedule||'daily')==='daily'?'selected':''}>📅 Daily (once per day)</option>
            <option value="hourly" ${s.gdriveSchedule==='hourly'?'selected':''}>⏰ Every 4 hours</option>
            <option value="onclose" ${s.gdriveSchedule==='onclose'?'selected':''}>📕 On Day Close</option>
          </select>
        </div>
        <div class="field" style="margin:0;">
          <label>Keep Last N Backups</label>
          <input type="number" id="gdKeep" value="${s.gdriveKeepN||30}" min="5" max="365"/>
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      ${!connected ? `<button class="btn btn-primary btn-block" id="connectBtn">🔗 Connect to Google Drive</button>` : `
        <button class="btn btn-success btn-block" id="backupNowBtn">☁️ Backup Now</button>
        <button class="btn btn-secondary" id="listBtn">📋 View Cloud Backups</button>
        <button class="btn btn-warning" id="restoreBtn">📤 Restore from Cloud</button>
        <button class="btn btn-ghost btn-sm" id="disconnectBtn">🚪 Disconnect</button>
      `}
    </div>

    <div id="gdLog" style="margin-top:10px;font-size:12px;color:var(--text-soft);"></div>

    <div class="modal-footer">
      <button class="btn btn-primary" id="saveCfgBtn">💾 Save Settings</button>
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, { large: true, onOpen(m) {
    const log = (msg, type='') => {
      const colors = { error:'var(--danger)', success:'var(--success)', '':'var(--text-soft)' };
      $('#gdLog', m).innerHTML = `<div style="padding:8px;background:var(--surface-alt);border-radius:6px;color:${colors[type]};">${msg}</div>`;
    };

    $('#setupGuideBtn', m)?.addEventListener('click', () => { closeModal(); openGDriveSetupGuide(); });

    $('#saveCfgBtn', m).onclick = () => {
      const newId = $('#gdClientId', m).value.trim();
      if (newId !== clientId) GDRIVE.setClientId(newId);
      DB.saveSettings({
        gdriveSchedule: $('#gdSchedule', m).value,
        gdriveKeepN: Math.max(5, +$('#gdKeep', m).value || 30)
      });
      toast('Settings saved','success');
      closeModal();
    };

    $('#connectBtn', m)?.addEventListener('click', async () => {
      const id = $('#gdClientId', m).value.trim();
      if (!id) { toast('Enter your Client ID first','error'); return; }
      GDRIVE.setClientId(id);
      log('Connecting...');
      try {
        await GDRIVE.connect();
        log('✅ Connected!', 'success');
        if (typeof logAction === 'function') logAction('gdrive.connect', '');
        setTimeout(() => { closeModal(); openGDriveManager(); }, 1000);
      } catch(e) {
        log('❌ ' + e.message, 'error');
      }
    });

    $('#backupNowBtn', m)?.addEventListener('click', async () => {
      log('Uploading backup to Google Drive...');
      try {
        const file = await GDRIVE.uploadBackup();
        log(`✅ Uploaded: ${file.name}`, 'success');
        const removed = await GDRIVE.pruneOldBackups(+$('#gdKeep', m).value || 30);
        if (removed) log(`✅ Uploaded. Pruned ${removed} old backups.`, 'success');
        if (typeof logAction === 'function') logAction('gdrive.backup', file.name);
        toast('Backup uploaded to Google Drive','success');
      } catch(e) {
        log('❌ ' + e.message, 'error');
      }
    });

    $('#listBtn', m)?.addEventListener('click', async () => {
      log('Loading...');
      try {
        const files = await GDRIVE.listBackups();
        if (!files.length) { log('No backups found yet'); return; }
        $('#gdLog', m).innerHTML = `
          <div style="background:var(--surface-alt);border-radius:8px;padding:10px;max-height:240px;overflow-y:auto;">
            <div style="font-weight:700;margin-bottom:8px;">${files.length} backup(s) in Google Drive:</div>
            ${files.map(f => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
                <span>${escapeHtml(f.name)}</span>
                <span style="color:var(--text-soft);">${Math.round((f.size||0)/1024)} KB</span>
              </div>
            `).join('')}
          </div>
        `;
      } catch(e) { log('❌ ' + e.message, 'error'); }
    });

    $('#restoreBtn', m)?.addEventListener('click', async () => {
      log('Loading backup list...');
      try {
        const files = await GDRIVE.listBackups();
        if (!files.length) { log('No backups to restore'); return; }
        // Show file picker
        const html = files.slice(0,20).map((f,i) => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;">
            <input type="radio" name="bk" value="${f.id}" ${i===0?'checked':''}/>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${escapeHtml(f.name)}</div>
              <div style="font-size:11px;color:var(--text-soft);">${new Date(f.createdTime).toLocaleString()} • ${Math.round((f.size||0)/1024)} KB</div>
            </div>
          </label>
        `).join('');
        $('#gdLog', m).innerHTML = `
          <div style="background:#fee2e2;border:1px solid var(--danger);padding:8px;border-radius:6px;margin-bottom:8px;font-size:12px;color:#7f1d1d;">
            ⚠️ Restoring will REPLACE all your current data. Make a local backup first!
          </div>
          <div style="background:var(--surface-alt);border-radius:8px;padding:10px;max-height:220px;overflow-y:auto;">${html}</div>
          <button class="btn btn-danger btn-block" id="confirmRestoreBtn" style="margin-top:8px;">🔄 Restore Selected Backup</button>
        `;
        $('#confirmRestoreBtn', m).onclick = async () => {
          const sel = m.querySelector('input[name="bk"]:checked');
          if (!sel) return;
          confirmDialog('This will REPLACE all your current data. Continue?', async () => {
            try {
              const json = await GDRIVE.downloadBackup(sel.value);
              DB.importJSON(json);
              toast('Restored! Reloading...','success');
              setTimeout(() => location.reload(), 1000);
            } catch(e) { log('❌ ' + e.message, 'error'); }
          });
        };
      } catch(e) { log('❌ ' + e.message, 'error'); }
    });

    $('#disconnectBtn', m)?.addEventListener('click', () => {
      confirmDialog('Disconnect from Google Drive?', () => {
        GDRIVE.disconnect();
        toast('Disconnected','success');
        closeModal(); openGDriveManager();
      });
    });
  }});
}

function openGDriveSetupGuide() {
  openModal(`
    <h3>📖 Google Drive Setup Guide (One-Time, ~5 min)</h3>
    <p class="sub">You need a free "Client ID" from Google Cloud — this gives the app permission to save backups to your Drive.</p>

    <ol style="font-size:13px;line-height:1.8;padding-left:20px;">
      <li>Go to <a href="https://console.cloud.google.com/" target="_blank"><b>console.cloud.google.com</b></a> and sign in</li>
      <li>Click <b>"Select a project"</b> → <b>"New Project"</b> → name it <b>"Laundry POS POS"</b> → Create</li>
      <li>In the search bar type <b>"Google Drive API"</b> → Click on it → <b>Enable</b></li>
      <li>Left menu → <b>APIs & Services</b> → <b>OAuth consent screen</b>:
        <ul>
          <li>User Type: <b>External</b> → Create</li>
          <li>App name: <b>Laundry POS POS</b>, support email: your email</li>
          <li>Save and Continue through all steps</li>
          <li>Under "Test users" add your own Gmail address</li>
        </ul>
      </li>
      <li>Left menu → <b>APIs & Services</b> → <b>Credentials</b>:
        <ul>
          <li>Click <b>"+ Create Credentials"</b> → <b>"OAuth client ID"</b></li>
          <li>Application type: <b>Web application</b></li>
          <li>Name: <b>Laundry POS POS</b></li>
          <li>Under <b>"Authorized JavaScript origins"</b> add:
            <ul>
              <li><code>http://localhost</code></li>
              <li><code>${location.origin}</code></li>
              <li>Plus any URL where you'll host this</li>
            </ul>
          </li>
          <li>Click <b>Create</b></li>
        </ul>
      </li>
      <li>Copy the <b>Client ID</b> shown (ends with <code>.apps.googleusercontent.com</code>)</li>
      <li>Paste it into the Google Drive setup screen here</li>
      <li>Click <b>"Connect to Google Drive"</b> → sign in with your Gmail → grant permission</li>
      <li>Done! ✅ Now auto-backups will run on your schedule.</li>
    </ol>

    <div style="background:#dbeafe;padding:10px;border-radius:8px;font-size:12px;margin-top:10px;">
      💡 <b>Privacy:</b> Backups go to YOUR Google Drive only. Laundry POS POS never has access — only you do.
    </div>

    <div class="modal-footer">
      <button class="btn btn-primary" onclick="closeModal();openGDriveManager()">← Back to Setup</button>
    </div>
  `, { large: true });
}

/* ===== Auto-backup scheduler ===== */
(function gdriveAutoSchedule() {
  if (typeof DB === 'undefined') return;
  setTimeout(async () => {
    if (!GDRIVE.isConnected()) return;
    const s = DB.settings();
    const sched = s.gdriveSchedule || 'daily';
    if (sched === 'off' || sched === 'onclose') return;
    const last = localStorage.getItem(GDRIVE.LAST_BACKUP_KEY);
    const intervalMs = sched === 'hourly' ? 4*60*60*1000 : 24*60*60*1000;
    if (last && Date.now() - new Date(last).getTime() < intervalMs) return;
    try {
      await GDRIVE.uploadBackup();
      await GDRIVE.pruneOldBackups(s.gdriveKeepN || 30);
      console.log('[Laundry POS] Auto-backup to Google Drive complete');
    } catch(e) { console.warn('[Laundry POS] Auto-backup failed:', e.message); }
  }, 5000);
})();

/* Trigger on day close */
function triggerGDriveOnDayClose() {
  const s = DB.settings();
  if (s.gdriveSchedule !== 'onclose' || !GDRIVE.isConnected()) return;
  GDRIVE.uploadBackup().then(() => GDRIVE.pruneOldBackups(s.gdriveKeepN || 30))
    .then(() => toast('☁️ Backup uploaded to Google Drive','success'))
    .catch(e => console.warn('GDrive backup failed:', e));
}
