/* ============================================================
   THERMAL LOGO PIPELINE
   ============================================================
   Thermal printers are 1-bit: they burn a dot or they don't.
   A colour logo straight from CSS looks terrible — grey edges
   turn into muddy dithering, transparent PNGs print as black
   blocks, and a dark-background logo prints as a solid black
   rectangle.

   This module takes the client's uploaded brand logo and
   produces a clean, print-ready version:

     1. flatten transparency onto WHITE (never black)
     2. auto-detect a dark logo and INVERT it
     3. resize to the physical dot width of the paper
     4. threshold to 1-bit (with optional dithering for photos)
     5. trim the surrounding white margin
     6. return a compact PNG data URL

   Everything is cached, so printing stays instant.
   ============================================================ */

window.THERMAL = (function () {
  'use strict';

  /* ---------- paper geometry (203 dpi ≈ 8 dots/mm) ---------- */
  var PAPER = {
    '58': { dots: 384, printableMm: 48 },
    '80': { dots: 576, printableMm: 72 }
  };
  var DOTS_PER_MM = 8;

  var cache = { key: null, dataUrl: null, w: 0, h: 0 };

  function paperFor(settings) {
    var p = String((settings && settings.invoicePaper) || '80');
    return PAPER[p] || PAPER['80'];
  }

  /* Target logo width in printer dots, from the chosen size. */
  function targetDots(settings) {
    var paper = paperFor(settings);
    var pct = +((settings && settings.invoiceLogoSize) || 62); // % of printable width
    if (!isFinite(pct) || pct <= 0) pct = 62;
    pct = Math.max(20, Math.min(100, pct));
    return Math.max(64, Math.round(paper.dots * pct / 100));
  }

  /* Physical mm width — used in the print CSS so the logo is the
     right size regardless of the screen. */
  function targetMm(settings) {
    return Math.round(targetDots(settings) / DOTS_PER_MM);
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('logo could not be loaded')); };
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  /* ---------- core processing ---------- */
  function process(src, opts) {
    opts = opts || {};
    var maxDots = opts.maxDots || 400;
    var mono = opts.mono !== false;
    var dither = !!opts.dither;

    return loadImage(src).then(function (img) {
      var sw = img.naturalWidth || img.width;
      var sh = img.naturalHeight || img.height;
      if (!sw || !sh) throw new Error('logo has no size');

      // Scale to the target dot width (never upscale beyond 2x)
      var scale = Math.min(maxDots / sw, 2);
      var w = Math.max(1, Math.round(sw * scale));
      var h = Math.max(1, Math.round(sh * scale));

      // --- pass A: draw on a TRANSPARENT canvas to capture the alpha mask ---
      var alphaCv = document.createElement('canvas');
      alphaCv.width = w; alphaCv.height = h;
      var actx = alphaCv.getContext('2d', { willReadFrequently: true });
      actx.clearRect(0, 0, w, h);
      actx.drawImage(img, 0, 0, w, h);
      var alphaData = actx.getImageData(0, 0, w, h).data;
      var opaque = new Uint8Array(w * h);
      for (var ai = 0, aj = 0; ai < alphaData.length; ai += 4, aj++) {
        opaque[aj] = alphaData[ai + 3] >= 40 ? 1 : 0;   // 1 = really part of the logo
      }

      // --- pass B: flatten onto white for correct colour maths ---
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      var data = ctx.getImageData(0, 0, w, h);
      var px = data.data;

      // 2) average luminance of the OPAQUE pixels only — decides if it is dark
      var sum = 0, n = 0;
      for (var i = 0, q = 0; i < px.length; i += 4, q++) {
        if (!opaque[q]) continue;              // ignore the transparent margin
        sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        n++;
      }
      var mean = n ? sum / n : 255;
      var invert = mean < 140;   // dark-background logo → flip it

      // 3) grayscale (+ invert only the logo itself; the margin stays white)
      var gray = new Float32Array(w * h);
      for (var p = 0, j = 0; p < px.length; p += 4, j++) {
        if (!opaque[j]) { gray[j] = 255; continue; }   // transparency → paper white
        var g = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
        gray[j] = invert ? (255 - g) : g;
      }

      // 4) to 1-bit
      var out = new Uint8ClampedArray(w * h * 4);
      var THRESH = 165;
      for (var k = 0; k < gray.length; k++) {
        var v;
        if (!mono) {
          v = gray[k];
        } else if (dither) {
          v = gray[k];
        } else {
          v = gray[k] < THRESH ? 0 : 255;
        }
        var o = k * 4;
        out[o] = out[o + 1] = out[o + 2] = v;
        out[o + 3] = 255;
      }

      // Floyd–Steinberg, only when dithering is requested (photos)
      if (mono && dither) {
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var idx = y * w + x;
            var old = gray[idx];
            var nv = old < THRESH ? 0 : 255;
            var err = old - nv;
            gray[idx] = nv;
            if (x + 1 < w) gray[idx + 1] += err * 7 / 16;
            if (y + 1 < h) {
              if (x > 0) gray[idx + w - 1] += err * 3 / 16;
              gray[idx + w] += err * 5 / 16;
              if (x + 1 < w) gray[idx + w + 1] += err * 1 / 16;
            }
            var oo = idx * 4;
            out[oo] = out[oo + 1] = out[oo + 2] = nv;
          }
        }
      }

      // 5) trim surrounding white margin (keeps the logo tight on paper)
      var minX = w, minY = h, maxX = -1, maxY = -1;
      for (var ty = 0; ty < h; ty++) {
        for (var tx = 0; tx < w; tx++) {
          if (out[(ty * w + tx) * 4] < 128) {
            if (tx < minX) minX = tx;
            if (tx > maxX) maxX = tx;
            if (ty < minY) minY = ty;
            if (ty > maxY) maxY = ty;
          }
        }
      }
      if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }  // blank logo

      var pad = 2;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);

      var cw = maxX - minX + 1;
      var ch = maxY - minY + 1;

      var outCv = document.createElement('canvas');
      outCv.width = cw; outCv.height = ch;
      var octx = outCv.getContext('2d');
      var imgData = octx.createImageData(cw, ch);
      for (var oy = 0; oy < ch; oy++) {
        for (var ox = 0; ox < cw; ox++) {
          var si = ((oy + minY) * w + (ox + minX)) * 4;
          var di = (oy * cw + ox) * 4;
          imgData.data[di] = imgData.data[di + 1] = imgData.data[di + 2] = out[si];
          imgData.data[di + 3] = 255;
        }
      }
      octx.putImageData(imgData, 0, 0);

      return {
        dataUrl: outCv.toDataURL('image/png'),
        width: cw,
        height: ch,
        inverted: invert,
        meanLuma: Math.round(mean)
      };
    });
  }

  /* ---------- cache keyed on logo + target width ---------- */
  function keyFor(settings) {
    var src = String((settings && settings.logoImage) || '');
    var sig = src.length > 120 ? (src.length + ':' + src.slice(-80)) : src;
    return sig + '|' + targetDots(settings) + '|' + (settings && settings.invoiceLogoMono !== false ? 'm' : 'c');
  }

  var pending = null;

  /* Build (or reuse) the processed logo. Always returns a promise. */
  function prepare(settings, opts) {
    var key = keyFor(settings);
    if (cache.key === key && cache.dataUrl) return Promise.resolve(cache);
    if (pending && pending.key === key) return pending.promise;

    var src = String((settings && settings.logoImage) || '').trim();
    if (!src) return Promise.resolve(null);

    var promise = process(src, {
      maxDots: targetDots(settings),
      mono: (settings && settings.invoiceLogoMono !== false),
      dither: false
    }).then(function (res) {
      cache = { key: key, dataUrl: res.dataUrl, w: res.width, h: res.height,
                inverted: res.inverted, meanLuma: res.meanLuma };
      pending = null;
      return cache;
    }).catch(function (err) {
      pending = null;
      console.warn('[thermal-logo] could not process logo:', err.message);
      return null;
    });

    pending = { key: key, promise: promise };
    return promise;
  }

  /* Synchronous read — used while rendering the invoice. */
  function cached(settings) {
    var key = keyFor(settings);
    if (cache.key === key && cache.dataUrl) return cache.dataUrl;
    prepare(settings);      // warm it for next time
    return null;
  }

  /* Pre-warm at boot / after the logo changes. */
  function prime(settings) {
    if (!settings) { try { settings = DB.settings(); } catch (e) { return; } }
    prepare(settings);
  }

  function clearCache() { cache = { key: null, dataUrl: null, w: 0, h: 0 }; pending = null; }

  return {
    prepare: prepare,
    cached: cached,
    prime: prime,
    clearCache: clearCache,
    targetDots: targetDots,
    targetMm: targetMm,
    paperFor: paperFor,
    PAPER: PAPER
  };
})();
