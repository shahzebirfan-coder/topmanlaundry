/* Portal i18n — Trilingual: English / Urdu (proper script) / Roman Urdu */
const PORTAL_T = {
  // Headers
  'track_orders':       { en: 'Track your order status anytime, anywhere', ur: 'اپنا آرڈر کسی بھی وقت ٹریک کریں',     rmn: 'Apna order anytime track karein' },
  'welcome':            { en: 'Welcome',                                   ur: 'خوش آمدید',                              rmn: 'Khush Aamdeed' },

  // Search
  'search_phone':       { en: 'Search by Phone',                           ur: 'فون نمبر سے تلاش',                       rmn: 'Phone se Search' },
  'search_invoice':     { en: 'Search by Invoice #',                       ur: 'انوائس نمبر سے تلاش',                    rmn: 'Invoice se Search' },
  'enter_phone':        { en: 'Enter Your Contact Number',                 ur: 'اپنا فون نمبر درج کریں',                  rmn: 'Apna Phone Number Likhein' },
  'enter_invoice':      { en: 'Enter Invoice Number',                      ur: 'انوائس نمبر درج کریں',                   rmn: 'Invoice Number Likhein' },
  'track_btn':          { en: 'Track My Order',                            ur: 'میرا آرڈر دیکھیں',                       rmn: 'Order Dekhein' },

  // Stats
  'total_orders':       { en: 'Total Orders',                              ur: 'کل آرڈرز',                              rmn: 'Kul Orders' },
  'ready_now':          { en: 'Ready Now',                                 ur: 'تیار',                                  rmn: 'Tayar' },
  'in_progress':        { en: 'In Progress',                               ur: 'جاری ہے',                               rmn: 'Chal Raha' },
  'due_label':          { en: 'Due',                                       ur: 'باقی',                                  rmn: 'Baqi' },
  'outstanding':        { en: 'Outstanding',                               ur: 'بقایا رقم',                             rmn: 'Baqi Raqam' },
  'pay_now':            { en: 'Pay Now',                                   ur: 'ابھی ادا کریں',                         rmn: 'Abhi Adai Karein' },

  // Timeline
  'booked':             { en: 'Booked',                                    ur: 'بک ہوا',                                rmn: 'Book Hua' },
  'washing':            { en: 'Washing',                                   ur: 'دھل رہا',                              rmn: 'Dhul Raha' },
  'ready':              { en: 'Ready',                                     ur: 'تیار',                                  rmn: 'Tayar' },
  'delivered':          { en: 'Delivered',                                 ur: 'مل گیا',                                rmn: 'Mil Gaya' },

  // Status messages
  'msg_pending':        { en: 'Your order has been received and will be processed shortly.', ur: 'آپ کا آرڈر موصول ہو گیا، جلد پروسس ہوگا۔',   rmn: 'Aapka order mil gaya hai, jaldi process hoga.' },
  'msg_washing':        { en: 'Your clothes are being washed with care.',                    ur: 'آپ کے کپڑے دھلائی میں ہیں۔',                rmn: 'Aapke kapre dhoye ja rahe hain.' },
  'msg_ready':          { en: 'Your order is READY for pickup!',                              ur: 'آپ کا آرڈر تیار ہے!',                       rmn: 'Aapka order TAYAR hai!' },
  'msg_delivered':      { en: 'This order has been delivered. Thank you!',                    ur: 'آرڈر ڈیلیور ہو گیا۔ شکریہ!',                rmn: 'Order deliver ho gaya. Shukriya!' },
  'msg_cancelled':      { en: 'This order was cancelled.',                                    ur: 'یہ آرڈر منسوخ ہو گیا۔',                     rmn: 'Yeh order cancel ho gaya.' },

  // Order info
  'pieces':             { en: 'Pieces',                                    ur: 'اشیاء / تعداد',                         rmn: 'Cheezein' },
  'expected':           { en: 'Expected',                                  ur: 'متوقع',                                 rmn: 'Tareekh' },
  'payment':            { en: 'Payment',                                   ur: 'پیمنٹ',                                rmn: 'Adaegi' },
  'paid':               { en: 'Paid',                                      ur: 'ادا شدہ',                              rmn: 'Adaa' },
  'packaging':          { en: 'Packaging',                                 ur: 'پیکیجنگ',                              rmn: 'Packaging' },
  'view_items':         { en: 'View items',                                ur: 'تفصیلات دیکھیں',                       rmn: 'Cheezein dekhein' },
  'booked_on':          { en: 'Booked',                                    ur: 'بک ہوا',                              rmn: 'Book Hua' },

  // Actions
  'download_pdf':       { en: 'Download Invoice',                          ur: 'انوائس ڈاؤن لوڈ کریں',                rmn: 'Invoice Download Karein' },
  'send_message':       { en: 'Send Message / Complaint',                  ur: 'پیغام / شکایت بھیجیں',                 rmn: 'Message / Shikayat Bhejein' },
  'rate_order':         { en: 'Rate this order',                           ur: 'اس آرڈر کو ریٹنگ دیں',                rmn: 'Rating Dein' },
  'enable_notify':      { en: 'Enable Notifications',                      ur: 'نوٹیفکیشنز آن کریں',                  rmn: 'Notifications On Karein' },
  'request_pickup':     { en: 'Request Pickup',     ur: 'پک اپ کی درخواست',  rmn: 'Pickup Request' },
  'shop_info':          { en: 'Shop Info',                                 ur: 'دکان کی معلومات',                      rmn: 'Shop ki Maloomat' },
  'shop_hours':         { en: 'Opening Hours',                             ur: 'کھلنے کے اوقات',                      rmn: 'Khulne ke Auqat' },
  'call_shop':          { en: 'Call Shop',                                 ur: 'دکان کو کال کریں',                    rmn: 'Shop ko Call Karein' },
  'whatsapp_shop':      { en: 'WhatsApp',                                  ur: 'واٹس ایپ',                            rmn: 'WhatsApp' },
  'directions':         { en: 'Get Directions',                            ur: 'راستہ دیکھیں',                         rmn: 'Directions Lein' },
  'open_now':           { en: 'Open Now',                                  ur: 'ابھی کھلا ہے',                         rmn: 'Khula Hai' },
  'closed':             { en: 'Closed',                                    ur: 'بند ہے',                              rmn: 'Band Hai' },

  // Empty
  'no_orders':          { en: 'No orders found',                           ur: 'کوئی آرڈر نہیں ملا',                   rmn: 'Koi order nahi mila' },
  'check_number':       { en: 'Please double-check your number',           ur: 'برائے مہربانی نمبر دوبارہ چیک کریں',   rmn: 'Number dobara check karein' },

  // Refer
  'refer_friend':       { en: 'Refer a Friend',                            ur: 'دوست کو ریفر کریں',                    rmn: 'Dost ko Bhejein' },
  'your_referral':      { en: 'Your referral code',                        ur: 'آپ کا ریفرل کوڈ',                     rmn: 'Aapka referral code' },
  'share_referral':     { en: 'Share via WhatsApp',                        ur: 'واٹس ایپ پر شیئر کریں',                rmn: 'WhatsApp pe Share Karein' }
};

const PORTAL_LANG_META = {
  en:  { name: 'English',     nativeName: 'English',     dir: 'ltr', flag: '🇬🇧' },
  ur:  { name: 'Urdu',        nativeName: 'اردو',         dir: 'rtl', flag: '🇵🇰' },
  rmn: { name: 'Roman Urdu',  nativeName: 'Roman Urdu',  dir: 'ltr', flag: '🇵🇰' }
};

let PORTAL_LANG = localStorage.getItem('mrLaundryPortalLang') || 'en';
if (!PORTAL_LANG_META[PORTAL_LANG]) PORTAL_LANG = 'en';

function pt(key, fallback) {
  const tr = PORTAL_T[key];
  if (!tr) return fallback || key;
  return tr[PORTAL_LANG] || tr.en || fallback || key;
}

function applyPortalDir() {
  const meta = PORTAL_LANG_META[PORTAL_LANG];
  const dir = meta?.dir || 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', PORTAL_LANG);
  if (document.body) {
    document.body.classList.toggle('lang-urdu', PORTAL_LANG === 'ur');
    document.body.classList.toggle('lang-rmn', PORTAL_LANG === 'rmn');
  }
}

function togglePortalLang() {
  // Cycle en -> ur -> rmn -> en
  const order = ['en', 'ur', 'rmn'];
  PORTAL_LANG = order[(order.indexOf(PORTAL_LANG) + 1) % order.length];
  localStorage.setItem('mrLaundryPortalLang', PORTAL_LANG);
  location.reload();
}

/* Beautiful portal language picker — 3 options */
function openPortalLangPicker() {
  // Standalone implementation (no openModal dependency)
  const old = document.getElementById('__portalLangPicker__');
  if (old) old.remove();
  const wrap = document.createElement('div');
  wrap.id = '__portalLangPicker__';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  const options = ['en','ur','rmn'].map(code => {
    const m = PORTAL_LANG_META[code];
    const active = PORTAL_LANG === code;
    return `<button data-lang="${code}" type="button" style="
      display:flex;align-items:center;gap:14px;
      padding:18px;background:${active?'#dbeafe':'#fff'};
      border:2px solid ${active?'#4f7cff':'#e5e9f2'};
      border-radius:14px;cursor:pointer;width:100%;
      font-family:inherit;transition:.15s;font-size:15px;
    ">
      <div style="font-size:32px;">${m.flag}</div>
      <div style="flex:1;text-align:left;">
        <div style="font-weight:800;font-size:18px;">${m.nativeName}</div>
        <div style="font-size:12px;color:#666;">${m.name}</div>
      </div>
      ${active ? '<div style="color:#4f7cff;font-size:22px;">✓</div>' : '<div style="color:#aaa;">→</div>'}
    </button>`;
  }).join('');
  wrap.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:20px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:36px;">🌐</div>
        <h3 style="margin:8px 0 4px;">Choose Language / زبان منتخب کریں</h3>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">${options}</div>
      <button id="__portalLangCancel__" style="margin-top:14px;width:100%;padding:12px;background:#f3f4f6;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Cancel / منسوخ</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => {
    PORTAL_LANG = b.dataset.lang;
    localStorage.setItem('mrLaundryPortalLang', PORTAL_LANG);
    location.reload();
  });
  document.getElementById('__portalLangCancel__').onclick = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
}

function isPortalUrdu() { return PORTAL_LANG === 'ur'; }
function isPortalRoman() { return PORTAL_LANG === 'rmn'; }

/* Apply dir as soon as possible */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', applyPortalDir);
  try { applyPortalDir(); } catch(e){}
}

window.pt = pt;
window.togglePortalLang = togglePortalLang;
window.openPortalLangPicker = openPortalLangPicker;
window.isPortalUrdu = isPortalUrdu;
window.isPortalRoman = isPortalRoman;
window.applyPortalDir = applyPortalDir;
window.PORTAL_LANG_META = PORTAL_LANG_META;
