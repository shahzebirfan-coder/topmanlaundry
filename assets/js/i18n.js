/* ============================================================
   i18n — Multi-language: English / Urdu (script) / Roman Urdu
   - en  = English
   - ur  = اردو (proper Urdu script, RTL)
   - rmn = Roman Urdu (English alphabet)
   ============================================================ */

const TRANSLATIONS = {
  // Navigation
  'nav.dashboard':       { en: 'Dashboard',         ur: 'ڈیش بورڈ',           rmn: 'Dashboard' },
  'nav.pos':             { en: 'New Sale (POS)',    ur: 'نیا آرڈر',           rmn: 'Naya Order' },
  'nav.orders':          { en: 'Orders / Invoices', ur: 'آرڈرز / بل',        rmn: 'Orders / Bills' },
  'nav.customers':       { en: 'Customers',         ur: 'گاہک',              rmn: 'Customer' },
  'nav.ledger':          { en: 'Payment Ledger',    ur: 'پیمنٹ کھاتہ',       rmn: 'Payment Ledger' },
  'nav.products':        { en: 'Products',          ur: 'پروڈکٹس / ریٹ لسٹ', rmn: 'Products' },
  'nav.expenses':        { en: 'Expenses',          ur: 'اخراجات',           rmn: 'Akhrajat' },
  'nav.reports':         { en: 'Reports',           ur: 'رپورٹس',            rmn: 'Reports' },
  'nav.vendors':         { en: 'Vendors',           ur: 'وینڈرز',            rmn: 'Vendor' },
  'nav.purchaseOrders':  { en: 'Purchase Orders',   ur: 'خریداری کے آرڈر',   rmn: 'Purchase Orders' },
  'nav.inventory':       { en: 'Inventory',         ur: 'مال / اسٹاک',       rmn: 'Inventory (Maal)' },
  'nav.cashbook':        { en: 'Cash Book',         ur: 'کیش بک',            rmn: 'Cash Book' },
  'nav.auditLog':        { en: 'Activity Log',      ur: 'سرگرمی کا ریکارڈ',  rmn: 'Activity Log' },
  'nav.users':           { en: 'Users',             ur: 'یوزرز',             rmn: 'Users' },
  'nav.settings':        { en: 'Settings',          ur: 'ترتیبات',           rmn: 'Settings' },
  'nav.logout':          { en: 'Logout',            ur: 'لاگ آؤٹ',           rmn: 'Logout' },

  // Common
  'common.save':         { en: 'Save',           ur: 'محفوظ کریں',     rmn: 'Save Karein' },
  'common.cancel':       { en: 'Cancel',         ur: 'منسوخ',         rmn: 'Cancel' },
  'common.delete':       { en: 'Delete',         ur: 'حذف کریں',      rmn: 'Delete Karein' },
  'common.edit':         { en: 'Edit',           ur: 'تبدیل کریں',    rmn: 'Edit Karein' },
  'common.add':          { en: 'Add',            ur: 'شامل کریں',     rmn: 'Add Karein' },
  'common.search':       { en: 'Search',         ur: 'تلاش کریں',     rmn: 'Search Karein' },
  'common.print':        { en: 'Print',          ur: 'پرنٹ کریں',     rmn: 'Print Karein' },
  'common.close':        { en: 'Close',          ur: 'بند کریں',      rmn: 'Band Karein' },
  'common.yes':          { en: 'Yes',            ur: 'ہاں',           rmn: 'Haan' },
  'common.no':           { en: 'No',             ur: 'نہیں',          rmn: 'Nahi' },
  'common.total':        { en: 'Total',          ur: 'کل',            rmn: 'Total' },
  'common.paid':         { en: 'Paid',           ur: 'ادا شدہ',       rmn: 'Adaa' },
  'common.due':          { en: 'Due',            ur: 'باقی',          rmn: 'Baqi' },
  'common.discount':     { en: 'Discount',       ur: 'رعایت',         rmn: 'Discount' },
  'common.amount':       { en: 'Amount',         ur: 'رقم',           rmn: 'Raqam' },
  'common.date':         { en: 'Date',           ur: 'تاریخ',         rmn: 'Tareekh' },
  'common.phone':        { en: 'Phone',          ur: 'فون نمبر',      rmn: 'Phone Number' },
  'common.name':         { en: 'Name',           ur: 'نام',           rmn: 'Naam' },
  'common.address':      { en: 'Address',        ur: 'پتہ',           rmn: 'Pata' },
  'common.notes':        { en: 'Notes',          ur: 'نوٹ',           rmn: 'Note' },
  'common.status':       { en: 'Status',         ur: 'حالت',          rmn: 'Status' },
  'common.confirm':      { en: 'Confirm',        ur: 'تصدیق کریں',    rmn: 'Confirm Karein' },

  // Greetings
  'greet.morning':       { en: 'Good Morning',   ur: 'صبح بخیر',      rmn: 'Subh Bakhair' },
  'greet.afternoon':     { en: 'Good Afternoon', ur: 'دوپہر بخیر',    rmn: 'Acha Dopahar' },
  'greet.evening':       { en: 'Good Evening',   ur: 'شام بخیر',      rmn: 'Shaam Bakhair' },
  'greet.night':         { en: 'Good Night',     ur: 'شب بخیر',       rmn: 'Shab Bakhair' },
  'greet.welcome':       { en: 'Welcome to',     ur: 'خوش آمدید',     rmn: 'Khush Aamdeed' },
  'greet.productive':    { en: 'Have a productive day', ur: 'آپ کا دن بہترین گزرے', rmn: 'Acha din ho aapka' },

  // POS / Cart
  'pos.currentSale':     { en: 'Current Sale',           ur: 'موجودہ سیل',         rmn: 'Current Sale' },
  'pos.cartEmpty':       { en: 'Cart is empty',          ur: 'کارٹ خالی ہے',       rmn: 'Cart khaali hai' },
  'pos.tapToAdd':        { en: 'Tap a product to add it', ur: 'پروڈکٹ پر کلک کر کے شامل کریں', rmn: 'Item add karein' },
  'pos.clear':           { en: 'Clear',                   ur: 'صاف کریں',          rmn: 'Clear' },
  'pos.change':          { en: 'Change',                  ur: 'تبدیل کریں',        rmn: 'Change' },
  'pos.subtotal':        { en: 'Subtotal',                ur: 'ذیلی کل',          rmn: 'Subtotal' },
  'pos.bookOrder':       { en: 'Book Order',              ur: 'آرڈر بک کریں',     rmn: 'Order Book Karein' },
  'pos.walkin':          { en: 'Walk-in Customer',        ur: 'واک ان کسٹمر',     rmn: 'Walk-in Customer' },
  'pos.allCategories':   { en: 'All',                     ur: 'سب',                rmn: 'Sab' },
  'pos.quickAdd':        { en: 'Quick Add',               ur: 'تیز اضافہ',        rmn: 'Quick Add' },

  // Booking
  'book.title':          { en: 'Book New Order',          ur: 'نیا آرڈر بک کریں',  rmn: 'Naya Order Book Karein' },
  'book.customerName':   { en: 'Customer Name',           ur: 'گاہک کا نام',       rmn: 'Customer ka Naam' },
  'book.contactNumber':  { en: 'Contact Number',          ur: 'فون نمبر',          rmn: 'Phone Number' },
  'book.bookingDate':    { en: 'Booking Date',            ur: 'بکنگ کی تاریخ',    rmn: 'Booking ki Tareekh' },
  'book.deliveryDate':   { en: 'Delivery Date',           ur: 'ڈیلیوری کی تاریخ', rmn: 'Delivery ki Tareekh' },
  'book.deliveryIn':     { en: 'Delivery in',             ur: 'ڈیلیوری',           rmn: 'Delivery mein' },
  'book.packaging':      { en: 'Packaging / Delivery Type', ur: 'پیکیجنگ / ڈیلیوری', rmn: 'Packaging' },
  'book.hanger':         { en: 'Hanger',                  ur: 'ہینگر',             rmn: 'Hanger' },
  'book.fold':           { en: 'Fold',                    ur: 'فولڈ',              rmn: 'Fold' },
  'book.both':           { en: 'Hanger / Fold',           ur: 'ہینگر / فولڈ',      rmn: 'Hanger / Fold' },
  'book.loyalty':        { en: 'Loyalty Card',            ur: 'لائلٹی کارڈ',       rmn: 'Loyalty Card' },
  'book.next':           { en: 'Next → Payment',          ur: 'آگے → پیمنٹ',       rmn: 'Aage → Payment' },

  // Payment
  'pay.title':           { en: 'Payment',               ur: 'پیمنٹ',                rmn: 'Payment' },
  'pay.payNow':          { en: 'Pay Now (Full)',        ur: 'پوری ادائیگی',         rmn: 'Poori Payment' },
  'pay.advance':         { en: 'Advance Payment',       ur: 'ایڈوانس',              rmn: 'Advance' },
  'pay.partial':         { en: 'Partial Payment',       ur: 'جزوی ادائیگی',         rmn: 'Adha Adha' },
  'pay.credit':          { en: 'Credit (Pay on Delivery)', ur: 'ادھار (ڈیلیوری پر)', rmn: 'Udhar (Delivery par)' },
  'pay.method':          { en: 'Payment Method',        ur: 'ادائیگی کا طریقہ',     rmn: 'Payment ka Tarika' },
  'pay.cash':            { en: 'Cash',                  ur: 'کیش',                 rmn: 'Cash' },
  'pay.card':            { en: 'Card',                  ur: 'کارڈ',                rmn: 'Card' },
  'pay.received':        { en: 'Amount Received',       ur: 'وصول شدہ رقم',        rmn: 'Wasool Hui Raqam' },
  'pay.fullyPaid':       { en: 'Fully Paid',            ur: 'پوری ادائیگی ہو گئی',  rmn: 'Poori Adai Ho Gayi' },
  'pay.changeReturn':    { en: 'Change to Return',      ur: 'واپس کرنا ہے',         rmn: 'Wapas Karein' },
  'pay.saveAndPrint':    { en: 'Save & Print Invoice',  ur: 'محفوظ کر کے پرنٹ کریں', rmn: 'Save aur Print Karein' },

  // Order statuses
  'status.pending':      { en: 'Pending',     ur: 'زیرِ التواء',  rmn: 'Pending' },
  'status.washing':      { en: 'Washing',     ur: 'دھلائی میں',  rmn: 'Dho Rahe Hain' },
  'status.ready':        { en: 'Ready',       ur: 'تیار',         rmn: 'Tayyar' },
  'status.delivered':    { en: 'Delivered',   ur: 'ڈیلیور ہو گیا', rmn: 'Deliver Ho Gaya' },
  'status.cancelled':    { en: 'Cancelled',   ur: 'منسوخ',        rmn: 'Cancel' },

  // Dashboard
  'dash.title':          { en: "Today's Snapshot",         ur: 'آج کی رپورٹ',         rmn: 'Aaj ki Report' },
  'dash.todayRevenue':   { en: "Today's Revenue",          ur: 'آج کی آمدنی',         rmn: 'Aaj ki Sale' },
  'dash.todayReceived':  { en: 'Payment Received Today',   ur: 'آج وصول شدہ پیمنٹ',  rmn: 'Aaj Wasool Hua' },
  'dash.todayExpenses':  { en: "Today's Expenses",         ur: 'آج کے اخراجات',       rmn: 'Aaj ke Akhrajat' },
  'dash.todayProfit':    { en: "Today's Profit",           ur: 'آج کا منافع',         rmn: 'Aaj ka Munafa' },
  'dash.totalSales':     { en: 'Total Sales (Today)',      ur: 'آج کی کل سیل',        rmn: 'Aaj kul Sales' },
  'dash.pendingOrders':  { en: 'Pending Orders',           ur: 'باقی آرڈرز',          rmn: 'Baqi Orders' },
  'dash.outstanding':    { en: 'Outstanding Due',          ur: 'بقایا رقم',           rmn: 'Baqi Raqam' },

  // Login
  'login.signin':        { en: 'Sign In',         ur: 'لاگ اِن کریں',                rmn: 'Login Karein' },
  'login.username':      { en: 'Username',        ur: 'یوزر نیم',                    rmn: 'Username' },
  'login.password':      { en: 'Password',        ur: 'پاس ورڈ',                     rmn: 'Password' },
  'login.invalid':       { en: 'Invalid username or password', ur: 'یوزر نیم یا پاس ورڈ غلط ہے', rmn: 'Galat username ya password' },
  'login.forgot':        { en: 'Forgot Password?',          ur: 'پاس ورڈ بھول گئے؟',          rmn: 'Password Bhool Gaye?' },
  'login.welcome':       { en: 'Welcome to',                ur: 'خوش آمدید',                   rmn: 'Khush Aamdeed' },
  'login.portal':        { en: 'Portal',                    ur: 'پورٹل',                       rmn: 'Portal' },
  'login.subcopy':       { en: 'Manage your orders, track your laundry, and stay connected — all in one place.', ur: 'اپنے آرڈرز سنبھالیں، لانڈری ٹریک کریں اور جڑے رہیں — سب ایک جگہ۔', rmn: 'Apne orders sambhalen, laundry track karein aur juray rahein — sab ek jagah.' },
  'login.claim1':        { en: 'Cleaner Clothes',           ur: 'صاف کپڑے',                    rmn: 'Saaf Kapray' },
  'login.claim2':        { en: 'Happier You',               ur: 'خوش آپ',                      rmn: 'Khush Aap' },
  'login.script':        { en: 'Your Laundry, Our Priority', ur: 'آپ کی لانڈری، ہماری ترجیح',   rmn: 'Aap ki Laundry, Hamari Priority' },
  'login.lede':          { en: 'Please enter your credentials to continue.', ur: 'جاری رکھنے کے لیے اپنی تفصیلات درج کریں۔', rmn: 'Jari rakhne ke liye apni details darj karein.' },
  'login.usernameHint':  { en: 'e.g. your username',        ur: 'مثلاً آپ کا یوزر نیم',         rmn: 'e.g. aap ka username' },
  'login.needHelp':      { en: 'Need Help? Contact IT Department', ur: 'مدد چاہیے؟ آئی ٹی ڈیپارٹمنٹ سے رابطہ کریں', rmn: 'Madad chahiye? IT Department se rabta karein' },
  'login.poweredBy':     { en: 'Powered by:',               ur: 'تیار کردہ:',                    rmn: 'Powered by:' },
  'login.forcesync':     { en: 'Force Cloud Sync',          ur: 'کلاؤڈ سنک کریں',              rmn: 'Force Cloud Sync' },
  'login.feature.track': { en: 'Track<br>Orders',           ur: 'آرڈر<br>ٹریک کریں',           rmn: 'Order<br>Track' },
  'login.feature.pickup':{ en: 'Book<br>Pickup',            ur: 'پک اپ<br>بک کریں',            rmn: 'Pickup<br>Book' },
  'login.feature.pay':   { en: 'Pay<br>Bills',              ur: 'بل<br>ادا کریں',              rmn: 'Bill<br>Ada' },
  'login.feature.updates':{en: 'Real-Time<br>Updates',      ur: 'ریئل ٹائم<br>اپڈیٹس',         rmn: 'Real-Time<br>Updates' },

  // Language picker
  'lang.title':          { en: 'Choose Language',           ur: 'زبان منتخب کریں',           rmn: 'Zubaan Chunein' },
  'lang.en':             { en: 'English',                   ur: 'انگریزی',                  rmn: 'English' },
  'lang.ur':             { en: 'اردو (Urdu)',               ur: 'اردو',                     rmn: 'اردو (Urdu)' },
  'lang.rmn':            { en: 'Roman Urdu',                ur: 'رومن اردو',                 rmn: 'Roman Urdu' },

  /* ========== POS (Cashier daily) ========== */
  'pos.searchProducts':  { en: 'Search products by name...',    ur: 'پروڈکٹ کا نام تلاش کریں...',  rmn: 'Product naam se search karein...' },
  'pos.receivePayment':  { en: 'Receive Payment',                ur: 'پیمنٹ وصول کریں',            rmn: 'Payment Receive Karein' },
  'pos.receivePaymentTip':{ en:'Receive payment from a customer with existing invoice', ur:'موجودہ انوائس والے گاہک سے پیمنٹ لیں', rmn:'Maujooda invoice wale customer se payment lein' },
  'pos.bookOrderArrow':  { en: '📝 Book Order →',               ur: '📝 آرڈر بک کریں →',          rmn: '📝 Order Book Karein →' },
  'pos.qty':             { en: 'Qty',                            ur: 'تعداد',                       rmn: 'Tadaad' },
  'pos.price':           { en: 'Price',                          ur: 'قیمت',                        rmn: 'Qeemat' },
  'pos.remove':          { en: 'Remove',                         ur: 'ہٹائیں',                     rmn: 'Hatayein' },
  'pos.discount':        { en: 'Discount',                       ur: 'رعایت',                       rmn: 'Discount' },
  'pos.fixed':           { en: 'Fixed (Rs.)',                    ur: 'مقرر (روپے)',                rmn: 'Fixed (Rs.)' },
  'pos.percent':         { en: 'Percent (%)',                    ur: 'فیصد (%)',                    rmn: 'Percent (%)' },
  'pos.applyDiscount':   { en: 'Apply Discount',                 ur: 'رعایت لگائیں',                rmn: 'Discount Lagayein' },
  'pos.total':           { en: 'Total',                          ur: 'کل',                          rmn: 'Total' },
  'pos.totalPcs':        { en: 'Total Pieces',                   ur: 'کل اشیاء',                    rmn: 'Kul Cheezein' },
  'pos.tip':             { en: 'Tip: Click any price to edit',   ur: 'ٹپ: قیمت بدلنے کے لیے کلک کریں', rmn: 'Tip: price badalne ke liye click karein' },
  'pos.clickToChange':   { en: 'Click to change price',          ur: 'قیمت بدلنے کے لیے کلک کریں',  rmn: 'Click karein price badalne ke liye' },
  'pos.customAdd':       { en: 'Custom Item',                    ur: 'حسبِ ضرورت آئٹم',             rmn: 'Custom Item' },
  'pos.itemName':        { en: 'Item Name',                      ur: 'آئٹم کا نام',                 rmn: 'Item ka Naam' },

  /* ========== Customer ========== */
  'cust.fullName':       { en: 'Full name',                      ur: 'پورا نام',                    rmn: 'Pora Naam' },
  'cust.selectCustomer': { en: 'Select Customer',                ur: 'گاہک منتخب کریں',            rmn: 'Customer Chunein' },
  'cust.newCustomer':    { en: '+ New Customer',                 ur: '+ نیا گاہک',                  rmn: '+ Naya Customer' },
  'cust.searchCustomer': { en: 'Search by name or phone',        ur: 'نام یا فون سے تلاش کریں',     rmn: 'Naam ya phone se search' },
  'cust.address':        { en: 'Address',                        ur: 'پتہ',                         rmn: 'Pata' },
  'cust.loyaltyCard':    { en: 'Loyalty card number',            ur: 'لائلٹی کارڈ نمبر',            rmn: 'Loyalty card number' },
  'cust.activate':       { en: 'Activate Loyalty',               ur: 'لائلٹی فعال کریں',            rmn: 'Loyalty Activate' },
  'cust.noCustFound':    { en: 'No customer found',              ur: 'کوئی گاہک نہیں ملا',         rmn: 'Customer nahi mila' },

  /* ========== Booking ========== */
  'book.deliveryToday':  { en: 'Today',                          ur: 'آج',                          rmn: 'Aaj' },
  'book.deliveryTomorrow':{ en:'Tomorrow',                       ur: 'کل',                          rmn: 'Kal' },
  'book.days':           { en: 'days',                           ur: 'دن',                          rmn: 'din' },
  'book.specialNotes':   { en: 'Special Notes (optional)',       ur: 'خصوصی نوٹ (اختیاری)',         rmn: 'Special Note (optional)' },
  'book.notesPlaceholder':{en: 'e.g. Starch on shirts, no perfume', ur:'مثلاً: شرٹ پر کلف لگائیں، خوشبو نہیں', rmn:'Misal: shirt par calf lagayein' },

  /* ========== Receive Payment ========== */
  'rcv.title':           { en: 'Receive Payment',                ur: 'پیمنٹ وصول کریں',             rmn: 'Payment Receive Karein' },
  'rcv.amountNow':       { en: 'Amount Receiving Now',           ur: 'ابھی وصول کی جانے والی رقم', rmn: 'Abhi receive ki janay wali raqam' },
  'rcv.full':            { en: 'Full',                           ur: 'مکمل',                        rmn: 'Poora' },
  'rcv.half':            { en: 'Half',                           ur: 'آدھا',                        rmn: 'Aadha' },
  'rcv.method':          { en: 'Payment Method',                 ur: 'ادائیگی کا طریقہ',            rmn: 'Payment Tareeqa' },
  'rcv.cash':            { en: '💵 Cash',                        ur: '💵 کیش',                      rmn: '💵 Cash' },
  'rcv.card':            { en: '💳 Card (POS Machine)',          ur: '💳 کارڈ (پی او ایس مشین)',    rmn: '💳 Card (POS Machine)' },
  'rcv.bank':            { en: '🏦 Bank Transfer',               ur: '🏦 بینک ٹرانسفر',             rmn: '🏦 Bank Transfer' },
  'rcv.jazzcash':        { en: '📱 JazzCash',                    ur: '📱 جاز کیش',                   rmn: '📱 JazzCash' },
  'rcv.easypaisa':       { en: '📱 Easypaisa',                   ur: '📱 ایزی پیسہ',                 rmn: '📱 Easypaisa' },
  'rcv.cheque':          { en: '📃 Cheque',                      ur: '📃 چیک',                       rmn: '📃 Cheque' },
  'rcv.refNote':         { en: 'Reference / Notes (optional)',   ur: 'حوالہ / نوٹ (اختیاری)',       rmn: 'Reference / Note (optional)' },
  'rcv.refPlaceholder':  { en: 'e.g. Cheque #1234, JazzCash TID', ur:'مثلاً چیک نمبر ١٢٣٤، جاز کیش ٹی آئی ڈی', rmn:'Misal: Cheque #1234' },
  'rcv.markDelivered':   { en: 'Also mark this order as Delivered', ur: 'اس آرڈر کو ڈیلیور بھی کریں', rmn: 'Iss order ko Delivered bhi karein' },
  'rcv.printReceipt':    { en: 'Print Payment Receipt after saving', ur: 'محفوظ کرنے کے بعد رسید پرنٹ کریں', rmn: 'Save ke baad receipt print karein' },
  'rcv.confirmBtn':      { en: '✅ Receive Payment',             ur: '✅ پیمنٹ وصول کریں',          rmn: '✅ Payment Receive Karein' },
  'rcv.total':           { en: 'Total',                          ur: 'کل',                          rmn: 'Total' },
  'rcv.paidSoFar':       { en: 'Paid so far',                    ur: 'اب تک ادا ہوا',              rmn: 'Ab tak ada hua' },
  'rcv.due':             { en: 'Due',                            ur: 'باقی',                        rmn: 'Baqi' },
  'rcv.noDue':           { en: 'No due balance — already fully paid', ur: 'کوئی بقایا نہیں — پہلے سے مکمل ادا شدہ', rmn: 'Koi baqi nahi — fully paid hai' },
  'rcv.received':        { en: 'Received',                       ur: 'وصول ہوئے',                  rmn: 'Receive hue' },
  'rcv.via':             { en: 'via',                            ur: 'بذریعہ',                      rmn: 'via' },

  /* ========== Quick Pay ========== */
  'qp.title':            { en: 'Quick Receive Payment',          ur: 'فوری پیمنٹ وصول کریں',       rmn: 'Quick Payment Receive' },
  'qp.searchHint':       { en: 'Customer slip lekar aaya? Type invoice # or phone', ur: 'گاہک سلپ لے کر آیا؟ انوائس نمبر یا فون درج کریں', rmn: 'Customer slip layi? Invoice # ya phone type karein' },
  'qp.placeholder':      { en: 'e.g. 1023 OR 0300-1234567',     ur: 'مثلاً ١٠٢٣ یا ٠٣٠٠-١٢٣٤٥٦٧',  rmn: 'Misal: 1023 ya 0300-1234567' },
  'qp.recentUnpaid':     { en: 'Recent unpaid invoices (top 20):', ur: 'حالیہ غیر ادا شدہ انوائس (ٹاپ ٢٠):', rmn: 'Recent unpaid invoices (top 20):' },
  'qp.noOutstanding':    { en: 'No outstanding dues!',            ur: 'کوئی بقایا نہیں!',           rmn: 'Koi baqi nahi!' },
  'qp.allPaid':          { en: 'All invoices fully paid.',        ur: 'تمام انوائسز مکمل ادا شدہ', rmn: 'Sab invoices fully paid' },
  'qp.noMatches':        { en: 'No matches',                       ur: 'کوئی مماثلت نہیں',          rmn: 'Koi match nahi' },
  'qp.tryDifferent':     { en: 'Try a different invoice # or phone', ur: 'مختلف انوائس یا فون آزمائیں', rmn: 'Doosra invoice ya phone try karein' },

  /* ========== Orders Page ========== */
  'ord.title':           { en: 'Orders & Invoices',              ur: 'آرڈرز اور انوائسز',           rmn: 'Orders aur Invoices' },
  'ord.sub':             { en: 'Search, view, and track all invoices.', ur: 'تمام انوائسز تلاش، دیکھیں اور ٹریک کریں۔', rmn: 'Sab invoices search karein' },
  'ord.findInvoice':     { en: '🔍 Find Invoice',                 ur: '🔍 انوائس تلاش کریں',         rmn: '🔍 Invoice Dhoondhein' },
  'ord.searchPlaceholder':{en:'Search by Invoice #, Customer Name or Phone...', ur:'انوائس نمبر، نام یا فون سے تلاش...', rmn:'Invoice #, naam ya phone se search' },
  'ord.allStatus':       { en: 'All Statuses',                    ur: 'تمام حالات',                  rmn: 'Sab Statuses' },
  'ord.allPayments':     { en: 'All Payments',                    ur: 'تمام ادائیگیاں',              rmn: 'Sab Payments' },
  'ord.fullyPaid':       { en: '✅ Fully Paid',                   ur: '✅ مکمل ادا',                  rmn: '✅ Poori Paid' },
  'ord.credit':          { en: '📋 Credit (Unpaid)',              ur: '📋 ادھار (غیر ادا)',           rmn: '📋 Credit (Unpaid)' },
  'ord.advance':         { en: '🟢 Advance',                       ur: '🟢 ایڈوانس',                  rmn: '🟢 Advance' },
  'ord.partial':         { en: '🟡 Partial',                       ur: '🟡 جزوی',                     rmn: '🟡 Partial' },
  'ord.from':            { en: 'From',                             ur: 'سے',                          rmn: 'Se' },
  'ord.to':              { en: 'To',                               ur: 'تک',                          rmn: 'Tak' },
  'ord.today':           { en: 'Today',                            ur: 'آج',                          rmn: 'Aaj' },
  'ord.last7':           { en: 'Last 7 days',                      ur: 'پچھلے ٧ دن',                  rmn: 'Last 7 din' },
  'ord.thisMonth':       { en: 'This Month',                       ur: 'اس مہینے',                   rmn: 'Iss Mahine' },
  'ord.clearAll':        { en: 'Clear All',                        ur: 'سب صاف کریں',                rmn: 'Sab Clear' },
  'ord.quickReceive':    { en: '💰 Quick Receive Payment',         ur: '💰 فوری پیمنٹ وصول',         rmn: '💰 Quick Receive Payment' },
  'ord.newSale':         { en: '+ New Sale',                       ur: '+ نئی سیل',                  rmn: '+ Nayi Sale' },
  'ord.invoice':         { en: 'Invoice #',                        ur: 'انوائس نمبر',                rmn: 'Invoice #' },
  'ord.customer':        { en: 'Customer',                         ur: 'گاہک',                       rmn: 'Customer' },
  'ord.items':           { en: 'Items',                            ur: 'اشیاء',                       rmn: 'Items' },
  'ord.total':           { en: 'Total',                            ur: 'کل',                          rmn: 'Total' },
  'ord.paid':            { en: 'Paid',                             ur: 'ادا',                         rmn: 'Paid' },
  'ord.due':             { en: 'Due',                              ur: 'باقی',                        rmn: 'Baqi' },
  'ord.status':          { en: 'Status',                           ur: 'حالت',                        rmn: 'Status' },
  'ord.booked':          { en: 'Booked',                           ur: 'بکنگ',                       rmn: 'Booking' },
  'ord.delivery':        { en: 'Delivery',                         ur: 'ڈیلیوری',                    rmn: 'Delivery' },
  'ord.actions':         { en: 'Actions',                          ur: 'عمل',                         rmn: 'Actions' },
  'ord.viewInv':         { en: 'View Invoice',                     ur: 'انوائس دیکھیں',              rmn: 'Invoice Dekhein' },
  'ord.updateStatus':    { en: 'Update Status',                    ur: 'حالت تبدیل کریں',            rmn: 'Status Update' },
  'ord.sendWa':          { en: 'Send WhatsApp to customer',        ur: 'گاہک کو واٹس ایپ بھیجیں',    rmn: 'WhatsApp bhejein' },
  'ord.photos':          { en: 'Photos',                            ur: 'تصاویر',                     rmn: 'Photos' },
  'ord.printInv':        { en: 'Print',                             ur: 'پرنٹ',                       rmn: 'Print' },
  'ord.edit':            { en: 'Edit',                              ur: 'ترمیم',                       rmn: 'Edit' },
  'ord.delete':          { en: 'Delete',                            ur: 'حذف',                         rmn: 'Delete' },
  'ord.noOrders':        { en: 'No orders found',                   ur: 'کوئی آرڈر نہیں ملا',         rmn: 'Koi order nahi mila' },
  'ord.tryClearing':     { en: 'Try clearing filters or make a new sale.', ur: 'فلٹر صاف کریں یا نئی سیل کریں۔', rmn: 'Filter clear karein ya nayi sale karein' },
  'ord.collected':       { en: 'Collected',                         ur: 'وصول شدہ',                    rmn: 'Wasool' },
  'ord.outstandingDue':  { en: 'Outstanding Due',                   ur: 'بقایا رقم',                   rmn: 'Baqi Raqam' },

  /* ========== Common ========== */
  'common.search2':      { en: 'Search...',                        ur: 'تلاش...',                     rmn: 'Search...' },
  'common.next':         { en: 'Next',                              ur: 'آگے',                        rmn: 'Aage' },
  'common.back':         { en: 'Back',                              ur: 'واپس',                       rmn: 'Wapas' },
  'common.update':       { en: 'Update',                            ur: 'اپڈیٹ',                      rmn: 'Update' },
  'common.required':     { en: 'Required',                          ur: 'لازمی',                      rmn: 'Lazmi' },
  'common.optional':     { en: 'optional',                          ur: 'اختیاری',                    rmn: 'optional' },
  'common.loading':      { en: 'Loading...',                        ur: 'لوڈ ہو رہا ہے...',           rmn: 'Load ho raha hai...' },
  'common.success':      { en: 'Success',                           ur: 'کامیاب',                     rmn: 'Kamyab' },
  'common.error':        { en: 'Error',                             ur: 'غلطی',                       rmn: 'Ghalti' },
  'common.warning':      { en: 'Warning',                           ur: 'انتباہ',                     rmn: 'Warning' }
};

/* Language metadata */
const LANG_META = {
  en:  { name: 'English',     nativeName: 'English',     dir: 'ltr', flag: '🇬🇧' },
  ur:  { name: 'Urdu',        nativeName: 'اردو',         dir: 'rtl', flag: '🇵🇰' },
  rmn: { name: 'Roman Urdu',  nativeName: 'Roman Urdu',  dir: 'ltr', flag: '🇵🇰' }
};

const I18N = {
  current: localStorage.getItem('mrLaundryLang') || 'en',

  set(lang) {
    if (!LANG_META[lang]) lang = 'en';
    this.current = lang;
    localStorage.setItem('mrLaundryLang', lang);
    this.applyDir();
  },
  toggle() {
    // Cycle en -> ur -> rmn -> en
    const order = ['en', 'ur', 'rmn'];
    const next = order[(order.indexOf(this.current) + 1) % order.length];
    this.set(next);
  },
  isUrdu()   { return this.current === 'ur'; },
  isRoman()  { return this.current === 'rmn'; },
  isRTL()    { return LANG_META[this.current]?.dir === 'rtl'; },
  applyDir() {
    const dir = this.isRTL() ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', this.current);
    document.body && document.body.classList.toggle('lang-urdu', this.isUrdu());
    document.body && document.body.classList.toggle('lang-rmn', this.isRoman());
  }
};

function t(key, fallback) {
  const tr = TRANSLATIONS[key];
  if (!tr) return fallback || key;
  return tr[I18N.current] || tr.en || fallback || key;
}

/* Apply direction on load */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => I18N.applyDir());
  // Also try immediately
  try { I18N.applyDir(); } catch(e) {}
}

/* Open the language picker modal */
function openLanguagePicker() {
  if (typeof openModal !== 'function') {
    // Fallback: simple cycle
    I18N.toggle();
    if (typeof toast === 'function') {
      toast({ en: '✅ Language changed', ur: '✅ زبان تبدیل ہو گئی', rmn: '✅ Zubaan tabdeel ho gayi' }[I18N.current], 'success');
    }
    setTimeout(() => app && app.go && app.go(app.current), 100);
    return;
  }
  const options = ['en','ur','rmn'].map(code => {
    const meta = LANG_META[code];
    const active = I18N.current === code;
    return `<button class="lang-option ${active?'active':''}" data-lang="${code}" type="button" style="
      display:flex;align-items:center;gap:14px;
      padding:18px;background:${active?'#dbeafe':'#fff'};
      border:2px solid ${active?'#4f7cff':'#e5e9f2'};
      border-radius:14px;cursor:pointer;width:100%;
      font-family:inherit;transition:.15s;
    ">
      <div style="font-size:32px;">${meta.flag}</div>
      <div style="flex:1;text-align:left;">
        <div style="font-weight:800;font-size:18px;${code==='ur'?'font-family:&quot;Noto Nastaliq Urdu&quot;,serif;':''}">${meta.nativeName}</div>
        <div style="font-size:12px;color:#666;">${meta.name} ${meta.dir==='rtl'?'(دائیں سے بائیں)':''}</div>
      </div>
      ${active ? '<div style="color:#4f7cff;font-size:22px;">✓</div>' : '<div style="color:#aaa;">→</div>'}
    </button>`;
  }).join('');

  openModal(`
    <h3>🌐 ${t('lang.title')}</h3>
    <p class="sub">Select your preferred language. The whole app will switch.</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${options}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">${t('common.cancel')}</button>
    </div>
  `, { onOpen(m) {
    m.querySelectorAll('.lang-option').forEach(b => {
      b.onclick = () => {
        const code = b.dataset.lang;
        I18N.set(code);
        closeModal();
        if (typeof toast === 'function') {
          const msgs = {
            en: '✅ Language changed to English',
            ur: '✅ زبان اردو میں تبدیل ہو گئی',
            rmn: '✅ Zubaan Roman Urdu mein tabdeel ho gayi'
          };
          toast(msgs[code], 'success');
        }
        setTimeout(() => app && app.go && app.go(app.current || 'dashboard'), 200);
      };
    });
  }});
}

/* Backward-compat: toggleLanguage now opens picker */
function toggleLanguage() {
  openLanguagePicker();
}

window.I18N = I18N;
window.t = t;
window.toggleLanguage = toggleLanguage;
window.openLanguagePicker = openLanguagePicker;
window.LANG_META = LANG_META;
