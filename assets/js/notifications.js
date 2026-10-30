/* ============================================================
   Sidebar Notification Badges + Real-Time Alerts
   - Pulsing red badges on Inbox, Claims, Pickup, Inventory
   - Browser desktop notifications when new items arrive
   - Soft "ding" sound for new alerts
   - Auto-refreshes every 10 seconds (catches Cloud Sync changes)
   ============================================================ */

const NotifSystem = {
  lastSnapshot: {},

  /* Count unread items per category */
  getCounts() {
    if (typeof DB === 'undefined') return {};
    const counts = {
      inbox: 0,         // unread messages + pending payment proofs + new reviews
      claims: 0,        // open claims
      delivery: 0,      // pending pickup requests
      inventory: 0      // low-stock items
    };

    try {
      const msgs = DB.all('messages').filter(m => m.status === 'unread').length;
      const proofs = DB.all('paymentProofs').filter(p => p.status === 'pending').length;
      counts.inbox = msgs + proofs;
    } catch(e){}

    try {
      counts.claims = DB.all('claims').filter(c => c.status === 'open').length;
    } catch(e){}

    try {
      counts.delivery = DB.all('pickupRequests').filter(r => r.status === 'pending').length;
    } catch(e){}

    try {
      counts.inventory = DB.all('inventory').filter(i => (i.stock||0) <= (i.minStock||0)).length;
    } catch(e){}

    return counts;
  },

  /* Detect changes since last check → trigger alerts */
  detectChanges(newCounts) {
    const changes = [];
    Object.keys(newCounts).forEach(key => {
      const oldVal = this.lastSnapshot[key] || 0;
      const newVal = newCounts[key];
      if (newVal > oldVal) {
        const diff = newVal - oldVal;
        changes.push({ category: key, count: diff, total: newVal });
      }
    });
    this.lastSnapshot = newCounts;
    return changes;
  },

  /* Apply badges to sidebar */
  applyBadges() {
    if (typeof DB === 'undefined' || !DB.currentUser()) return;
    const counts = this.getCounts();

    const map = [
      { page: 'inbox',     count: counts.inbox },
      { page: 'claims',    count: counts.claims },
      { page: 'delivery',  count: counts.delivery },
      { page: 'inventory', count: counts.inventory }
    ];

    map.forEach(({ page, count }) => {
      const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
      if (!navItem) return;
      // Remove old badge
      const oldBadge = navItem.querySelector('.notif-badge');
      if (oldBadge) oldBadge.remove();
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'notif-badge';
        badge.textContent = count > 99 ? '99+' : count;
        badge.title = `${count} new`;
        navItem.appendChild(badge);
      }
    });

    // Also update topbar bell icon if present
    this.updateTopbarBell(counts);
  },

  /* Update topbar bell with total count */
  updateTopbarBell(counts) {
    const total = counts.inbox + counts.claims + counts.delivery + counts.inventory;
    let bell = document.getElementById('notifBell');
    if (!bell) return;
    const bellBadge = bell.querySelector('.notif-bell-badge');
    if (bellBadge) bellBadge.remove();
    if (total > 0) {
      const span = document.createElement('span');
      span.className = 'notif-bell-badge';
      span.textContent = total > 99 ? '99+' : total;
      bell.appendChild(span);
    }
  },

  /* Trigger browser notification + sound */
  triggerAlerts(changes) {
    if (!changes.length) return;
    const labels = {
      inbox:     { icon: '💬', name: 'New Customer Message' },
      claims:    { icon: '🛡️', name: 'New Claim' },
      delivery:  { icon: '🚚', name: 'New Pickup Request' },
      inventory: { icon: '⚠️', name: 'Low Stock Alert' }
    };

    changes.forEach(ch => {
      const info = labels[ch.category] || { icon: '🔔', name: ch.category };
      // Sound
      if (typeof SoundFX !== 'undefined') SoundFX.play('notify');
      // Browser notification (if permitted)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(`${info.icon} ${info.name}`, {
            body: `${ch.count} new — ${ch.total} total pending`,
            icon: 'assets/img/logo.jpeg',
            badge: 'assets/img/logo.jpeg',
            tag: 'mrl-notif-' + ch.category
          });
          n.onclick = () => {
            window.focus();
            if (typeof app !== 'undefined') app.go(ch.category === 'inbox' ? 'inbox' : ch.category);
            n.close();
          };
        } catch(e) {}
      }
      // Toast notification
      if (typeof toast === 'function') {
        toast(`${info.icon} ${ch.count} new ${info.name.toLowerCase()}`, 'success');
      }
    });
  },

  /* Request browser notification permission */
  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  },

  /* Manual refresh + change detection */
  refresh(silent) {
    const counts = this.getCounts();
    if (!silent) {
      const changes = this.detectChanges(counts);
      if (changes.length > 0) this.triggerAlerts(changes);
    } else {
      this.lastSnapshot = counts;
    }
    this.applyBadges();
  },

  /* Start the polling system */
  start() {
    // Initial silent load (don't alert about existing items)
    setTimeout(() => this.refresh(true), 1500);
    // Request notification permission after 3 seconds
    setTimeout(() => this.requestPermission(), 3000);
    // Auto-refresh every 10 seconds
    setInterval(() => this.refresh(false), 10000);
    // Also refresh on visibility change (when tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.refresh(false);
    });
  }
};

/* === Auto-start when app is ready === */
window.addEventListener('DOMContentLoaded', () => {
  // Wait for DB to be loaded
  setTimeout(() => {
    if (typeof DB !== 'undefined' && DB.currentUser()) {
      NotifSystem.start();
    } else {
      // Try again after login
      setInterval(() => {
        if (typeof DB !== 'undefined' && DB.currentUser() && !NotifSystem._started) {
          NotifSystem._started = true;
          NotifSystem.start();
        }
      }, 2000);
    }
  }, 1000);
});

/* === Re-apply badges on every nav change === */
if (typeof window !== 'undefined') {
  const origGo = window.app ? window.app.go : null;
  setTimeout(() => {
    if (window.app && window.app.go && !window.app._notifWrapped) {
      const orig = window.app.go.bind(window.app);
      window.app.go = function(page) {
        const result = orig(page);
        setTimeout(() => NotifSystem.applyBadges(), 100);
        return result;
      };
      window.app._notifWrapped = true;
    }
  }, 2000);
}

/* === Notifications Panel — opens when bell is clicked === */
function openNotificationsPanel() {
  if (typeof openModal !== 'function') return;
  const counts = NotifSystem.getCounts();
  const total = counts.inbox + counts.claims + counts.delivery + counts.inventory;

  // Get recent items for preview
  const recentMsgs = DB.all('messages').filter(m => m.status === 'unread')
    .sort((a,b)=>(b.receivedAt||'').localeCompare(a.receivedAt||'')).slice(0,5);
  const recentProofs = DB.all('paymentProofs').filter(p => p.status === 'pending')
    .sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,3);
  const openClaims = DB.all('claims').filter(c => c.status === 'open')
    .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,3);
  const pendingPickups = DB.all('pickupRequests').filter(r => r.status === 'pending')
    .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,3);
  const lowStock = DB.all('inventory').filter(i => (i.stock||0) <= (i.minStock||0));

  let html = `<h3>🔔 Notifications`;
  if (total > 0) html += ` <span class="badge due">${total}</span>`;
  html += `</h3>`;

  if (total === 0) {
    html += `<div class="empty"><div class="emoji">✅</div><h4>All caught up!</h4><p>No new notifications.</p></div>`;
  } else {
    // Messages section
    if (recentMsgs.length > 0) {
      html += `<div style="margin:14px 0 8px;font-weight:700;color:var(--primary);">💬 Customer Messages (${counts.inbox - recentProofs.length})</div>`;
      recentMsgs.forEach(m => {
        html += `<div class="notif-item" data-go="inbox" style="padding:10px 12px;background:var(--surface-alt);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid #4f7cff;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><b>${escapeHtml(m.name)}</b> <small style="color:var(--text-soft);">${escapeHtml(m.phone)}</small></div>
            <span style="font-size:11px;color:var(--text-soft);">${fmtDateShort(m.receivedAt)}</span>
          </div>
          <div style="font-size:12px;margin-top:4px;color:var(--text-soft);">${escapeHtml(m.text.substring(0, 80))}${m.text.length>80?'...':''}</div>
        </div>`;
      });
    }
    // Payment proofs
    if (recentProofs.length > 0) {
      html += `<div style="margin:14px 0 8px;font-weight:700;color:var(--warning);">💳 Payment Proofs Pending</div>`;
      recentProofs.forEach(p => {
        html += `<div class="notif-item" data-go="inbox" style="padding:10px 12px;background:#fef3c7;border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid #f59e0b;">
          <b>${escapeHtml(p.payerName)}</b> paid <b>${fmtMoney(p.amount)}</b>
          <small style="display:block;color:var(--text-soft);">Verify in inbox</small>
        </div>`;
      });
    }
    // Open claims
    if (openClaims.length > 0) {
      html += `<div style="margin:14px 0 8px;font-weight:700;color:#7c3aed;">🛡️ Open Claims (${counts.claims})</div>`;
      openClaims.forEach(c => {
        html += `<div class="notif-item" data-go="claims" style="padding:10px 12px;background:var(--surface-alt);border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid #7c3aed;">
          <b>${escapeHtml(c.claimNo)}</b> — ${escapeHtml(c.customerName)}
        </div>`;
      });
    }
    // Pickup requests
    if (pendingPickups.length > 0) {
      html += `<div style="margin:14px 0 8px;font-weight:700;color:#22c55e;">🚚 Pickup Requests (${counts.delivery})</div>`;
      pendingPickups.forEach(r => {
        html += `<div class="notif-item" data-go="delivery" style="padding:10px 12px;background:#d1fae5;border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid #22c55e;">
          <b>${escapeHtml(r.customerName)}</b> — ${escapeHtml(r.pickupDate)} ${escapeHtml(r.pickupSlot)}
        </div>`;
      });
    }
    // Low stock
    if (lowStock.length > 0) {
      html += `<div style="margin:14px 0 8px;font-weight:700;color:var(--danger);">⚠️ Low Stock (${counts.inventory})</div>`;
      lowStock.forEach(i => {
        html += `<div class="notif-item" data-go="inventory" style="padding:10px 12px;background:#fee2e2;border-radius:8px;margin-bottom:6px;cursor:pointer;border-left:3px solid #ef4444;">
          <b>${escapeHtml(i.name)}</b> — only <b>${i.stock||0} ${i.unit||''}</b> left
        </div>`;
      });
    }
  }

  html += `<div class="modal-footer">
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
  </div>`;

  openModal(html, { large: true, onOpen(m) {
    m.querySelectorAll('.notif-item').forEach(el => el.onclick = () => {
      const page = el.dataset.go;
      closeModal();
      if (typeof app !== 'undefined') app.go(page);
    });
  }});
}
