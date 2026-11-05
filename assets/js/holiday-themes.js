/* ============================================================
   HOLIDAY THEMES  (Pakistan gazetted + religious occasions)
   ------------------------------------------------------------
   • Pure offline date engine — no API, no internet needed.
   • Login screen automatically shifts to the upcoming occasion's
     theme `leadDays` days before the date, through the last day
     of the occasion (multi-day Eids included).
   • Admin can enable/disable events, override any date (important
     for moon-sighted Eid dates), change the lead window and add
     their own custom events from Settings → 🎉 Holiday Themes.
   • Data lives in DB.settings, so Cloud Sync carries it to every
     device and the customer portal.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- tiny helpers (no globals assumed) ---------------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function parseISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    // reject impossible dates such as 2026-02-31
    return (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) ? dt : null;
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function dayDiff(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  function localDate(v) {
    if (v instanceof Date) return parseISO(iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))));
    if (typeof v === 'string') return parseISO(v);
    const n = new Date();
    return parseISO(n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()));
  }
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function fmtDate(s, short) {
    const d = parseISO(s); if (!d) return s || '';
    const day = DAYS[d.getUTCDay()];
    return short ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0,3)} ${d.getUTCFullYear()}`
                 : `${day}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  /* ---------------- palettes ---------------- */
  const P = {
    iqbal:   { deep:'#063a2b', mid:'#0d6b4b', accent:'#e3b955', glow:'#f7e7b7', soft:'#e9f4ed', ink:'#082b21', ring:'rgba(13,107,75,.16)' },
    azadi:   { deep:'#073b2a', mid:'#0a7a4f', accent:'#f3f8f2', glow:'#d9f2e2', soft:'#e8f6ed', ink:'#062c20', ring:'rgba(10,122,79,.16)' },
    pakistan:{ deep:'#0a3a2c', mid:'#0e7d54', accent:'#d8b45a', glow:'#e5f4e6', soft:'#edf7ef', ink:'#082c22', ring:'rgba(14,125,84,.16)' },
    quaid:   { deep:'#103b30', mid:'#17795d', accent:'#d9bc76', glow:'#f2ead0', soft:'#eef5f0', ink:'#0b2e25', ring:'rgba(23,121,93,.16)' },
    kashmir: { deep:'#123a4c', mid:'#197a86', accent:'#dfeff2', glow:'#dcf1f5', soft:'#edf6f8', ink:'#0b2e3c', ring:'rgba(25,122,134,.16)' },
    labour:  { deep:'#26344c', mid:'#3c6b8f', accent:'#f0ad4e', glow:'#f8e6c8', soft:'#eef3f8', ink:'#1b2a41', ring:'rgba(60,107,143,.16)' },
    eid:     { deep:'#10362f', mid:'#0e8374', accent:'#e9c05c', glow:'#fbeec2', soft:'#e8f6f2', ink:'#0a2e29', ring:'rgba(14,131,116,.16)' },
    eidAzha: { deep:'#123a34', mid:'#137f66', accent:'#e8bd6b', glow:'#f8edcf', soft:'#e9f5f0', ink:'#0a2d29', ring:'rgba(19,127,102,.16)' },
    ramadan: { deep:'#1b2350', mid:'#4a4d94', accent:'#e4bf68', glow:'#eee2bb', soft:'#eef0fa', ink:'#171d42', ring:'rgba(74,77,148,.16)' },
    milad:   { deep:'#0d3b31', mid:'#128266', accent:'#e6c273', glow:'#f6ecd0', soft:'#e9f5f0', ink:'#0a2c25', ring:'rgba(18,130,102,.16)' },
    ashura:  { deep:'#1f2b38', mid:'#4a5b6b', accent:'#c9d3dc', glow:'#e6ecf1', soft:'#eef2f5', ink:'#18232e', ring:'rgba(74,91,107,.16)' },
    custom:  { deep:'#283b56', mid:'#4c76a6', accent:'#e9c46a', glow:'#f4e7c5', soft:'#eef3f9', ink:'#1d2c42', ring:'rgba(76,118,166,.16)' }
  };
  const PALETTE_NAMES = {
    iqbal:'Iqbal green', azadi:'Pakistan green', pakistan:'Deep green + gold',
    quaid:'Emerald + gold', kashmir:'Teal blue', labour:'Navy + amber',
    eid:'Eid teal + gold', eidAzha:'Eid green + gold', ramadan:'Ramadan indigo',
    milad:'Milad green', ashura:'Respectful slate', custom:'Blue + gold'
  };

  /* ---------------- built-in occasions ----------------
     Fixed dates recur every year automatically.
     Lunar (moon-based) dates are listed for 2026-2028 from the
     expected Pakistan calendar; beyond that the engine estimates
     ~10.875 days earlier per year and marks the date "estimated".
     Every date can be overridden by the admin in Settings.        */
  const BUILTIN = [
    { id:'kashmir', name:'Kashmir Day', urdu:'یومِ کشمیر', emoji:'🏔️', art:'mountain',
      recur:'02-05', kind:'national', palette:'kashmir', priority:70, festive:false,
      info:'5 February — Kashmiriyon ke sath yakjehti ka qaumi din.',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'ramadan', name:'Ramadan Mubarak', urdu:'رمضان المبارک', emoji:'🌙', art:'lantern',
      lunar:{ 2026:'2026-02-18', 2027:'2027-02-09', 2028:'2028-01-28' }, days:3,
      kind:'religious', palette:'ramadan', priority:78, festive:true, tentative:true,
      info:'Ramzan-ul-Mubarak ka aaghaz — roza, ibadat aur barkat ka mahina.',
      ops:'Ramzan mein shop timings aam tor par badal jati hain — counter par notice dekhein.' },

    { id:'eidFitr', name:'Eid ul-Fitr', urdu:'عید الفطر', emoji:'🌙', art:'crescent',
      lunar:{ 2026:'2026-03-21', 2027:'2027-03-10', 2028:'2028-02-26' }, days:3,
      kind:'religious', palette:'eid', priority:100, festive:true, tentative:true,
      info:'Eid Mubarak! Ramzan ke baad khushi aur shukr ka din — 3 din ki chhutti.',
      ops:'Eid par shop band ya mukhtasar timings — pickup order pehle book karlein.' },

    { id:'pakistanDay', name:'Pakistan Day', urdu:'یومِ پاکستان', emoji:'🇵🇰', art:'minar',
      recur:'03-23', kind:'national', palette:'pakistan', priority:85, festive:true,
      info:'23 March 1940 — Qarardad-e-Pakistan aur Minar-e-Pakistan ka din.',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'labour', name:'Labour Day', urdu:'یومِ مزدور', emoji:'🛠️', art:'gear',
      recur:'05-01', kind:'national', palette:'labour', priority:70, festive:false,
      info:'1 May — mazdooron ke haqooq aur mehnat ka qaumi din.',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'eidAzha', name:'Eid ul-Azha', urdu:'عید الاضحیٰ', emoji:'🕌', art:'dome',
      lunar:{ 2026:'2026-05-27', 2027:'2027-05-17', 2028:'2028-05-05' }, days:3,
      kind:'religious', palette:'eidAzha', priority:100, festive:true, tentative:true,
      info:'Eid Mubarak! Qurbani aur ehsan ka din — 3 din ki chhutti.',
      ops:'Eid par shop band ya mukhtasar timings — pickup order pehle book karlein.' },

    { id:'takbeer', name:'Youm-e-Takbeer', urdu:'یومِ تکبیر', emoji:'⭐', art:'star',
      recur:'05-28', kind:'national', palette:'azadi', priority:65, festive:false,
      info:'28 May 1998 — Pakistan ke nuclear tests ki yaadgar.',
      ops:'Qaumi commemoration; zarurat ho to shop timings check karlein.' },

    { id:'ashura', name:'Yaum-e-Ashura', urdu:'یومِ عاشورہ', emoji:'🕯️', art:'crescent',
      lunar:{ 2026:'2026-06-24', 2027:'2027-06-14', 2028:'2028-06-03' }, days:2,
      kind:'religious', palette:'ashura', priority:80, festive:false, tentative:true,
      info:'9 aur 10 Muharram — ehtiram aur soch ka din (public holiday).',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'azadi', name:'Independence Day', urdu:'یومِ آزادی', emoji:'🇵🇰', art:'flag',
      recur:'08-14', kind:'national', palette:'azadi', priority:95, festive:true,
      info:'14 August 1947 — Jashn-e-Azadi. Pakistan Zindabad!',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'milad', name:'Eid Milad-un-Nabi ﷺ', urdu:'عید میلاد النبی ﷺ', emoji:'🕌', art:'dome',
      lunar:{ 2026:'2026-08-25', 2027:'2027-08-15', 2028:'2028-08-04' }, days:1,
      kind:'religious', palette:'milad', priority:85, festive:true, tentative:true,
      info:'12 Rabi-ul-Awwal — Rehmat-ul-lil-Aalameen ﷺ ka youm-e-wiladat.',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'iqbal', name:'Allama Iqbal Day', urdu:'یومِ اقبال', emoji:'📜', art:'iqbal',
      recur:'11-09', kind:'national', palette:'iqbal', priority:90, festive:true,
      portrait:'assets/img/holidays/iqbal-1935.jpg',
      portraitAlt:'assets/img/holidays/iqbal-profile.jpg',
      person:{
        name:'Allama Muhammad Iqbal', years:'1877 – 1938',
        role:'Shair-e-Mashriq · Mufakkir-e-Pakistan',
        detail:'9 November 1877 ko Sialkot mein paida hue. Urdu aur Farsi ke shair, falsafi aur siyasatdan — 1930 ke Allahabad khutbe mein Pakistan ka tasawwur pesh kiya. 21 April 1938 ko Lahore mein inteqal hua.'
      },
      info:'9 November — Shair-e-Mashriq Allama Muhammad Iqbal ka youm-e-paidaish. Cabinet Division ki 2026 notification ke mutabiq mulk bhar mein gazetted holiday.',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' },

    { id:'quaid', name:'Quaid-e-Azam Day', urdu:'یومِ قائدِ اعظم', emoji:'🏛️', art:'dome',
      recur:'12-25', kind:'national', palette:'quaid', priority:88, festive:true,
      portrait:'assets/img/holidays/jinnah-1945.jpg',
      person:{
        name:'Quaid-e-Azam Muhammad Ali Jinnah', years:'1876 – 1948',
        role:'Baba-e-Qaum · Founder of Pakistan',
        detail:'25 December 1876 ko Karachi mein paida hue. All-India Muslim League ki qiyadat karte hue 14 August 1947 ko Pakistan qaim kiya aur pehle Governor General bane. 11 September 1948 ko inteqal hua.'
      },
      info:'25 December — Baba-e-Qaum Quaid-e-Azam Muhammad Ali Jinnah ka youm-e-paidaish (aur Christmas).',
      ops:'Gazetted holiday. Pickup / delivery timings badal sakti hain.' }
  ];

  /* ---------------- SVG line-art emblems ---------------- */
  function art(kind) {
    const head = '<svg class="ht-art-svg" viewBox="0 0 240 240" fill="none" stroke="currentColor" ' +
                 'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    const star = (x, y, r, op) => '<path d="M' + x + ' ' + (y-r) + ' L' + (x+r*0.28) + ' ' + (y-r*0.28) +
      ' L' + (x+r) + ' ' + y + ' L' + (x+r*0.28) + ' ' + (y+r*0.28) + ' L' + x + ' ' + (y+r) +
      ' L' + (x-r*0.28) + ' ' + (y+r*0.28) + ' L' + (x-r) + ' ' + y + ' L' + (x-r*0.28) + ' ' + (y-r*0.28) +
      ' Z" fill="currentColor" stroke="none" opacity="' + (op || '.5') + '"/>';
    const ring = '<circle cx="120" cy="120" r="104" opacity=".22"/><circle cx="120" cy="120" r="88" opacity=".13"/>';
    const bodies = {
      iqbal: ring +
        '<path d="M150 42a34 34 0 1 0 26 52 30 30 0 1 1-26-52Z" fill="currentColor" stroke="none" opacity=".45"/>' +
        star(96, 46, 9, .55) +
        /* minaret */
        '<path d="M52 196V96l9-12V70h22v14l9 12v100"/><path d="M62 70V56h20v14"/>' +
        '<path d="M46 196h44"/><path d="M66 96h16M66 130h16M66 164h16"/>' +
        /* open book */
        '<path d="M112 176c14-8 28-8 42 0v28c-14-8-28-8-42 0v-28Z"/>' +
        '<path d="M196 176c-14-8-28-8-42 0v28c14-8 28-8 42 0v-28Z"/>' +
        '<path d="M154 176v28"/><path d="M120 188h26M162 188h26"/>' +
        star(196, 56, 7, .4),
      minar: ring +
        '<path d="M78 202V74l10-16h64l10 16v128"/><path d="M88 58h64"/>' +
        '<path d="M100 42h40v16h-40z"/><path d="M120 42V22"/>' +
        '<path d="M70 202h100M62 214h116"/>' +
        '<path d="M98 90h44M98 120h44M98 150h44"/>' + star(120, 30, 8, .5),
      flag: ring +
        '<path d="M62 24v190"/><path d="M62 34h122l-18 26 18 26H62"/>' +
        '<path d="M140 54a13 13 0 1 0 11 20 11 11 0 1 1-11-20Z" fill="currentColor" stroke="none" opacity=".45"/>' +
        star(116, 62, 7, .6) + '<path d="M50 214h34"/>',
      crescent: ring +
        '<path d="M148 38a62 62 0 1 0 44 100 56 56 0 1 1-44-100Z" fill="currentColor" stroke="none" opacity=".42"/>' +
        star(76, 56, 9, .55) + star(178, 168, 8, .5) + star(60, 150, 6, .4) +
        '<path d="M40 200h160"/><path d="M56 208h128"/>',
      lantern: ring +
        '<path d="M120 24v18"/><path d="M96 42h48l10 18h-68l10-18Z"/>' +
        '<path d="M86 60h68l10 22-10 92H86L76 82l10-22Z"/>' +
        '<path d="M96 82v92M144 82v92M120 60v114"/><path d="M86 174h68"/>' +
        '<path d="M120 174v22M104 196h32"/>' +
        '<path d="M168 44a20 20 0 1 0 15 32 18 18 0 1 1-15-32Z" fill="currentColor" stroke="none" opacity=".4"/>' +
        star(52, 72, 7, .45),
      dome: ring +
        '<path d="M78 196V112c0-26 19-46 42-46s42 20 42 46v84"/>' +
        '<path d="M120 66V50M110 50h20"/><path d="M60 196h120M52 208h136"/>' +
        '<path d="M52 196V104l8-12h12l8 12v92M160 196V104l8-12h12l8 12v92"/>' +
        '<path d="M100 196v-44a20 20 0 0 1 40 0v44"/>' + star(120, 34, 7, .45),
      mountain: ring +
        '<path d="M24 184 88 88l38 58 26-34 64 72"/><path d="M62 134l26-46 26 46"/>' +
        '<path d="M24 184h192"/><path d="M40 204h160"/>' + star(170, 48, 10, .5) +
        '<path d="M196 62a20 20 0 1 0 14 30 18 18 0 1 1-14-30Z" fill="currentColor" stroke="none" opacity=".35"/>',
      gear: ring +
        '<circle cx="120" cy="118" r="42"/><circle cx="120" cy="118" r="16"/>' +
        '<path d="M120 62v-18M120 192v-18M64 118H46M194 118h-18M80 78l-13-13M173 171l-13-13M160 78l13-13M67 171l13-13"/>' +
        '<path d="M76 200h88"/><path d="M92 212h56"/>',
      star: ring + star(120, 120, 46, .35) +
        '<path d="M120 40v24M120 176v24M40 120h24M176 120h24"/>' +
        star(64, 64, 8, .45) + star(176, 64, 8, .45) + star(64, 176, 8, .45) + star(176, 176, 8, .45)
    };
    return head + (bodies[kind] || bodies.star) + '</svg>';
  }

  /* ---------------- settings ---------------- */
  function rawSettings() {
    try { return (typeof DB !== 'undefined' && DB.settings) ? (DB.settings() || {}) : {}; } catch (e) { return {}; }
  }
  function cfg() {
    const s = rawSettings();
    return {
      enabled:     s.holidayThemesEnabled !== false,
      leadDays:    Math.max(0, Math.min(30, (s.holidayLeadDays == null ? 4 : Number(s.holidayLeadDays)) || 0)),
      disabled:    Array.isArray(s.holidayDisabled) ? s.holidayDisabled : [],
      overrides:   (s.holidayDateOverrides && typeof s.holidayDateOverrides === 'object') ? s.holidayDateOverrides : {},
      custom:      Array.isArray(s.holidayCustomEvents) ? s.holidayCustomEvents : [],
      showInApp:   s.holidayShowInApp !== false,
      showOnPortal:s.holidayShowOnPortal !== false,
      showPortraits: s.holidayShowPortraits !== false,
      portraitOverrides: (s.holidayPortraitOverrides && typeof s.holidayPortraitOverrides === 'object')
        ? s.holidayPortraitOverrides : {}
    };
  }
  function allEvents() {
    const c = cfg();
    const customs = c.custom.map(x => Object.assign({
      kind:'custom', palette:'custom', priority:60, festive:true, days:1, art:'star',
      emoji:'🎉', urdu:'', info:'', ops:'Apni shop ka khaas din.'
    }, x)).filter(x => x && x.id && x.name && (x.date || x.recur));
    return BUILTIN.concat(customs);
  }

  /* ---------------- date resolution ---------------- */
  function lunarDate(ev, year) {
    const map = ev.lunar || {};
    if (map[year]) return { date: map[year], approx: false };
    const years = Object.keys(map).map(Number).filter(n => !isNaN(n))
      .sort((a, b) => Math.abs(a - year) - Math.abs(b - year));
    if (!years.length) return null;
    const anchorY = years[0], anchor = parseISO(map[anchorY]);
    if (!anchor) return null;
    /* One lunar year is ~354.37 solar days, so an Islamic date drifts
       ~10.9 days earlier each Gregorian year but STAYS in that year. */
    let d = addDays(anchor, Math.round(354.367 * (year - anchorY)));
    if (d.getUTCFullYear() < year) d = addDays(d, 354);
    if (d.getUTCFullYear() > year) d = addDays(d, -354);
    return { date: iso(d), approx: true };
  }
  function resolvedFor(ev, year, c) {
    const override = c.overrides[ev.id + '@' + year] || c.overrides[ev.id];
    if (override && parseISO(override)) return { date: override, approx: false, overridden: true };
    if (ev.recur) {
      const s = year + '-' + ev.recur;
      return parseISO(s) ? { date: s, approx: false } : null;
    }
    if (ev.lunar) return lunarDate(ev, year);
    if (ev.date) {
      if (ev.annual || ev.recur) {
        const s = year + '-' + String(ev.date).slice(5);
        return parseISO(s) ? { date: s, approx: false } : null;
      }
      return parseISO(ev.date) && String(ev.date).slice(0, 4) === String(year)
        ? { date: ev.date, approx: false } : null;
    }
    return null;
  }
  function occurrencesFor(year, c) {
    c = c || cfg();
    const out = [];
    allEvents().forEach(ev => {
      if (c.disabled.indexOf(ev.id) !== -1) return;
      const r = resolvedFor(ev, year, c);
      if (!r) return;
      const start = parseISO(r.date);
      if (!start) return;
      const days = Math.max(1, Number(ev.days) || 1);
      const end = iso(addDays(start, days - 1));
      out.push({ ev, date: r.date, end, year, days,
                 dateObj: start, approx: !!r.approx, overridden: !!r.overridden,
                 tentative: !!ev.tentative || !!r.approx });
    });
    return out;
  }
  function decorate(o, today) {
    const until = dayDiff(today, o.dateObj);
    const left  = dayDiff(today, parseISO(o.end));
    let label;
    if (until <= 0) {
      if (left < 0) label = 'Preview';           // past event being previewed
      else {
        const elapsed = (o.days - 1) - left;
        label = (o.days > 1 && left >= 0) ? `Aaj • day ${elapsed + 1}/${o.days}` : 'Aaj';
      }
    } else if (until === 1) label = 'Kal';
    else label = until + ' din baad';
    return Object.assign({}, o, { until, left, label, isToday: until <= 0, leadLabel: label });
  }
  function activeOn(dateInput) {
    const c = cfg();
    if (!c.enabled) return null;
    const forced = previewParam();
    if (forced) {
      const ev = allEvents().find(x => x.id === forced);
      if (ev) {
        const o = occurrencesFor(localDate(dateInput).getUTCFullYear(), c).find(x => x.ev.id === ev.id) ||
                  occurrencesFor(localDate(dateInput).getUTCFullYear() + 1, c).find(x => x.ev.id === ev.id);
        if (o) return Object.assign(decorate(o, localDate(dateInput)), { preview: true });
      }
    }
    const today = localDate(dateInput);
    const y = today.getUTCFullYear();
    let list = [];
    [y - 1, y, y + 1].forEach(yy => { list = list.concat(occurrencesFor(yy, c)); });
    list = list.map(o => decorate(o, today))
      .filter(o => o.until <= c.leadDays && o.left >= 0);
    list.sort((a, b) => {
      const ao = a.isToday, bo = b.isToday;
      if (ao !== bo) return ao ? -1 : 1;
      if (a.until !== b.until) return a.until - b.until;
      return (b.ev.priority || 0) - (a.ev.priority || 0);
    });
    return list[0] || null;
  }
  function upcoming(n, dateInput) {
    const c = cfg();
    const today = localDate(dateInput);
    const y = today.getUTCFullYear();
    let list = [];
    [y, y + 1, y + 2].forEach(yy => { list = list.concat(occurrencesFor(yy, c)); });
    return list.map(o => decorate(o, today)).filter(o => o.left >= 0)
      .sort((a, b) => a.dateObj - b.dateObj || (b.ev.priority || 0) - (a.ev.priority || 0))
      .slice(0, n || 5);
  }
  function previewParam() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const s = sessionStorage.getItem('htPreviewEvent');
        if (s) return s;
      }
      if (typeof location !== 'undefined' && location.search) {
        const m = new URLSearchParams(location.search);
        return m.get('htPreview') || '';
      }
    } catch (e) {}
    return '';
  }
  function forcedDate() {
    try {
      if (typeof location !== 'undefined' && location.search) {
        const v = new URLSearchParams(location.search).get('htDate');
        return parseISO(v) ? v : null;
      }
    } catch (e) {}
    return null;
  }
  function forcedOff() {
    try { return typeof location !== 'undefined' && /(?:^|[?&])htOff=1(?:&|$)/.test(location.search || ''); }
    catch (e) { return false; }
  }
  function state(dateInput) {
    if (forcedOff()) return null;
    return activeOn(forcedDate() || dateInput);
  }
  function paletteOf(ev) { return P[ev.palette] || P.custom; }

  /* Portrait source. Admin can paste a URL/path or upload a data-URL image;
     anything unexpected falls back to the bundled public-domain photo. */
  function portraitUrl(ev) {
    const c = cfg();
    if (!c.showPortraits) return '';
    const custom = c.portraitOverrides[ev.id];
    if (custom) {
      const v = String(custom);
      if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
      if (/^(https?:\/\/|assets\/img\/|\.\/|\/)[^\s"'()<>\\]+$/.test(v)) return v;
    }
    return ev.portrait || '';
  }
  function cssUrl(v) {
    if (!v) return 'none';
    return "url('" + String(v).replace(/['"\\]/g, '').replace(/[\r\n]/g, '') + "')";
  }
  function styleAttr(ev) {
    const p = paletteOf(ev);
    return `--ht-deep:${p.deep};--ht-mid:${p.mid};--ht-accent:${p.accent};--ht-glow:${p.glow};` +
           `--ht-soft:${p.soft};--ht-ink:${p.ink};--ht-ring:${p.ring};` +
           `--ht-portrait:${cssUrl(portraitUrl(ev))};`;
  }
  function personHtml(p) {
    if (!p) return '';
    return `<div class="ht-person">
        ${p.role ? `<div class="ht-person-role">🎖️ ${esc(p.role)}</div>` : ''}
        ${p.detail ? `<p>${esc(p.detail)}</p>` : ''}
      </div>`;
  }
  function portraitHtml(ev) {
    const pic = portraitUrl(ev);
    if (!pic) return '';
    const p = ev.person || {};
    return `<aside class="ht-portrait">
        <div class="ht-portrait-frame"><img src="${esc(pic)}" alt="${esc(p.name || ev.name)}" loading="lazy"/></div>
        ${p.name ? `<div class="ht-portrait-name">${esc(p.name)}</div>` : ''}
        ${p.years ? `<div class="ht-portrait-years">${esc(p.years)}</div>` : ''}
      </aside>`;
  }

  /* ---------------- HTML pieces ---------------- */
  function panelHtml(o, opts) {
    opts = opts || {};
    const ev = o.ev;
    const kicker = ev.kind === 'religious' ? '🌙 RELIGIOUS OCCASION'
                 : ev.kind === 'custom' ? '🎉 SPECIAL DAY' : '🇵🇰 GAZETTED HOLIDAY';
    const pic = portraitUrl(ev);
    return `
      <div class="ht-panel ${opts.compact ? 'is-compact' : ''} ${o.preview ? 'is-preview' : ''} ${ev.festive ? 'is-festive' : ''} ${pic ? 'has-portrait' : ''}" data-ht-id="${esc(ev.id)}">
        <div class="ht-panel-art">${art(ev.art)}</div>
        <div class="ht-panel-main">
          <div class="ht-panel-top">
            <span class="ht-kicker">${o.preview ? '👁 PREVIEW' : kicker}</span>
            <span class="ht-count ${o.isToday ? 'is-today' : ''}">${esc(o.leadLabel)}</span>
          </div>
          <div class="ht-emoji">${esc(ev.emoji)}</div>
          <h2 class="ht-title">${esc(ev.name)}</h2>
          ${ev.urdu ? `<div class="ht-urdu" dir="rtl" lang="ur">${esc(ev.urdu)}</div>` : ''}
          <div class="ht-date">📅 ${esc(fmtDate(o.date))}${o.days > 1 ? ' &nbsp;→&nbsp; ' + esc(fmtDate(o.end, true)) : ''}</div>
          ${ev.info ? `<p class="ht-info">${esc(ev.info)}</p>` : ''}
          ${personHtml(ev.person)}
          <div class="ht-ops">ℹ️ ${esc(ev.ops || 'Public holiday — timings may change.')}</div>
          ${o.tentative ? '<div class="ht-tentative">🌙 Ye tareekh chand raat / sarkari notification ke mutabiq badal sakti hai — Settings se update karein.</div>' : ''}
          ${o.preview ? '<div class="ht-previewtag">👁 Preview mode — asli login screen par ye theme us event ke ' +
            esc(String(cfg().leadDays)) + ' din pehle se le kar event tak dikhegi.</div>' : ''}
        </div>
        ${portraitHtml(ev)}
      </div>`;
  }
  function ribbonHtml(o) {
    const ev = o.ev;
    const pic = portraitUrl(ev);
    return `<div class="ht-ribbon ${pic ? 'has-portrait' : ''}" data-ht-id="${esc(ev.id)}" title="${esc(ev.name)}">
      ${pic ? `<img class="ht-ribbon-pic" src="${esc(pic)}" alt="${esc((ev.person && ev.person.name) || ev.name)}"/>` : `<span class="ht-ribbon-emoji">${esc(ev.emoji)}</span>`}
      <span class="ht-ribbon-txt">
        <span class="ht-ribbon-l1"><b>${esc(ev.name)}</b> <span>• ${esc(o.leadLabel)} &nbsp;|&nbsp; ${esc(fmtDate(o.date))}</span></span>
        ${ev.info ? `<span class="ht-ribbon-l2">${esc(ev.info)}</span>` : ''}
      </span>
      <button type="button" class="ht-ribbon-info" onclick="if(window.HT)HT.showDetails()" aria-label="Holiday details">ⓘ</button>
    </div>`;
  }
  function topbarBadgeHtml() {
    const c = cfg();
    if (!c.enabled || !c.showInApp) return '';
    const o = state();
    if (!o) return '';
    return `<button type="button" class="ht-topbar-badge" onclick="if(window.HT)HT.showDetails()"
      title="${esc(o.ev.name)} — ${esc(o.leadLabel)}" style="${styleAttr(o.ev)}">
      <span>${esc(o.ev.emoji)}</span><span class="ht-topbar-txt">${esc(o.ev.name)} · ${esc(o.leadLabel)}</span>
    </button>`;
  }
  function portalBannerHtml(o) {
    const pic = portraitUrl(o.ev);
    return `<div class="ht-portal-banner ${pic ? 'has-portrait' : ''}" data-ht-id="${esc(o.ev.id)}" style="${styleAttr(o.ev)}">
      <div class="ht-portal-art">${art(o.ev.art)}</div>
      ${pic ? `<img class="ht-portal-pic" src="${esc(pic)}" alt="${esc((o.ev.person && o.ev.person.name) || o.ev.name)}"/>` : ''}
      <div class="ht-portal-body">
        <div class="ht-portal-line1">
          <span class="ht-portal-emoji">${esc(o.ev.emoji)}</span>
          <b>${esc(o.ev.name)}</b>
          <span class="ht-portal-count">${esc(o.leadLabel)} · ${esc(fmtDate(o.date, true))}</span>
        </div>
        <div class="ht-portal-line2">${esc(o.ev.ops || 'Public holiday — timings may change.')}</div>
      </div>
      <button type="button" class="ht-portal-x" aria-label="Dismiss" onclick="if(window.HT)HT.dismissPortal()">✕</button>
    </div>`;
  }

  /* ---------------- login screen decoration ---------------- */
  function decorateLogin(appEl) {
    const o = state();
    const root = (appEl || document).querySelector ? (appEl || document).querySelector('.lg-root') : null;
    if (!root) return;
    root.classList.remove('ht-themed');
    if (!o) {
      root.removeAttribute('data-ht');
      try { document.documentElement.removeAttribute('data-ht'); } catch (e) {}
      return;
    }
    root.classList.add('ht-themed', 'ht-' + o.ev.id, o.ev.festive ? 'ht-festive' : 'ht-solemn');
    root.classList.toggle('has-person', !!portraitUrl(o.ev));
    root.setAttribute('data-ht', o.ev.id);
    root.setAttribute('style', styleAttr(o.ev));
    try { document.documentElement.setAttribute('data-ht', o.ev.id); } catch (e) {}

    const heroBody = root.querySelector('.lg-hero-body');
    if (heroBody) {
      const old = heroBody.querySelector('.ht-panel');
      if (old) old.remove();
      heroBody.insertAdjacentHTML('beforeend', panelHtml(o));
    }
    const panel = root.querySelector('.lg-panel');
    if (panel) {
      const old = panel.querySelector('.ht-ribbon');
      if (old) old.remove();
      panel.insertAdjacentHTML('afterbegin', ribbonHtml(o));
    }
    renderDiagnostics();
    /* browser chrome + tab title also pick up the occasion */
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', paletteOf(o.ev).deep);
      let shop = '';
      try { shop = (rawSettings().shopName || '').trim(); } catch (e) {}
      document.title = o.ev.name + (shop ? ' — ' + shop : '') + ' POS';
    } catch (e) {}
  }

  /* ---------------- customer portal banner ---------------- */
  function portalDismissed(o) {
    try {
      return sessionStorage.getItem('htPortalDismissed') === (o.ev.id + '|' + o.date);
    } catch (e) { return false; }
  }
  function dismissPortal() {
    const o = state();
    if (o) { try { sessionStorage.setItem('htPortalDismissed', o.ev.id + '|' + o.date); } catch (e) {} }
    renderPortalBanner();
  }
  function renderPortalBanner(el) {
    const c = cfg();
    const node = typeof el === 'string' ? document.getElementById(el)
               : (el || document.getElementById('htPortalBanner'));
    if (!node) return;
    const o = state();
    if (!c.enabled || !c.showOnPortal || !o || portalDismissed(o)) { node.innerHTML = ''; return; }
    node.innerHTML = portalBannerHtml(o);
  }

  /* ---------------- details pop-up ---------------- */
  function showDetails() {
    const o = state();
    const list = upcoming(6);
    const rows = list.map(x => `<div class="ht-up-row">
        <span class="ht-up-emoji">${esc(x.ev.emoji)}</span>
        <div><b>${esc(x.ev.name)}</b><small>${esc(fmtDate(x.date))}${x.tentative ? ' · 🌙 expected' : ''}</small></div>
        <span class="ht-up-when">${esc(x.left >= 0 && x.until <= 0 ? 'Aaj' : (x.until + ' din baad'))}</span>
      </div>`).join('');
    openModal(`
      <h3>🎉 Holiday Themes</h3>
      <p class="sub">Pakistan ke gazetted aur qaumi/mazhabi din — login screen khud-ba-khud theme badal leti hai.</p>
      ${o ? `<div class="ht-preview ht-themed" style="${styleAttr(o.ev)}">${panelHtml(o, { compact:true })}</div>` : ''}
      <div style="font-weight:800;margin:16px 0 8px;">📅 Aane wale din</div>
      <div class="ht-up-list">${rows || '<p class="sub">Koi upcoming event nahi.</p>'}</div>
      <div class="sub" style="margin-top:10px;line-height:1.6;">
        🖼️ Shakhsiyat ki tasveerain Wikimedia Commons ki <b>public-domain</b> archival photos hain
        (credit: <b>HOLIDAY_THEMES.md</b>). Settings → 🎉 Holiday Themes se apni picture bhi laga sakte hain.
      </div>
      <div class="sub" style="margin-top:12px;line-height:1.6;">
        Theme har event se <b>${esc(String(cfg().leadDays))} din pehle</b> shuru hoti hai aur event ke
        aakhri din tak rehti hai. 🌙 wali tareekhen chand raat ke mutabiq expected hain —
        Settings → 🎉 Holiday Themes se badlein.
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="if(window.HT)HT.openDialog()">⚙️ Manage Themes</button>
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `, { large: true });
  }

  /* ---------------- admin dialog ---------------- */
  let _customDraft = null;

  /* Uploaded pictures are downscaled before they go into DB.settings,
     otherwise a 5 MB phone photo would bloat localStorage/cloud sync. */
  function shrinkImage(file, cb) {
    try {
      const fr = new FileReader();
      fr.onload = () => {
        const src = String(fr.result || '');
        if (!/^data:image\//.test(src)) { cb(''); return; }
        const img = new Image();
        img.onload = () => {
          try {
            const sc = Math.min(1, 560 / img.width, 740 / img.height);
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            cb(cv.toDataURL('image/jpeg', 0.82));
          } catch (e) { cb(src); }
        };
        img.onerror = () => cb(src);
        img.src = src;
      };
      fr.onerror = () => cb('');
      fr.readAsDataURL(file);
    } catch (e) { cb(''); }
  }

  function customRow(ev) {
    return `<div class="ht-admin-row is-custom" data-cid="${esc(ev.id)}">
      <div class="ht-admin-row-main">
        <span class="ht-admin-emoji">${esc(ev.emoji)}</span>
        <div><b>${esc(ev.name)}</b><small>${esc(ev.date || ev.recur || '')} · Custom event</small></div>
      </div>
      <button type="button" class="btn btn-danger btn-sm" data-ht-del="${esc(ev.id)}">🗑</button>
    </div>`;
  }
  function openDialog() {
    const c = cfg();
    _customDraft = c.custom.slice();   // always start from saved data so Cancel discards edits
    const today = localDate(forcedDate() || undefined);
    const year = today.getUTCFullYear();
    const o = activeOn(today);

    const rows = allEvents().map(ev => {
      const r = resolvedFor(ev, year, c) || {};
      const next = occurrencesFor(year, c).find(x => x.ev.id === ev.id) ||
                   occurrencesFor(year + 1, c).find(x => x.ev.id === ev.id);
      const isCustom = ev.kind === 'custom';
      const tags = [
        ev.tentative ? '<span class="ht-tag ht-tag-moon">🌙 moon / expected</span>' : '<span class="ht-tag">📆 fixed</span>',
        isCustom ? '<span class="ht-tag ht-tag-custom">custom</span>' : ''
      ].join('');
      return `<div class="ht-admin-row" data-id="${esc(ev.id)}">
        <label class="ht-admin-chk">
          <input type="checkbox" class="ht-en" data-id="${esc(ev.id)}" ${c.disabled.indexOf(ev.id) === -1 ? 'checked' : ''}/>
        </label>
        <span class="ht-admin-emoji">${esc(ev.emoji)}</span>
        <div class="ht-admin-row-main">
          <div><b>${esc(ev.name)}</b> ${tags}</div>
          <small>${esc(ev.urdu || '')} ${ev.urdu ? '·' : ''} ${esc(r.date ? fmtDate(r.date, true) : '—')}${r.approx ? ' (estimated)' : ''}</small>
        </div>
        <input type="date" class="ht-date" data-id="${esc(ev.id)}" data-year="${esc(year)}"
               value="${esc(r.date || (next ? next.date : ''))}" title="Is saal ki tareekh badlein"/>
        <button type="button" class="btn btn-secondary btn-sm ht-prev" data-id="${esc(ev.id)}">👁</button>
      </div>`;
    }).join('');

    const customRows = _customDraft.map(customRow).join('');
    const paletteOpts = Object.keys(P).map(k => `<option value="${k}">${esc(PALETTE_NAMES[k] || k)}</option>`).join('');
    const picRows = allEvents().filter(ev => ev.portrait).map(ev => {
      const cur = c.portraitOverrides[ev.id] || '';
      return `<div class="ht-pic-row" data-id="${esc(ev.id)}">
        <img class="ht-pic-thumb" src="${esc(portraitUrl(ev))}" alt=""/>
        <div class="ht-pic-main">
          <b>${esc(ev.emoji)} ${esc(ev.name)}</b>
          <small>${esc((ev.person && ev.person.name) || ev.name)} · Wikimedia Commons (public domain)</small>
          <input class="ht-pic-url" data-id="${esc(ev.id)}" value="${esc(cur)}"
                 placeholder="Khali = built-in photo · ya assets/img/... / https://..."/>
        </div>
        <label class="btn btn-secondary btn-sm ht-pic-upload" style="cursor:pointer;">📤 Upload
          <input type="file" class="ht-pic-file" data-id="${esc(ev.id)}" accept="image/*" style="display:none;"/>
        </label>
        ${ev.portraitAlt ? `<button type="button" class="btn btn-ghost btn-sm ht-pic-alt" data-id="${esc(ev.id)}" data-alt="${esc(ev.portraitAlt)}" title="Doosri built-in tasveer">🔄</button>` : ''}
        <button type="button" class="btn btn-ghost btn-sm ht-pic-reset" data-id="${esc(ev.id)}" title="Built-in tasveer wapas layein">↺</button>
      </div>`;
    }).join('');

    openModal(`
      <h3>🎉 Holiday Themes — Login Screen</h3>
      <p class="sub">Kisi bhi qaumi / mazhabi din se pehle login screen apne aap us event ki theme mein shift ho jati hai. Sab kuch offline, bina kisi API ke.</p>

      <div id="htPreviewBox" class="ht-preview ht-themed" style="${o ? styleAttr(o.ev) : styleAttr({palette:'iqbal'})}">
        ${o ? panelHtml(o, { compact:true }) : '<div class="ht-nothing">Abhi koi active theme nahi — agla event qareeb aate hi yahan preview dikhega.</div>'}
      </div>

      <div class="ht-admin-controls">
        <label class="ht-switch"><input type="checkbox" id="htEnabled" ${c.enabled ? 'checked' : ''}/> <b>🎨 Auto holiday themes ON</b></label>
        <div class="ht-admin-inline">
          <label>Lead days <input type="number" id="htLead" min="0" max="30" value="${esc(String(c.leadDays))}" style="width:70px;"/></label>
          <label class="ht-switch"><input type="checkbox" id="htShowApp" ${c.showInApp ? 'checked' : ''}/> POS topbar badge</label>
          <label class="ht-switch"><input type="checkbox" id="htShowPortal" ${c.showOnPortal ? 'checked' : ''}/> Customer portal banner</label>
          <label class="ht-switch"><input type="checkbox" id="htShowPortraits" ${c.showPortraits ? 'checked' : ''}/> 🖼️ Personality pictures</label>
        </div>
        <small class="sub">Lead days = kitne din <b>pehle</b> se theme dikhni shuru ho. Default 4 (client ne 3–4 din kaha tha). Event ke aakhri din tak rehti hai.</small>
      </div>

      <div class="ht-admin-head">👁 Preview kisi bhi event ka</div>
      <select id="htPreviewSel" class="ht-sel">
        <option value="">— Asli aaj ka theme —</option>
        ${allEvents().map(ev => `<option value="${esc(ev.id)}">${esc(ev.emoji)} ${esc(ev.name)}</option>`).join('')}
      </select>

      <div class="ht-admin-head">🖼️ Personality pictures — Iqbal Day / Quaid-e-Azam Day</div>
      <div class="ht-admin-list">${picRows}</div>
      <small class="sub" style="display:block;margin-top:6px;line-height:1.6;">
        Bundled tasveerain <b>public-domain</b> archival photos hain (Wikimedia Commons). Apni pasand ki
        photo upload karein ya URL/path dein; khali chhorhne par built-in photo wapas aa jati hai.
      </small>

      <div class="ht-admin-head">📅 Built-in Pakistan holidays &amp; occasions</div>
      <div class="ht-admin-list ht-admin-scroll">${rows}</div>

      <div class="ht-admin-head">➕ Apna custom event (shop ka khaas din)</div>
      <div class="ht-custom-form">
        <input id="htCName" placeholder="Event name, e.g. Shop Anniversary" maxlength="60"/>
        <input id="htCDate" type="date" value="${esc(iso(today))}"/>
        <input id="htCEmoji" placeholder="🎉" maxlength="4" value="🎉" style="width:70px;text-align:center;font-size:18px;"/>
        <select id="htCPalette">${paletteOpts}</select>
        <label class="ht-switch"><input type="checkbox" id="htCAnnual" checked/> Har saal</label>
        <button type="button" class="btn btn-secondary btn-sm" id="htCAdd">➕ Add</button>
      </div>
      <div id="htCustomList" class="ht-admin-list">${customRows || '<small class="sub">Koi custom event nahi.</small>'}</div>

      <div class="modal-footer">
        <button class="btn btn-primary" id="htSave">💾 Save Changes</button>
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      </div>
    `, { large:true, onOpen(m) {
      /* live preview of any event */
      const sel = m.querySelector('#htPreviewSel');
      if (sel) sel.onchange = () => {
        const id = sel.value;
        const box = m.querySelector('#htPreviewBox');
        if (!box) return;
        if (!id) {
          const live = activeOn(today);
          box.setAttribute('style', styleAttr(live ? live.ev : { palette:'iqbal' }));
          box.innerHTML = live ? panelHtml(live, { compact:true })
            : '<div class="ht-nothing">Abhi koi active theme nahi.</div>';
          return;
        }
        const ev = allEvents().find(x => x.id === id);
        if (!ev) return;
        const cc = cfg();
        const occ = occurrencesFor(year, cc).find(x => x.ev.id === id) ||
                    occurrencesFor(year + 1, cc).find(x => x.ev.id === id);
        if (!occ) return;
        const fake = Object.assign(decorate(occ, today), { preview:true });
        box.setAttribute('style', styleAttr(ev));
        box.innerHTML = panelHtml(fake, { compact:true });
      };

      /* personality pictures: upload / alternate / reset */
      m.querySelectorAll('.ht-pic-file').forEach(inp => {
        inp.onchange = () => {
          const f = inp.files && inp.files[0];
          if (!f) return;
          if (f.size > 6 * 1024 * 1024) { if (typeof toast === 'function') toast('Tasveer 6 MB se chhoti ho', 'error'); return; }
          const id = inp.getAttribute('data-id');
          const row = m.querySelector('.ht-pic-row[data-id="' + id + '"]');
          shrinkImage(f, (dataUrl) => {
            if (!dataUrl) { if (typeof toast === 'function') toast('Tasveer parhi na ja saki', 'error'); return; }
            if (row) {
              const url = row.querySelector('.ht-pic-url');
              const thumb = row.querySelector('.ht-pic-thumb');
              if (url) url.value = dataUrl;
              if (thumb) thumb.src = dataUrl;
            }
            if (typeof toast === 'function') toast('✅ Tasveer lag gayi — Save dabayein', 'success');
          });
        };
      });
      m.querySelectorAll('.ht-pic-reset').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const row = m.querySelector('.ht-pic-row[data-id="' + id + '"]');
          const ev = allEvents().find(x => x.id === id);
          if (row) {
            const url = row.querySelector('.ht-pic-url');
            const thumb = row.querySelector('.ht-pic-thumb');
            if (url) url.value = '';
            if (thumb && ev) thumb.src = ev.portrait;
          }
        };
      });
      m.querySelectorAll('.ht-pic-alt').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id'), alt = btn.getAttribute('data-alt');
          const row = m.querySelector('.ht-pic-row[data-id="' + id + '"]');
          if (row) {
            const url = row.querySelector('.ht-pic-url');
            const thumb = row.querySelector('.ht-pic-thumb');
            if (url) url.value = alt;
            if (thumb) thumb.src = alt;
          }
        };
      });

      /* delete custom event */
      m.querySelectorAll('[data-ht-del]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-ht-del');
          _customDraft = _customDraft.filter(x => x.id !== id);
          const row = m.querySelector('[data-cid="' + id + '"]');
          if (row) row.remove();
        };
      });

      /* add custom event */
      const addBtn = m.querySelector('#htCAdd');
      if (addBtn) addBtn.onclick = () => {
        const name = (m.querySelector('#htCDate') && m.querySelector('#htCName').value || '').trim();
        const date = m.querySelector('#htCDate').value;
        if (!name || !parseISO(date)) { if (typeof toast === 'function') toast('Naam aur sahi tareekh likhein', 'error'); return; }
        const ev = {
          id: 'custom-' + Date.now().toString(36),
          name, date,
          annual: m.querySelector('#htCAnnual').checked,
          emoji: (m.querySelector('#htCEmoji').value || '🎉').trim() || '🎉',
          palette: m.querySelector('#htCPalette').value,
          info: name + ' — hamari shop ka khaas din.',
          ops: 'Is din shop timings badal sakti hain.',
          urdu:'', kind:'custom', days:1, art:'star', festive:true, priority:60
        };
        _customDraft.push(ev);
        const list = m.querySelector('#htCustomList');
        const empty = list.querySelector('small');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', customRow(ev));
        const newBtn = list.querySelector('[data-ht-del="' + ev.id + '"]');
        if (newBtn) newBtn.onclick = () => {
          _customDraft = _customDraft.filter(x => x.id !== ev.id);
          const row = list.querySelector('[data-cid="' + ev.id + '"]');
          if (row) row.remove();
        };
        m.querySelector('#htCName').value = '';
        if (typeof toast === 'function') toast('✅ Custom event add ho gaya — Save dabayein', 'success');
      };

      /* save */
      const saveBtn = m.querySelector('#htSave');
      if (saveBtn) saveBtn.onclick = () => {
        const disabled = [];
        m.querySelectorAll('.ht-en').forEach(chk => { if (!chk.checked) disabled.push(chk.getAttribute('data-id')); });
        const overrides = Object.assign({}, cfg().overrides);
        m.querySelectorAll('.ht-date').forEach(inp => {
          const id = inp.getAttribute('data-id'), yr = inp.getAttribute('data-year');
          const v = inp.value;
          if (v && parseISO(v)) overrides[id + '@' + yr] = v;
        });
        const pic = Object.assign({}, cfg().portraitOverrides);
        m.querySelectorAll('.ht-pic-row').forEach(row => { delete pic[row.getAttribute('data-id')]; });
        m.querySelectorAll('.ht-pic-url').forEach(inp => {
          const v = inp.value.trim();
          if (v) pic[inp.getAttribute('data-id')] = v;
        });
        const patch = {
          holidayShowPortraits: m.querySelector('#htShowPortraits').checked,
          holidayPortraitOverrides: pic,
          holidayThemesEnabled: m.querySelector('#htEnabled').checked,
          holidayLeadDays: Math.max(0, Math.min(30, Number(m.querySelector('#htLead').value) || 0)),
          holidayShowInApp: m.querySelector('#htShowApp').checked,
          holidayShowOnPortal: m.querySelector('#htShowPortal').checked,
          holidayDisabled: disabled,
          holidayDateOverrides: overrides,
          holidayCustomEvents: _customDraft.slice()
        };
        try {
          if (typeof DB !== 'undefined' && DB.saveSettings) DB.saveSettings(patch);
          else if (typeof localStorage !== 'undefined') {
            const k = 'mrLaundryDB', d = JSON.parse(localStorage.getItem(k) || '{}');
            d.settings = Object.assign({}, d.settings || {}, patch);
            localStorage.setItem(k, JSON.stringify(d));
          }
          if (typeof toast === 'function') toast('✅ Holiday themes save ho gaye — login screen refresh karein', 'success');
          if (typeof closeModal === 'function') closeModal();
          renderPortalBanner();
        } catch (err) {
          if (typeof toast === 'function') toast('Save error: ' + (err && err.message), 'error');
        }
      };
    }});
  }

  /* ---------------- auto hook for portal pages ---------------- */
  function initAuto() {
    const run = () => { renderPortalBanner(); renderDiagnostics(); };
    try {
      if (typeof document === 'undefined') return;
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
      else run();
      window.addEventListener('load', () => setTimeout(run, 1500));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
      /* cloud settings may arrive a little later */
      setTimeout(run, 3500);
    } catch (e) {}
  }

  /* ---------------- self-diagnostic: ?htDebug=1 ----------------
     Shows exactly why a holiday theme is (or is not) active on THIS
     device — local date, settings, active event, module version. */
  const BUILD = '20261104.15';
  function debugOn() {
    try { return typeof location !== 'undefined' && /(?:^|[?&])htDebug=1(?:&|$)/.test(location.search || ''); }
    catch (e) { return false; }
  }
  function diagnostics() {
    const c = cfg();
    const s = rawSettings();
    const n = new Date();
    const o = state();
    let tz = 'n/a';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'n/a'; } catch (e) {}
    let reason = '—';
    if (forcedOff()) reason = '❌ ?htOff=1 se theme band ki gayi hai';
    else if (!c.enabled) reason = '❌ Master switch OFF (holidayThemesEnabled=false)';
    else if (!o) reason = `⚪ Koi event ${c.leadDays}-din ke window mein nahi (ya sab disabled / date override)`;
    else reason = '✅ Sab theek — theme lagni chahiye';
    return {
      loaded: true, build: BUILD,
      date: `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`,
      time: `${pad(n.getHours())}:${pad(n.getMinutes())}`,
      tz,
      enabled: c.enabled, leadDays: c.leadDays,
      disabled: c.disabled.join(', ') || '(koi nahi)',
      overrides: Object.keys(c.overrides).length ? JSON.stringify(c.overrides) : '(koi nahi)',
      showPortraits: c.showPortraits,
      savedMasterFlag: s.holidayThemesEnabled,
      active: o ? `${o.ev.name} · ${o.leadLabel} · ${fmtDate(o.date)}` : '(koi nahi)',
      reason
    };
  }
  function renderDiagnostics() {
    if (!debugOn() || typeof document === 'undefined') return;
    const d = diagnostics();
    let el = document.getElementById('htDebugPanel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'htDebugPanel';
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:430px;' +
        'background:#0f2233;color:#e8f2f8;padding:12px 14px;border-radius:12px;' +
        'box-shadow:0 12px 34px rgba(0,0,0,.38);font:11.5px/1.65 ui-monospace,Consolas,monospace;' +
        'border:1px solid #3a5a72;';
      document.body.appendChild(el);
    }
    const row = (k, v) => `<div><span style="color:#8fb3c9;display:inline-block;min-width:132px">${esc(k)}</span><b>${esc(v)}</b></div>`;
    el.innerHTML = `
      <div style="font-size:13px;font-weight:800;color:#ffd77a;margin-bottom:6px">🔍 Holiday Theme Diagnostic
        <span style="float:right;cursor:pointer;color:#fff" onclick="this.parentNode.parentNode.remove()">✕</span></div>
      ${row('JS module', 'loaded ✅  v' + d.build)}
      ${row('Device date', d.date + '  ' + d.time)}
      ${row('Timezone', d.tz)}
      ${row('Master ON', String(d.enabled))}
      ${row('Lead days', String(d.leadDays))}
      ${row('Disabled', d.disabled)}
      ${row('Date overrides', d.overrides)}
      ${row('Portraits ON', String(d.showPortraits))}
      ${row('Active event', d.active)}
      <div style="margin-top:7px;padding-top:7px;border-top:1px solid #3a5a72;color:#b9e6c9">${esc(d.reason)}</div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;font-family:inherit">
        <a href="?htPreview=iqbal" style="color:#7fd1ff">force Iqbal</a>
        <a href="?htDate=2026-11-09" style="color:#7fd1ff">9 Nov</a>
        <a href="?htDate=2026-12-25" style="color:#7fd1ff">Quaid Day</a>
        <a href="?" style="color:#7fd1ff">clear</a>
      </div>
      <div style="margin-top:6px;color:#8fb3c9">Agar ye panel na dikhe to naya <b>index.html</b> upload nahi hua / Ctrl+F5 karein.</div>`;
  }

  /* ---------------- public API ---------------- */
  const HT = {
    BUILTIN, PALETTES: P,
    cfg, allEvents, occurrencesFor, resolvedFor, activeOn, upcoming, state,
    decorate, fmtDate, art, panelHtml, ribbonHtml, topbarBadgeHtml, portalBannerHtml,
    decorateLogin, renderPortalBanner, dismissPortal, showDetails, openDialog, styleAttr,
    portraitUrl, portraitHtml, personHtml, diagnostics, renderDiagnostics, debugOn,
    /* test / demo helpers */
    setPreview(id) { try { sessionStorage.setItem('htPreviewEvent', id || ''); } catch (e) {} },
    clearPreview() { try { sessionStorage.removeItem('htPreviewEvent'); } catch (e) {} }
  };
  if (typeof window !== 'undefined') {
    window.HT = HT;
    window.openHolidayThemesDialog = openDialog;
    initAuto();
  }
})();
