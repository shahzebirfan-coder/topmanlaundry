/* ============================================================
   Permissions System
   Admin can grant/revoke specific page access to individual cashiers.
   Default cashier perms: pos, orders, customers (basic billing tasks)
   ============================================================ */

const ALL_PERMISSIONS = [
  { id:'dashboard',      label:'📊 Dashboard',          desc:'View Today\u2019s Performance, revenue, stats' },
  { id:'pos',            label:'🛒 New Sale (POS)',     desc:'Book new orders & take payments', defaultCashier:true },
  { id:'orders',         label:'📦 Orders / Invoices',  desc:'View, search, print invoices', defaultCashier:true },
  { id:'customers',      label:'👤 Customers',          desc:'Add, edit, view customers', defaultCashier:true },
  { id:'ledger',         label:'💰 Payment Ledger',     desc:'View dues & collect payments' },
  { id:'products',       label:'🧺 Products',           desc:'View & edit product rates' },
  { id:'expenses',       label:'💸 Expenses',           desc:'Add daily expenses' },
  { id:'reports',        label:'📈 Reports',            desc:'View sales reports & analytics' },
  { id:'inventory',      label:'📦 Inventory',          desc:'Manage supplies (detergent, hangers, etc.)' },
  { id:'cashbook',       label:'💵 Cash Book',          desc:'Daily cash reconciliation' },
  { id:'auditLog',       label:'🔐 Activity Log',       desc:'View all user actions' },
  { id:'vendors',        label:'🏭 Vendors',            desc:'Manage 3rd-party laundry vendors' },
  { id:'purchaseOrders', label:'📑 Purchase Orders',    desc:'Manage POs to vendors' },
  { id:'delivery',       label:'🚚 Pickup & Delivery', desc:'Manage home pickups and drivers' },
  { id:'reportBuilder',  label:'📈 Report Builder',     desc:'Build custom reports' },
  { id:'claims',         label:'🛡️ Claims',          desc:'Register & process customer claims' },
  { id:'inbox',          label:'📨 Customer Inbox',  desc:'View customer messages & payment proofs' },
  { id:'promoAdmin',     label:'🎁 Promo Codes',      desc:'Create/manage discount codes' },
  { id:'branches',       label:'🏢 Branches',           desc:'Manage shop branches' },
  // Sensitive operations
  { id:'editInvoice',    label:'✏️ Edit Invoices',       desc:'Modify existing invoices (admin-only by default)', sensitive:true },
  { id:'deleteOrders',   label:'🗑️ Delete Orders',       desc:'Permanently delete orders', sensitive:true },
  { id:'deleteCustomers',label:'🗑️ Delete Customers',    desc:'Delete customer records', sensitive:true },
  { id:'editProducts',   label:'✏️ Edit Product Rates',  desc:'Change product prices in rate list', sensitive:true },
  { id:'viewPhotos',     label:'📷 View/Manage Photos',  desc:'Add and view garment photos' }
];

/* Get permissions for a user — admin has all, cashier has overrides */
function getUserPermissions(user) {
  if (!user) return [];
  if (user.role === 'admin') return ALL_PERMISSIONS.map(p => p.id); // admin = everything
  // Cashier: check per-user permissions, fall back to defaults
  const fresh = DB.get('users', user.id);
  if (fresh && Array.isArray(fresh.permissions)) return fresh.permissions;
  return ALL_PERMISSIONS.filter(p => p.defaultCashier).map(p => p.id);
}

/* Check if current logged-in user has a permission */
function hasPermission(permId) {
  const user = DB.currentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getUserPermissions(user).includes(permId);
}

/* Set permissions for a user (admin only) */
function setUserPermissions(userId, permissions) {
  return DB.update('users', userId, { permissions: Array.isArray(permissions) ? permissions : [] });
}
