/* ============================================================
   Laundry POS POS — Database (localStorage abstraction)
   Swap functions in this file later to use real backend (PHP/MySQL).
   ============================================================ */

const DB_KEY = 'mrLaundryDB';
const SESSION_KEY = 'mrLaundrySession';

const DB = {
  _data: null,

  load() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try { this._data = JSON.parse(raw); }
      catch(e){ this._data = this._seed(); this.save(); }
      // Migration: ensure new top-level tables exist
      const seed = this._seed();
    const now = '2024-01-01T00:00:00.000Z'; // Fixed date so remote data always overwrites local defaults on a fresh device!
      // Ensure default Hanger & Shopper inventory items exist (auto-add if missing)
      const inv = this._data.inventory;
      if (!inv.find(i => i.autoDeduct === 'hanger')) {
        inv.push({ id: 'inv_hanger', name: 'Hangers', unit: 'pcs', stock: 100, minStock: 20, unitCost: 5, autoDeduct: 'hanger', createdAt: '2024-01-01T00:00:00.000Z' });
      }
      if (!inv.find(i => i.autoDeduct === 'shopper')) {
        inv.push({ id: 'inv_shopper', name: 'Shoppers (Plastic Bags)', unit: 'pcs', stock: 100, minStock: 20, unitCost: 3, autoDeduct: 'shopper', createdAt: '2024-01-01T00:00:00.000Z' });
      }
      ['vendors_dummy_skip'].forEach(t => { if (!this._data[t]) this._data[t] = seed[t]; });
      this._data.settings = Object.assign({}, seed.settings, this._data.settings);
      // Smart fill: if payment fields are empty/missing, copy defaults from seed
      ['jazzcashName','jazzcashNumber','easypaisaName','easypaisaNumber','portalTerms'].forEach(k => {
        if (!this._data.settings[k] || this._data.settings[k] === '') {
          this._data.settings[k] = seed.settings[k];
        }
      });
      this._data._counters = this._data._counters || { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000 };
      if (!this._data.branches || !this._data.branches.length) {
        this._data.branches = [{ id: 'main', name: 'Main Branch', address: '', phone: '', color: '#4f7cff', isActive: true, createdAt: '2024-01-01T00:00:00.000Z' }];
      }
      
      
      // Client Migration: Update credentials
      if (this._data.users) {
        let adminUser = this._data.users.find(u => u.username === 'demo' || u.role === 'admin');
        if (adminUser && typeof CLIENT_CONFIG !== 'undefined') {
          adminUser.username = CLIENT_CONFIG.adminUsername;
          adminUser.password = CLIENT_CONFIG.adminPassword;
          adminUser.name = CLIENT_CONFIG.adminName;
        }
      }
      if (this._data.settings && (this._data.settings.shopName === 'Laundry POS' || this._data.settings.shopName === 'Mr Laundry')) {
        this._data.settings.shopName = typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.shopName : 'Laundry POS';
        this._data.settings.tagline = typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.tagline : '';
        this._data.settings.phone = typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.phone || '') : '';
        this._data.settings.address = typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.address || '') : '';
        this._data.settings.facebook = typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.facebook || '') : '';
      }

      if (this._data._counters.po == null) this._data._counters.po = 1000;
      if (this._data._counters.expense == null) this._data._counters.expense = 1000;

      // Expense categories became editable — seed the table for older installs
      if (!Array.isArray(this._data.expenseCategories) || !this._data.expenseCategories.length) {
        this._data.expenseCategories = [
          { id:'rent',        label:'🏠 Rent',                        color:'#ef4444', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'salary',      label:'👤 Salary / Wages',              color:'#f59e0b', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'utilities',   label:'💡 Utilities (Bills)',           color:'#3b82f6', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'supplies',    label:'🧴 Supplies (Detergent, etc.)',  color:'#06b6d4', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'maintenance', label:'🔧 Maintenance / Repair',        color:'#8b5cf6', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'transport',   label:'🚚 Transport / Fuel',            color:'#ec4899', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'marketing',   label:'📢 Marketing / Ads',             color:'#10b981', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'tax',         label:'🧾 Tax / Govt Fee',              color:'#dc2626', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'food',        label:'🍵 Food / Tea for Staff',        color:'#eab308', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'rawmaterial', label:'🧺 Raw Material',                color:'#0ea5e9', createdAt:'2024-01-01T00:00:00.000Z' },
          { id:'other',       label:'📦 Other',                       color:'#6b7280', createdAt:'2024-01-01T00:00:00.000Z' }
        ];
        this.save();
      }

      // Thermal printer defaults — applied once, never overrides a client's own choice.
      // This makes an existing install plug & play with a receipt printer too.
      const st = this._data.settings;
      if (st && !st._thermalDefaults) {
        if (st.invoicePaper == null)    st.invoicePaper = '80';
        if (st.invoiceLogoSize == null) st.invoiceLogoSize = 62;
        if (st.invoiceLogoMono == null) st.invoiceLogoMono = true;
        if (st.invoiceMarginMm == null) st.invoiceMarginMm = 2;
        if (st.invoiceShowLogo == null) st.invoiceShowLogo = true;
        st._thermalDefaults = 1;
        this.save();
      }
    } else {
      this._data = this._seed();
      this.save();
    }
    return this._data;
  },

  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this._data));
  },

  reset() {
    this._data = this._seed();
    this.save();
  },

  _seed() {
    const now = new Date().toISOString();
    return {
      expenseCategories: [
        { id:'rent',        label:'🏠 Rent',                        color:'#ef4444', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'salary',      label:'👤 Salary / Wages',              color:'#f59e0b', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'utilities',   label:'💡 Utilities (Bills)',           color:'#3b82f6', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'supplies',    label:'🧴 Supplies (Detergent, etc.)',  color:'#06b6d4', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'maintenance', label:'🔧 Maintenance / Repair',        color:'#8b5cf6', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'transport',   label:'🚚 Transport / Fuel',            color:'#ec4899', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'marketing',   label:'📢 Marketing / Ads',             color:'#10b981', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'tax',         label:'🧾 Tax / Govt Fee',              color:'#dc2626', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'food',        label:'🍵 Food / Tea for Staff',        color:'#eab308', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'rawmaterial', label:'🧺 Raw Material',                color:'#0ea5e9', createdAt:'2024-01-01T00:00:00.000Z' },
        { id:'other',       label:'📦 Other',                       color:'#6b7280', createdAt:'2024-01-01T00:00:00.000Z' }
      ],
      _counters: { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000, expense: 1000 },
      users: [
        { id: 'u1', name: typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.adminName : 'Admin', username: typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.adminUsername : 'admin', password: typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.adminPassword : 'password', role: 'admin', createdAt: now },
        { id: 'u2', name: 'AI Bot Cashier', username: 'aibot', password: 'aibot123', role: 'cashier', createdAt: now }
      ],
      categories: [
        { id: 'cgents',  name: 'Gents Wear',  icon: '👔' },
        { id: 'cladies', name: 'Ladies Wear', icon: '🥻' },
        { id: 'cothers', name: 'Others',      icon: '🧺' },
        { id: 'cpress',  name: 'Press / Ironing', icon: '♨️' }
      ],
      products: getMrLaundryRateList(),
      customers: [
        { id: 'cu1', name: 'Walk-in Customer', phone: '', address: '', loyaltyNo: '', loyaltyDiscountPercent: 0, loyaltyActive: false, createdAt: now }
      ],
      orders: [],
      expenses: [],
      ownerDrawings: [],     // Owner's personal withdrawals from shop money
      vendors: [
        { id: 'v1', name: 'Sample Laundry Vendor', contactPerson: '', phone: '', address: '', openingBalance: 0, createdAt: now }
      ],
      branches: [
        { id: 'main', name: 'Main Branch', address: '', phone: '', color: '#4f7cff', isActive: true, createdAt: '2024-01-01T00:00:00.000Z' }
      ],
      purchaseOrders: [],
      inventory: [
        { id: 'inv_hanger',  name: 'Hangers',  unit: 'pcs', stock: 100, minStock: 20, unitCost: 5,  autoDeduct: 'hanger',  createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'inv_shopper', name: 'Shoppers (Plastic Bags)', unit: 'pcs', stock: 100, minStock: 20, unitCost: 3, autoDeduct: 'shopper', createdAt: '2024-01-01T00:00:00.000Z' }
      ],
      inventoryMovements: [],
      dayClosures: [],
      auditLog: [],
      messages: [],
      paymentProofs: [],
      promoCodes: [],
      reviews: [],
      pushSubs: [],
      claims: [],
      vouchers: [],
      drivers: [],
      pickupRequests: [],
      refundReasons: [],
      autoReplyRules: [
        { id:'ar1', trigger:'order|status|where', reply:'Thank you for contacting us! Please share your invoice number and we will check the status immediately.', active:true },
        { id:'ar2', trigger:'price|rate|cost|kitna', reply:'For pricing, please visit our portal or send us the item name. Standard rates: Shirt Rs.150, Pant Rs.150, Suit Rs.1000.', active:true },
        { id:'ar3', trigger:'closed|hours|timing|open', reply:'We are open Mon-Sat: 9:00 AM - 9:00 PM, Sunday Closed. Thank you!', active:true }
      ],
      reportTemplates: [],
      settings: {
        shopName: typeof CLIENT_CONFIG !== 'undefined' ? CLIENT_CONFIG.shopName : 'Laundry POS',
        tagline: typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.tagline || '') : '',
        address: typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.address || '') : '',
        phone: typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.phone || '') : '',
        facebook: typeof CLIENT_CONFIG !== 'undefined' ? (CLIENT_CONFIG.facebook || '') : '',
        currency: 'Rs.',
        taxPercent: 0,
        logo: '🧺',
        logoImage: 'assets/img/logo.jpeg',
        invoiceFooter: 'Thank you for choosing Laundry POS!',
        baseUrl: '',
        defaultDeliveryDays: 2,
        loyaltyPrefix: 'MRL',
        defaultLoyaltyDiscountPercent: 10,
        autoBackupReminder: true,
        poPrefix: 'PO',
        // ===== INVOICE CUSTOMIZATION =====
        invoiceFontSize: 13,           // base font size in px
        invoiceWidth: 360,             // max width in px (thermal=300, A6=420, A5=560)
        // ===== THERMAL RECEIPT DEFAULTS (plug & play) =====
        invoicePaper: '80',            // '58' = 58mm roll, '80' = 80mm roll
        invoiceLogoSize: 62,           // logo width as % of printable area
        invoiceLogoMono: true,         // 1-bit black & white for thermal heads
        invoiceMarginMm: 2,            // page margin in mm
        _thermalDefaults: 1,           // marks that defaults were applied
        invoiceQtyCircle: true,        // show big quantity circle
        invoiceShowLogo: true,
        invoiceShowAddress: true,
        invoiceShowPhone: true,
        invoiceShowTagline: true,
        invoiceShowCashier: true,
        invoiceShowQR: true,
        invoiceShowDeliveryType: true, // Hanger/Fold
        invoiceShowItemBreakdown: true,
        invoiceShowPaymentMethod: true,
        invoiceShowDiscount: true,
        invoiceShowNotes: true,
        invoiceShowFooter: true,
        invoiceShowEditedBadge: true,
        invoiceTerms: 'Items not collected within 30 days are non-refundable.',
        invoiceShowTerms: false,
        // Office-copy & WhatsApp settings
        printDualCopy: true,           // when true, prints customer + office copy together
        officeCopyWidth: 280,          // small slip for office
        officeCopyFontSize: 11,
        photoRetentionDays: 30,        // auto-cleanup photos older than X days after delivery
        photoAutoCleanup: true,
        // === Portal-specific settings ===
        shopHours: 'Mon-Sat: 9:00 AM - 9:00 PM\nSunday: Closed',
        shopLocation: '',
        shopMapUrl: '',
        portalLang: 'en',
        // === Payment settings ===
        bankName: '',
        bankAccountTitle: 'Shahzeb Vakani',
        bankAccountNumber: '',
        jazzcashName: 'Shahzeb Vakani',
        jazzcashNumber: '0302 8244803',
        easypaisaName: 'Shahzeb Vakani',
        easypaisaNumber: '0302 8244803',
        paymentInstructions: 'Please pay to the above account and upload screenshot below. We will verify and mark your invoice as PAID within 30 minutes.',
        // === Loyalty / Referral ===
        referralDiscountPercent: 10,
        // === Claims Policy ===
        claimPolicyPercent: 30,
        claimVoucherFreeCount: 7,
        claimVoucherValidDays: 180,
        claimPrefix: 'CLM',
        voucherPrefix: 'VCH',
        // === Cash close lock ===
        forceCashClose: true,             // require day close before logout
        // === Sound effects ===
        soundEffects: true,
        // === Suspicious alerts ===
        suspiciousAlerts: true,
        largeDiscountThreshold: 500,      // alert if discount > Rs.500
        largeRefundThreshold: 1000,
        // === Auto-reply ===
        autoReplyEnabled: true,
        // === Public reviews ===
        showPublicReviews: true,
        minReviewStars: 4,                // only show reviews with 4+ stars publicly
        claimTerms: 'Claim valid only with original purchase slip. Voucher valid for 7 free wash services within 6 months from issue date. Non-transferable. Cannot be exchanged for cash.',
        portalTerms: '1. Customer is requested to check articles before delivery; complaints will not be entertained afterwards.\n2. Articles not collected within 30 days from delivery date will not be the responsibility of Laundry POS.\n3. We are not responsible for shrinkage, color fading, or damage to delicate fabrics (silk, wool, embroidery, beads, sequins, leather).\n4. Buttons, beads, or any decorative items that come off during washing/cleaning are not our responsibility.\n5. In case of any loss or damage caused by us, compensation will be limited to a maximum of 5 times the laundry charge of that article, OR as per our Claim Policy (30% of original purchase price with valid receipt).\n6. Pre-existing stains, tears, color bleeding, or hidden damage are NOT our liability.\n7. We take all reasonable care, but articles are accepted at the owner\'s risk.\n8. Payment must be made at the time of delivery unless agreed otherwise.\n9. Pickup & delivery timing may vary on Sundays, public holidays, and during heavy load.\n10. Cash on Delivery (COD) orders must be paid in full to the rider.\n11. By giving us your articles for service, you agree to these Terms & Conditions.\n12. Management reserves the right to update these terms at any time without prior notice.',
        // === Push notifications ===
        pushVapidPublicKey: '',
        whatsappTemplate: 'Hello {name}, thank you for your order at {shop}!\n\nInvoice: {invoice}\nTotal Pcs: {pcs}\nAmount: {total}\nPaid: {paid}\nDue: {due}\nDelivery: {delivery} ({type})\n\n{footer}'
      }
    };
  },

  all(table)  { return this._data[table] || []; },
  get(table, id) { return (this._data[table] || []).find(r => r.id === id); },
  insert(table, record) {
    record.id = record.id || (table[0] + Date.now().toString(36) + Math.floor(Math.random()*1000));
    record.createdAt = record.createdAt || new Date().toISOString();
    this._data[table].push(record);
    this.save();
    return record;
  },
  update(table, id, patch) {
    const i = this._data[table].findIndex(r => r.id === id);
    if (i === -1) return null;
    this._data[table][i] = { ...this._data[table][i], ...patch };
    this.save();
    return this._data[table][i];
  },
  remove(table, id) {
    const i = this._data[table].findIndex(r => r.id === id);
    if (i === -1) return false;
    this._data[table].splice(i, 1);
    this.save();
    return true;
  },

  nextLoyaltyNumber() {
    if (!this._data._counters) this._data._counters = { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000 };
    this._data._counters.loyalty += 1;
    this.save();
    const prefix = (this._data.settings.loyaltyPrefix || 'MRL').toUpperCase();
    return `${prefix}-${this._data._counters.loyalty}`;
  },
  
  nextInvoiceNumber() {
    if (!this._data._counters) this._data._counters = { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000 };
    
    // Find highest existing invoice number in orders array to prevent ANY duplication
    let maxExisting = 1000;
    if (this._data.orders && this._data.orders.length > 0) {
      for (let o of this._data.orders) {
        if (o.invoiceNo && !isNaN(o.invoiceNo) && parseInt(o.invoiceNo) > maxExisting) {
          maxExisting = parseInt(o.invoiceNo);
        }
      }
    }
    
    let nextVal = Math.max(this._data._counters.invoice || 1000, maxExisting) + 1;
    this._data._counters.invoice = nextVal;
    this.save();
    return nextVal;
  },

  nextClaimNumber() {
    if (!this._data._counters) this._data._counters = { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000 };
    this._data._counters.claim = (this._data._counters.claim || 1000) + 1;
    this.save();
    const prefix = (this._data.settings.claimPrefix || 'CLM').toUpperCase();
    return `${prefix}-${this._data._counters.claim}`;
  },
  nextVoucherNumber() {
    if (!this._data._counters) this._data._counters = { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000 };
    this._data._counters.voucher = (this._data._counters.voucher || 1000) + 1;
    this.save();
    const prefix = (this._data.settings.voucherPrefix || 'VCH').toUpperCase();
    return `${prefix}-${this._data._counters.voucher}`;
  },
  nextPONumber() {
    if (!this._data._counters) this._data._counters = { loyalty: 1000, invoice: 1000, po: 1000, claim: 1000, voucher: 1000 };
    this._data._counters.po = (this._data._counters.po || 1000) + 1;
    this.save();
    const prefix = (this._data.settings.poPrefix || 'PO').toUpperCase();
    return `${prefix}-${this._data._counters.po}`;
  },

  settings() { return this._data.settings; },
  saveSettings(patch) { 
    patch._settingsUpdatedAt = new Date().toISOString();
    this._data.settings = { ...this._data.settings, ...patch }; 
    this.save(); 
    // Brand logo / paper settings changed → rebuild the thermal print logo
    if (window.THERMAL && ('logoImage' in patch || 'invoicePaper' in patch ||
        'invoiceLogoSize' in patch || 'invoiceLogoMono' in patch)) {
      try { THERMAL.clearCache(); THERMAL.prime(); } catch (e) {}
    }
  },

  login(username, password) {
    const un = username.toLowerCase();
    const u = this._data.users.find(x => x.username.toLowerCase() === un && x.password === password);
    if (!u) {
      // Log failed attempt
      try {
        this._data.auditLog = this._data.auditLog || [];
        this._data.auditLog.push({
          id: 'a'+Date.now().toString(36),
          action: 'login.failed',
          details: 'Username: '+username,
          username, userName: username, role: 'unknown',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        this.save();
      } catch(e){}
      return null;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, name: u.name, username: u.username, role: u.role }));
    // Log successful login
    try {
      this._data.auditLog = this._data.auditLog || [];
      this._data.auditLog.push({
        id: 'a'+Date.now().toString(36),
        action: 'login',
        details: '',
        userId: u.id, username: u.username, userName: u.name, role: u.role,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      this.save();
    } catch(e){}
    return u;
  },
  logout() {
    const u = this.currentUser();
    if (u) {
      try {
        this._data.auditLog = this._data.auditLog || [];
        this._data.auditLog.push({
          id: 'a'+Date.now().toString(36),
          action: 'logout',
          details: '',
          userId: u.id, username: u.username, userName: u.name, role: u.role,
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        this.save();
      } catch(e){}
    }
    sessionStorage.removeItem(SESSION_KEY);
  },
  currentUser() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e){ return null; }
  },

  exportJSON() { return JSON.stringify(this._data, null, 2); },
  importJSON(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    this._data = parsed; this.save();
  }
};

/* ============================================================
   MR LAUNDRY OFFICIAL RATE LIST
   Update prices here, then click "Import/Reset Price List" in admin Products page.
   ============================================================ */
function getMrLaundryRateList() {
  const G = 'cgents', L = 'cladies', O = 'cothers', P = 'cpress';
  const list = [
    // ===== GENTS WEAR =====
    { name: 'Suit 2 Pcs',            category: G, price: 800,  image: '🤵' },
    { name: 'Suit 3 Pcs',            category: G, price: 1000, image: '🤵' },
    { name: 'Coat',                  category: G, price: 600,  image: '🧥' },
    { name: 'Dress Pant',            category: G, price: 200,  image: '👖' },
    { name: 'Trouser',               category: G, price: 200,  image: '👖' },
    { name: 'Waist Coat',            category: G, price: 300,  image: '🦺' },
    { name: 'Shalwar Suit',          category: G, price: 250,  image: '🥻' },
    { name: 'Kurta',                 category: G, price: 125,  image: '👘' },
    { name: 'Shalwar / Pajama',      category: G, price: 125,  image: '👖' },
    { name: 'Boski Shalwar Suit',    category: G, price: 500,  image: '🥻' },
    { name: 'T-Shirt',               category: G, price: 150,  image: '👕' },
    { name: 'Polo / Collar Shirt',   category: G, price: 150,  image: '👕' },
    { name: 'Open Shirt',            category: G, price: 150,  image: '👔' },
    { name: 'Tie',                   category: G, price: 100,  image: '👔' },
    { name: 'Safari Suit',           category: G, price: 400,  image: '🤵' },
    { name: 'Vest',                  category: G, price: 60,   image: '👕' },
    { name: 'Under Wear',            category: G, price: 60,   image: '🩲' },
    { name: 'Sherwani',              category: G, price: 1000, image: '🤴' },
    { name: 'Kurta Saya / Lab Coat', category: G, price: 200,  image: '🥼' },
    { name: 'Kandurah',              category: G, price: 200,  image: '👘' },
    { name: 'Shorts',                category: G, price: 150,  image: '🩳' },
    { name: 'Kids T-Shirt',          category: G, price: 120,  image: '👕' },
    { name: 'Kids Shorts',           category: G, price: 120,  image: '🩳' },
    { name: 'Kids Shirt',            category: G, price: 120,  image: '👔' },
    { name: 'Kids Trouser / Jeans',  category: G, price: 120,  image: '👖' },

    // ===== LADIES WEAR =====
    { name: 'Shalwar Suit Plain - 3 Pcs', category: L, price: 400, image: '🥻' },
    { name: 'Shalwar Suit Plain - 2 Pcs', category: L, price: 300, image: '🥻' },
    { name: 'Dupatta',                    category: L, price: 150, image: '🧣' },
    { name: 'Ladies Shirt',               category: L, price: 150, image: '👚' },
    { name: 'Ladies Shalwar / Pajama',    category: L, price: 150, image: '👖' },
    { name: 'Fancy / Kamdar Shirt',       category: L, price: 600, image: '👚' },
    { name: 'Fancy / Kamdar Dupatta',     category: L, price: 800, image: '🧣' },
    { name: 'Gharara / Maxi',             category: L, price: 1500, image: '👗' },
    { name: 'Saree Plain',                category: L, price: 600,  image: '🥻' },
    { name: 'Saree Fancy / Kamdar',       category: L, price: 800,  image: '🥻' },
    { name: 'Burqa / Abaya Plain',        category: L, price: 500,  image: '🧕' },
    { name: 'Burqa / Abaya Fancy / Kamdar', category: L, price: 700, image: '🧕' },
    { name: 'Frock',                      category: L, price: 1200, image: '👗' },
    { name: 'Blouse Plain',               category: L, price: 500,  image: '👚' },
    { name: 'Petty Coat',                 category: L, price: 150,  image: '👗' },
    { name: 'Scarf / Stole',              category: L, price: 150,  image: '🧣' },
    { name: 'Skirt Suit',                 category: L, price: 400,  image: '👗' },
    { name: 'Short Coat',                 category: L, price: 400,  image: '🧥' },
    { name: 'Bridal Dress - Maxi',        category: L, price: 6000, image: '👰' },
    { name: 'Bridal Dress - 3 Pcs Suit',  category: L, price: 6000, image: '👰' },
    { name: 'Ladies Undergarments (BRA)', category: L, price: 80,   image: '🩲' },

    // ===== OTHERS =====
    { name: 'Hoodie / Cardigan / Sweater', category: O, price: 600,  image: '🧥' },
    { name: 'Heavy Jacket',               category: O, price: 800,  image: '🧥' },
    { name: 'Jacket Leather',             category: O, price: 1000, image: '🧥' },
    { name: 'Over Coat',                  category: O, price: 1200, image: '🧥' },
    { name: 'Socks',                      category: O, price: 60,   image: '🧦' },
    { name: 'Track Suit',                 category: O, price: 400,  image: '🏃' },
    { name: 'Shawl',                      category: O, price: 800,  image: '🧣' },
    { name: 'Ajrak',                      category: O, price: 300,  image: '🧣' },
    { name: 'Apron',                      category: O, price: 100,  image: '🥼' },
    { name: 'Stuffed Toys - Small',       category: O, price: 1000, image: '🧸' },
    { name: 'Stuffed Toys - Large',       category: O, price: 2500, image: '🧸' },
    { name: 'Shoes',                      category: O, price: 400,  image: '👟' },
    { name: 'School Bag',                 category: O, price: 400,  image: '🎒' },
    { name: 'Carpet Woolen / Synthetic (Per Sq.Ft)',       category: O, price: 40,  image: '🧶' },
    { name: 'Carpet Centerpiece / Hand Knotted (Per Sq.Ft)', category: O, price: 120, image: '🧶' },
    { name: 'Vertical Blinds',            category: O, price: 1000, image: '🪟' },
    { name: 'Blanket Single',             category: O, price: 1000, image: '🛌' },
    { name: 'Blanket Double',             category: O, price: 1400, image: '🛌' },
    { name: 'Quilt / Comforter',          category: O, price: 0,    image: '🛌' },
    { name: 'Quilt Cover / Bed Sheet',    category: O, price: 400,  image: '🛏️' },
    { name: 'Bedsheet Single',            category: O, price: 100,  image: '🛏️' },
    { name: 'Bedsheet Double',            category: O, price: 180,  image: '🛏️' },
    { name: 'Table Cloth Plain',          category: O, price: 100,  image: '🍽️' },
    { name: 'Table Cloth Fancy',          category: O, price: 250,  image: '🍽️' },
    { name: 'Bath Gown / Bath Robe',      category: O, price: 250,  image: '🛁' },
    { name: 'Bath Towel',                 category: O, price: 120,  image: '🧖' },
    { name: 'Hand Towel / Napkin',        category: O, price: 50,   image: '🧖' },
    { name: 'Curtain (Per Panel)',        category: O, price: 300,  image: '🪟' },
    { name: 'Palmets (Per Running Ft)',   category: O, price: 150,  image: '🪟' },
    { name: 'Cushion Cover - Plain',      category: O, price: 80,   image: '🛋️' },
    { name: 'Cushion Cover - Fancy',      category: O, price: 120,  image: '🛋️' },
    { name: 'Door Mat',                   category: O, price: 200,  image: '🚪' },
    { name: 'Ja Namaz',                   category: O, price: 0,    image: '🕌' },
    { name: 'Daree Small',                category: O, price: 600,  image: '🧶' },
    { name: 'Daree Large',                category: O, price: 800,  image: '🧶' },
    { name: 'Sweater Full Sleeve',        category: O, price: 300,  image: '🧶' },
    { name: 'Sleeveless Sweater',         category: O, price: 200,  image: '🧶' },
    { name: 'Membership Card',            category: O, price: 1000, image: '💳' },
    { name: 'Pillow Cover',               category: O, price: 120,  image: '🛏️' },
    { name: 'Rafooh',                     category: O, price: 0,    image: '🧵' },
    { name: 'Sofa',                       category: O, price: 0,    image: '🛋️' },

    // ===== PRESS / IRONING ONLY (rates can be set later) =====
    { name: 'Suit 2 Pcs (Press)',           category: P, price: 0, image: '🤵' },
    { name: 'Suit 3 Pcs (Press)',           category: P, price: 0, image: '🤵' },
    { name: 'Coat (Press)',                 category: P, price: 0, image: '🧥' },
    { name: 'Dress Pant (Press)',           category: P, price: 0, image: '👖' },
    { name: 'Trouser (Press)',              category: P, price: 0, image: '👖' },
    { name: 'Waist Coat (Press)',           category: P, price: 0, image: '🦺' },
    { name: 'Shalwar Suit (Press)',         category: P, price: 0, image: '🥻' },
    { name: 'Kurta (Press)',                category: P, price: 0, image: '👘' },
    { name: 'Shalwar / Pajama (Press)',     category: P, price: 0, image: '👖' },
    { name: 'Boski Shalwar Suit (Press)',   category: P, price: 0, image: '🥻' },
    { name: 'T-Shirt (Press)',              category: P, price: 0, image: '👕' },
    { name: 'Polo / Collar Shirt (Press)',  category: P, price: 0, image: '👕' },
    { name: 'Open Shirt (Press)',           category: P, price: 0, image: '👔' },
    { name: 'Tie (Press)',                  category: P, price: 0, image: '👔' },
    { name: 'Safari Suit (Press)',          category: P, price: 0, image: '🤵' },
    { name: 'Sherwani (Press)',             category: P, price: 0, image: '🤴' },
    { name: 'Kurta Saya / Lab Coat (Press)',category: P, price: 0, image: '🥼' },
    { name: 'Kandurah (Press)',             category: P, price: 0, image: '👘' },
    { name: 'Vest (Press)',                 category: P, price: 0, image: '👕' },
    { name: 'Scarf / Stole (Press)',        category: P, price: 0, image: '🧣' },
    { name: 'Skirt Suit (Press)',           category: P, price: 0, image: '👗' },
    { name: 'Ladies Short Coat (Press)',    category: P, price: 0, image: '🧥' },
    { name: 'Bridal Dress - Maxi (Press)',  category: P, price: 0, image: '👰' },
    { name: 'Bridal Dress - 3 Pcs Suit (Press)', category: P, price: 0, image: '👰' },
    { name: 'Ladies Shalwar Suit Plain - 3 Pcs (Press)', category: P, price: 0, image: '🥻' },
    { name: 'Ladies Shalwar Suit Plain - 2 Pcs (Press)', category: P, price: 0, image: '🥻' },
    { name: 'Ladies Dupatta (Press)',       category: P, price: 0, image: '🧣' },
    { name: 'Ladies Shirt (Press)',         category: P, price: 0, image: '👚' },
    { name: 'Ladies Shalwar / Pajama (Press)', category: P, price: 0, image: '👖' },
    { name: 'Ladies Fancy / Kamdar Shirt (Press)', category: P, price: 0, image: '👚' },
    { name: 'Ladies Fancy / Kamdar Dupatta (Press)', category: P, price: 0, image: '🧣' },
    { name: 'Ladies Gharara / Maxi (Press)',category: P, price: 0, image: '👗' },
    { name: 'Ladies Saree Plain (Press)',   category: P, price: 0, image: '🥻' },
    { name: 'Ladies Saree Fancy / Kamdar (Press)', category: P, price: 0, image: '🥻' },
    { name: 'Burqa / Abaya Plain (Press)',  category: P, price: 0, image: '🧕' },
    { name: 'Burqa / Abaya Fancy / Kamdar (Press)', category: P, price: 0, image: '🧕' },
    { name: 'Frock (Press)',                category: P, price: 0, image: '👗' },
    { name: 'Blouse Plain (Press)',         category: P, price: 0, image: '👚' }
  ];
  return list.map((p, idx) => ({
    id: 'p' + (idx + 1),
    ...p,
    active: true
  }));
}
DB.load();

/* === Auto-cleanup photos from delivered orders older than X days === */
function cleanupOldPhotos(force) {
  const s = DB.settings();
  if (!force && s.photoAutoCleanup === false) return { removed: 0, freed: 0 };
  const retentionDays = +s.photoRetentionDays || 30;
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  let removed = 0, freed = 0;
  DB.all('orders').forEach(o => {
    if (o.status !== 'delivered') return;
    if (!o.photos || !o.photos.length) return;
    const d = new Date(o.createdAt);
    if (d < cutoff) {
      freed += (o.photos || []).reduce((s,p) => s + (p.size||0), 0);
      removed += o.photos.length;
      DB.update('orders', o.id, { photos: [], photoCleanupAt: new Date().toISOString() });
    }
  });
  return { removed, freed };
}

/* Run auto-cleanup once per day */
(function autoCleanupCheck() {
  const lastRun = localStorage.getItem('mrLaundryLastPhotoCleanup');
  if (lastRun && Date.now() - new Date(lastRun).getTime() < 24*60*60*1000) return;
  const result = cleanupOldPhotos(false);
  if (result.removed > 0) console.log(`[Laundry POS] Auto-cleanup: removed ${result.removed} old photos (${Math.round(result.freed/1024)} KB freed)`);
  localStorage.setItem('mrLaundryLastPhotoCleanup', new Date().toISOString());
})();

function brandLogoHTML(size = 40, rounded = true) {
  const s = DB.settings();
  const radius = Math.max(10, Math.round(size * 0.2));
  if (s.logoImage) {
    return `<img class="logo" src="${s.logoImage}" alt="logo" style="width:${size}px;height:${size}px;object-fit:contain;${rounded?'border-radius:'+radius+'px;':''}background:#000;padding:${Math.round(size*0.07)}px;box-shadow:0 8px 22px rgba(0,0,0,0.18);" onerror="this.outerHTML='<div class=\\'logo\\' style=\\'width:${size}px;height:${size}px;border-radius:${radius}px;background:linear-gradient(135deg,#4f7cff,#6a5cff);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size*0.55)}px;\\'>${s.logo||'🧺'}</div>'"/>`;
  }
  return `<div class="logo" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:linear-gradient(135deg,#4f7cff,#6a5cff);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size*0.55)}px;box-shadow:0 8px 22px rgba(79,124,255,0.35);">${s.logo||'🧺'}</div>`;
}
