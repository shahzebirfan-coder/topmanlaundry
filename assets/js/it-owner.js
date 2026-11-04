/* ============================================================
   IT OWNER SERVICE ACCOUNT  —  SUPPORT / MAINTENANCE ACCESS
   ------------------------------------------------------------
   A separate login for the software owner (IT Owner) to sign in to a
   client's installation and work on it with FULL ADMIN rights.

   Important design points:
   • This account is NOT stored in DB._data.users. It therefore never appears
     in the client's Users page, is never included in their backup files, and
     survives a backup restore / cloud sync.
   • It is a plain client-side credential in a static app. Anyone with access
     to the site's source can read it — change the default password below
     before deploying, and use `enabled:false` or `expiresAt` to switch it off.
     For real security you would need server-side / Firebase Authentication.
   • Every IT Owner session is clearly banner-marked and all audited actions
     are tagged `itOwner:true` in the Activity Log.

   TO CHANGE THE PASSWORD: edit `password` below (one line).
   TO DISABLE: set `enabled: false`.
   TO EXPIRE: set `expiresAt: '2026-12-31'` (empty = never expires).
   ============================================================ */
window.IT_OWNER = {
  enabled:        true,
  id:             'it_owner',
  username:       'celinesoft',
  password:       'ITOwner@2026',          // ⚠️ CHANGE THIS BEFORE DEPLOYING
  name:           'IT Owner (CelineSoft)',
  expiresAt:      '',                      // e.g. '2026-12-31' — '' = never
  showBanner:     true,
  logDataChanges: true                     // tag every data change in audit log
};

/* Returns the active config, or null when disabled / expired. */
function itOwnerConfig() {
  const c = (typeof window !== 'undefined') ? window.IT_OWNER : null;
  if (!c || !c.enabled || !c.username || !c.password) return null;
  if (c.expiresAt) {
    const t = Date.parse(c.expiresAt + 'T23:59:59');
    if (!isNaN(t) && Date.now() > t) return null;
  }
  return c;
}

/* Is the CURRENT session an IT Owner session? */
function currentUserIsITOwner() {
  try {
    if (typeof DB === 'undefined' || !DB.currentUser) return false;
    const u = DB.currentUser();
    return !!(u && u.isITOwner);
  } catch (e) { return false; }
}

/* Tag every data mutation made during an IT Owner session. Skips the
   auditLog table itself, otherwise logAction() would recurse forever. */
function installITOwnerAuditHook() {
  const io = (typeof itOwnerConfig === 'function') ? itOwnerConfig() : null;
  if (!io || io.logDataChanges === false || typeof DB === 'undefined') return;
  if (DB.__itOwnerAuditHooked) return;
  DB.__itOwnerAuditHooked = true;

  ['insert', 'update', 'remove'].forEach(op => {
    if (typeof DB[op] !== 'function') return;
    const orig = DB[op].bind(DB);
    DB[op] = function (...args) {
      const result = orig(...args);
      try {
        if (currentUserIsITOwner() && args[0] !== 'auditLog' && typeof logAction === 'function') {
          let ref = '';
          if (args[1] && typeof args[1] === 'object') ref = args[1].id || '';
          else if (args[1] != null) ref = String(args[1]);
          logAction('itowner.' + op, String(args[0]) + (ref ? ':' + ref : ''));
        }
      } catch (e) {}
      return result;
    };
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installITOwnerAuditHook);
  } else {
    setTimeout(installITOwnerAuditHook, 0);
  }
}
