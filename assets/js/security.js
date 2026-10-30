/* ============================================================
   Security: Cash close lock + Suspicious activity alerts
   ============================================================ */

/* Check if today's cash is closed */
function isTodayCashClosed() {
  const today = isoDay();
  return DB.all('dayClosures').some(c => c.date === today);
}

/* Wrapper around logout that enforces cash close */
function attemptLogout() {
  const user = DB.currentUser();
  if (!user) { DB.logout(); app.go('login'); return; }

  const settings = DB.settings();
  const forceLock = settings.forceCashClose !== false;

  // Admin can always logout
  if (user.role === 'admin') {
    confirmDialog('Are you sure you want to logout?', () => {
      DB.logout(); app.go('login');
    });
    return;
  }

  // Cashier: check cash close
  if (forceLock && !isTodayCashClosed()) {
    // Check if there are any sales today (otherwise no need to close)
    const todayOrders = DB.all('orders').filter(o =>
      o.cashierId === user.id && o.createdAt.slice(0,10) === isoDay()
    );

    if (todayOrders.length > 0) {
      openModal(`
        <h3 style="color:var(--danger);">🔒 Cash Close Required</h3>
        <p class="sub">You cannot logout without closing today's cash register.</p>

        <div style="background:#fee2e2;border-left:4px solid #ef4444;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;color:#7f1d1d;">
          You have processed <b>${todayOrders.length} orders</b> today totaling <b>${fmtMoney(todayOrders.reduce((s,o)=>s+(o.paid||0),0))}</b>.
          <br><br>
          Please count the cash drawer and close the day from <b>💵 Cash Book</b> before logging out.
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="closeModal();app.go('cashbook');">💵 Go to Cash Book →</button>
        </div>
      `);
      return;
    }
  }

  // OK to logout
  confirmDialog('Are you sure you want to logout?', () => {
    DB.logout(); app.go('login');
  });
}

/* ============================================================
   SUSPICIOUS ACTIVITY DETECTION
   ============================================================ */
function checkSuspiciousActivity(action, details) {
  const settings = DB.settings();
  if (settings.suspiciousAlerts === false) return;
  const user = DB.currentUser();
  if (!user || user.role === 'admin') return;  // skip admin actions

  let suspicious = false;
  let reason = '';

  if (action.includes('delete')) {
    suspicious = true;
    reason = `🚨 CASHIER DELETED: ${details}`;
  } else if (action === 'order.large_discount') {
    suspicious = true;
    reason = `⚠️ LARGE DISCOUNT applied: ${details}`;
  } else if (action === 'order.refund') {
    suspicious = true;
    reason = `⚠️ REFUND issued: ${details}`;
  } else if (action.includes('void')) {
    suspicious = true;
    reason = `⚠️ ORDER VOIDED: ${details}`;
  }

  if (suspicious) {
    DB.insert('auditLog', {
      action: 'security.flag',
      details: reason + ' (by cashier ' + user.username + ')',
      userId: user.id,
      username: user.username,
      userName: user.name,
      role: user.role,
      timestamp: new Date().toISOString(),
      flagged: true
    });
  }
}

/* Hook large-discount check into order create */
function checkLargeDiscount(orderData) {
  const settings = DB.settings();
  const threshold = settings.largeDiscountThreshold || 500;
  const discount = (orderData.discount || orderData.manualDiscount || 0);
  if (discount >= threshold) {
    const user = DB.currentUser();
    if (user && user.role !== 'admin') {
      checkSuspiciousActivity('order.large_discount',
        `Cashier ${user.username}: ${fmtMoney(discount)} discount on ${orderData.invoiceNo ? 'INV-' + orderData.invoiceNo : 'order'}`);
    }
  }
}

/* Get count of flagged actions today */
function getSuspiciousCountToday() {
  const today = isoDay();
  return DB.all('auditLog').filter(a => a.flagged && a.timestamp.slice(0,10) === today).length;
}
