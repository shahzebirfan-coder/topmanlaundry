/* ============================================================
   LOGIN RESCUE  —  "client login nahi kar pa raha" ka permanent hal
   ------------------------------------------------------------
   Do cheezein deta hai, dono 100% offline (internet ki zarurat nahi):

   1) USER IDs DEKHEIN
      Login screen se hi us device ke user IDs, naam, role aur "password
      kab change hua" dekha ja sakta hai. Passwords kabhi show nahi hote.
      (Agar client ne ID change kar di aur bhool gaya — ab nazar aa jayegi.)

   2) IT RESCUE CODE  (8 characters, roz badalta hai)
      IT support phone par ek code bata deta hai, client woh code login
      screen par daal kar apna naya password khud set kar leta hai.
      • Code = 8 chars, format XXXX-XXXX
      • Aaj aur kal tak valid (raat 12 baje ke aas-paas bhi kaam karta hai)
      • Har shop ka code alag (shop ID + IT password se banta hai)
      • Roz automatically badal jata hai — purana code reuse nahi hota

   NOTE (security): ye ek static (client-side) app hai, is liye IT password
   app ki source me hi hota hai. Ye "galti se lock out" hone se bachata hai,
   lekin ise server-side authentication ka replacement na samjhein.
   ============================================================ */

window.RESCUE = (function () {
  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 0/O/1/I jaisi confusing chars nahi

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function secret() {
    const pwd = (window._IT_BRAND && window._IT_BRAND.pwd) ? window._IT_BRAND.pwd : 'ITAdmin';
    return 'rescue:' + pwd;
  }

  function shopId() {
    try {
      if (window.CLOUD && typeof CLOUD.getShopId === 'function') {
        const s = CLOUD.getShopId();
        if (s) return String(s);
      }
    } catch (e) {}
    try {
      if (typeof CLOUD_AUTO_SHOP_ID !== 'undefined' && CLOUD_AUTO_SHOP_ID) return String(CLOUD_AUTO_SHOP_ID);
    } catch (e) {}
    const ls = localStorage.getItem('mrLaundryShopId');
    if (ls) return ls;
    return 'topman_laundry';
  }

  /* Local (device) date — shop ke hisaab se, UTC nahi. */
  function dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function block(n, salt) {
    let h = fnv1a(secret() + '|' + shopId() + '|' + salt + '|' + n);
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += ALPHABET[h % ALPHABET.length];
      h = Math.floor(h / ALPHABET.length) || fnv1a(salt + '|' + n + '|' + i);
    }
    return out;
  }

  function codeFor(dayStr) {
    return block(1, 'A' + dayStr) + '-' + block(2, 'B' + dayStr);
  }

  function normalizeCode(v) {
    return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /* Aaj ka ya pichhle din ka code chalega (late-night calls ke liye). */
  function acceptedCodes() {
    return [0, -1].map(off => ({ day: dayKey(off), code: codeFor(dayKey(off)) }));
  }

  function isValidCode(input) {
    const n = normalizeCode(input);
    if (n.length !== 8) return false;
    return acceptedCodes().some(c => normalizeCode(c.code) === n);
  }

  return {
    shopId, dayKey, codeFor, normalizeCode, isValidCode, acceptedCodes,
    openReset: openRescueReset,
    openUserList: openShowUserIds,
    openGenerator: openRescueCodeGenerator
  };
})();

/* ---------- shared helpers ---------- */
function rescueUserRows() {
  const rows = (typeof DB !== 'undefined' && DB.all) ? DB.all('users') : [];
  return (Array.isArray(rows) ? rows : []).filter(u => u && u.username);
}

function rescueWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try { return d.toLocaleString(); } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

function rescueAudit(action, details, user) {
  try {
    if (typeof DB === 'undefined' || !DB._data) return;
    const now = new Date().toISOString();
    DB._data.auditLog = DB._data.auditLog || [];
    DB._data.auditLog.push({
      id: 'a' + Date.now().toString(36),
      action,
      details,
      userId: user ? user.id : undefined,
      username: user ? user.username : 'recovery',
      userName: user ? user.name : 'Recovery',
      role: user ? user.role : 'unknown',
      timestamp: now, createdAt: now
    });
    DB.save();
  } catch (e) {}
}

/* ---------- 1. Show the user IDs on this device (no passwords) ---------- */
function openShowUserIds() {
  const users = rescueUserRows();
  const list = users.length
    ? users.map(u => `
        <tr>
          <td><code style="font-size:13px;font-weight:700;">${escapeHtml(u.username)}</code></td>
          <td>${escapeHtml(u.name || '')}</td>
          <td><span class="badge ${u.role === 'admin' ? 'admin' : 'cashier'}">${u.role === 'admin' ? '👑 Admin' : '🧑‍💼 Cashier'}</span></td>
          <td style="font-size:12px;color:var(--text-soft);">${escapeHtml(rescueWhen(u.credentialsUpdatedAt || u.passwordChangedAt || u.updatedAt || u.createdAt))}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" style="padding:14px;text-align:center;color:var(--text-soft);">Koi user record nahi mila.</td></tr>`;

  openModal(`
    <h3>👤 Is device ke User IDs</h3>
    <p class="sub">Login screen ke liye username yahan se confirm kar lein. <b>Passwords security ki wajah se kabhi show nahi kiye jate.</b></p>

    <div style="max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:10px;">
      <table class="tbl" style="margin:0;">
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Password last changed</th></tr></thead>
        <tbody>${list}</tbody>
      </table>
    </div>

    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px;border-radius:8px;margin-top:14px;font-size:13px;">
      💡 <b>Username yaad aa gaya lekin password nahi?</b> Neeche <b>🆘 IT Rescue Code</b> se apna naya password set kar lein.
      <br>Username case-insensitive hai — <code>Admin</code> aur <code>admin</code> dono chalenge.
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" id="rUserIdReset">🆘 IT Rescue Code</button>
    </div>
  `, { large: true, onOpen(m) {
    const b = $('#rUserIdReset', m);
    if (b) b.onclick = () => { closeModal(); setTimeout(openRescueReset, 150); };
  }});
}

/* ---------- 2. Rescue code → new password (client flow) ---------- */
function openRescueReset() {
  const users = rescueUserRows();

  openModal(`
    <h3>🆘 IT Rescue Code</h3>
    <p class="sub">
      IT support se aaj ka <b>Rescue Code</b> lein (8 characters, jaise <code>7K3M-9QXP</code>).
      Code daalne ke baad aap khud apna naya password set kar sakte hain.
    </p>

    <div class="field">
      <label>Rescue Code</label>
      <input id="rsCode" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false"
             style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;letter-spacing:2px;text-transform:uppercase;"/>
      <small style="color:var(--text-soft);">Aaj aur pichhle din ka code chalta hai. Code har roz badalta hai.</small>
    </div>

    <div id="rsStep2" style="display:none;">
      <hr style="margin:14px 0;">
      <div class="field">
        <label>Kis account ka password reset karna hai?</label>
        <select id="rsUser">
          ${users.length ? users.map(u => `
            <option value="${escapeHtml(u.id)}" ${u.role === 'admin' ? 'selected' : ''}>
              ${escapeHtml(u.username)} — ${escapeHtml(u.name || '')} ${u.role === 'admin' ? '(Admin)' : '(Cashier)'}
            </option>`).join('') : '<option value="">(koi user nahi — naya admin banega)</option>'}
        </select>
      </div>
      <div class="field">
        <label>Naya Password *</label>
        <input type="text" id="rsNew" placeholder="Kam az kam 4 characters" autocomplete="off"/>
      </div>
      <div class="field">
        <label>Naya Password dobara *</label>
        <input type="text" id="rsNew2" placeholder="Same as above" autocomplete="off"/>
      </div>
    </div>

    <div id="rsMsg" style="margin-top:10px;font-size:13px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="rsBack">← Options</button>
      <button class="btn btn-primary" id="rsNext">Verify Code →</button>
    </div>
  `, { onOpen(m) {
    let verified = false;
    const msg = (txt, type) => {
      const colors = { error: 'var(--danger)', success: 'var(--success)' };
      const el = $('#rsMsg', m);
      el.innerHTML = txt
        ? `<div style="padding:9px 11px;background:var(--surface-alt);border-radius:8px;color:${colors[type] || 'var(--text-soft)'};">${txt}</div>`
        : '';
    };

    $('#rsBack', m).onclick = () => { closeModal(); setTimeout(openForgotPassword, 150); };
    setTimeout(() => $('#rsCode', m) && $('#rsCode', m).focus(), 100);

    $('#rsNext', m).onclick = () => {
      if (!verified) {
        const code = $('#rsCode', m).value;
        if (!rescueNormalized(code)) { msg('Rescue code likhein.', 'error'); return; }
        if (!RESCUE.isValidCode(code)) {
          msg('❌ Code ghalat hai ya expire ho gaya. IT se aaj ka naya code lein.', 'error');
          rescueAudit('recovery.failed', 'Wrong IT rescue code', null);
          return;
        }
        verified = true;
        $('#rsCode', m).disabled = true;
        $('#rsStep2', m).style.display = 'block';
        $('#rsNext', m).textContent = 'Reset Password';
        msg('✅ Code verified. Ab naya password set karein.', 'success');
        setTimeout(() => { const el = $('#rsNew', m); if (el) el.focus(); }, 80);
        return;
      }

      const id = $('#rsUser', m).value;
      const np = $('#rsNew', m).value;
      const np2 = $('#rsNew2', m).value;
      if (!np || np.length < 4) { msg('Password kam az kam 4 characters ka hona chahiye.', 'error'); return; }
      if (np !== np2) { msg('Dono passwords same nahi hain.', 'error'); return; }

      let target = users.find(u => u.id === id) || users[0] || null;
      if (!target) {
        /* users table khaali thi → safety net admin bana dega */
        try { DB.ensureLoginableUsers(); } catch (e) {}
        target = (DB.all('users') || []).find(u => u.role === 'admin') || (DB.all('users') || [])[0] || null;
      }
      if (!target) { msg('❌ Koi user record nahi mila. IT se rabta karein.', 'error'); return; }

      try {
        if (typeof DB.setUserPassword === 'function') {
          DB.setUserPassword(target.id, np, { via: 'IT rescue code' });
        } else {
          DB.update('users', target.id, { password: np });
        }
      } catch (e) {
        msg('❌ Password save nahi hua: ' + (e && e.message ? e.message : e), 'error');
        return;
      }
      rescueAudit('recovery.rescueCode', 'Password reset via IT rescue code', target);
      closeModal();
      setTimeout(() => {
        alert('✅ Password set ho gaya!\n\nUsername: ' + target.username +
              '\nNaya Password: ' + np +
              '\n\nAb isi username/password se login karein. Login ke baad\nmenu se apna password change kar lijiye.');
      }, 180);
    };
  }});
}

/* Code normalise — empty check ke liye chhota wrapper */
function rescueNormalized(v) { return RESCUE.normalizeCode(v); }

/* ---------- 3. IT staff: today's code generate karein ---------- */
function openRescueCodeGenerator() {
  const proceed = () => {
    const rows = [0, 1, -1].map(off => {
      const day = RESCUE.dayKey(off);
      const code = RESCUE.codeFor(day);
      const label = off === 0 ? '✅ Aaj' : (off === 1 ? '➡️ Kal' : '⬅️ Pichhla din');
      return { label, day, code };
    });

    openModal(`
      <h3>🔐 IT Rescue Code — Generator</h3>
      <p class="sub">Ye codes phone par client ko bata dein. Client login screen par <b>Forgot Password → 🆘 IT Rescue Code</b> me daal kar apna password set karega.</p>

      <div style="background:var(--surface-alt);padding:10px 12px;border-radius:8px;font-size:12px;margin-bottom:12px;">
        Shop ID: <code>${escapeHtml(RESCUE.shopId())}</code>
      </div>

      ${rows.map(r => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
          <div style="flex:0 0 96px;font-size:12px;color:var(--text-soft);">${r.label}<br>${escapeHtml(r.day)}</div>
          <code style="flex:1;font-size:20px;font-weight:800;letter-spacing:3px;">${escapeHtml(r.code)}</code>
          <button class="btn btn-secondary btn-sm" data-copy="${escapeHtml(r.code)}">Copy</button>
        </div>`).join('')}

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:11px;border-radius:8px;font-size:12px;margin-top:12px;">
        ⚠️ <b>Sirf IT staff ke liye.</b> Ye code us shop ke liye hi chalta hai aur roz badalta hai.
        Client ko dene ke baad Activity Log me <code>recovery.rescueCode</code> entry dekh sakte hain.
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `, { onOpen(m) {
      m.querySelectorAll('[data-copy]').forEach(b => {
        b.onclick = () => {
          const txt = b.dataset.copy;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
            else { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
            if (typeof toast === 'function') toast('Code copied: ' + txt, 'success');
          } catch (e) { if (typeof toast === 'function') toast('Copy na ho saka — haath se likh lein', 'error'); }
        };
      });
    }});
  };

  /* IT password maangein (wahi password jo Settings unlock me use hota hai) */
  const itPwd = (window._IT_BRAND && window._IT_BRAND.pwd) || '';
  if (typeof promptPasswordModal === 'function') {
    promptPasswordModal('IT Rescue Code — IT password', (pwd) => {
      if (String(pwd) !== String(itPwd)) {
        if (typeof toast === 'function') toast('❌ IT password ghalat hai', 'error');
        return;
      }
      proceed();
    });
  } else {
    const pwd = window.prompt('IT password:');
    if (String(pwd) === String(itPwd)) proceed();
    else if (typeof toast === 'function') toast('❌ IT password ghalat hai', 'error');
  }
}

window.openShowUserIds = openShowUserIds;
window.openRescueReset = openRescueReset;
window.openRescueCodeGenerator = openRescueCodeGenerator;
