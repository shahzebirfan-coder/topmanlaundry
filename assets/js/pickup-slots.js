/* ============================================================
   PICKUP TIME SLOTS — shared by portal.html (customer booking)
   and the admin Pickup & Delivery page.

   Rules:
   • Non-overlapping slots (default 1 hour, 9 AM → 9 PM).
   • Only slots starting at least `leadMinutes` (default 2 hours) from NOW
     are offered for today. Future dates get all slots.
   • Capacity = 1 booking per (date, slot). Enforced in the UI *and*
     atomically inside the Firestore transaction in portal.html.
   • Settings (Customer Portal Configuration) can override:
       pickupStartHour, pickupEndHour, pickupSlotMinutes, pickupLeadMinutes
   ============================================================ */
window.PICKUP_SLOT_DEFAULTS = {
  startHour:   9,
  endHour:     21,
  slotMinutes: 60,
  leadMinutes: 120,
  capacity:    1
};

function _psPad(n) { return String(n).padStart(2, '0'); }
function _psHHMM(mins) { return _psPad(Math.floor(mins / 60)) + ':' + _psPad(mins % 60); }
function _ps12(mins) {
  const h = Math.floor(mins / 60), mm = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + (mm ? ':' + _psPad(mm) : '') + ' ' + ap;
}
function psLocalDate(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + _psPad(x.getMonth() + 1) + '-' + _psPad(x.getDate());
}
function psSettings() {
  let s = {};
  try { if (typeof DB !== 'undefined' && DB.settings) s = DB.settings() || {}; } catch (e) {}
  const cfg = Object.assign({}, window.PICKUP_SLOT_DEFAULTS);
  const sh = +s.pickupStartHour, eh = +s.pickupEndHour, sm = +s.pickupSlotMinutes, lm = +s.pickupLeadMinutes;
  if (Number.isFinite(sh) && sh >= 0 && sh <= 22) cfg.startHour = Math.floor(sh);
  if (Number.isFinite(eh) && eh > cfg.startHour && eh <= 24) cfg.endHour = Math.floor(eh);
  if ([15, 30, 60, 120].includes(sm)) cfg.slotMinutes = sm;
  if (Number.isFinite(lm) && lm >= 0 && lm <= 1440) cfg.leadMinutes = Math.floor(lm);
  return cfg;
}

/* All slots for a day (regardless of availability). */
function generatePickupSlots() {
  const cfg = psSettings();
  const out = [];
  for (let m = cfg.startHour * 60; m + cfg.slotMinutes <= cfg.endHour * 60; m += cfg.slotMinutes) {
    out.push({
      value: _psHHMM(m) + '-' + _psHHMM(m + cfg.slotMinutes),
      label: _ps12(m) + ' - ' + _ps12(m + cfg.slotMinutes),
      startMinutes: m,
      endMinutes: m + cfg.slotMinutes
    });
  }
  return out;
}

function psSlotKey(date, value) { return String(date) + '|' + String(value); }

/* Active bookings (cancelled/deleted ones free the slot again). */
function psBookedSlots(requests) {
  const set = new Set();
  (requests || []).forEach(r => {
    if (!r || r._deleted || r.status === 'cancelled') return;
    if (r.pickupDate && r.pickupSlot) set.add(psSlotKey(r.pickupDate, r.pickupSlot));
  });
  return set;
}

function isPickupSlotAvailable(value, date, requests, now) {
  if (!date || !value) return false;
  const slot = generatePickupSlots().find(s => s.value === value);
  if (!slot) return false;                 // legacy/overlapping values are no longer bookable
  const n = now || new Date();
  const today = psLocalDate(n);
  if (date < today) return false;
  if (date === today) {
    const cur = n.getHours() * 60 + n.getMinutes();
    if (slot.startMinutes < cur + psSettings().leadMinutes) return false;
  }
  return !psBookedSlots(requests).has(psSlotKey(date, value));
}

function availablePickupSlots(date, requests, now) {
  return generatePickupSlots().filter(s => isPickupSlotAvailable(s.value, date, requests, now));
}

/* Human-readable label, also handles old legacy values still in the DB. */
function formatPickupSlot(value) {
  const v = String(value || '');
  const generated = generatePickupSlots().find(s => s.value === v);
  if (generated) return generated.label;
  const legacy = {
    '9am-12pm':  '9 AM - 12 PM',
    '10am-2pm':  '10 AM - 2 PM',
    '2pm-6pm':   '2 PM - 6 PM',
    '6pm-9pm':   '6 PM - 9 PM'
  };
  if (legacy[v]) return legacy[v];
  if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v)) {
    const [a, b] = v.split('-');
    const toMin = t => (+t.slice(0, 2)) * 60 + (+t.slice(3, 5));
    return _ps12(toMin(a)) + ' - ' + _ps12(toMin(b));
  }
  return v || '-';
}

/* First date that still has at least one available slot. */
function firstPickupDateWithSlots(requests, now) {
  const n = now || new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(n.getTime() + i * 86400000);
    const date = psLocalDate(d);
    const list = availablePickupSlots(date, requests, n);
    // for future days ignore the lead-time rule by passing a fake "now" at midnight
    if (i > 0) {
      if (generatePickupSlots().some(s => isPickupSlotAvailable(s.value, date, requests,
        new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)))) return date;
    } else if (list.length) return date;
  }
  return psLocalDate(new Date(n.getTime() + 86400000));
}
