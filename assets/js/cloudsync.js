/* ============================================================
   CLOUD SYNC v4 — Chunked storage for unlimited data size
   - Splits data across multiple Firestore documents
   - Each table → its own doc; large tables → chunked further
   - Bypasses Firestore 1MB-per-doc limit
   - Maintains backward compat with old single-doc format
   - Bulletproof MERGE — no data loss
   ============================================================ */

const MAX_DOC_SIZE = 800000; // 800KB — safe margin under Firestore 1MB limit

/* Accept anything a user is likely to paste from the Firebase console:
     • plain JSON                      { "apiKey": "...", ... }
     • const firebaseConfig = {...};   (JS object, unquoted keys, single quotes)
     • firebase.initializeApp({...});
     • the whole SDK snippet (with imports), fenced in ``` marks
   No `new Function` in the common path, so it also works under a strict CSP. */
function parseFirebaseConfig(text) {
  let s = String(text || '').trim();
  if (!s) throw new Error('Empty config — paste your firebaseConfig object');

  // Strip markdown fences.
  s = s.replace(/^```(?:json|js|javascript)?\s*/i, '').replace(/```\s*$/, '').trim();

  /* Pull out the first balanced { ... } block starting at `start`. */
  function blockAt(from) {
    let depth = 0, quote = '', esc = false;
    for (let i = from; i < s.length; i++) {
      const c = s[i];
      if (quote) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === quote) quote = '';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return s.slice(from, i + 1); }
    }
    return null;
  }

  /* Turn a JS-ish object literal into JSON where possible. */
  function toObject(src) {
    try { return JSON.parse(src); } catch (e) {}
    try {
      const normalised = src
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        .replace(/'((?:\\.|[^'\\])*)'/g, '"$1"')
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(normalised);
    } catch (e) {}
    try { return (new Function('return (' + src + ')'))(); } catch (e) { return null; }
  }

  /* The full SDK snippet contains other objects (`import { initializeApp }`).
     Scan every { ... } block and keep the one that looks like a config. */
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const block = blockAt(i);
    if (!block) continue;
    const obj = toObject(block);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;

    const clean = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) clean[k] = v;
    }
    if (clean.apiKey || clean.projectId) return clean;
  }
  throw new Error('No firebaseConfig object found — copy the block that contains "apiKey" and "projectId".');
}

/* Stable per-install device ID */
function getDeviceId() {
  let id = localStorage.getItem('mrLaundryDeviceId');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
    localStorage.setItem('mrLaundryDeviceId', id);
  }
  return id;
}
function getDeviceLabel() {
  let label = localStorage.getItem('mrLaundryDeviceLabel');
  if (!label) {
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) label = '📱 Mobile';
    else if (/Mac/i.test(ua)) label = '💻 Mac';
    else if (/Windows/i.test(ua)) label = '🖥️ Windows PC';
    else label = '💻 Computer';
    localStorage.setItem('mrLaundryDeviceLabel', label);
  }
  return label;
}

const CLOUD = {
  CFG_KEY: 'mrLaundryFirebaseCfg',
  SHOP_KEY: 'mrLaundryShopId',
  ENABLED_KEY: 'mrLaundryCloudEnabled',
  LAST_SYNC_KEY: 'mrLaundryLastSync',

  _app: null, _db: null, _unsub: null,
  _syncing: false, _pendingPush: false,
  _suppressPush: false,
  _initialMergeDone: false,
  _initialSyncDone: false,
  _lastAppliedVersion: 0,
  _lastPushedJson: {},
  _toastDebounceTimer: null,
  /* Zero-touch auto-sync */
  _initialSyncPromise: null,
  _resolveInitialSync: null,
  _lastPullChanged: false,
  _autoSyncStarted: false,
  _lastAutoSyncAt: 0,
  _silentBusy: false,
  _syncState: 'idle',

  getConfig() {
    const raw = localStorage.getItem(this.CFG_KEY);
    if (raw) {
      try {
        const c = JSON.parse(raw);
        if (c && typeof c === 'object' && c.apiKey) return c;
      } catch(e) {}
    }
    // Optional hard-coded key in assets/js/cloud-autoconfig.js — only used
    // when nothing has been saved in Settings and the user hasn't cleared it.
    if (localStorage.getItem('mrLaundryCloudCfgCleared') !== 'true') {
      const auto = (typeof window !== 'undefined') ? window.CLOUD_AUTO_CONFIG : null;
      if (auto && auto.apiKey && auto.projectId) return auto;
    }
    return null;
  },
  setConfig(cfg) {
    localStorage.setItem(this.CFG_KEY, JSON.stringify(cfg));
    localStorage.removeItem('mrLaundryCloudCfgCleared');
    this._resetConnection();
  },
  clearConfig() {
    localStorage.removeItem(this.CFG_KEY);
    localStorage.removeItem(this.SHOP_KEY);
    localStorage.removeItem(this.LAST_SYNC_KEY);
    localStorage.setItem('mrLaundryCloudCfgCleared', 'true');
    this._resetConnection();
  },
  _resetConnection() {
    try { this.stop(); } catch (e) {}
    this._db = null; this._app = null; this._cfgKey = '';
    this._lastPushedJson = {}; this._lastPushedMeta = null;
  },
  getShopId() {
    const saved = localStorage.getItem(this.SHOP_KEY);
    if (saved) return saved;
    // Built-in Shop ID from cloud-autoconfig.js → works on a brand-new device.
    return (typeof window !== 'undefined' && window.CLOUD_AUTO_SHOP_ID) ? window.CLOUD_AUTO_SHOP_ID : '';
  },
  setShopId(id) { localStorage.setItem(this.SHOP_KEY, id); },
  isEnabled() {
    const v = localStorage.getItem(this.ENABLED_KEY);
    if (v !== null) return v === 'true';   // explicit user choice always wins
    // No choice yet on this device: auto-start when a config is built in.
    const auto = (typeof window !== 'undefined') && window.CLOUD_AUTO_ENABLE === true;
    return !!(auto && this.getConfig());
  },
  isAutoConfigured() {
    return !!(typeof window !== 'undefined' && window.CLOUD_AUTO_ENABLE === true
      && window.CLOUD_AUTO_CONFIG && window.CLOUD_AUTO_CONFIG.apiKey && !localStorage.getItem(this.CFG_KEY));
  },
  setEnabled(v) { localStorage.setItem(this.ENABLED_KEY, v?'true':'false'); },
  isReady() { return !!(this.getConfig() && this.getShopId()); },

  /* Called by DB.importJSON(): after a backup restore this device holds the
     correct data. Mark it so the initial cloud bootstrap PUSHES the backup
     instead of pulling older cloud records back over it. */
  onLocalImport() {
    localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
    localStorage.setItem('mrLaundryImportBaseline', new Date().toISOString());
    this._initialSyncDone = true;
    this._lastPushedJson = {};
    this._lastPushedMeta = null;
  },

  /* ============== ZERO-TOUCH AUTO SYNC ==============
     Goal: simply opening the website is enough. No daily merge / push / pull. */
  whenInitialSyncDone() {
    if (this._initialSyncDone) return Promise.resolve();
    if (!this._initialSyncPromise) {
      this._initialSyncPromise = new Promise(res => { this._resolveInitialSync = res; });
    }
    return this._initialSyncPromise;
  },

  _finishInitialSync() {
    this._initialSyncDone = true;
    this._initialMergeDone = true;
    this._lastAutoSyncAt = Date.now();
    if (this._resolveInitialSync) { this._resolveInitialSync(); this._resolveInitialSync = null; }
    try { this.startAutoSync(); } catch (e) {}
  },

  /* Small always-visible indicator so the client can SEE that data is fresh. */
  setStatus(state) {
    this._syncState = state || 'ok';
    const el = (typeof document !== 'undefined') ? document.getElementById('cloudSyncPill') : null;
    if (!el) return;
    const stamp = this._lastAutoSyncAt
      ? new Date(this._lastAutoSyncAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
      : '';
    const map = {
      syncing: ['☁️ Syncing…',            '#fef3c7', '#92400e'],
      ok:      ['☁️ Auto-sync ON' + (stamp ? ' · ' + stamp : ''), '#d1fae5', '#065f46'],
      offline: ['⚠️ Offline — retrying',   '#fee2e2', '#991b1b'],
      paused:  ['⚠️ Sync paused',          '#fee2e2', '#991b1b']
    };
    const [txt, bg, fg] = map[this._syncState] || map.ok;
    el.textContent = txt;
    el.style.background = bg;
    el.style.color = fg;
    el.title = 'Data automatically syncs on every open. Click for an instant check.';
  },

  /* Re-render ONLY when the pull really changed data, and never while the
     user is typing or has a form open. Otherwise a background sync would wipe
     an in-progress order. */
  refreshView() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    if (document.querySelector('.modal-backdrop, .portal-modal-backdrop')) return;
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    try {
      if (typeof app !== 'undefined' && app.current && app.current !== 'login'
          && typeof DB !== 'undefined' && DB.currentUser()) {
        app.go(app.current);
      }
    } catch (e) {}
    try { if (typeof refreshCloudStatus === 'function') refreshCloudStatus(); } catch (e) {}
    setTimeout(() => this.setStatus(this._syncState), 0);
  },

  async silentSync(reason) {
    if (!this.isEnabled() || !this.isReady() || !this._initialSyncDone || this._silentBusy) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    this._silentBusy = true;
    this.setStatus('syncing');
    try {
      await this.pullAndMerge();
      if (this._lastPullChanged) this.refreshView();
      this._lastAutoSyncAt = Date.now();
      this.setStatus('ok');
    } catch (e) {
      console.warn('[AutoSync] ' + (reason || '') + ' failed:', e);
      this.setStatus('offline');
    } finally {
      this._silentBusy = false;
    }
  },

  /* Re-check on tab focus / wake-from-sleep / reconnect, plus a 2-minute
     safety net. The realtime listener already covers normal remote changes. */
  startAutoSync() {
    if (this._autoSyncStarted || typeof document === 'undefined') return;
    this._autoSyncStarted = true;
    const maybe = (reason) => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - (this._lastAutoSyncAt || 0) < 20000) return;
      this.silentSync(reason);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') maybe('tab visible');
    });
    window.addEventListener('focus', () => maybe('focus'));
    window.addEventListener('online', () => maybe('online'));
    setInterval(() => maybe('timer'), 120000);
  },

  async loadSDK() {
    if (window.firebase?.firestore) return;
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js'
    ];
    for (const src of scripts) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
  },

  async init(force) {
    const cfg = this.getConfig();
    if (!cfg) throw new Error('Firebase not configured — add your key in Settings → Cloud Sync');
    if (!cfg.apiKey || !cfg.projectId) throw new Error('Saved config is missing apiKey or projectId');
    await this.loadSDK();

    const cfgKey = JSON.stringify(cfg);
    if (this._db && this._cfgKey === cfgKey && !force) return this._db;

    /* Firebase caches the FIRST config for the lifetime of the app. Without
       tearing the app down, a newly pasted key was silently ignored. */
    this._resetConnection();
    try {
      const apps = (window.firebase && firebase.apps) ? firebase.apps.slice() : [];
      for (const a of apps) { try { await a.delete(); } catch (e) {} }
    } catch (e) {}

    this._app = firebase.initializeApp(cfg);
    this._db = firebase.firestore();
    this._cfgKey = cfgKey;
    return this._db;
  },

  /* ============== MERGE LOGIC ============== */
  mergeData(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const merged = JSON.parse(JSON.stringify(local));

    for (const tbl of Object.keys(remote)) {
      const r = remote[tbl];
      const l = merged[tbl];

      if (Array.isArray(r)) {
        const byId = {};
        (l || []).forEach(rec => { if (rec && rec.id) byId[rec.id] = rec; });
        for (const rec of r) {
          if (!rec || !rec.id) continue;
          const existing = byId[rec.id];
          if (!existing) { byId[rec.id] = rec; continue; }
          const lTs = +new Date(existing.updatedAt || existing.createdAt || 0) || 0;
          const rTs = +new Date(rec.updatedAt || rec.createdAt || 0) || 0;
          if (rTs >= lTs) byId[rec.id] = rec;
        }
        merged[tbl] = Object.values(byId).filter(rec => !rec._deleted);
      } else if (tbl === 'settings' && typeof r === 'object') {
        const lTs = +new Date((l && l._settingsUpdatedAt) || 0) || 0;
        const rTs = +new Date((r && r._settingsUpdatedAt) || 0) || 0;
        if (rTs >= lTs) merged.settings = Object.assign({}, l || {}, r);
        else merged.settings = Object.assign({}, r || {}, l || {});
      } else if (tbl === '_counters' && typeof r === 'object') {
        merged._counters = Object.assign({}, l || {});
        for (const k of Object.keys(r || {})) {
          merged._counters[k] = Math.max(+(l?.[k] || 0), +(r[k] || 0));
        }
      } else if (l == null) {
        merged[tbl] = r;
      }
    }
    /* Locked portal payment details are not negotiable: an older cloud copy
       must never blank them or restore the previous shop's numbers. */
    if (typeof applyLockedPortalPayments === 'function') applyLockedPortalPayments(merged);
    return merged;
  },

  /* ============== PUSH (CHUNKED) ============== */
  async push() {
    if (this._suppressPush) return;
    if (!this.isEnabled() || !this.isReady()) return;
    if (this._syncing) { this._pendingPush = true; return; }
    this._syncing = true;
    try {
      const db = await this.init();
      const shopId = this.getShopId();
      const data = DB._data;
      const version = Date.now();
      const myDeviceId = getDeviceId();
      const username = DB.currentUser()?.username || 'unknown';
      const serverTs = firebase.firestore.FieldValue.serverTimestamp();

      const tablesRef = db.collection('shops').doc(shopId).collection('tables');
      const tableMeta = {};
      let totalSize = 0;

      // Write each table — single doc OR chunked
      for (const tbl of Object.keys(data)) {
        const json = JSON.stringify(data[tbl] ?? null);
        totalSize += json.length;
        
        // OPTIMIZATION: Only push if data actually changed to save Firebase Quota
        if (this._lastPushedJson[tbl] === json) {
          // Keep existing meta for the main doc
          if (this._lastPushedMeta && this._lastPushedMeta[tbl]) {
            tableMeta[tbl] = this._lastPushedMeta[tbl];
          } else {
             const num = Math.ceil(json.length / MAX_DOC_SIZE) || 1;
             tableMeta[tbl] = { chunks: num, size: json.length, skipped: true };
          }
          continue;
        }
        
        this._lastPushedJson[tbl] = json;

        if (json.length < MAX_DOC_SIZE) {
          tableMeta[tbl] = { chunks: 1, size: json.length };
          await tablesRef.doc(tbl).set({
            data: json,
            chunks: 1,
            version,
            deviceId: myDeviceId,
            updatedAt: serverTs
          });
        } else {
          const numChunks = Math.ceil(json.length / MAX_DOC_SIZE);
          tableMeta[tbl] = { chunks: numChunks, size: json.length };
          for (let i = 0; i < numChunks; i++) {
            const chunkData = json.substr(i * MAX_DOC_SIZE, MAX_DOC_SIZE);
            await tablesRef.doc(`${tbl}__c${i}`).set({
              data: chunkData,
              chunkIndex: i,
              totalChunks: numChunks,
              parent: tbl,
              version,
              deviceId: myDeviceId,
              updatedAt: serverTs
            });
          }
        }
      }

      this._lastPushedMeta = tableMeta;
      // Write main meta doc — triggers listen() on other devices
      await db.collection('shops').doc(shopId).set({
        tables: tableMeta,
        totalSize,
        version,
        deviceId: myDeviceId,
        deviceLabel: getDeviceLabel(),
        updatedBy: username,
        updatedAt: serverTs,
        _format: 'chunked-v1'
      });

      this._lastAppliedVersion = version;
      localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      console.log(`[CloudSync] Pushed ${Object.keys(tableMeta).length} tables (${Math.round(totalSize/1024)}KB)`);
    } finally {
      this._syncing = false;
      if (this._pendingPush) { this._pendingPush = false; setTimeout(() => this.push(), 200); }
    }
  },

  /* ============== PULL & MERGE (CHUNKED) ============== */
  async pullAndMerge() {
    const db = await this.init();
    const shopId = this.getShopId();
    const mainDoc = await db.collection('shops').doc(shopId).get();
    if (!mainDoc.exists) return false;

    const meta = mainDoc.data();
    let remoteData = null;

    // New chunked format
    if (meta._format === 'chunked-v1' && meta.tables) {
      remoteData = {};
      const tablesRef = db.collection('shops').doc(shopId).collection('tables');

      for (const tbl of Object.keys(meta.tables)) {
        const info = meta.tables[tbl];
        if (info.chunks === 1) {
          const doc = await tablesRef.doc(tbl).get();
          if (doc.exists) {
            try { remoteData[tbl] = JSON.parse(doc.data().data); }
            catch(e) { console.warn(`parse ${tbl}`, e); }
          }
        } else {
          // Reassemble chunks in order
          const chunks = [];
          for (let i = 0; i < info.chunks; i++) {
            const doc = await tablesRef.doc(`${tbl}__c${i}`).get();
            if (doc.exists) chunks[i] = doc.data().data;
          }
          if (chunks.length === info.chunks) {
            try { remoteData[tbl] = JSON.parse(chunks.join('')); }
            catch(e) { console.warn(`parse chunked ${tbl}`, e); }
          }
        }
      }
    } else if (meta.data) {
      // Legacy single-doc format
      try { remoteData = JSON.parse(meta.data); }
      catch(e) { console.warn('Bad remote data', e); return false; }
    } else {
      return false;
    }

    const beforeJson = JSON.stringify(DB._data);
    const merged = this.mergeData(DB._data, remoteData);
    this._lastPullChanged = JSON.stringify(merged) !== beforeJson;
    DB._data = merged;
    try { DB.normalizeCounters(); } catch (e) {}
    this._suppressPush = true;
    try { DB.save(); } finally { this._suppressPush = false; }
    this._lastAppliedVersion = meta.version || Date.now();
    localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
    return true;
  },

  /* ============== REAL-TIME LISTEN ============== */
  async listen() {
    if (this._unsub) this._unsub();
    const db = await this.init();
    const shopId = this.getShopId();
    const myDeviceId = getDeviceId();

    // Listen only on main meta doc — small, efficient
    this._unsub = db.collection('shops').doc(shopId).onSnapshot(async (doc) => {
      if (!doc.exists) return;
      const remote = doc.data();
      if (remote.deviceId === myDeviceId) return; // anti-echo
      if (remote.version && remote.version <= this._lastAppliedVersion) return; // dedupe

      try {
        await this.pullAndMerge();
        this._lastAutoSyncAt = Date.now();
        if (this._lastPullChanged) this.refreshView();
        this.setStatus('ok');
        clearTimeout(this._toastDebounceTimer);
        this._toastDebounceTimer = setTimeout(() => {
          if (typeof toast === 'function') {
            toast(`☁️ Synced from ${remote.deviceLabel || 'another device'} (${remote.updatedBy || 'user'})`, 'success');
          }
        }, 300);
      } catch(e) { console.warn('Sync merge failed:', e); }
    }, err => console.warn('Cloud listen error:', err));
  },

  /* Legacy force-pull (returns plain data, used by "Force Pull" button) */
  async pull() {
    const db = await this.init();
    const shopId = this.getShopId();
    const mainDoc = await db.collection('shops').doc(shopId).get();
    if (!mainDoc.exists) return null;
    const meta = mainDoc.data();
    if (meta._format === 'chunked-v1' && meta.tables) {
      const result = {};
      const tablesRef = db.collection('shops').doc(shopId).collection('tables');
      for (const tbl of Object.keys(meta.tables)) {
        const info = meta.tables[tbl];
        if (info.chunks === 1) {
          const doc = await tablesRef.doc(tbl).get();
          if (doc.exists) {
            try { result[tbl] = JSON.parse(doc.data().data); } catch(e){}
          }
        } else {
          const chunks = [];
          for (let i = 0; i < info.chunks; i++) {
            const doc = await tablesRef.doc(`${tbl}__c${i}`).get();
            if (doc.exists) chunks[i] = doc.data().data;
          }
          if (chunks.length === info.chunks) {
            try { result[tbl] = JSON.parse(chunks.join('')); } catch(e){}
          }
        }
      }
      return result;
    } else if (meta.data) {
      return JSON.parse(meta.data);
    }
    return null;
  },

  stop() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
  },

  /* First connection from a brand-new device: adopt the cloud dataset rather
     than pushing this browser's demo/seed records into the shared shop DB.
     (Without this, fresh installs could overwrite real data on first sync.) */
  async adoptCloudIfPresent() {
    const remote = await this.pull();
    if (!remote || typeof remote !== 'object' || !Object.keys(remote).length) return false;
    const merged = Object.assign({}, (typeof DB !== 'undefined' ? DB._data : {}) || {}, remote);
    this._suppressPush = true;
    try {
      if (typeof DB !== 'undefined') { DB._data = merged; DB.save(); }
    } finally { this._suppressPush = false; }
    localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
    return true;
  }
};

/* ============== AUTO-INIT (zero-touch) ==============
   Runs on EVERY page open. Pulls cloud data, pushes local changes, starts
   the realtime listener, refreshes the visible screen and shows a status
   pill. The client never has to press Merge / Push / Pull again. */
(function cloudAutoInit() {
  if (typeof DB === 'undefined') return;
  /* Short delay so the first paint happens instantly; login waits for the
     result via CLOUD.whenInitialSyncDone(). */
  setTimeout(async () => {
    if (!(CLOUD.isEnabled() && CLOUD.isReady())) {
      CLOUD.setStatus('paused');
      if (CLOUD.isReady() && !CLOUD.isEnabled()) {
        showCloudRecoveryPrompt('Cloud Sync is paused. Re-enable to sync your data?');
      }
      CLOUD._finishInitialSync();
      return;
    }
    CLOUD.setStatus('syncing');
    try {
      await CLOUD.init();
      /* A backup was just restored → this device is the source of truth.
         Publish it to the cloud instead of adopting older cloud data. */
      if (localStorage.getItem('mrLaundryImportBaseline')) {
        localStorage.removeItem('mrLaundryImportBaseline');
        CLOUD._lastPushedJson = {};
        CLOUD._lastPushedMeta = null;
        await CLOUD.push();
        await CLOUD.listen();
        CLOUD._finishInitialSync();
        CLOUD.refreshView();
        console.log('[Laundry POS] Restored backup published to cloud');
        return;
      }
      /* A brand-new device with the built-in config must ADOPT the existing
         cloud data, not push its local demo/seed records over the shop DB. */
      const firstRun = !localStorage.getItem(CLOUD.LAST_SYNC_KEY);
      let adopted = false;
      if (firstRun && CLOUD.isAutoConfigured()) {
        try { adopted = await CLOUD.adoptCloudIfPresent(); }
        catch (e) { console.warn('First-run cloud adopt skipped:', e); }
      }
      if (!adopted) await CLOUD.pullAndMerge();
      await CLOUD.push();
      await CLOUD.listen();
      CLOUD._finishInitialSync();
      CLOUD.setStatus('ok');
      /* THIS was the missing piece: the startup pull updated DB._data but the
         already-rendered page kept showing stale local data, so users pressed
         "Merge Now" every day just to reload. */
      if (adopted || CLOUD._lastPullChanged) CLOUD.refreshView();
      console.log('[Laundry POS] Auto sync complete on open'
        + (adopted ? ' (adopted cloud data on first run)' : ''));
      setTimeout(() => {
        if (typeof toast === 'function') toast('☁️ Data up to date — auto sync ON', 'success');
      }, 1200);
    } catch(e) {
      console.warn('Cloud init failed:', e);
      CLOUD._finishInitialSync();   // don't leave login waiting
      CLOUD.setStatus('offline');
      showCloudRecoveryPrompt('Cloud sync failed to start: ' + e.message);
    }
  }, 600);
})();

function showCloudRecoveryPrompt(msg) {
  if (typeof openModal !== 'function') return;
  if (sessionStorage.getItem('mrLaundryCloudPrompted')) return;
  sessionStorage.setItem('mrLaundryCloudPrompted', '1');
  setTimeout(() => {
    openModal('<div style="text-align:center;padding:20px;">' +
      '<div style="font-size:60px;margin-bottom:14px;">☁️</div>' +
      '<h3 style="margin-bottom:10px;">Cloud Sync Needs Attention</h3>' +
      '<p style="color:var(--text-soft);margin-bottom:16px;font-size:14px;">' + escapeHtml(msg) + '</p>' +
      '<p style="font-size:13px;color:var(--text-soft);margin-bottom:16px;">Your data is safe — we just need to re-connect to your cloud database.</p>' +
      '<div style="display:flex;gap:8px;justify-content:center;">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Later</button>' +
      '<button class="btn btn-primary" onclick="closeModal();reconnectCloudSync();">🔄 Re-Enable Sync</button>' +
      '</div></div>');
  }, 2000);
}

async function reconnectCloudSync() {
  if (!CLOUD.isReady()) {
    if (typeof toast === 'function') toast('No saved config. Please go to Settings.', 'error');
    if (typeof app !== 'undefined') app.go('settings');
    return;
  }
  if (typeof toast === 'function') toast('Re-connecting...', 'success');
  try {
    await CLOUD.init();
    CLOUD.setEnabled(true);
    await CLOUD.pullAndMerge();
    await CLOUD.push();
    await CLOUD.listen();
    CLOUD._initialSyncDone = true;
    if (typeof toast === 'function') toast('✅ Cloud sync re-enabled!', 'success');
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    if (typeof toast === 'function') toast('Failed: ' + e.message, 'error');
  }
}

/* ============== HOOK DB OPERATIONS ============== */
(function hookDB() {
  if (typeof DB === 'undefined') return;
  const origInsert = DB.insert?.bind(DB);
  const origUpdate = DB.update?.bind(DB);
  const origRemove = DB.remove?.bind(DB);

  if (origInsert) {
    DB.insert = function(table, rec) {
      rec = rec || {};
      const stamp = new Date().toISOString();
      if (!rec.updatedAt) rec.updatedAt = stamp;
      if (!rec.createdAt) rec.createdAt = stamp;
      return origInsert(table, rec);
    };
  }
  if (origUpdate) {
    DB.update = function(table, id, patch) {
      patch = patch || {};
      patch.updatedAt = new Date().toISOString();
      return origUpdate(table, id, patch);
    };
  }
  if (origRemove) {
    DB.remove = function(table, id) {
      const rows = DB._data[table] || [];
      const i = rows.findIndex(r => r.id === id);
      if (i === -1) return false;
      // Keep the original fields (esp. invoiceNo / claimNo / poNo) on the
      // tombstone, otherwise deleting the newest record lets its number be
      // handed out again after a restore or a cloud merge.
      rows[i] = Object.assign({}, rows[i], { _deleted: true, updatedAt: new Date().toISOString() });
      DB.save();
      return true;
    };
  }

  const origAll = DB.all?.bind(DB);
  const origGet = DB.get?.bind(DB);
  if (origAll) {
    DB.all = function(table) {
      const rows = origAll(table) || [];
      return rows.filter(r => r && !r._deleted);
    };
  }
  if (origGet) {
    DB.get = function(table, id) {
      const r = origGet(table, id);
      return (r && r._deleted) ? undefined : r;
    };
  }

  const origSave = DB.save.bind(DB);
  let pushTimer = null;
  DB.save = function() {
    origSave();
    localStorage.setItem('mrLaundryLocalVersion', Date.now());
    if (CLOUD._suppressPush) return;
    if (!CLOUD.isEnabled() || !CLOUD.isReady()) return;
    /* A fresh device must PULL first. Without this guard the 1.5s auto-push
       beats the 2.5s initial sync and overwrites the shop's real cloud data
       with this browser's demo/seed records. */
    if (!CLOUD._initialSyncDone) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      CLOUD.push().catch(e => console.warn('Push failed:', e));
    }, 1500);
  };
})();

/* ============== UI ============== */

/* Status line under the Settings button. Updates EVERY status element, so a
   duplicate / stale card can never show the wrong state again. */
function cloudStatusHtml() {
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (v) => String(v == null ? '' : v);
  const cfg = CLOUD.getConfig();
  if (CLOUD.isEnabled() && CLOUD.isReady()) {
    const last = localStorage.getItem(CLOUD.LAST_SYNC_KEY);
    return `✅ Active • Project: <b>${esc(cfg && cfg.projectId || '—')}</b> • Shop ID: <b>${esc(CLOUD.getShopId())}</b>`
      + (last ? ` • Last sync: ${esc(new Date(last).toLocaleString())}` : '');
  }
  if (cfg) return '⏸️ Firebase key saved — sync paused (open Configure to enable)';
  return '❌ No Firebase key set — click Configure to add one';
}
/* Tiny always-visible "auto sync" pill in the top bar. Clicking it does an
   instant check — it is NOT a daily requirement, just a reassurance. */
function cloudSyncPillHtml() {
  if (typeof CLOUD === 'undefined' || !CLOUD.isReady()) return '';
  const on = CLOUD.isEnabled();
  return `<button type="button" id="cloudSyncPill" title="Data auto-syncs on every open. Click for an instant check." style="border:0;border-radius:20px;padding:5px 12px;font-size:11.5px;font-weight:800;cursor:pointer;white-space:nowrap;background:${on?'#d1fae5':'#fee2e2'};color:${on?'#065f46':'#991b1b'};">${on?'☁️ Auto-sync ON':'⚠️ Sync paused'}</button>`;
}

function refreshCloudStatus() {
  try {
    document.querySelectorAll('.cloud-status, #cloudStatus').forEach(el => el.innerHTML = cloudStatusHtml());
  } catch (e) {}
}

function openCloudSyncManager(prefill) {
  const cfg = CLOUD.getConfig();
  const shopId = CLOUD.getShopId();
  const enabled = CLOUD.isEnabled();
  const lastSync = localStorage.getItem(CLOUD.LAST_SYNC_KEY);
  const deviceId = getDeviceId();
  const deviceLabel = getDeviceLabel();
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (v) => String(v == null ? '' : v);
  const cfgText = (typeof prefill === 'string')
    ? prefill
    : (cfg ? JSON.stringify(cfg, null, 2) : '');
  const maskedKey = (cfg && cfg.apiKey)
    ? esc(String(cfg.apiKey).slice(0, 6) + '…' + String(cfg.apiKey).slice(-4))
    : '—';
  const autoCfg = (typeof window !== 'undefined') ? window.CLOUD_AUTO_CONFIG : null;
  const hasLocalOverride = !!localStorage.getItem(CLOUD.CFG_KEY);
  const usingBuiltIn = !!(autoCfg && autoCfg.apiKey && !hasLocalOverride
                          && localStorage.getItem('mrLaundryCloudCfgCleared') !== 'true');

  openModal(`
    <h3>☁️ Cloud Sync (Multi-Device)</h3>
    <p class="sub">Real-time sync via Firebase Firestore. Paste your <b>firebaseConfig</b> below to add a new key or replace the existing one.</p>

    <div style="background:var(--surface-alt);padding:10px;border-radius:8px;font-size:12px;margin-bottom:14px;line-height:1.7;">
      <b>Current project:</b> ${cfg ? esc(cfg.projectId || 'unknown') : '❌ none'}<br>
      <b>API key:</b> <code>${maskedKey}</code> &nbsp;•&nbsp; <b>Shop ID:</b> ${shopId ? esc(shopId) : '❌ not set'}<br>
      <b>Status:</b> ${enabled ? '✅ Sync ON' : '⏸️ Sync OFF'} &nbsp;•&nbsp; ${lastSync ? '🔄 Last sync: ' + esc(new Date(lastSync).toLocaleString()) : '⚠️ Never synced'}<br>
      <b>Config source:</b> ${usingBuiltIn ? '✅ Built into the website (new devices connect automatically)' : (hasLocalOverride ? '💾 Saved in this browser (Settings)' : '⚠️ No config')}<br>
      📱 This device: <b>${esc(deviceLabel)}</b> <code style="font-size:10px;">${esc(deviceId)}</code>
    </div>

    <div class="field">
      <label>Firebase Config / API Key</label>
      <textarea id="fbCfg" rows="9" spellcheck="false" placeholder='{ "apiKey": "AIza...", "authDomain": "my-project.firebaseapp.com", "projectId": "my-project", "appId": "1:...:web:..." }' style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-family:monospace;font-size:11px;">${esc(cfgText)}</textarea>
      <small style="display:block;color:var(--text-soft);margin-top:6px;line-height:1.5;">
        Paste the whole <code>firebaseConfig</code> object from Firebase Console → Project settings → Your apps
        (<code>const firebaseConfig = {...};</code> works too). To replace only the key, edit the <code>apiKey</code> line
        above — or paste just the new <code>AIza…</code> key — then click <b>Save / Replace Firebase Key</b>.
        Stored locally in this browser.
      </small>
      <div style="padding:8px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:12px;color:#78350f;margin-top:8px;">
        ⚠️ <b>Do NOT paste Firestore security rules here.</b> Those go in the Firebase Console →
        <b>Rules</b> tab. This box needs the object with <code>"apiKey"</code> and <code>"projectId"</code>.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button type="button" class="btn btn-secondary btn-sm" id="findCfgBtn">📍 Where do I find firebaseConfig?</button>
        ${cfg ? `<button type="button" class="btn btn-ghost btn-sm" id="restoreCfgBtn">🔄 Restore saved key</button>` : ''}
        ${(autoCfg && autoCfg.apiKey && hasLocalOverride) ? `<button type="button" class="btn btn-ghost btn-sm" id="resetToBuiltInBtn">↩️ Use built-in config</button>` : ''}
      </div>
    </div>

    <div class="form-row">
      <div class="field">
        <label>Shop ID (unique to your business)</label>
        <input id="shopId" value="${esc(shopId)}" placeholder="mr-laundry-main-branch"/>
        <small style="color:var(--text-soft);">⚠️ All devices MUST use the SAME Shop ID</small>
      </div>
      <div class="field">
        <label>Sync status</label>
        <div style="padding:10px;background:${enabled ? '#d1fae5' : '#fee2e2'};border-radius:8px;text-align:center;font-weight:700;">
          ${enabled ? '✅ Sync ON' : '❌ Sync OFF'}
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
      <button type="button" class="btn btn-primary btn-block" id="saveCfgBtn">💾 Save / Replace Firebase Key</button>
      ${!enabled ? `
        <button type="button" class="btn btn-success btn-block" id="enableBtn">✅ Save &amp; Enable Cloud Sync</button>
      ` : `
        <div style="background:#d1fae5;border-left:4px solid #10b981;padding:12px;border-radius:8px;font-size:12.5px;line-height:1.6;color:#065f46;">
          ✅ <b>Auto Sync ON — ab roz kuch karne ki zarurat nahi.</b><br>
          Website kholte hi cloud se data apne aap aa jata hai, har change apne aap push hota hai,
          aur doosre system ki tabdeeliyan realtime mil jati hain. Tab dubara kholne par bhi
          khud hi check ho jata hai.
          <div style="margin-top:6px;font-size:11px;opacity:.85;">Last sync: ${esc(lastSync ? new Date(lastSync).toLocaleString() : 'just now')}</div>
        </div>
        <details style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:4px;">
          <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text-soft);">⚙️ Advanced / Troubleshooting (manual controls)</summary>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
            <button type="button" class="btn btn-success" id="mergeNowBtn">🔄 Merge Now (Pull + Push)</button>
            <button type="button" class="btn btn-primary" id="pushNowBtn">⬆️ Force Push This Device → Cloud</button>
            <button type="button" class="btn btn-warning" id="pullNowBtn">⬇️ Force Pull Cloud → This Device (OVERWRITE)</button>
            <button type="button" class="btn btn-danger" id="disableBtn">⏸️ Pause Cloud Sync</button>
          </div>
        </details>
      `}
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" id="testCfgBtn" style="flex:1;min-width:140px;">🔌 Test Connection</button>
        <button type="button" class="btn btn-ghost" id="firebaseGuideBtn" style="flex:1;min-width:120px;">📖 Setup Guide</button>
        <button type="button" class="btn btn-danger" id="clearCfgBtn" style="flex:1;min-width:120px;">🗑️ Remove Key</button>
      </div>
    </div>

    <div id="syncLog" style="margin-top:10px;font-size:12px;"></div>

    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, { large: true, onOpen(m) {
    const log = (msg, type = '') => {
      const colors = { error: 'var(--danger)', success: 'var(--success)', '': 'var(--text-soft)' };
      const box = $('#syncLog', m);
      if (box) box.innerHTML = `<div style="padding:8px;background:var(--surface-alt);border-radius:6px;color:${colors[type] || colors['']};">${esc(msg)}</div>`;
    };
    const logHtml = (html) => {
      const box = $('#syncLog', m);
      if (box) box.innerHTML = html;
    };

    /* The most common mistake: pasting the Firestore RULES (from the Rules
       tab) into this box instead of the web app's firebaseConfig. */
    const looksLikeRules = (raw) =>
      /rules_version|service\s+cloud\.firestore|allow\s+read,\s*write/i.test(raw);

    const showRulesMistake = () => {
      logHtml(`
        <div style="padding:10px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;color:#b91c1c;line-height:1.6;font-size:12.5px;">
          ❌ <b>Wrong block pasted — these are Firestore SECURITY RULES.</b><br>
          They belong in <b>Firebase Console → Firestore Database → Rules</b> (then click <b>Publish</b>).<br>
          In THIS box you need the <code>firebaseConfig</code> object containing
          <code>apiKey</code>, <code>projectId</code>, <code>appId</code> … from
          <b>Project settings → Your apps → SDK setup and configuration</b>.<br>
          <button type="button" class="btn btn-primary btn-sm" id="rulesHelpBtn" style="margin-top:8px;">📍 Show me exactly where to find it</button>
        </div>`);
      $('#rulesHelpBtn', m)?.addEventListener('click', () => openFirebaseConfigHelp());
    };

    const readInputs = () => {
      const raw  = ($('#fbCfg', m)?.value || '').trim();
      const shop = ($('#shopId', m)?.value || '').trim();
      if (!raw)  throw new Error('Paste your Firebase config into the box first');
      if (looksLikeRules(raw)) {
        const err = new Error('Those are Firestore security rules, not a firebaseConfig object.');
        err.isRules = true;
        throw err;
      }
      if (!shop) throw new Error('Enter a Shop ID (use the SAME one on every device)');

      // Convenience: if only an "AIza…" API key is pasted, keep the rest of
      // the saved config and just swap the key.
      let parsed;
      if (!raw.includes('{') && /^AIza[0-9A-Za-z_-]{10,}$/.test(raw)) {
        const old = CLOUD.getConfig();
        if (!old) throw new Error('No existing config to update — paste the full firebaseConfig object');
        parsed = Object.assign({}, old, { apiKey: raw });
      } else {
        parsed = parseFirebaseConfig(raw);
      }
      if (!parsed.apiKey || !parsed.projectId) throw new Error('Invalid config — missing apiKey or projectId');
      return { parsed, shop };
    };

    const restartSyncIfOn = async () => {
      if (CLOUD.isEnabled() && CLOUD.isReady()) await CLOUD.listen();
    };

    /* Save the key, re-init Firebase with the NEW config, and (optionally)
       activate sync. Also fixes the old bug where push() ran before
       setEnabled(true) and therefore silently did nothing. */
    const saveKey = async (activate) => {
      let parsed, shop;
      try { ({ parsed, shop } = readInputs()); }
      catch (e) { if (e.isRules) showRulesMistake(); else log('❌ ' + e.message, 'error'); return false; }

      const wasOn = CLOUD.isEnabled();
      try {
        log('💾 Saving Firebase key…');
        CLOUD.setConfig(parsed);
        CLOUD.setShopId(shop);
        if (activate) CLOUD.setEnabled(true);

        log('🔌 Connecting to project ' + parsed.projectId + '…');
        await CLOUD.init(true);          // force re-init so the new key is used

        if (activate || wasOn) {
          let adopted = false;
          if (!localStorage.getItem(CLOUD.LAST_SYNC_KEY)) {
            log('🔄 First connection — loading existing shop data…');
            try { adopted = await CLOUD.adoptCloudIfPresent(); } catch (e) {}
          }
          if (!adopted) {
            log('🔄 Merging existing cloud data…');
            await CLOUD.pullAndMerge();
          }
          log('⬆️ Pushing local data…');
          await CLOUD.push();
          CLOUD._initialSyncDone = true;
          await restartSyncIfOn();
        }
        CLOUD._initialSyncDone = true;
        refreshCloudStatus();
        if (typeof logAction === 'function') logAction(activate ? 'cloud.enable' : 'cloud.keyChange', parsed.projectId);
        log('✅ ' + (activate ? 'Cloud Sync is ON' : 'New Firebase key saved') + ' — project ' + parsed.projectId, 'success');
        if (typeof toast === 'function') toast(activate ? '✅ Cloud Sync enabled' : '✅ Firebase key saved', 'success');
        setTimeout(() => {
          closeModal();
          if (activate) { try { location.reload(); } catch (e) {} }
          else openCloudSyncManager();
        }, 1400);
        return true;
      } catch (e) {
        log('❌ ' + (e && e.message ? e.message : String(e)), 'error');
        return false;
      }
    };

    $('#saveCfgBtn', m)?.addEventListener('click', () => saveKey(false));
    $('#enableBtn',  m)?.addEventListener('click', () => saveKey(true));

    $('#testCfgBtn', m)?.addEventListener('click', async () => {
      let parsed, shop;
      try { ({ parsed, shop } = readInputs()); }
      catch (e) { if (e.isRules) showRulesMistake(); else log('❌ ' + e.message, 'error'); return; }
      try {
        log('🔌 Testing connection…');
        CLOUD.setConfig(parsed);
        CLOUD.setShopId(shop);
        const db = await CLOUD.init(true);
        await db.collection('shops').doc(shop).get();
        refreshCloudStatus();
        log('✅ Connected to Firestore — project ' + parsed.projectId + ' is reachable.', 'success');
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        if (/permission|PERMISSION_DENIED|insufficient/i.test(msg)) {
          logHtml(`
            <div style="padding:10px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;color:#b91c1c;line-height:1.6;font-size:12.5px;">
              ❌ <b>Firestore denied the request.</b> Your database rules are still locked
              (<code>allow read, write: if false;</code>). Paste the rules from the Setup Guide into
              <b>Firebase Console → Firestore Database → Rules</b>, click <b>Publish</b>, then test again.<br>
              <button type="button" class="btn btn-primary btn-sm" id="permHelpBtn" style="margin-top:8px;">📖 Open Rules Guide</button>
            </div>`);
          $('#permHelpBtn', m)?.addEventListener('click', () => { closeModal(); openFirebaseSetupGuide(); });
        } else {
          log('❌ Connection failed: ' + msg + ' — check the key, Firestore rules and your internet connection.', 'error');
        }
      } finally {
        try { await restartSyncIfOn(); } catch (e) {}
      }
    });

    $('#clearCfgBtn', m)?.addEventListener('click', () => {
      confirmDialog('Remove the saved Firebase key and stop Cloud Sync on this device? Your local data is NOT deleted.', () => {
        CLOUD.setEnabled(false);
        CLOUD.clearConfig();
        refreshCloudStatus();
        if (typeof toast === 'function') toast('Firebase key removed', 'success');
        setTimeout(() => { closeModal(); openCloudSyncManager(); }, 50);
      });
    });

    $('#firebaseGuideBtn', m)?.addEventListener('click', () => { closeModal(); openFirebaseSetupGuide(); });
    $('#findCfgBtn', m)?.addEventListener('click', () => { closeModal(); openFirebaseConfigHelp(); });
    $('#resetToBuiltInBtn', m)?.addEventListener('click', () => {
      confirmDialog('Discard the key saved in this browser and go back to the built-in config?', () => {
        localStorage.removeItem(CLOUD.CFG_KEY);
        localStorage.removeItem(CLOUD.SHOP_KEY);
        localStorage.removeItem(CLOUD.ENABLED_KEY);
        localStorage.removeItem(CLOUD.LAST_SYNC_KEY);
        localStorage.removeItem('mrLaundryCloudCfgCleared');
        CLOUD.setEnabled(false); CLOUD.stop(); CLOUD._resetConnection();
        CLOUD.setEnabled(true);
        refreshCloudStatus();
        if (typeof toast === 'function') toast('✅ Back to the built-in config', 'success');
        setTimeout(() => { closeModal(); openCloudSyncManager(); }, 50);
      });
    });
    $('#restoreCfgBtn', m)?.addEventListener('click', () => {
      const saved = CLOUD.getConfig();
      if (!saved) { log('No saved key to restore', 'error'); return; }
      $('#fbCfg', m).value = JSON.stringify(saved, null, 2);
      $('#shopId', m).value = CLOUD.getShopId();
      log('✅ Restored the saved firebaseConfig — you can edit it or click Test Connection.', 'success');
    });

    $('#mergeNowBtn', m)?.addEventListener('click', async () => {
      log('Merging…');
      try {
        await CLOUD.pullAndMerge();
        await CLOUD.push();
        log('✅ Merge complete. Reloading…', 'success');
        setTimeout(() => { try { location.reload(); } catch (e) {} }, 1000);
      } catch (e) { log('❌ ' + e.message, 'error'); }
    });

    $('#pushNowBtn', m)?.addEventListener('click', async () => {
      log('Pushing (chunked)…');
      try { await CLOUD.push(); log('✅ Pushed to cloud', 'success'); }
      catch (e) { log('❌ ' + e.message, 'error'); }
    });

    $('#pullNowBtn', m)?.addEventListener('click', () => {
      confirmDialog('FORCE Pull will OVERWRITE local data with cloud. You probably want "Merge Now" instead. Continue?', async () => {
        try {
          const remote = await CLOUD.pull();
          if (!remote) { log('No data in cloud yet', 'error'); return; }
          DB._data = remote; DB.save();
          if (typeof toast === 'function') toast('Pulled from cloud. Reloading…', 'success');
          setTimeout(() => { try { location.reload(); } catch (e) {} }, 1000);
        } catch (e) { log('❌ ' + e.message, 'error'); }
      });
    });

    $('#disableBtn', m)?.addEventListener('click', () => {
      CLOUD.setEnabled(false); CLOUD.stop();
      refreshCloudStatus();
      if (typeof toast === 'function') toast('Cloud sync paused', 'success');
      closeModal(); openCloudSyncManager();
    });
  }});
}

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shops/{shopId} {
      allow read, write: if true;
    }
    match /shops/{shopId}/tables/{tableId} {
      allow read, write: if true;
    }
  }
}`;

/* A ready-to-edit config object, pre-filled with whatever we already know. */
function firebaseConfigTemplate() {
  const c = CLOUD.getConfig() || {};
  const pid = c.projectId || 'YOUR_PROJECT_ID';
  return JSON.stringify({
    apiKey:            c.apiKey            || 'PASTE_YOUR_API_KEY_HERE',
    authDomain:        c.authDomain        || pid + '.firebaseapp.com',
    projectId:         pid,
    storageBucket:     c.storageBucket     || pid + '.firebasestorage.app',
    messagingSenderId: c.messagingSenderId || 'YOUR_SENDER_ID',
    appId:             c.appId             || 'YOUR_APP_ID'
  }, null, 2);
}

function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  ta.remove();
}

/* Focused help for the #1 mistake: pasting Firestore rules instead of the
   web app's firebaseConfig. */
function openFirebaseConfigHelp() {
  const cfg = CLOUD.getConfig() || {};
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (v) => String(v == null ? '' : v);
  openModal(`
    <h3>📍 Where do I find <code>firebaseConfig</code>?</h3>

    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 12px;border-radius:8px;color:#b91c1c;font-size:13px;line-height:1.6;margin-bottom:14px;">
      ⚠️ <b>Two different things — don't mix them up:</b><br>
      • <b>Firestore security rules</b> (<code>rules_version = '2'; service cloud.firestore …</code>)
        → paste in the <b>Firebase Console → Rules</b> tab.<br>
      • <b>firebaseConfig</b> (<code>{ "apiKey": …, "projectId": … }</code>)
        → paste in <b>this app's</b> config box.
    </div>

    <p style="font-size:13px;font-weight:700;margin-bottom:6px;">Get it here:</p>
    <ol style="font-size:13px;line-height:1.9;padding-left:20px;margin-bottom:14px;">
      <li>Open <a href="https://console.firebase.google.com/" target="_blank"><b>console.firebase.google.com</b></a> and select your project${cfg.projectId ? ' (<b>' + esc(cfg.projectId) + '</b>)' : ''}</li>
      <li>Click the <b>⚙️ gear</b> at top-left → <b>Project settings</b></li>
      <li>On the <b>General</b> tab, scroll to <b>Your apps</b></li>
      <li>If there is no Web app yet, click the <b><code>&lt;/&gt;</code></b> icon to add one (no hosting needed)</li>
      <li>Under <b>SDK setup and configuration</b>, choose <b>Config</b> (not "npm")</li>
      <li>Copy the whole <code>const firebaseConfig = { … };</code> block and paste it into the app's config box</li>
    </ol>

    <p style="font-size:13px;font-weight:700;margin-bottom:6px;">It looks like this:</p>
    <pre id="cfgExample" style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;font-size:11.5px;overflow-x:auto;margin-bottom:8px;">${esc(firebaseConfigTemplate())}</pre>
    <p style="font-size:12px;color:var(--text-soft);line-height:1.6;margin-bottom:14px;">
      Replace <code>PASTE_YOUR_API_KEY_HERE</code> etc. with the values from the console.
      If a key is already saved, the template above is pre-filled with it — just edit what you want to change.
    </p>

    <div class="modal-footer" style="flex-wrap:wrap;gap:8px;">
      <button type="button" class="btn btn-ghost" onclick="closeModal();openCloudSyncManager()">← Back to Cloud Sync</button>
      <button type="button" class="btn btn-secondary" id="copyCfgExample">📋 Copy example</button>
      <button type="button" class="btn btn-primary" id="useCfgExample">✏️ Put this in the config box</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#copyCfgExample', m)?.addEventListener('click', async () => {
      const txt = $('#cfgExample', m).textContent;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(txt);
        else copyTextFallback(txt);
        if (typeof toast === 'function') toast('Example copied', 'success');
      } catch (e) { copyTextFallback(txt); }
    });
    $('#useCfgExample', m)?.addEventListener('click', () => openCloudSyncManager(firebaseConfigTemplate()));
  }});
}

function openFirebaseSetupGuide() {
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (v) => String(v == null ? '' : v);
  openModal(`
    <h3>📖 Firebase Setup Guide (One-Time, ~5 min)</h3>
    <p class="sub">Two separate blocks go in two separate places. The most common mistake is swapping them.</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:14px;">
      <div style="font-weight:800;color:#1d4ed8;margin-bottom:6px;">A) IN THE FIREBASE CONSOLE — Firestore security rules</div>
      <ol style="font-size:13px;line-height:1.8;padding-left:20px;margin-bottom:10px;">
        <li>Go to <a href="https://console.firebase.google.com/" target="_blank"><b>console.firebase.google.com</b></a> → your project</li>
        <li>Left menu → <b>Build</b> → <b>Firestore Database</b> → <b>Create database</b> (if not created yet)</li>
        <li>Open the <b>Rules</b> tab. The default <code>allow read, write: if false;</code> <b>blocks all sync</b> — replace it with the block below</li>
        <li>Click <b>Publish</b> and wait ~30 seconds</li>
      </ol>
      <pre id="rulesExample" style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;font-size:11.5px;overflow-x:auto;margin-bottom:8px;">${esc(FIRESTORE_RULES)}</pre>
      <small style="color:#b91c1c;display:block;line-height:1.6;margin-bottom:8px;">
        ⚠️ The <code>/tables/{tableId}</code> path is REQUIRED — the app stores each table in its own document.
        These "allow if true" rules are open/test-mode rules: anyone with your project ID could read the data.
        For production, restrict them to your Shop ID and/or add Firebase Authentication.
      </small>
      <button type="button" class="btn btn-secondary btn-sm" id="copyRulesBtn">📋 Copy rules</button>
      <span style="font-size:11.5px;color:#1d4ed8;margin-left:8px;">→ paste in the Firebase Console Rules tab, NOT in this app</span>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;margin-bottom:14px;">
      <div style="font-weight:800;color:#15803d;margin-bottom:6px;">B) IN THIS APP — firebaseConfig (your key)</div>
      <ol style="font-size:13px;line-height:1.8;padding-left:20px;margin-bottom:10px;">
        <li>Firebase Console → <b>⚙️ Project settings</b> → <b>General</b> → <b>Your apps</b></li>
        <li>Under <b>SDK setup and configuration</b> pick <b>Config</b>, copy the <code>const firebaseConfig = { … };</code> block</li>
        <li>Paste it into the <b>Firebase Config / API Key</b> box in Cloud Sync settings (NOT the rules!)</li>
        <li>Set a <b>Shop ID</b> — use the SAME on every device</li>
        <li>Click <b>🔌 Test Connection</b>, then <b>✅ Save &amp; Enable Cloud Sync</b></li>
      </ol>
      <button type="button" class="btn btn-secondary btn-sm" id="guideFindCfgBtn">📍 Show me where to find firebaseConfig</button>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-primary" onclick="closeModal();openCloudSyncManager()">← Back to Cloud Sync</button>
    </div>
  `, { large: true, onOpen(m) {
    $('#copyRulesBtn', m)?.addEventListener('click', async () => {
      const txt = $('#rulesExample', m).textContent;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(txt);
        else copyTextFallback(txt);
        if (typeof toast === 'function') toast('Rules copied — paste into Firebase Console → Rules', 'success');
      } catch (e) { copyTextFallback(txt); }
    });
    $('#guideFindCfgBtn', m)?.addEventListener('click', () => { closeModal(); openFirebaseConfigHelp(); });
  }});
}
