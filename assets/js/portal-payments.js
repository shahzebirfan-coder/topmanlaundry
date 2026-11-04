/* ============================================================
   LOCKED CUSTOMER PORTAL PAYMENT DETAILS  —  TOP MAN LAUNDRY
   ------------------------------------------------------------
   These values are baked into the application. They are re-applied on EVERY
   path that can replace or persist settings:
     • fresh install / DB.load()
     • DB.save()  (all writes, including Cloud Sync pushes)
     • DB.settings()  (all reads in POS, portal.html, live.html, reviews.html)
     • DB.saveSettings()  (Customer Portal Settings dialog)
     • DB.importJSON()  (backup restore)
     • CLOUD.mergeData()  (cloud pull / realtime merge)
     • portal.html direct Firestore settings fetch

   Result: the details can never be blanked, reset to the old demo values, or
   overwritten by an older backup / another device / cloud sync.

   TO CHANGE THEM PERMANENTLY: edit the 7 values below and redeploy.
   `locked: false` disables enforcement (not recommended).
   An IT ADMIN / IT Owner can also set a temporary per-shop override from
   Settings → Customer Portal Configuration → "Unlock to edit"; that override
   is optional and falls back to these values if it is ever missing or blank.
   ============================================================ */
window.PORTAL_PAYMENT_CONFIG = {
  locked:            true,
  jazzcashName:      'Muhammad Usman',
  jazzcashNumber:    '03462760066',
  easypaisaName:     'Muhammad Usman',
  easypaisaNumber:   '03462760066',
  bankName:          'Bank Alfalah',
  bankAccountTitle:  'Topman Quality Drycleaner',
  bankAccountNumber: '00161007089581'
};

window.PORTAL_PAYMENT_KEYS = [
  'jazzcashName', 'jazzcashNumber',
  'easypaisaName', 'easypaisaNumber',
  'bankName', 'bankAccountTitle', 'bankAccountNumber'
];

function portalPaymentConfig() {
  return (typeof window !== 'undefined' && window.PORTAL_PAYMENT_CONFIG)
    ? window.PORTAL_PAYMENT_CONFIG : null;
}

/* Used by DB._seed() so a brand-new install never flashes the old demo data. */
function portalPaymentValue(k, fallback) {
  const c = portalPaymentConfig();
  return (c && typeof c[k] === 'string' && c[k] !== '') ? c[k] : (fallback || '');
}

/* THE ENFORCER. Accepts a DB-shaped object (or defaults to DB._data).
   A deliberate IT override is honoured only when it has a real, non-blank
   value; otherwise the baked-in value always wins. */
function applyLockedPortalPayments(target) {
  const c = portalPaymentConfig();
  const data = target || (typeof DB !== 'undefined' ? DB._data : null);
  if (!c || !c.locked || !data || typeof data !== 'object') return data;
  if (!data.settings || typeof data.settings !== 'object') data.settings = {};

  const ov = data.settings._portalPaymentsOverride;
  let usedOverride = false;
  for (const k of window.PORTAL_PAYMENT_KEYS) {
    const custom = (ov && typeof ov[k] === 'string' && ov[k].trim()) ? ov[k].trim() : null;
    if (custom) usedOverride = true;
    data.settings[k] = custom || c[k];
  }
  data.settings._portalPaymentsLocked = true;
  data.settings._portalPaymentsSource = usedOverride ? 'it-override' : 'built-in';
  return data;
}
