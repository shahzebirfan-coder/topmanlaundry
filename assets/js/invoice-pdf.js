/* ============================================================
   INVOICE PDF  —  Colour, professional invoice generator
   ------------------------------------------------------------
   • Koi internet / CDN library nahi (offline-first, PWA safe)
   • Asli .pdf file banati hai (Base-14 Helvetica, WinAnsi)
   • A4 portrait, brand-colour header, table, totals, PAID badge
   • Mobile par Web Share API se WhatsApp ko seedha PDF attach
     hoti hai; desktop par PDF download + wa.me fallback.

   PUBLIC API
     window.InvoicePDF.build(order, customer, settings) -> {blob, filename, bytes}
     window.InvoicePDF.buildBlob(order, customer, settings) -> Blob
     window.InvoicePDF.download(order, customer, settings) -> filename
     window.InvoicePDF.share(order, customer, settings, text) -> Promise<bool>
     window.InvoicePDF.canShareFiles() -> bool
   ============================================================ */

(function () {

  /* ---------- brand palette (colour copy for customer) ---------- */
  var C = {
    brand:      [0.043, 0.231, 0.478], // #0B3B7A deep blue
    brandDark:  [0.024, 0.145, 0.318], // #062451
    gold:       [0.961, 0.702, 0.008], // #F5B301
    teal:       [0.043, 0.478, 0.541], // #0B7A8A
    ink:        [0.106, 0.129, 0.176], // #1B212D
    inkSoft:    [0.361, 0.404, 0.475],
    line:       [0.812, 0.847, 0.886],
    tint:       [0.952, 0.965, 0.980], // #F3F6FA row tint
    panel:      [0.933, 0.949, 0.969], // #EEF2F7
    white:      [1, 1, 1],
    green:      [0.086, 0.639, 0.290], // #16A34A paid
    amber:      [0.851, 0.467, 0.024], // #D97706 partial
    red:        [0.863, 0.149, 0.149]  // #DC2626 unpaid
  };

  var PAGE_W = 595.28, PAGE_H = 841.89;
  var M = 40;                       // page margin
  var CW = PAGE_W - M * 2;          // content width

  /* ---------- Helvetica metrics (widths per 1000 units) ---------- */
  var W_REG = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
    '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
    ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
    '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333, '{': 334, '|': 260, '}': 334, '~': 584 };
  var W_BOLD = { ' ': 278, '!': 333, '"': 474, '#': 556, '$': 556, '%': 889, '&': 722, "'": 238,
    '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
    ':': 333, ';': 333, '<': 584, '=': 584, '>': 584, '?': 611, '@': 975,
    '[': 333, '\\': 278, ']': 333, '^': 584, '_': 556, '`': 333, '{': 389, '|': 280, '}': 389, '~': 584 };

  function fillWidths(tbl, kind) {
    var i, ch;
    for (i = 48; i <= 57; i++) tbl[String.fromCharCode(i)] = 556;           // digits
    var up = [667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611];
    for (i = 0; i < 26; i++) tbl[String.fromCharCode(65 + i)] = kind === 'bold'
      ? [722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611][i]
      : up[i];
    var low = [556,556,500,557,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500];
    var lowB = [556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500];
    for (i = 0; i < 26; i++) tbl[String.fromCharCode(97 + i)] = kind === 'bold' ? lowB[i] : low[i];
    return tbl;
  }
  var WID = { reg: fillWidths(W_REG, 'reg'), bold: fillWidths(W_BOLD, 'bold') };
  var AVG = { reg: 556, bold: 600 };

  function textWidth(str, size, bold) {
    var tbl = bold ? WID.bold : WID.reg, avg = bold ? AVG.bold : AVG.reg;
    var total = 0, i, ch;
    for (i = 0; i < str.length; i++) {
      ch = str.charAt(i);
      total += (tbl[ch] !== undefined ? tbl[ch] : avg);
    }
    return total * size / 1000;
  }

  /* ---------- text sanitising for WinAnsi / Helvetica ---------- */
  function clean(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2022\u00B7]/g, '-')
      .replace(/\u20B9/g, 'Rs.')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u2700-\u27BF\uD800-\uDFFF\u2600-\u26FF\uFE0F]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }
  function esc(str) {
    return clean(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  function money(n) {
    n = Number(n) || 0;
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).replace(/\.00$/, '');
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + 'Rs. ' + parts.join('.');
  }
  function num(n) { return String(Number(n) || 0); }
  function prettyDate(v) {
    if (!v) return 'TBD';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
    if (m) return shortDate(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00');
    return String(v);
  }
  function shortDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return clean(iso);
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + mon[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ============================================================
     Minimal PDF writer (single/multi page, colour, Helvetica)
     ============================================================ */
  function Doc() {
    this.pages = [];      // array of content-stream strings
    this.cur = null;
  }

  Doc.prototype.newPage = function () {
    this.cur = [];
    this.pages.push(this.cur);
    return this.cur;
  };

  /* top-left origin helpers ------------------------------------ */
  function ty(y) { return +(PAGE_H - y).toFixed(2); }

  Doc.prototype._col = function (c, op) {
    return [c[0].toFixed(3), c[1].toFixed(3), c[2].toFixed(3)].join(' ') + ' ' + op + '\n';
  };

  /* filled rectangle: x,y = top-left */
  Doc.prototype.rect = function (x, y, w, h, color, radius) {
    var s = this._col(color || C.ink, 'rg');
    if (radius) {
      var r = Math.min(radius, w / 2, h / 2), k = 0.5523 * r;
      var x2 = x + w, y2 = y + h;
      s += r.toFixed(2) + ' ' + r.toFixed(2) + ' ' + (x + r) +' '+ ty(y) + ' m\n';
      // build rounded rect path using beziers (top-left origin converted)
      s = this._col(color, 'rg');
      s += (x + r).toFixed(2) + ' ' + ty(y) + ' m\n';
      s += (x2 - r).toFixed(2) + ' ' + ty(y) + ' l\n';
      s += (x2 - r + k).toFixed(2) + ' ' + ty(y) + ' ' + (x2) + ' ' + (ty(y) - r + k).toFixed(2) + ' ' + x2.toFixed(2) + ' ' + ty(y + r).toFixed(2) + ' c\n';
      s += x2.toFixed(2) + ' ' + ty(y2 - r).toFixed(2) + ' l\n';
      s += x2.toFixed(2) + ' ' + (ty(y2 - r) - k).toFixed(2) + ' ' + (x2 - r + k).toFixed(2) + ' ' + ty(y2).toFixed(2) + ' ' + (x2 - r).toFixed(2) + ' ' + ty(y2).toFixed(2) + ' c\n';
      s += (x + r).toFixed(2) + ' ' + ty(y2).toFixed(2) + ' l\n';
      s += (x + r - k).toFixed(2) + ' ' + ty(y2).toFixed(2) + ' ' + x.toFixed(2) + ' ' + (ty(y2 - r) + k).toFixed(2) + ' ' + x.toFixed(2) + ' ' + ty(y2 - r).toFixed(2) + ' c\n';
      s += x.toFixed(2) + ' ' + ty(y + r).toFixed(2) + ' l\n';
      s += x.toFixed(2) + ' ' + (ty(y + r) - k).toFixed(2) + ' ' + (x + r - k).toFixed(2) + ' ' + ty(y).toFixed(2) + ' ' + (x + r).toFixed(2) + ' ' + ty(y).toFixed(2) + ' c\n';
      s += 'f\n';
    } else {
      s += x.toFixed(2) + ' ' + ty(y + h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f\n';
    }
    this.cur.push(s);
  };

  /* circle (for the brand monogram) */
  Doc.prototype.circle = function (cx, cy, r, color) {
    var k = 0.5523 * r, y = ty(cy);
    var s = this._col(color, 'rg');
    s += (cx + r).toFixed(2) + ' ' + y.toFixed(2) + ' m\n';
    s += (cx + r).toFixed(2) + ' ' + (y + k).toFixed(2) + ' ' + (cx + k).toFixed(2) + ' ' + (y + r).toFixed(2) + ' ' + cx.toFixed(2) + ' ' + (y + r).toFixed(2) + ' c\n';
    s += (cx - k).toFixed(2) + ' ' + (y + r).toFixed(2) + ' ' + (cx - r).toFixed(2) + ' ' + (y + k).toFixed(2) + ' ' + (cx - r).toFixed(2) + ' ' + y.toFixed(2) + ' c\n';
    s += (cx - r).toFixed(2) + ' ' + (y - k).toFixed(2) + ' ' + (cx - k).toFixed(2) + ' ' + (y - r).toFixed(2) + ' ' + cx.toFixed(2) + ' ' + (y - r).toFixed(2) + ' c\n';
    s += (cx + k).toFixed(2) + ' ' + (y - r).toFixed(2) + ' ' + (cx + r).toFixed(2) + ' ' + (y - k).toFixed(2) + ' ' + (cx + r).toFixed(2) + ' ' + y.toFixed(2) + ' c\nf\n';
    this.cur.push(s);
  };

  Doc.prototype.line = function (x1, y1, x2, y2, color, width) {
    var s = this._col(color || C.line, 'RG');
    s += (width || 1).toFixed(2) + ' w\n';
    s += x1.toFixed(2) + ' ' + ty(y1).toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + ty(y2).toFixed(2) + ' l S\n';
    this.cur.push(s);
  };

  /* text: align = left | right | center ; baseline at y (top-left origin) */
  Doc.prototype.text = function (str, x, y, opt) {
    opt = opt || {};
    var size = opt.size || 10;
    var bold = opt.bold === true;
    var font = bold ? '/F2' : '/F1';
    var txt = clean(str);
    if (!txt) return 0;
    var track = opt.tracking || 0;
    var w = textWidth(txt, size, bold) + (track ? track * size * Math.max(0, txt.length - 1) : 0);
    var px = x;
    if (opt.align === 'right') px = x - w;
    else if (opt.align === 'center') px = x - w / 2;
    if (track) {
      /* letter-spacing emulation for small caps labels */
      var s2 = this._col(opt.color || C.ink, 'rg');
      var cx2 = px, i;
      var any = false;
      for (i = 0; i < txt.length; i++) {
        if (txt.charAt(i) === ' ') { cx2 += textWidth(' ', size, bold) + track * size; continue; }
        s2 += 'BT ' + font + ' ' + size + ' Tf ' + cx2.toFixed(2) + ' ' + ty(y).toFixed(2) + ' Td (' + esc(txt.charAt(i)) + ') Tj ET\n';
        cx2 += textWidth(txt.charAt(i), size, bold) + track * size;
        any = true;
      }
      if (any) this.cur.push(s2);
      return w;
    }
    var s = this._col(opt.color || C.ink, 'rg');
    s += 'BT ' + font + ' ' + size + ' Tf ' + px.toFixed(2) + ' ' + ty(y).toFixed(2) + ' Td (' + esc(txt) + ') Tj ET\n';
    this.cur.push(s);
    return w;
  };

  /* truncate text with ellipsis to fit width */
  Doc.prototype.fit = function (str, maxW, size, bold) {
    var txt = clean(str);
    if (textWidth(txt, size, bold) <= maxW) return txt;
    while (txt.length > 1 && textWidth(txt + '...', size, bold) > maxW) txt = txt.slice(0, -1);
    return txt + '...';
  };

  /* wrap into lines */
  Doc.prototype.wrap = function (str, maxW, size, bold) {
    var words = clean(str).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (textWidth(test, size, bold) > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  /* ---------- serialise to PDF bytes ---------- */
  Doc.prototype.toBytes = function () {
    var objs = [];
    var pageCount = this.pages.length;
    var firstPage = 5;                                  // 1..4 = catalog/pages/fonts
    var kids = [];
    var i;
    for (i = 0; i < pageCount; i++) kids.push((firstPage + i * 2) + ' 0 R');

    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pageCount + ' >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    for (i = 0; i < pageCount; i++) {
      var content = this.pages[i].join('');
      objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /ProcSet [/PDF /Text] >> /Contents ' + (firstPage + i * 2 + 1) + ' 0 R >>');
      objs.push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
    }

    var out = '%PDF-1.4\n';
    var offsets = [];
    for (i = 0; i < objs.length; i++) {
      offsets.push(out.length);
      out += (i + 1) + ' 0 obj\n' + objs[i] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    for (i = 0; i < offsets.length; i++) {
      out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    }
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';

    var bytes = new Uint8Array(out.length);
    for (i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xFF;
    return bytes;
  };

  /* ============================================================
     THE INVOICE DESIGN
     ============================================================ */
  function initials(name) {
    var parts = clean(name || 'ML').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
    if (!parts.length) return 'ML';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function renderPageHeader(doc, s, first) {
    /* deep-blue band + gold accent */
    doc.rect(0, 0, PAGE_W, 118, C.brand);
    doc.rect(0, 112, PAGE_W, 6, C.gold);
    doc.rect(0, 0, PAGE_W, 4, C.brandDark);

    /* monogram */
    doc.circle(M + 30, first ? 60 : 56, 27, C.gold);
    doc.text(initials(s.shopName), M + 30, (first ? 60 : 56) + 7.5, { size: 20, bold: true, color: C.brandDark, align: 'center' });

    doc.text(s.shopName || 'Mr Laundry', M + 70, first ? 52 : 48, { size: 23, bold: true, color: C.white });
    doc.text(s.tagline || 'Laundry & Dry Cleaning', M + 70, first ? 70 : 66, { size: 9.5, color: [0.78, 0.87, 0.97] });

    /* right side contact block */
    var rx = PAGE_W - M;
    doc.text(s.phone || '', rx, first ? 44 : 40, { size: 10, bold: true, color: C.white, align: 'right' });
    var lines = doc.wrap(s.address || '', 240, 8.5, false).slice(0, 2);
    for (var i = 0; i < lines.length; i++) {
      doc.text(lines[i], rx, (first ? 58 : 54) + i * 11, { size: 8.5, color: [0.80, 0.88, 0.97], align: 'right' });
    }
  }

  function renderPageFooter(doc, s, pageNo, totalPages) {
    doc.rect(0, PAGE_H - 40, PAGE_W, 40, C.brand);
    doc.rect(0, PAGE_H - 40, PAGE_W, 3, C.gold);
    doc.text('Thank you for choosing ' + (s.shopName || 'Mr Laundry') + '!', M, PAGE_H - 20, { size: 10, bold: true, color: C.white });
    doc.text((s.invoiceFooter || 'Please collect your articles within 30 days.') , M, PAGE_H - 8, { size: 7.5, color: [0.80, 0.88, 0.97] });
    doc.text('Page ' + pageNo + ' / ' + totalPages, PAGE_W - M, PAGE_H - 20, { size: 8, color: [0.80, 0.88, 0.97], align: 'right' });
  }

  function statusOf(order) {
    var due = Number(order.due) || 0, paid = Number(order.paid) || 0;
    if (due <= 0.009) return { key: 'paid', label: 'PAID', color: C.green };
    if (paid > 0) return { key: 'partial', label: 'PARTLY PAID', color: C.amber };
    return { key: 'unpaid', label: 'UNPAID', color: C.red };
  }

  function build(order, customer, settings) {
    var o = order || {}, c = customer || {}, s = settings || {};
    var doc = new Doc();
    doc.newPage();

    var invoiceNo = o.invoiceNo ? 'INV-' + o.invoiceNo : '#' + String(o.id || '').slice(-6).toUpperCase();
    var pcsFn = (typeof window !== 'undefined' && typeof window.itemPcs === 'function') ? window.itemPcs
              : function (it) { return Number(it && it.pcs) > 0 ? Number(it.pcs) : 1; };
    var items = (o.items || []).slice();
    var totalPcs = items.reduce(function (sum, it) {
      return sum + (Number(it.qty) || 0) * (pcsFn(it) || 1);
    }, 0);
    var status = statusOf(o);
    var delType = (o.deliveryType === 'folder' || o.deliveryType === 'fold')
      ? { label: 'FOLD / SHOPPER', icon: 'FOLD' }
      : { label: 'HANGER', icon: 'HANG' };

    renderPageHeader(doc, s, true);

    /* ---------- invoice title row ---------- */
    var y = 146;
    doc.text('SALES INVOICE', M, y, { size: 16, bold: true, color: C.brand, tracking: 0.9 });
    doc.text('Invoice #: ' + invoiceNo, PAGE_W - M, y - 1, { size: 12, bold: true, color: C.ink, align: 'right' });
    doc.text('Date: ' + shortDate(o.createdAt), PAGE_W - M, y + 14, { size: 9, color: C.inkSoft, align: 'right' });
    doc.line(M, y + 14, PAGE_W - M, y + 14, C.line, 1);

    /* ---------- customer + delivery panels ---------- */
    y = 178;
    var boxW = (CW - 12) / 2, boxH = 66;
    /* Bill To */
    doc.rect(M, y, boxW, boxH, C.panel, 6);
    doc.rect(M, y, 4, boxH, C.brand, 2);
    doc.text('BILL TO', M + 14, y + 16, { size: 8, bold: true, color: C.brand });
    doc.text(doc.fit(c.name || 'Walk-in Customer', boxW - 30, 12.5, true), M + 14, y + 32, { size: 12.5, bold: true, color: C.ink });
    doc.text(doc.fit(c.phone || '', boxW - 30, 9, false), M + 14, y + 46, { size: 9, color: C.inkSoft });
    doc.text(doc.fit(c.address || '', boxW - 30, 8.5, false), M + 14, y + 58, { size: 8.5, color: C.inkSoft });

    /* Delivery panel */
    var bx = M + boxW + 12;
    doc.rect(bx, y, boxW, boxH, C.panel, 6);
    doc.rect(bx, y, 4, boxH, C.teal, 2);
    doc.text('DELIVERY', bx + 14, y + 16, { size: 8, bold: true, color: C.teal });
    doc.text('Expected: ' + prettyDate(o.deliveryDate), bx + 14, y + 32, { size: 10.5, bold: true, color: C.ink });
    doc.text('Packaging: ' + delType.label, bx + 14, y + 46, { size: 9, color: C.inkSoft });
    doc.text('Served by: ' + (o.cashierName || s.cashierName || 'Counter'), bx + 14, y + 58, { size: 8.5, color: C.inkSoft });

    /* ---------- pieces + payment badges ---------- */
    y = 256;
    var badgeW = (CW - 24) / 3;
    /* pieces */
    doc.rect(M, y, badgeW, 52, C.panel, 6);
    doc.text('TOTAL PIECES', M + badgeW / 2, y + 16, { size: 8, bold: true, color: C.inkSoft, align: 'center' });
    doc.text(String(totalPcs), M + badgeW / 2, y + 40, { size: 21, bold: true, color: C.brand, align: 'center' });
    /* items */
    doc.rect(M + badgeW + 12, y, badgeW, 52, C.panel, 6);
    doc.text('ITEMS', M + badgeW * 1.5 + 12, y + 16, { size: 8, bold: true, color: C.inkSoft, align: 'center' });
    doc.text(String(items.length), M + badgeW * 1.5 + 12, y + 40, { size: 21, bold: true, color: C.brand, align: 'center' });
    /* status */
    var sx = M + (badgeW + 12) * 2;
    doc.rect(sx, y, badgeW, 52, status.color, 6);
    doc.text('PAYMENT STATUS', sx + badgeW / 2, y + 16, { size: 8, bold: true, color: C.white, align: 'center' });
    doc.text(status.label, sx + badgeW / 2, y + 39, { size: 14, bold: true, color: C.white, align: 'center' });

    /* ---------- items table ---------- */
    var colX = { no: M + 6, name: M + 30, qty: M + 300, pcs: M + 350, rate: M + 430, amt: PAGE_W - M - 8 };
    var rowY = 330;
    var ROW_H = 21, MAX_ROWS = 15;
    var pageNo = 1;

    function tableHead(atY) {
      doc.rect(M, atY, CW, 24, C.brand, 4);
      doc.text('#', colX.no, atY + 16, { size: 8, bold: true, color: C.white });
      doc.text('DESCRIPTION', colX.name, atY + 16, { size: 8, bold: true, color: C.white });
      doc.text('QTY', colX.qty, atY + 16, { size: 8, bold: true, color: C.white, align: 'right' });
      doc.text('PCS', colX.pcs, atY + 16, { size: 8, bold: true, color: C.white, align: 'right' });
      doc.text('RATE', colX.rate, atY + 16, { size: 8, bold: true, color: C.white, align: 'right' });
      doc.text('AMOUNT', colX.amt, atY + 16, { size: 8, bold: true, color: C.white, align: 'right' });
      return atY + 24;
    }

    rowY = tableHead(rowY);

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var pcsEach = pcsFn(it) || 1;
      var linePcs = (Number(it.qty) || 0) * pcsEach;

      if (i > 0 && i % MAX_ROWS === 0) {
        /* new page */
        renderPageFooter(doc, s, pageNo, 2);
        doc.newPage();
        pageNo++;
        renderPageHeader(doc, s, false);
        doc.text('SALES INVOICE (continued)', M, 146, { size: 12, bold: true, color: C.brand });
        doc.text(invoiceNo, PAGE_W - M, 146, { size: 10, bold: true, color: C.ink, align: 'right' });
        rowY = tableHead(162);
      }

      var idx = i % MAX_ROWS;
      if (idx % 2 === 1) doc.rect(M, rowY, CW, ROW_H, C.tint);
      doc.text(String(i + 1), colX.no, rowY + 14, { size: 8.5, color: C.inkSoft });
      doc.text(doc.fit(it.name || 'Item', 255, 9.5, true), colX.name, rowY + 14, { size: 9.5, bold: true, color: C.ink });
      doc.text(num(it.qty), colX.qty, rowY + 14, { size: 9.5, color: C.ink, align: 'right' });
      doc.text(pcsEach > 1 ? String(linePcs) : '-', colX.pcs, rowY + 14, { size: 9.5, bold: pcsEach > 1, color: pcsEach > 1 ? C.teal : C.inkSoft, align: 'right' });
      doc.text(money(it.price), colX.rate, rowY + 14, { size: 9.5, color: C.ink, align: 'right' });
      doc.text(money((Number(it.qty) || 0) * (Number(it.price) || 0)), colX.amt, rowY + 14, { size: 9.5, bold: true, color: C.ink, align: 'right' });
      doc.line(M, rowY + ROW_H, PAGE_W - M, rowY + ROW_H, C.line, 0.5);
      rowY += ROW_H;
    }

    /* pieces note under table */
    rowY += 8;
    doc.text('Pieces counted as Qty x Pcs/unit  (e.g. 2pc Suit x 2 = 4 pcs)', M, rowY + 6, { size: 7.5, color: C.inkSoft });

    /* ---------- totals ---------- */
    var tx = PAGE_W - M - 250, tyy = rowY + 22;
    function tRow(label, value, opt) {
      opt = opt || {};
      doc.text(label, tx, tyy, { size: 9.5, color: opt.color || C.inkSoft });
      doc.text(value, PAGE_W - M, tyy, { size: opt.big ? 11 : 9.5, bold: !!opt.bold, color: opt.color || C.ink, align: 'right' });
      tyy += opt.gap || 16;
    }
    tRow('Subtotal', money(o.subtotal != null ? o.subtotal : items.reduce(function (a, b) { return a + (b.qty || 0) * (b.price || 0); }, 0)));
    if (Number(o.discount) > 0) tRow('Discount', '- ' + money(o.discount), { color: C.green });
    if (Number(o.tax) > 0) tRow('Tax', money(o.tax));
    if (Number(o.pickupDeliveryCharges) > 0) tRow('Pick Up & Delivery', money(o.pickupDeliveryCharges));
    tyy += 2;
    doc.line(tx, tyy - 8, PAGE_W - M, tyy - 8, C.line, 1);

    /* grand total bar */
    doc.rect(tx, tyy - 2, 250, 30, C.brand, 5);
    doc.text('TOTAL', tx + 12, tyy + 17, { size: 11, bold: true, color: C.white, tracking: 1 });
    doc.text(money(o.total), PAGE_W - M - 10, tyy + 18, { size: 13, bold: true, color: C.white, align: 'right' });
    tyy += 42;

    tRow('Amount Paid', money(o.paid));
    doc.line(tx, tyy - 10, PAGE_W - M, tyy - 10, C.line, 0.5);
    tRow('Balance Due', money(o.due), { bold: true, big: true, color: Number(o.due) > 0 ? C.red : C.green, gap: 20 });

    /* ---------- notes / terms ---------- */
    var ny = Math.max(tyy + 6, rowY + 150);
    if (Number(o.due) > 0) {
      doc.rect(M, ny, CW, 34, [0.996, 0.953, 0.898], 5);
      doc.rect(M, ny, 4, 34, C.amber, 2);
      doc.text('Balance of ' + money(o.due) + ' is due at the time of delivery. Please bring this invoice.',
        M + 14, ny + 21, { size: 9, bold: true, color: [0.569, 0.353, 0.043] });
      ny += 44;
    }
    if (s.invoiceTerms && s.invoiceShowTerms) {
      var tl = doc.wrap(s.invoiceTerms, CW - 20, 7.5, false).slice(0, 3);
      doc.text('TERMS & CONDITIONS', M, ny + 6, { size: 7.5, bold: true, color: C.inkSoft });
      for (var k = 0; k < tl.length; k++) {
        doc.text('- ' + tl[k], M, ny + 20 + k * 10, { size: 7.5, color: C.inkSoft });
      }
    }

    renderPageFooter(doc, s, pageNo, pageNo);

    var bytes = doc.toBytes();
    var blob = (typeof Blob !== 'undefined') ? new Blob([bytes], { type: 'application/pdf' }) : null;
    var filename = 'Invoice-' + String(invoiceNo).replace(/[^A-Za-z0-9-]/g, '') + '.pdf';
    return { bytes: bytes, blob: blob, filename: filename, totalPcs: totalPcs, pages: pageNo };
  }

  /* ---------- download helper ---------- */
  function download(order, customer, settings) {
    var out = build(order, customer, settings);
    try {
      var url = URL.createObjectURL(out.blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
    } catch (e) {
      console.error('[InvoicePDF] download failed', e);
      throw e;
    }
    return out.filename;
  }

  function canShareFiles() {
    try {
      if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
      var probe = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });
      return navigator.canShare({ files: [probe] });
    } catch (e) { return false; }
  }

  /* ---------- Web Share (real attachment on mobile) ---------- */
  function share(order, customer, settings, text) {
    var out = build(order, customer, settings);
    if (!canShareFiles()) return Promise.resolve(false);
    var file = new File([out.blob], out.filename, { type: 'application/pdf' });
    return navigator.share({
      files: [file],
      title: out.filename,
      text: text || ('Invoice ' + (order.invoiceNo ? 'INV-' + order.invoiceNo : '') + ' - ' + (settings.shopName || 'Mr Laundry'))
    }).then(function () { return true; }).catch(function () { return false; });
  }

  window.InvoicePDF = {
    build: build,
    buildBlob: function (o, c, s) { return build(o, c, s).blob; },
    download: download,
    share: share,
    canShareFiles: canShareFiles,
    _colors: C
  };

})();
