/* ============================================================
   AUTH RECOVERY SYSTEM
   - Master Recovery Code (shop-wide PIN, like a bank PIN)
   - Per-user Security Questions
   - Admin can reset any cashier password instantly
   - "Forgot Password?" link on login screen
   - Emergency Restore from JSON backup
   ============================================================ */

/* Map of question codes -> display text */
const SECURITY_QUESTIONS = {
  mother: "👩 What is your mother's name?",
  city: "🏙️ Which city were you born in?",
  school: "🏫 What was the name of your first school?",
  pet: "🐾 What was your first pet's name?",
  favfood: "🍔 What is your favorite food?",
  phone: "📱 What was your old phone number?",
  custom: "✏️ Custom question"
};

function getSecurityQuestionText(user) {
  if (!user || !user.securityQuestion) return '';
  if (user.securityQuestion === 'custom') return user.securityQuestionCustom || '✏️ Custom question';
  return SECURITY_QUESTIONS[user.securityQuestion] || user.securityQuestion;
}

/* ========== 1. ADMIN RESETS A USER'S PASSWORD ========== */
function openAdminResetPassword(userId) {
  if (DB.currentUser().role !== 'admin') { toast('Admin only','error'); return; }
  const u = DB.get('users', userId);
  if (!u) return;

  openModal(`
    <h3>🔑 Reset Password — ${escapeHtml(u.name)}</h3>
    <p class="sub">Set a new password for <b>${escapeHtml(u.username)}</b>. They will need to log in with this new password.</p>

    <div class="field">
      <label>New Password *</label>
      <input type="text" id="rpNew" placeholder="e.g. NewPass2026" autofocus/>
      <small style="color:var(--text-soft);">Tell the user this password — they can change it after login.</small>
    </div>

    <div class="field">
      <label>Type it again to confirm *</label>
      <input type="text" id="rpConfirm" placeholder="Same as above"/>
    </div>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px;border-radius:8px;font-size:12px;margin-top:10px;">
      ⚠️ <b>This action is logged.</b> The old password will be gone forever.
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="rpSave">🔑 Reset Password</button>
    </div>
  `, { onOpen(m) {
    $('#rpSave', m).onclick = () => {
      const np = $('#rpNew', m).value;
      const cp = $('#rpConfirm', m).value;
      if (!np) { toast('Enter a password','error'); return; }
      if (np !== cp) { toast('Passwords do not match','error'); return; }
      if (np.length < 4) { toast('Password too short (min 4 chars)','error'); return; }
      DB.update('users', userId, { password: np });
      if (typeof logAction === 'function') logAction('user.passwordReset', `${u.username} reset by admin`);
      toast(`✅ Password reset for ${u.name}`, 'success');
      closeModal();
      if (typeof renderUsersBody === 'function') renderUsersBody();
    };
  }});
}

/* ========== 2. FORGOT PASSWORD — From login screen ========== */
function openForgotPassword() {
  openModal(`
    <h3>🔐 Forgot Password — Recovery</h3>
    <p class="sub">Choose how you want to recover access:</p>

    <div style="display:flex;flex-direction:column;gap:10px;">

      <button class="recovery-option" data-method="security">
        <div style="font-size:28px;">❓</div>
        <div style="flex:1;text-align:left;">
          <div style="font-weight:700;">Answer Security Question</div>
          <small style="color:var(--text-soft);">If you set up a security question earlier</small>
        </div>
        <div>→</div>
      </button>

      <button class="recovery-option" data-method="master">
        <div style="font-size:28px;">🔑</div>
        <div style="flex:1;text-align:left;">
          <div style="font-weight:700;">Master Recovery Code</div>
          <small style="color:var(--text-soft);">Shop owner's special PIN (set in Settings)</small>
        </div>
        <div>→</div>
      </button>

      <button class="recovery-option" data-method="backup">
        <div style="font-size:28px;">📂</div>
        <div style="flex:1;text-align:left;">
          <div style="font-weight:700;">Upload Backup File</div>
          <small style="color:var(--text-soft);">Restore from a .json backup you saved earlier</small>
        </div>
        <div>→</div>
      </button>

      <button class="recovery-option" data-method="contact">
        <div style="font-size:28px;">📞</div>
        <div style="flex:1;text-align:left;">
          <div style="font-weight:700;">Contact Shop Admin</div>
          <small style="color:var(--text-soft);">Ask the owner to reset your password</small>
        </div>
        <div>→</div>
      </button>

    </div>

    <style>
      .recovery-option {
        display:flex;align-items:center;gap:14px;
        padding:14px 18px;background:#fff;
        border:2px solid #e5e9f2;border-radius:12px;
        cursor:pointer;transition:.15s;font-family:inherit;
      }
      .recovery-option:hover { border-color:#4f7cff;background:#f0f7ff;transform:translateY(-1px); }
    </style>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">← Back to Login</button>
    </div>
  `, { large: true, onOpen(m) {
    $$('.recovery-option', m).forEach(btn => {
      btn.onclick = () => {
        const method = btn.dataset.method;
        closeModal();
        setTimeout(() => {
          if (method === 'security') openSecurityQuestionRecovery();
          else if (method === 'master') openMasterCodeRecovery();
          else if (method === 'backup') openBackupRecovery();
          else if (method === 'contact') showAdminContactInfo();
        }, 150);
      };
    });
  }});
}

/* ========== 2a. Security Question Recovery ========== */
function openSecurityQuestionRecovery() {
  openModal(`
    <h3>❓ Recover via Security Question</h3>
    <p class="sub">Step 1: Enter your username</p>

    <div class="field">
      <label>Username</label>
      <input id="srUser" placeholder="e.g. your username" autofocus/>
    </div>

    <div id="srStep2" style="display:none;">
      <hr style="margin:14px 0;">
      <p class="sub">Step 2: Answer your security question</p>
      <div style="background:#dbeafe;padding:12px;border-radius:8px;margin-bottom:10px;font-weight:700;" id="srQuestion"></div>
      <div class="field">
        <label>Your Answer</label>
        <input id="srAnswer" placeholder="Type your answer"/>
      </div>
    </div>

    <div id="srStep3" style="display:none;">
      <hr style="margin:14px 0;">
      <p class="sub">Step 3: Set a new password</p>
      <div class="field">
        <label>New Password</label>
        <input type="text" id="srNewPass" placeholder="e.g. NewPass2026"/>
      </div>
      <div class="field">
        <label>Confirm New Password</label>
        <input type="text" id="srNewPass2" placeholder="Same as above"/>
      </div>
    </div>

    <div id="srMsg" style="margin:10px 0;font-size:13px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="srBack" style="display:none;">← Forgot Methods</button>
      <button class="btn btn-primary" id="srNext">Next →</button>
    </div>
  `, { onOpen(m) {
    let stage = 1;
    let foundUser = null;
    const msg = (txt, type='') => {
      const colors = { error:'var(--danger)', success:'var(--success)', '':'var(--text-soft)' };
      $('#srMsg', m).innerHTML = `<div style="padding:8px;background:var(--surface-alt);border-radius:6px;color:${colors[type]};">${txt}</div>`;
    };

    $('#srBack', m).onclick = () => { closeModal(); setTimeout(openForgotPassword, 150); };

    $('#srNext', m).onclick = () => {
      if (stage === 1) {
        const u = $('#srUser', m).value.trim().toLowerCase();
        if (!u) { msg('Enter username', 'error'); return; }
        foundUser = DB.all('users').find(x => x.username.toLowerCase() === u);
        if (!foundUser) { msg('❌ Username not found', 'error'); return; }
        if (!foundUser.securityQuestion || !foundUser.securityAnswer) {
          msg('⚠️ This user has no security question set up. Try another recovery method.', 'error');
          return;
        }
        $('#srQuestion', m).textContent = getSecurityQuestionText(foundUser);
        $('#srStep2', m).style.display = 'block';
        $('#srBack', m).style.display = 'inline-block';
        $('#srNext', m).textContent = 'Verify Answer →';
        $('#srUser', m).disabled = true;
        $('#srAnswer', m).focus();
        msg('');
        stage = 2;
      } else if (stage === 2) {
        const ans = $('#srAnswer', m).value.trim().toLowerCase();
        if (!ans) { msg('Enter your answer', 'error'); return; }
        if (ans !== foundUser.securityAnswer) {
          msg('❌ Wrong answer. Try again or use another method.', 'error');
          if (typeof logAction === 'function') {
            // Log failed attempt to audit
            try {
              DB._data.auditLog = DB._data.auditLog || [];
              DB._data.auditLog.push({
                id: 'a'+Date.now().toString(36),
                action: 'recovery.failed', details: `Username: ${foundUser.username} (wrong security answer)`,
                username: foundUser.username, userName: foundUser.name, role: 'unknown',
                timestamp: new Date().toISOString(), createdAt: new Date().toISOString()
              });
              DB.save();
            } catch(e){}
          }
          return;
        }
        $('#srStep3', m).style.display = 'block';
        $('#srAnswer', m).disabled = true;
        $('#srNext', m).textContent = 'Set New Password';
        $('#srNewPass', m).focus();
        msg('✅ Answer verified! Set a new password.', 'success');
        stage = 3;
      } else if (stage === 3) {
        const np = $('#srNewPass', m).value;
        const np2 = $('#srNewPass2', m).value;
        if (!np) { msg('Enter new password','error'); return; }
        if (np !== np2) { msg('Passwords do not match','error'); return; }
        if (np.length < 4) { msg('Password too short (min 4 chars)','error'); return; }
        DB.update('users', foundUser.id, { password: np });
        try {
          DB._data.auditLog = DB._data.auditLog || [];
          DB._data.auditLog.push({
            id: 'a'+Date.now().toString(36),
            action: 'recovery.password', details: `via Security Question`,
            userId: foundUser.id, username: foundUser.username, userName: foundUser.name, role: foundUser.role,
            timestamp: new Date().toISOString(), createdAt: new Date().toISOString()
          });
          DB.save();
        } catch(e){}
        closeModal();
        setTimeout(() => {
          alert(`✅ Password reset successfully!\n\nUsername: ${foundUser.username}\nNew Password: ${np}\n\nYou can now log in.`);
        }, 200);
      }
    };

    setTimeout(() => $('#srUser', m)?.focus(), 100);
  }});
}

/* ========== 2b. Master Recovery Code ========== */
function openMasterCodeRecovery() {
  const s = DB.settings();
  const codeSet = !!s.masterRecoveryCode;

  if (!codeSet) {
    openModal(`
      <h3>🔑 Master Recovery Code</h3>
      <div style="background:#fee2e2;border-left:4px solid #ef4444;padding:14px;border-radius:8px;margin-bottom:14px;">
        ❌ <b>Master Recovery Code is not set yet!</b><br><br>
        Please set it from Settings page first (only Admin can). It is a backup PIN that lets you reset any password.
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Back</button>
        <button class="btn btn-primary" onclick="closeModal();setTimeout(openForgotPassword,150)">← Try Another Method</button>
      </div>
    `);
    return;
  }

  openModal(`
    <h3>🔑 Master Recovery Code</h3>
    <p class="sub">Enter the shop's Master Recovery Code (set in Settings by Admin) to reset any user's password.</p>

    <div class="field">
      <label>Username (whose password to reset)</label>
      <input id="mcUser" placeholder="e.g. your username" autofocus/>
    </div>

    <div class="field">
      <label>Master Recovery Code</label>
      <input type="password" id="mcCode" placeholder="••••••••"/>
    </div>

    <div id="mcStep2" style="display:none;">
      <div class="field">
        <label>New Password for User</label>
        <input type="text" id="mcNewPass" placeholder="New password"/>
      </div>
      <div class="field">
        <label>Confirm New Password</label>
        <input type="text" id="mcNewPass2" placeholder="Same as above"/>
      </div>
    </div>

    <div id="mcMsg" style="margin:10px 0;font-size:13px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="mcNext">Verify Code →</button>
    </div>
  `, { onOpen(m) {
    let verified = false;
    let foundUser = null;
    const msg = (txt, type='') => {
      const colors = { error:'var(--danger)', success:'var(--success)', '':'var(--text-soft)' };
      $('#mcMsg', m).innerHTML = `<div style="padding:8px;background:var(--surface-alt);border-radius:6px;color:${colors[type]};">${txt}</div>`;
    };

    $('#mcNext', m).onclick = () => {
      if (!verified) {
        const u = $('#mcUser', m).value.trim().toLowerCase();
        const code = $('#mcCode', m).value;
        if (!u || !code) { msg('Fill both fields','error'); return; }
        foundUser = DB.all('users').find(x => x.username.toLowerCase() === u);
        if (!foundUser) { msg('❌ Username not found','error'); return; }
        if (code !== s.masterRecoveryCode) {
          msg('❌ Wrong Master Recovery Code','error');
          try {
            DB._data.auditLog = DB._data.auditLog || [];
            DB._data.auditLog.push({
              id: 'a'+Date.now().toString(36),
              action: 'recovery.failed', details: `Wrong master code for ${u}`,
              username: u, userName: u, role: 'unknown',
              timestamp: new Date().toISOString(), createdAt: new Date().toISOString()
            });
            DB.save();
          } catch(e){}
          return;
        }
        verified = true;
        $('#mcUser', m).disabled = true;
        $('#mcCode', m).disabled = true;
        $('#mcStep2', m).style.display = 'block';
        $('#mcNext', m).textContent = 'Reset Password';
        $('#mcNewPass', m).focus();
        msg('✅ Code verified. Set new password.', 'success');
      } else {
        const np = $('#mcNewPass', m).value;
        const np2 = $('#mcNewPass2', m).value;
        if (!np || np !== np2) { msg('Passwords must match','error'); return; }
        if (np.length < 4) { msg('Min 4 chars','error'); return; }
        DB.update('users', foundUser.id, { password: np });
        try {
          DB._data.auditLog = DB._data.auditLog || [];
          DB._data.auditLog.push({
            id: 'a'+Date.now().toString(36),
            action: 'recovery.password', details: `via Master Code`,
            userId: foundUser.id, username: foundUser.username, userName: foundUser.name, role: foundUser.role,
            timestamp: new Date().toISOString(), createdAt: new Date().toISOString()
          });
          DB.save();
        } catch(e){}
        closeModal();
        setTimeout(() => {
          alert(`✅ Password reset successfully!\n\nUsername: ${foundUser.username}\nNew Password: ${np}\n\nYou can now log in.`);
        }, 200);
      }
    };
  }});
}

/* ========== 2c. Backup file recovery ========== */
function openBackupRecovery() {
  openModal(`
    <h3>📂 Restore from Backup File</h3>
    <p class="sub">Upload a .json backup file you previously downloaded from Settings → Backup. This will <b>replace ALL data</b>.</p>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
      ⚠️ <b>Warning:</b> This restores everything (users, orders, customers, etc.) from the backup file. Current data on this device will be replaced.
    </div>

    <div class="field">
      <label>Choose Backup JSON file</label>
      <input type="file" id="brFile" accept=".json,application/json"/>
    </div>

    <div id="brPreview" style="margin-top:10px;font-size:13px;"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="brRestore" disabled>🔄 Restore Now</button>
    </div>
  `, { onOpen(m) {
    let parsedData = null;
    $('#brFile', m).onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          parsedData = JSON.parse(ev.target.result);
          const userCount = parsedData.users?.length || 0;
          const orderCount = parsedData.orders?.length || 0;
          $('#brPreview', m).innerHTML = `
            <div style="background:#dcfce7;padding:10px;border-radius:8px;color:#065f46;">
              ✅ Valid backup detected!<br>
              👥 Users: <b>${userCount}</b><br>
              📦 Orders: <b>${orderCount}</b><br>
              ${parsedData.users ? '<small>Usernames found: ' + parsedData.users.map(u => escapeHtml(u.username)).join(', ') + '</small>' : ''}
            </div>
          `;
          $('#brRestore', m).disabled = false;
        } catch(err) {
          $('#brPreview', m).innerHTML = '<div style="color:var(--danger);">❌ Invalid file. Must be a valid JSON backup.</div>';
          $('#brRestore', m).disabled = true;
        }
      };
      reader.readAsText(f);
    };

    $('#brRestore', m).onclick = () => {
      if (!parsedData) return;
      if (!confirm('REPLACE all data on this device with backup file? This cannot be undone (but you can re-import).\n\nClick OK to proceed.')) return;
      try {
        DB._data = parsedData;
        DB.save();
        try {
          DB._data.auditLog = DB._data.auditLog || [];
          DB._data.auditLog.push({
            id: 'a'+Date.now().toString(36),
            action: 'recovery.restoreBackup', details: 'Restored from JSON file',
            username: 'recovery', userName: 'Recovery', role: 'unknown',
            timestamp: new Date().toISOString(), createdAt: new Date().toISOString()
          });
          DB.save();
        } catch(e){}
        closeModal();
        setTimeout(() => {
          alert('✅ Backup restored! You can now log in with the credentials from your backup file.');
          location.reload();
        }, 200);
      } catch(err) {
        alert('Restore failed: ' + err.message);
      }
    };
  }});
}

/* ========== 2d. Admin contact info ========== */
function showAdminContactInfo() {
  const s = DB.settings();
  const admins = DB.all('users').filter(u => u.role === 'admin');
  const adminList = admins.map(a => `<li><b>${escapeHtml(a.name)}</b> (${escapeHtml(a.username)})</li>`).join('');

  openModal(`
    <h3>📞 Contact Shop Admin</h3>
    <p class="sub">Ask the shop owner to reset your password.</p>

    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:14px;border-radius:8px;margin-bottom:14px;">
      <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(s.shopName || 'Laundry POS')}</div>
      ${s.phone ? `📞 <a href="tel:${escapeHtml(s.phone)}">${escapeHtml(s.phone)}</a><br>` : ''}
      ${s.email ? `📧 <a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a><br>` : ''}
      ${s.address ? `📍 ${escapeHtml(s.address)}<br>` : ''}
    </div>

    ${admins.length ? `<div style="margin-bottom:14px;"><b>Admin Users:</b><ul>${adminList}</ul></div>` : ''}

    <div style="background:#fffbeb;padding:12px;border-radius:8px;font-size:13px;">
      💡 <b>Tip for Admin:</b> Login → Users page → click <b>🔑 Reset Pass</b> next to user's name → set a new password → tell user.
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="closeModal();setTimeout(openForgotPassword,150)">← Try Another Method</button>
    </div>
  `);
}

/* ========== 3. CHANGE OWN PASSWORD (when logged in) ========== */
function openChangeMyPassword() {
  const user = DB.currentUser();
  if (!user) return;
  openModal(`
    <h3>🔐 Change My Password</h3>
    <p class="sub">Logged in as <b>${escapeHtml(user.name)}</b> (${escapeHtml(user.username)})</p>

    <div class="field">
      <label>Current Password *</label>
      <input type="password" id="cpOld" placeholder="••••••••" autofocus/>
    </div>
    <div class="field">
      <label>New Password *</label>
      <input type="text" id="cpNew" placeholder="At least 4 characters"/>
    </div>
    <div class="field">
      <label>Confirm New Password *</label>
      <input type="text" id="cpNew2" placeholder="Same as above"/>
    </div>

    <div id="cpMsg"></div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="cpSave">💾 Change Password</button>
    </div>
  `, { onOpen(m) {
    $('#cpSave', m).onclick = () => {
      const oldp = $('#cpOld', m).value;
      const newp = $('#cpNew', m).value;
      const newp2 = $('#cpNew2', m).value;
      const fullUser = DB.get('users', user.id);
      if (!fullUser) { toast('User not found', 'error'); return; }
      if (fullUser.password !== oldp) { toast('❌ Current password is wrong', 'error'); return; }
      if (!newp || newp.length < 4) { toast('New password too short', 'error'); return; }
      if (newp !== newp2) { toast('Passwords do not match', 'error'); return; }
      DB.update('users', user.id, { password: newp });
      if (typeof logAction === 'function') logAction('user.passwordChange', 'Changed own password');
      toast('✅ Password changed!', 'success');
      closeModal();
    };
  }});
}

/* ========== 4. MASTER RECOVERY CODE SETUP — In Settings ========== */
function openMasterCodeSetup() {
  if (DB.currentUser().role !== 'admin') { toast('Admin only','error'); return; }
  const s = DB.settings();
  const exists = !!s.masterRecoveryCode;

  openModal(`
    <h3>🔑 Master Recovery Code Setup</h3>
    <p class="sub">This is a special code that lets you reset ANY user's password — even your own — if you ever forget.</p>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;">
      🔐 <b>Treat this like a bank PIN!</b><br>
      • Write it down on paper and keep safe<br>
      • Don't share with anyone except trusted family<br>
      • If lost, you'll need to use backup file recovery
    </div>

    ${exists ? `
      <div style="background:#dcfce7;padding:10px;border-radius:8px;color:#065f46;margin-bottom:14px;">
        ✅ Master Recovery Code is currently <b>SET</b>. You can change it below.
      </div>
    ` : `
      <div style="background:#fee2e2;padding:10px;border-radius:8px;color:#991b1b;margin-bottom:14px;">
        ⚠️ Master Recovery Code is <b>NOT SET</b>. Set it now for safety!
      </div>
    `}

    ${exists ? `
      <div class="field">
        <label>Current Code (verify)</label>
        <input type="password" id="mcsOld" placeholder="••••••••"/>
      </div>
    ` : ''}

    <div class="field">
      <label>New Master Code *</label>
      <input type="text" id="mcsNew" placeholder="e.g. Shop2026!"/>
      <small style="color:var(--text-soft);">Use a strong code: letters + numbers, 6+ characters</small>
    </div>

    <div class="field">
      <label>Confirm New Code *</label>
      <input type="text" id="mcsNew2" placeholder="Same as above"/>
    </div>

    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="mcsSave">💾 Save Master Code</button>
    </div>
  `, { onOpen(m) {
    $('#mcsSave', m).onclick = () => {
      if (exists) {
        const old = $('#mcsOld', m).value;
        if (old !== s.masterRecoveryCode) { toast('Current code wrong', 'error'); return; }
      }
      const np = $('#mcsNew', m).value;
      const np2 = $('#mcsNew2', m).value;
      if (!np || np.length < 6) { toast('Min 6 characters', 'error'); return; }
      if (np !== np2) { toast('Codes do not match', 'error'); return; }
      DB.saveSettings({ masterRecoveryCode: np, masterRecoveryCodeSetAt: new Date().toISOString() });
      if (typeof logAction === 'function') logAction('settings.masterCode', exists ? 'Master code changed' : 'Master code set');
      toast('✅ Master Recovery Code saved! Write it down safely.', 'success');
      closeModal();
    };
  }});
}

/* Make global */
window.openAdminResetPassword = openAdminResetPassword;
window.openForgotPassword = openForgotPassword;
window.openSecurityQuestionRecovery = openSecurityQuestionRecovery;
window.openMasterCodeRecovery = openMasterCodeRecovery;
window.openBackupRecovery = openBackupRecovery;
window.openChangeMyPassword = openChangeMyPassword;
window.openMasterCodeSetup = openMasterCodeSetup;
window.getSecurityQuestionText = getSecurityQuestionText;
window.SECURITY_QUESTIONS = SECURITY_QUESTIONS;
