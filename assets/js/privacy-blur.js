/* ============================================================
   AMOUNT PRIVACY — "blur by default, eye icon se reveal"
   ------------------------------------------------------------
   Client ki request: Dashboard ke paise wale numbers (This Month ka
   Sales / Received / Net Profit, Today's performance, Money Balance by
   Source...) screen par sab ke saamne nazar aate hain. Jab tak koi
   👁️ (eye) icon na dabaye, amounts **blur / hidden** rahein.

   Kaam kaise karta hai:
   • Har protected block par `data-priv` attribute hota hai.
   • Default = HIDDEN (page load par bhi hidden — screenshot-safe).
   • 👁️ dabane par block khulta hai; 60 second baad apne aap dobara
     blur ho jata hai (koi bhool kar khula na chhod de).
   • State per browser-session yaad rehti hai (sessionStorage), taake
     ek page se doosre page par jaate waqt dobara click na karna pade.
   • Blur sirf dikhawa nahi: jab hidden ho to numbers par
     `pointer-events:none` + `user-select:none` hota hai, aur text
     screen par padha nahi ja sakta.

   NOTE: localStorage/sessionStorage based app hai — jo bhi page ka
   source kholega woh data nikal sakta hai. Ye "kandhe se jhaankne"
   (shoulder surfing) aur screenshots se bachata hai, koi server-side
   access control nahi hai.
   ============================================================ */

window.PRIV = (function () {
  const KEY = 'mrLaundryAmountsHidden';
  const AUTO_HIDE_MS = 60000;     // reveal ke baad kitni der me dobara blur
  let timer = null;

  function isHidden() {
    try {
      const v = sessionStorage.getItem(KEY);
      return v === null ? true : v === '1';   // default: HIDDEN
    } catch (e) { return true; }
  }

  function setHidden(hidden) {
    try { sessionStorage.setItem(KEY, hidden ? '1' : '0'); } catch (e) {}
  }

  function injectCSS() {
    if (document.getElementById('priv-css')) return;
    const css = `
      .priv-block { position: relative; }
      .priv-target {
        transition: filter .18s ease, opacity .18s ease;
      }
      .priv-block.is-hidden .priv-target {
        filter: blur(9px);
        opacity: .75;
        pointer-events: none;
        user-select: none;
      }
      .priv-block.is-hidden .priv-target * { user-select: none !important; }

      /* "amounts hidden" chip — blurred values ke ooper.
         NOTE: chip .priv-block par lagta hai (blurred target par nahi),
         warna blur filter khud chip ko bhi dhundla kar deta. */
      .priv-block.is-hidden::after {
        content: '🔒 Amounts hidden — 👁️ dabayein';
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%,-50%);
        background: rgba(15,43,70,.90);
        color: #fff;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: .2px;
        padding: 8px 14px;
        border-radius: 999px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 4;
        box-shadow: 0 6px 18px rgba(15,43,70,.25);
      }

      .priv-eye {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1.5px solid var(--border, #dbe3ee);
        background: #fff;
        color: var(--navy, #0f2b46);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
        line-height: 1;
        transition: .15s;
        vertical-align: middle;
        margin-left: 8px;
        box-shadow: 0 2px 6px rgba(15,43,70,.06);
      }
      .priv-eye:hover { background: #f0f7ff; border-color: #4f7cff; color: #1d4ed8; }
      .priv-block.is-hidden .priv-eye { background: #fff7ed; border-color: #fdba74; color: #9a3412; }

      .priv-master {
        margin-left: auto;
        display: inline-flex; align-items: center; gap: 6px;
        border: 1.5px solid var(--border, #dbe3ee);
        background: #fff; color: var(--navy, #0f2b46);
        font-family: inherit; font-size: 12.5px; font-weight: 700;
        padding: 8px 14px; border-radius: 999px; cursor: pointer; transition: .15s;
      }
      .priv-master:hover { background: #f0f7ff; border-color: #4f7cff; }
      .priv-master.is-hidden { background: #fff7ed; border-color: #fdba74; color: #9a3412; }

      @media print {
        /* Printing needs the real numbers, but a blurred print is useless. */
        .priv-block.is-hidden .priv-target { filter: none !important; opacity: 1 !important; }
        .priv-block.is-hidden::after { display: none !important; }
        .priv-eye, .priv-master { display: none !important; }
      }
    `;
    const st = document.createElement('style');
    st.id = 'priv-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* Inline eye button — section title ke saath lagta hai */
  function eyeBtn() {
    return `<button type="button" class="priv-eye" onclick="PRIV.toggle(event)" title="Amounts show / hide">` +
           `<span class="priv-eye-ico">${isHidden() ? '👁️' : '🙈'}</span>` +
           `<span class="priv-eye-txt">${isHidden() ? 'Show' : 'Hide'}</span></button>`;
  }

  /* Page header ka master button */
  function masterBtn() {
    return `<button type="button" class="priv-master${isHidden() ? ' is-hidden' : ''}" onclick="PRIV.toggle(event)" title="Saare amounts show / hide">` +
           `<span class="priv-master-ico">${isHidden() ? '🔒' : '👁️'}</span>` +
           `<span class="priv-master-txt">${isHidden() ? 'Amounts Hidden' : 'Amounts Visible'}</span></button>`;
  }

  function apply() {
    injectCSS();
    const hidden = isHidden();
    document.querySelectorAll('[data-priv]').forEach(el => {
      el.classList.toggle('is-hidden', hidden);
      /* screen readers ko bhi na padhne dein jab hidden ho */
      el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
    document.querySelectorAll('.priv-eye').forEach(b => {
      b.classList.toggle('is-hidden', hidden);
      const ico = b.querySelector('.priv-eye-ico');
      const txt = b.querySelector('.priv-eye-txt');
      if (ico) ico.textContent = hidden ? '👁️' : '🙈';
      if (txt) txt.textContent = hidden ? 'Show' : 'Hide';
    });
    document.querySelectorAll('.priv-master').forEach(b => {
      b.classList.toggle('is-hidden', hidden);
      const ico = b.querySelector('.priv-master-ico');
      const txt = b.querySelector('.priv-master-txt');
      if (ico) ico.textContent = hidden ? '🔒' : '👁️';
      if (txt) txt.textContent = hidden ? 'Amounts Hidden' : 'Amounts Visible';
    });
  }

  function scheduleAutoHide() {
    clearTimeout(timer);
    if (isHidden()) return;
    timer = setTimeout(() => {
      setHidden(true);
      apply();
      try { if (typeof toast === 'function') toast('🔒 Amounts dobara hide kar diye gaye', 'success'); } catch (e) {}
    }, AUTO_HIDE_MS);
  }

  function toggle(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    setHidden(!isHidden());
    apply();
    scheduleAutoHide();
    return isHidden();
  }

  function show()  { setHidden(false); apply(); scheduleAutoHide(); }
  function hide()  { setHidden(true);  apply(); clearTimeout(timer); }

  /* Har page render ke baad ek dafa — jo blocks mojood hain un par state lagao */
  function refresh() { setTimeout(apply, 0); }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { injectCSS(); apply(); });
    else { injectCSS(); apply(); }
  }

  return { KEY, AUTO_HIDE_MS, isHidden, apply, refresh, toggle, show, hide, eyeBtn, masterBtn, injectCSS };
})();
