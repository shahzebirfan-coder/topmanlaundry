const CACHE_NAME = 'mr-laundry-pos-v33';
const urlsToCache = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/css/responsive.css',
  './assets/css/boot.css',
  './assets/css/expenses.css',
  './assets/css/holiday-themes.css',
  './assets/img/logo.jpeg',
  './assets/img/holidays/iqbal-1935.jpg',
  './assets/img/holidays/iqbal-profile.jpg',
  './assets/img/holidays/jinnah-1945.jpg',
  './assets/js/app.js',
  './assets/js/auth-recovery.js',
  './assets/js/it-core.js',
  './assets/js/client-config.js',
  './assets/js/cloud-autoconfig.js',
  './assets/js/cloudsync.js',
  './assets/js/components.js',
  './assets/js/it-owner.js',
  './assets/js/portal-payments.js',
  './assets/js/pickup-slots.js',
  './assets/js/db.js',
  './assets/js/extras.js',
  './assets/js/gdrive.js',
  './assets/js/holiday-themes.js',
  './assets/js/i18n.js',
  './assets/js/inventory-auto.js',
  './assets/js/marketing.js',
  './assets/js/notifications.js',
  './assets/js/permissions.js',
  './assets/js/persistent.js',
  './assets/js/portal-helpers.js',
  './assets/js/portal-i18n.js',
  './assets/js/qrcode.min.js',
  './assets/js/refund.js',
  './assets/js/security.js',
  './assets/js/shortcuts.js',
  './assets/js/sounds.js',
  './assets/js/thermal-logo.js',
  './assets/js/utils.js',
  './assets/js/whatsapp.js',
  './assets/js/pages/auditLog.js',
  './assets/js/pages/branches.js',
  './assets/js/pages/cashbook.js',
  './assets/js/pages/claims.js',
  './assets/js/pages/customers.js',
  './assets/js/pages/dashboard.js',
  './assets/js/pages/delivery.js',
  './assets/js/pages/drawings.js',
  './assets/js/pages/expenses.js',
  './assets/js/pages/inbox.js',
  './assets/js/pages/inventory.js',
  './assets/js/pages/invoice.js',
  './assets/js/pages/ledger.js',
  './assets/js/pages/login.js',
  './assets/js/pages/marketing.js',
  './assets/js/pages/orders.js',
  './assets/js/pages/photos.js',
  './assets/js/pages/pos.js',
  './assets/js/pages/products.js',
  './assets/js/pages/promoAdmin.js',
  './assets/js/pages/purchaseOrders.js',
  './assets/js/pages/reportBuilder.js',
  './assets/js/pages/reports.js',
  './assets/js/pages/settings.js',
  './assets/js/pages/taskboard.js',
  './assets/js/pages/users.js',
  './assets/js/pages/vendors.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Drop old caches so an app update never leaves stale CSS/JS behind
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

