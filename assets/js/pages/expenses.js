/* ===================== EXPENSES =====================
   Three tabs:
     • List Expenses   — detailed register with full filters
     • Add Expense     — full entry form
     • Expense Category— add / edit / delete categories (live)
   Categories live in the DB (expenseCategories), so a client can
   manage their own list without touching code.
   ==================================================== */

/* Fallback used only if the DB table is somehow missing. */
const EXPENSE_CATEGORY_DEFAULTS = [
  { id: 'rent',        label: '🏠 Rent',                       color: '#ef4444' },
  { id: 'salary',      label: '👤 Salary / Wages',             color: '#f59e0b' },
  { id: 'utilities',   label: '💡 Utilities (Bills)',          color: '#3b82f6' },
  { id: 'supplies',    label: '🧴 Supplies (Detergent, etc.)', color: '#06b6d4' },
  { id: 'maintenance', label: '🔧 Maintenance / Repair',       color: '#8b5cf6' },
  { id: 'transport',   label: '🚚 Transport / Fuel',           color: '#ec4899' },
  { id: 'marketing',   label: '📢 Marketing / Ads',            color: '#10b981' },
  { id: 'tax',         label: '🧾 Tax / Govt Fee',             color: '#dc2626' },
  { id: 'food',        label: '🍵 Food / Tea for Staff',       color: '#eab308' },
  { id: 'rawmaterial', label: '🧺 Raw Material',               color: '#0ea5e9' },
  { id: 'other',       label: '📦 Other',                      color: '#6b7280' }
];

const EXP_PAYMENT_STATUS = ['Paid', 'Unpaid', 'Partial'];
const EXP_FOR_OPTIONS    = ['Shop', 'Staff', 'Owner', 'Client', 'Vendor', 'Other'];
const EXP_RECURRING      = ['None', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];

/* Tab + filter state */
let expTab = 'list';
let expFilter = {
  range: 'thismonth', dateFrom: '', dateTo: '',
  category: 'all', subCategory: 'all', location: 'all',
  paymentStatus: 'all', expenseFor: 'all', contact: 'all',
  search: '', sortBy: 'date', sortDir: 'desc', pageSize: 25, page: 1,
  hiddenCols: []
};

/* ---------- category helpers (DB-backed) ---------- */
function expenseCategoryList() {
  let rows = [];
  try { rows = DB.all('expenseCategories'); } catch (e) { rows = []; }
  if (!Array.isArray(rows) || !rows.length) return EXPENSE_CATEGORY_DEFAULTS.slice();
  const key = c => String(c.label || '').replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
  return rows.slice().sort((a, b) => key(a).localeCompare(key(b)));
}

function getExpCategory(id) {
  const list = expenseCategoryList();
  return list.find(c => c.id === id) || { id: 'other', label: '📦 Other', color: '#6b7280' };
}

function expCategoryUsage(id) {
  return DB.all('expenses').filter(e => (e.category || 'other') === id).length;
}

function slugifyCategory(label) {
  const base = String(label).toLowerCase()
    .replace(/[^\w\s-]/g, '')      // drop emoji / punctuation
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  let id = base || 'category';
  const existing = new Set(expenseCategoryList().map(c => c.id));
  if (!existing.has(id)) return id;
  let n = 2;
  while (existing.has(id + '-' + n)) n++;
  return id + '-' + n;
}

/* ---------- date range ---------- */
function applyDateRange(range) {
  const today = new Date();
  const isoOf = (d) => isoDay(d);
  let from = '', to = isoOf(today);
  switch (range) {
    case 'today':       from = to; break;
    case 'yesterday': { const y = new Date(); y.setDate(y.getDate() - 1); from = to = isoOf(y); break; }
    case 'last7':     { const d = new Date(); d.setDate(d.getDate() - 6); from = isoOf(d); break; }
    case 'last30':    { const d = new Date(); d.setDate(d.getDate() - 29); from = isoOf(d); break; }
    case 'thismonth': { from = isoOf(new Date(today.getFullYear(), today.getMonth(), 1)); break; }
    case 'lastmonth': {
      const fm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lm = new Date(today.getFullYear(), today.getMonth(), 0);
      from = isoOf(fm); to = isoOf(lm); break;
    }
    case 'thisyear':  { from = isoOf(new Date(today.getFullYear(), 0, 1)); break; }
    case 'lastyear': {
      from = isoOf(new Date(today.getFullYear() - 1, 0, 1));
      to = isoOf(new Date(today.getFullYear() - 1, 11, 31)); break;
    }
    case 'all':       from = '1970-01-01'; break;
    case 'custom':    return;
    default: from = to;
  }
  expFilter.dateFrom = from;
  expFilter.dateTo = to;
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function renderExpenses() {
  if (!expFilter.dateFrom) applyDateRange(expFilter.range || 'thismonth');

  const tabBtn = (id, icon, label) => `
    <button class="exp-tab ${expTab === id ? 'is-active' : ''}" data-tab="${id}">
      <span class="exp-tab-ic">${icon}</span>${label}
    </button>`;

  const content = `
    <div class="exp-head">
      <div>
        <h1 class="page-title">💸 Expenses</h1>
        <p class="page-sub">Track, categorise and report every business expense.</p>
      </div>
      <button class="btn btn-primary" id="expQuickAdd">+ Add Expense</button>
    </div>

    <div class="exp-tabs">
      ${tabBtn('list', '📋', 'List Expenses')}
      ${tabBtn('add', '➕', 'Add Expense')}
      ${tabBtn('cats', '📂', 'Expense Category')}
    </div>

    <div id="expTabBody"></div>
  `;

  $('#app').innerHTML = renderLayout('expenses', content);
  bindLayout();

  $$('.exp-tab').forEach(b => b.onclick = () => {
    expTab = b.dataset.tab;
    renderExpenses();
  });
  $('#expQuickAdd').onclick = () => { expTab = 'add'; renderExpenses(); };

  if (expTab === 'list')      renderExpenseListTab();
  else if (expTab === 'add')  renderExpenseAddTab();
  else                        renderExpenseCategoryTab();
}

/* ============================================================
   TAB 1 — LIST
   ============================================================ */
function renderExpenseListTab() {
  const cats = expenseCategoryList();
  const locs = (typeof DB !== 'undefined' ? DB.all('branches') : []) || [];
  const subs = [...new Set(DB.all('expenses').map(e => e.subCategory).filter(Boolean))].sort();
  const contacts = [...new Set(DB.all('expenses').map(e => e.contact).filter(Boolean))].sort();

  const sel = (id, label, options, current) => `
    <div class="exp-f">
      <label>${label}</label>
      <select id="${id}">
        ${options.map(o => `<option value="${o.value}" ${String(current) === String(o.value) ? 'selected' : ''}>${o.text}</option>`).join('')}
      </select>
    </div>`;

  $('#expTabBody').innerHTML = `
    <!-- ===== FILTERS ===== -->
    <div class="exp-filters card">
      <div class="exp-filters-head">
        <span style="font-weight:800;font-size:13px;">🔍 Filters</span>
        <button class="btn btn-ghost btn-sm" id="expClearFilters">Clear all</button>
      </div>
      <div class="exp-filters-grid">
        ${sel('fLocation', 'Business Location',
              [{ value: 'all', text: 'All locations' },
               ...locs.map(l => ({ value: l.id, text: l.name }))], expFilter.location)}
        ${sel('fFor', 'Expense for',
              [{ value: 'all', text: 'All' },
               ...EXP_FOR_OPTIONS.map(v => ({ value: v, text: v }))], expFilter.expenseFor)}
        ${sel('fContact', 'Contact',
              [{ value: 'all', text: 'All' },
               ...contacts.map(c => ({ value: c, text: c }))], expFilter.contact)}
        ${sel('fCategory', 'Expense Category',
              [{ value: 'all', text: 'All' },
               ...cats.map(c => ({ value: c.id, text: c.label }))], expFilter.category)}
        ${sel('fSub', 'Sub category',
              [{ value: 'all', text: 'All' },
               ...subs.map(s => ({ value: s, text: s }))], expFilter.subCategory)}
        ${sel('fStatus', 'Payment Status',
              [{ value: 'all', text: 'All' },
               ...EXP_PAYMENT_STATUS.map(v => ({ value: v, text: v }))], expFilter.paymentStatus)}
        <div class="exp-f exp-f-wide">
          <label>Date Range</label>
          <div class="exp-daterange">
            <input type="date" id="fFrom" value="${expFilter.dateFrom}"/>
            <span>—</span>
            <input type="date" id="fTo" value="${expFilter.dateTo}"/>
            <button class="btn btn-primary btn-sm" id="fApply">Apply</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== LIST ===== -->
    <div class="card exp-listcard">
      <div class="exp-listhead">
        <div class="exp-listhead-title">All expenses</div>
        <button class="btn btn-primary btn-sm" id="expAddFromList">+ Add</button>
      </div>

      <div class="exp-toolbar">
        <div class="exp-toolbar-left">
          <label class="exp-show">Show
            <select id="expPageSize">
              ${[10, 25, 50, 100].map(n => `<option value="${n}" ${expFilter.pageSize === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            entries
          </label>
          <div class="exp-bulk">
            <button class="exp-tool" id="expExportCSV">📥 Export to CSV</button>
            <button class="exp-tool" id="expExportExcel">📊 Export to Excel</button>
            <button class="exp-tool" id="expPrint">🖨️ Print</button>
            <div class="exp-cols">
              <button class="exp-tool" id="expColsBtn">👁️ Column visibility</button>
              <div class="exp-cols-menu" id="expColsMenu"></div>
            </div>
            <button class="exp-tool" id="expExportPDF">📄 Export to PDF</button>
          </div>
        </div>
        <input id="expSearch" class="exp-search" placeholder="Search …" value="${escapeHtml(expFilter.search)}"/>
      </div>

      <div class="exp-tablewrap">
        <table class="exp-table" id="expTable">
          <thead id="expHead"></thead>
          <tbody id="expBody"></tbody>
        </table>
      </div>
      <div id="expPager" class="exp-pager"></div>
    </div>
  `;

  /* ---- filter wiring ---- */
  const wire = (id, key, numeric) => {
    const el = $('#' + id);
    if (el) el.onchange = () => {
      expFilter[key] = numeric ? +el.value : el.value;
      expFilter.page = 1;
      renderExpRows();
    };
  };
  wire('fLocation', 'location');
  wire('fFor', 'expenseFor');
  wire('fContact', 'contact');
  wire('fCategory', 'category');
  wire('fSub', 'subCategory');
  wire('fStatus', 'paymentStatus');
  wire('expPageSize', 'pageSize', true);

  $('#fApply').onclick = () => {
    expFilter.dateFrom = $('#fFrom').value || expFilter.dateFrom;
    expFilter.dateTo = $('#fTo').value || expFilter.dateTo;
    expFilter.range = 'custom';
    expFilter.page = 1;
    renderExpRows();
  };
  $('#expClearFilters').onclick = () => {
    expFilter = Object.assign(expFilter, {
      range: 'thismonth', category: 'all', subCategory: 'all', location: 'all',
      paymentStatus: 'all', expenseFor: 'all', contact: 'all', search: '', page: 1
    });
    applyDateRange('thismonth');
    renderExpenseListTab();
  };
  $('#expSearch').oninput = (e) => {
    expFilter.search = e.target.value;
    expFilter.page = 1;
    renderExpRows();
  };
  $('#expAddFromList').onclick = () => { expTab = 'add'; renderExpenses(); };
  $('#expExportCSV').onclick   = () => exportExpensesCSV();
  $('#expExportExcel').onclick = () => exportExpensesExcel();
  $('#expPrint').onclick       = () => exportExpensesPDF(true);
  $('#expExportPDF').onclick   = () => exportExpensesPDF(false);

  /* ---- column visibility ---- */
  const colBtn = $('#expColsBtn');
  const colMenu = $('#expColsMenu');
  if (colBtn && colMenu) {
    const allCols = EXP_COLUMNS.map(c => ({ key: c.key, label: c.label }));
    colMenu.innerHTML = allCols.map(c => `
      <label><input type="checkbox" data-col="${c.key}" ${expFilter.hiddenCols.includes(c.key) ? '' : 'checked'}/> ${c.label}</label>
    `).join('') + `<button class="exp-tool" id="expColsAll" style="margin-top:6px;width:100%;">Show all</button>`;
    colBtn.onclick = (e) => { e.stopPropagation(); colMenu.classList.toggle('is-open'); };
    document.addEventListener('click', () => colMenu.classList.remove('is-open'), { once: true });
    colMenu.querySelectorAll('input[data-col]').forEach(cb => {
      cb.onchange = () => {
        const k = cb.dataset.col;
        if (cb.checked) expFilter.hiddenCols = expFilter.hiddenCols.filter(x => x !== k);
        else if (!expFilter.hiddenCols.includes(k)) expFilter.hiddenCols.push(k);
        renderExpRows();
      };
    });
    const allBtn = $('#expColsAll');
    if (allBtn) allBtn.onclick = () => { expFilter.hiddenCols = []; renderExpRows(); };
  }

  renderExpRows();
}

/* Column definitions — also drives exports */
const EXP_COLUMNS = [
  { key: 'action',        label: 'Action',           fixed: true },
  { key: 'date',          label: 'Date',             sortable: true },
  { key: 'refNo',         label: 'Reference No',     sortable: true },
  { key: 'recurring',     label: 'Recurring details' },
  { key: 'category',      label: 'Expense Category' },
  { key: 'subCategory',   label: 'Sub category' },
  { key: 'location',      label: 'Location' },
  { key: 'paymentStatus', label: 'Payment Status' },
  { key: 'tax',           label: 'Tax',              sortable: true },
  { key: 'amount',        label: 'Total amount',     sortable: true },
  { key: 'paymentDue',    label: 'Payment due' },
  { key: 'expenseFor',    label: 'Expense for' },
  { key: 'contact',       label: 'Contact' },
  { key: 'note',          label: 'Expense note' }
];

/* ---------- filtering ---------- */
function filteredExpenses() {
  const q = (expFilter.search || '').toLowerCase().trim();
  return DB.all('expenses').filter(e => {
    const d = e.date || (e.createdAt || '').slice(0, 10);
    if (d < expFilter.dateFrom || d > expFilter.dateTo) return false;
    if (expFilter.category !== 'all' && (e.category || 'other') !== expFilter.category) return false;
    if (expFilter.subCategory !== 'all' && (e.subCategory || '') !== expFilter.subCategory) return false;
    if (expFilter.location !== 'all' && (e.branchId || 'main') !== expFilter.location) return false;
    if (expFilter.paymentStatus !== 'all' && (e.paymentStatus || 'Paid') !== expFilter.paymentStatus) return false;
    if (expFilter.expenseFor !== 'all' && (e.expenseFor || 'Shop') !== expFilter.expenseFor) return false;
    if (expFilter.contact !== 'all' && (e.contact || '') !== expFilter.contact) return false;
    if (q) {
      const hay = [e.title, e.note, e.refNo, e.contact, e.subCategory, e.expenseFor]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    const k = expFilter.sortBy;
    let av, bv;
    if (k === 'amount' || k === 'tax') { av = +(a[k] || 0); bv = +(b[k] || 0); }
    else if (k === 'date') { av = a.date || (a.createdAt || ''); bv = b.date || (b.createdAt || ''); }
    else { av = String(a[k] || '').toLowerCase(); bv = String(b[k] || '').toLowerCase(); }
    if (av < bv) return expFilter.sortDir === 'asc' ? -1 : 1;
    if (av > bv) return expFilter.sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function expStatusPill(status) {
  const map = {
    Paid:    { bg: '#dcfce7', fg: '#15803d' },
    Unpaid:  { bg: '#fee2e2', fg: '#b91c1c' },
    Partial: { bg: '#fef3c7', fg: '#b45309' }
  };
  const c = map[status] || map.Paid;
  return `<span class="exp-pill" style="background:${c.bg};color:${c.fg};">${status || 'Paid'}</span>`;
}

function branchName(id) {
  try {
    const b = DB.all('branches').find(x => x.id === id);
    return b ? b.name : (id || '—');
  } catch (e) { return id || '—'; }
}

/* ---------- rows ---------- */
function renderExpRows() {
  const head = $('#expHead');
  const body = $('#expBody');
  if (!head || !body) return;

  const visible = EXP_COLUMNS.filter(c => c.fixed || !expFilter.hiddenCols.includes(c.key));
  const all = filteredExpenses();
  const total = all.reduce((s, e) => s + (e.amount || 0), 0);
  const totalTax = all.reduce((s, e) => s + (e.tax || 0), 0);
  const totalDue = all.reduce((s, e) => s + (e.paymentDue || 0), 0);

  /* header */
  head.innerHTML = `<tr>${visible.map(c => {
    const arrow = c.sortable
      ? `<span class="exp-sort">${expFilter.sortBy === c.key ? (expFilter.sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>`
      : '';
    return `<th class="${c.sortable ? 'is-sortable' : ''}" data-sort="${c.sortable ? c.key : ''}">${c.label}${arrow}</th>`;
  }).join('')}</tr>`;

  head.querySelectorAll('th.is-sortable').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.sort;
      if (!k) return;
      if (expFilter.sortBy === k) expFilter.sortDir = expFilter.sortDir === 'asc' ? 'desc' : 'asc';
      else { expFilter.sortBy = k; expFilter.sortDir = 'asc'; }
      renderExpRows();
    };
  });

  /* paging */
  const per = expFilter.pageSize || 25;
  const pages = Math.max(1, Math.ceil(all.length / per));
  if (expFilter.page > pages) expFilter.page = pages;
  const start = (expFilter.page - 1) * per;
  const pageRows = all.slice(start, start + per);

  /* body */
  if (!all.length) {
    body.innerHTML = `<tr><td colspan="${visible.length}">
      <div class="empty" style="padding:44px;">
        <div class="emoji">💸</div>
        <h4>No expenses found</h4>
        <p>Try a wider date range, clear the filters, or add a new expense.</p>
      </div></td></tr>`;
  } else {
    body.innerHTML = pageRows.map(e => {
      const cat = getExpCategory(e.category);
      const cells = visible.map(c => {
        switch (c.key) {
          case 'action':
            return `<td class="exp-nw"><button class="exp-actbtn" data-id="${e.id}">Actions ▾</button></td>`;
          case 'date':
            return `<td class="exp-nw">${escapeHtml(fmtDateShort(e.date || (e.createdAt || '').slice(0, 10)))}</td>`;
          case 'refNo':
            return `<td class="exp-nw"><b>${escapeHtml(e.refNo || '—')}</b></td>`;
          case 'recurring':
            return `<td>${escapeHtml(e.recurring && e.recurring !== 'None' ? e.recurring : '—')}</td>`;
          case 'category':
            return `<td><span class="exp-catpill" style="background:${cat.color}1f;color:${cat.color};">${cat.label}</span></td>`;
          case 'subCategory':
            return `<td>${escapeHtml(e.subCategory || '—')}</td>`;
          case 'location':
            return `<td>${escapeHtml(branchName(e.branchId || 'main'))}</td>`;
          case 'paymentStatus':
            return `<td>${expStatusPill(e.paymentStatus)}</td>`;
          case 'tax':
            return `<td class="exp-nw" style="text-align:right;">${e.tax ? fmtMoney(e.tax) : '—'}</td>`;
          case 'amount':
            return `<td class="exp-nw" style="text-align:right;"><b style="color:#dc2626;">${fmtMoney(e.amount)}</b></td>`;
          case 'paymentDue':
            return `<td class="exp-nw" style="text-align:right;">${e.paymentDue ? fmtMoney(e.paymentDue) : fmtMoney(0)}</td>`;
          case 'expenseFor':
            return `<td>${escapeHtml(e.expenseFor || 'Shop')}</td>`;
          case 'contact':
            return `<td>${escapeHtml(e.contact || '—')}</td>`;
          case 'note':
            return `<td class="exp-note"><div class="exp-note-clamp" title="${escapeHtml(e.note || '')}">${escapeHtml(e.note || '—')}</div></td>`;
          default:
            return `<td>—</td>`;
        }
      }).join('');
      return `<tr data-row="${e.id}">${cells}</tr>`;
    }).join('');
  }

  /* footer totals row */
  if (all.length) {
    body.insertAdjacentHTML('beforeend', `
      <tr class="exp-totalrow">
        ${visible.map(c => {
          if (c.key === 'action') return '<td></td>';
          if (c.key === 'tax')    return `<td style="text-align:right;">${fmtMoney(totalTax)}</td>`;
          if (c.key === 'amount') return `<td style="text-align:right;">${fmtMoney(total)}</td>`;
          if (c.key === 'paymentDue') return `<td style="text-align:right;">${fmtMoney(totalDue)}</td>`;
          if (c.key === 'date')   return `<td>${all.length} entries</td>`;
          return '<td></td>';
        }).join('')}
      </tr>`);
  }

  /* actions */
  body.querySelectorAll('.exp-actbtn').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      openExpenseActions(btn.dataset.id, btn);
    };
  });

  /* pager */
  const pager = $('#expPager');
  if (pager) {
    if (all.length <= per) {
      pager.innerHTML = `<span class="exp-pageinfo">Showing ${all.length} of ${all.length} entries</span>`;
    } else {
      const btn = (p, txt, dis) => `<button class="exp-pagebtn" ${dis ? 'disabled' : ''} data-page="${p}">${txt}</button>`;
      let nums = '';
      for (let p = 1; p <= pages; p++) {
        if (pages > 7 && p > 2 && p < pages - 1 && Math.abs(p - expFilter.page) > 1) {
          if (!nums.endsWith('…')) nums += '…';
          continue;
        }
        nums += `<button class="exp-pagebtn ${p === expFilter.page ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
      }
      pager.innerHTML = `
        <span class="exp-pageinfo">Showing ${start + 1} to ${Math.min(start + per, all.length)} of ${all.length} entries</span>
        <span class="exp-pagenav">
          ${btn(expFilter.page - 1, '‹', expFilter.page === 1)}
          ${nums.replace(/…/g, '<span class="exp-ellipsis">…</span>')}
          ${btn(expFilter.page + 1, '›', expFilter.page === pages)}
        </span>`;
      pager.querySelectorAll('button[data-page]').forEach(b => {
        b.onclick = () => { expFilter.page = +b.dataset.page; renderExpRows(); };
      });
    }
  }
}

/* ---------- row action menu ---------- */
function openExpenseActions(id, anchor) {
  const e = DB.get('expenses', id);
  if (!e) { toast('⚠️ This expense could not be found — refresh the page', 'error'); return; }
  document.querySelectorAll('.exp-menu').forEach(n => n.remove());

  const menu = document.createElement('div');
  menu.className = 'exp-menu';
  menu.innerHTML = `
    <button data-a="view">👁️ View details</button>
    <button data-a="edit">✏️ Edit expense</button>
    <button data-a="duplicate">📄 Duplicate</button>
    <button data-a="paid">✅ Mark as Paid</button>
    <button data-a="delete" class="is-danger">🗑️ Delete</button>`;
  document.body.appendChild(menu);

  const r = anchor.getBoundingClientRect();
  menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
  menu.style.left = Math.max(8, Math.min(r.left + window.scrollX - 130, window.innerWidth - 210)) + 'px';

  menu.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const a = b.dataset.a;
      menu.remove();
      if (a === 'view')      viewExpense(id);
      if (a === 'edit')      openExpenseForm(e);
      if (a === 'duplicate') {
        const copy = Object.assign({}, e);
        delete copy.id; delete copy.refNo;
        openExpenseForm(null, copy);
      }
      if (a === 'paid') {
        DB.update('expenses', id, { paymentStatus: 'Paid', paymentDue: 0 });
        toast('✅ Marked as paid', 'success');
        renderExpRows();
      }
      if (a === 'delete') {
        confirmDialog('Delete this expense? This cannot be undone.', () => {
          DB.remove('expenses', id);
          toast('🗑️ Expense deleted', 'success');
          renderExpRows();
        });
      }
    };
  });

  setTimeout(() => {
    document.addEventListener('click', function closer() {
      menu.remove();
      document.removeEventListener('click', closer);
    }, { once: true });
  }, 0);
}

function viewExpense(id) {
  const e = DB.get('expenses', id);
  if (!e) return;
  const cat = getExpCategory(e.category);
  const row = (k, v) => `<div class="exp-vrow"><span>${k}</span><b>${v}</b></div>`;
  openModal(`
    <h3>🧾 Expense ${escapeHtml(e.refNo || '')}</h3>
    <div class="exp-view">
      ${row('Date', escapeHtml(e.date || (e.createdAt || '').slice(0, 10)))}
      ${row('Title', escapeHtml(e.title || '—'))}
      ${row('Category', `<span class="exp-catpill" style="background:${cat.color}1f;color:${cat.color};">${cat.label}</span>`)}
      ${row('Sub category', escapeHtml(e.subCategory || '—'))}
      ${row('Location', escapeHtml(branchName(e.branchId || 'main')))}
      ${row('Payment status', expStatusPill(e.paymentStatus))}
      ${row('Expense for', escapeHtml(e.expenseFor || 'Shop'))}
      ${row('Contact', escapeHtml(e.contact || '—'))}
      ${row('Recurring', escapeHtml(e.recurring || 'None'))}
      ${row('Base amount', fmtMoney(e.baseAmount != null ? e.baseAmount : (e.amount || 0) - (e.tax || 0)))}
      ${row('Tax', fmtMoney(e.tax || 0))}
      ${row('Total amount', `<span style="color:#dc2626;">${fmtMoney(e.amount)}</span>`)}
      ${row('Payment due', fmtMoney(e.paymentDue || 0))}
      ${row('Note', escapeHtml(e.note || '—'))}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" id="expViewEdit">✏️ Edit</button>
    </div>
  `, { onOpen(m) {
    $('#expViewEdit', m).onclick = () => { closeModal(); setTimeout(() => openExpenseForm(e), 120); };
  }});
}

/* ============================================================
   TAB 2 — ADD / EDIT
   ============================================================ */
function renderExpenseAddTab() {
  const cats = expenseCategoryList();
  const locs = DB.all('branches');
  const subs = [...new Set(DB.all('expenses').map(e => e.subCategory).filter(Boolean))].sort();
  const contacts = [...new Set(DB.all('expenses').map(e => e.contact).filter(Boolean))].sort();

  $('#expTabBody').innerHTML = `
    <div class="card" style="max-width:1100px;">
      <div class="card-header"><h3>➕ Add Expense</h3></div>
      <div style="padding:18px;">
        <div class="form-row cols-1">
          <div class="field">
            <label>Expense Title *</label>
            <input id="nTitle" placeholder="e.g. June Rent, Detergent for Friday"/>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Expense Category *</label>
            <select id="nCategory">
              ${cats.map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Sub category</label>
            <input id="nSub" list="expSubList" placeholder="e.g. Shop Rent, Washing Machine"/>
            <datalist id="expSubList">${subs.map(s => `<option value="${escapeHtml(s)}"></option>`).join('')}</datalist>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Expense for</label>
            <select id="nFor">${EXP_FOR_OPTIONS.map(v => `<option value="${v}">${v}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Contact</label>
            <input id="nContact" list="expContactList" placeholder="Vendor / person name"/>
            <datalist id="expContactList">${contacts.map(c => `<option value="${escapeHtml(c)}"></option>`).join('')}</datalist>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Business Location</label>
            <select id="nLocation">
              ${locs.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Date *</label>
            <input type="date" id="nDate" value="${isoDay()}"/>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Amount (before tax) *</label>
            <input type="number" id="nAmount" value="" placeholder="0" step="0.01" style="font-weight:700;font-size:16px;"/>
          </div>
          <div class="field">
            <label>Tax</label>
            <input type="number" id="nTax" value="" placeholder="0" step="0.01"/>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Payment Status</label>
            <select id="nStatus">${EXP_PAYMENT_STATUS.map(v => `<option value="${v}">${v}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Payment Due</label>
            <input type="number" id="nDue" value="" placeholder="0" step="0.01"/>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Recurring details</label>
            <select id="nRecurring">${EXP_RECURRING.map(v => `<option value="${v}">${v}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Reference No</label>
            <input id="nRef" placeholder="auto-generated" readonly style="background:var(--surface-alt);"/>
          </div>
        </div>

        <div class="form-row cols-1">
          <div class="field">
            <label>Expense note</label>
            <textarea id="nNote" rows="3" placeholder="Any details…"></textarea>
          </div>
        </div>

        <div class="exp-totalbox">
          <span>Total amount</span>
          <b id="nTotal">Rs. 0</b>
        </div>

        <div class="modal-footer" style="padding:0;border:0;margin-top:16px;">
          <button class="btn btn-ghost" id="nCancel">Cancel</button>
          <button class="btn btn-primary" id="nSave">💾 Save Expense</button>
        </div>
      </div>
    </div>
  `;

  const recalc = () => {
    const base = +($('#nAmount').value || 0);
    const tax = +($('#nTax').value || 0);
    $('#nTotal').textContent = fmtMoney(base + tax);
  };
  $('#nAmount').oninput = recalc;
  $('#nTax').oninput = recalc;
  recalc();

  $('#nCancel').onclick = () => { expTab = 'list'; renderExpenses(); };
  $('#nSave').onclick = () => {
    if (saveExpenseValues(null, null)) {
      expTab = 'list';
      renderExpenses();
    }
  };
}

/* Used by both the Add tab and the modal form */
function saveExpenseValues(existing, seed) {
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const s = seed || {};

  const title = (g('nTitle') != null ? g('nTitle') : (g('eTitle') != null ? g('eTitle') : s.title) || '').trim();
  const base = +(g('nAmount') != null ? g('nAmount') : (g('eAmount') != null ? g('eAmount') : s.baseAmount) || 0);
  const tax = +(g('nTax') != null ? g('nTax') : (g('eTax') != null ? g('eTax') : s.tax) || 0);

  if (!title) { toast('Enter an expense title', 'error'); return false; }
  if (base <= 0) { toast('Enter an amount greater than 0', 'error'); return false; }

  const status = (g('nStatus') || g('eStatus') || s.paymentStatus || 'Paid');
  let due = +(g('nDue') != null ? g('nDue') : (g('eDue') != null ? g('eDue') : s.paymentDue) || 0);
  if (status === 'Paid') due = 0;
  if (status === 'Unpaid' && due === 0) due = base + tax;
  if (status === 'Partial' && due === 0) due = Math.round((base + tax) * 0.5);

  const data = {
    title,
    category: (g('nCategory') || g('eCategory') || s.category || 'other'),
    subCategory: (g('nSub') != null ? g('nSub') : (g('eSub') != null ? g('eSub') : s.subCategory) || '').trim(),
    expenseFor: (g('nFor') || g('eFor') || s.expenseFor || 'Shop'),
    contact: (g('nContact') != null ? g('nContact') : (g('eContact') != null ? g('eContact') : s.contact) || '').trim(),
    branchId: (g('nLocation') || g('eLocation') || s.branchId || ((typeof getActiveBranchId === 'function') ? getActiveBranchId() : 'main')),
    date: (g('nDate') || g('eDate') || s.date || isoDay()),
    baseAmount: base,
    tax,
    amount: base + tax,
    paymentStatus: status,
    paymentDue: due,
    recurring: (g('nRecurring') || g('eRecurring') || s.recurring || 'None'),
    note: (g('nNote') != null ? g('nNote') : (g('eNote') != null ? g('eNote') : s.note) || '').trim()
  };
  if (g('nRef') != null) data.refNo = g('nRef') || undefined;

  if (existing && existing.id) {
    DB.update('expenses', existing.id, data);
    if (typeof logAction === 'function') logAction('expense.edit', `${title} ${fmtMoney(data.amount)}`);
    toast('✅ Expense updated', 'success');
  } else {
    if (!data.refNo) data.refNo = nextExpenseRef();
    DB.insert('expenses', data);
    if (typeof logAction === 'function') logAction('expense.add', `${title} ${fmtMoney(data.amount)}`);
    toast('✅ Expense added', 'success');
  }
  return true;
}

function nextExpenseRef() {
  const year = new Date().getFullYear();
  const all = DB.all('expenses').map(e => e.refNo).filter(Boolean);
  let max = 0;
  all.forEach(r => {
    const m = String(r).match(/(\d+)\s*$/);
    if (m && String(r).includes(String(year))) max = Math.max(max, +m[1]);
  });
  if (!DB._data._counters.expense) DB._data._counters.expense = 1000;
  DB._data._counters.expense = Math.max(DB._data._counters.expense, max) + 1;
  DB.save();
  return `EXP/${year}/${String(DB._data._counters.expense).padStart(4, '0')}`;
}

/* Modal form (used from the list "Actions → Edit") */
function openExpenseForm(existing, seed) {
  const e = Object.assign({
    title: '', baseAmount: '', tax: '', category: 'other', subCategory: '',
    expenseFor: 'Shop', contact: '', date: isoDay(), paymentStatus: 'Paid',
    paymentDue: '', recurring: 'None', note: '', branchId: 'main'
  }, seed || {}, existing || {});

  const cats = expenseCategoryList();
  const locs = DB.all('branches');

  openModal(`
    <h3>${existing ? '✏️ Edit' : '➕ Add'} Expense</h3>
    <div class="form-row">
      <div class="field"><label>Expense Title *</label><input id="eTitle" value="${escapeHtml(e.title || '')}"/></div>
      <div class="field"><label>Reference No</label><input id="eRef" value="${escapeHtml(e.refNo || 'auto')}" readonly style="background:var(--surface-alt);"/></div>
    </div>
    <div class="form-row">
      <div class="field">
        <label>Expense Category *</label>
        <select id="eCategory">${cats.map(c => `<option value="${c.id}" ${e.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Sub category</label><input id="eSub" value="${escapeHtml(e.subCategory || '')}"/></div>
    </div>
    <div class="form-row">
      <div class="field">
        <label>Expense for</label>
        <select id="eFor">${EXP_FOR_OPTIONS.map(v => `<option value="${v}" ${e.expenseFor === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Contact</label><input id="eContact" value="${escapeHtml(e.contact || '')}"/></div>
    </div>
    <div class="form-row">
      <div class="field">
        <label>Business Location</label>
        <select id="eLocation">${locs.map(l => `<option value="${l.id}" ${e.branchId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Date *</label><input type="date" id="eDate" value="${e.date}"/></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Amount (before tax) *</label><input type="number" id="eAmount" value="${e.baseAmount != null && e.baseAmount !== '' ? e.baseAmount : (e.amount || '')}" step="0.01"/></div>
      <div class="field"><label>Tax</label><input type="number" id="eTax" value="${e.tax || ''}" step="0.01"/></div>
    </div>
    <div class="form-row">
      <div class="field">
        <label>Payment Status</label>
        <select id="eStatus">${EXP_PAYMENT_STATUS.map(v => `<option value="${v}" ${(e.paymentStatus || 'Paid') === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Payment Due</label><input type="number" id="eDue" value="${e.paymentDue || ''}" step="0.01"/></div>
    </div>
    <div class="form-row cols-1">
      <div class="field">
        <label>Recurring details</label>
        <select id="eRecurring">${EXP_RECURRING.map(v => `<option value="${v}" ${(e.recurring || 'None') === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row cols-1">
      <div class="field"><label>Expense note</label><textarea id="eNote" rows="2">${escapeHtml(e.note || '')}</textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="eSave">💾 Save</button>
    </div>
  `, { onOpen(m) {
    $('#eSave', m).onclick = () => {
      if (saveExpenseValues(existing || null, existing || null)) {
        closeModal();
        expTab = 'list';
        renderExpenses();
      }
    };
  }});
}

/* ============================================================
   TAB 3 — EXPENSE CATEGORIES
   ============================================================ */
function renderExpenseCategoryTab() {
  const cats = expenseCategoryList();

  $('#expTabBody').innerHTML = `
    <div class="card exp-catcard">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3>📂 Expense Categories</h3>
        <button class="btn btn-primary btn-sm" id="catAdd">+ Add Category</button>
      </div>

      <div style="padding:14px;">
        <p style="color:var(--text-soft);font-size:13px;margin-bottom:14px;">
          Add your own expense categories. Categories already used by an expense cannot be deleted until you
          move those expenses to another category.
        </p>

        <div id="catFormWrap" style="display:none;background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
          <div class="form-row">
            <div class="field">
              <label>Category Name *</label>
              <input id="catName" placeholder="e.g. 🚿 Water Tanker"/>
            </div>
            <div class="field">
              <label>Colour</label>
              <input type="color" id="catColor" value="#4f7cff" style="height:42px;padding:4px;"/>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" id="catSave">💾 Save Category</button>
            <button class="btn btn-ghost btn-sm" id="catCancel">Cancel</button>
          </div>
        </div>

        <table class="tbl">
          <thead><tr>
            <th>Category</th>
            <th style="text-align:right;">Expenses</th>
            <th style="text-align:right;">Total Amount</th>
            <th style="text-align:right;">Actions</th>
          </tr></thead>
          <tbody>
            ${cats.map(c => {
              const used = expCategoryUsage(c.id);
              const total = DB.all('expenses').filter(e => (e.category || 'other') === c.id)
                .reduce((s, e) => s + (e.amount || 0), 0);
              return `<tr>
                <td>
                  <span class="exp-catpill" style="background:${c.color}1f;color:${c.color};">${escapeHtml(c.label)}</span>
                </td>
                <td style="text-align:right;">${used}</td>
                <td style="text-align:right;">${fmtMoney(total)}</td>
                <td style="text-align:right;">
                  <button class="btn btn-secondary btn-sm" data-edit="${c.id}">✏️</button>
                  <button class="btn btn-danger btn-sm" data-del="${c.id}" ${used > 0 ? 'disabled title="Used by expenses — cannot delete"' : ''}>🗑️</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const formWrap = $('#catFormWrap');
  const resetForm = () => {
    formWrap.style.display = 'none';
    $('#catName').value = '';
    $('#catColor').value = '#4f7cff';
    formWrap.dataset.editing = '';
  };

  $('#catAdd').onclick = () => {
    formWrap.style.display = 'block';
    formWrap.dataset.editing = '';
    $('#catName').value = '';
    $('#catColor').value = '#4f7cff';
    $('#catName').focus();
  };
  $('#catCancel').onclick = resetForm;

  $('#catSave').onclick = () => {
    const name = ($('#catName').value || '').trim();
    const color = $('#catColor').value || '#4f7cff';
    if (!name) { toast('Enter a category name', 'error'); return; }
    const editing = formWrap.dataset.editing;

    if (editing) {
      DB.update('expenseCategories', editing, { label: name, color });
      toast('✅ Category updated', 'success');
    } else {
      const dup = expenseCategoryList().some(c => c.label.toLowerCase() === name.toLowerCase());
      if (dup) { toast('That category already exists', 'error'); return; }
      DB.insert('expenseCategories', { id: slugifyCategory(name), label: name, color });
      toast('✅ Category added', 'success');
    }
    if (typeof logAction === 'function') logAction('expense.category', name);
    renderExpenseCategoryTab();
  };

  $$('[data-edit]').forEach(b => b.onclick = () => {
    const c = getExpCategory(b.dataset.edit);
    formWrap.style.display = 'block';
    formWrap.dataset.editing = c.id;
    $('#catName').value = c.label;
    $('#catColor').value = c.color;
    $('#catName').focus();
  });

  $$('[data-del]').forEach(b => b.onclick = () => {
    const id = b.dataset.del;
    const used = expCategoryUsage(id);
    if (used > 0) {
      toast(`Cannot delete — ${used} expense(s) use this category`, 'error');
      return;
    }
    const c = getExpCategory(id);
    confirmDialog(`Delete category "${c.label}"?`, () => {
      DB.remove('expenseCategories', id);
      toast('🗑️ Category deleted', 'success');
      renderExpenseCategoryTab();
    });
  });
}

/* ============================================================
   EXPORTS
   ============================================================ */
function expExportRows() {
  const list = filteredExpenses();
  const head = ['Date', 'Reference No', 'Recurring', 'Expense Category', 'Sub category',
                'Location', 'Payment Status', 'Tax', 'Total amount', 'Payment due',
                'Expense for', 'Contact', 'Expense note', 'Title'];
  const rows = list.map(e => {
    const cat = getExpCategory(e.category);
    return [
      e.date || (e.createdAt || '').slice(0, 10),
      e.refNo || '',
      e.recurring && e.recurring !== 'None' ? e.recurring : '',
      cat.label.replace(/[^\w\s\/&()\-]/g, '').trim(),
      e.subCategory || '',
      branchName(e.branchId || 'main'),
      e.paymentStatus || 'Paid',
      e.tax || 0,
      e.amount || 0,
      e.paymentDue || 0,
      e.expenseFor || 'Shop',
      e.contact || '',
      e.note || '',
      e.title || ''
    ];
  });
  const total = list.reduce((s, e) => s + (e.amount || 0), 0);
  return { head, rows, total, list };
}

function exportExpensesCSV() {
  const { head, rows, total } = expExportRows();
  const all = [head, ...rows, ['', '', '', '', '', '', '', '', total, '', '', '', '', 'TOTAL']];
  const csv = all.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(`expenses_${expFilter.dateFrom}_to_${expFilter.dateTo}.csv`, csv, 'text/csv');
  toast('✅ CSV exported', 'success');
}

function exportExpensesExcel() {
  const { head, rows, total } = expExportRows();
  let html = '<html><head><meta charset="utf-8"></head><body><table border="1">';
  html += '<tr>' + head.map(h => `<th style="background:#4f7cff;color:#fff;">${escapeHtml(h)}</th>`).join('') + '</tr>';
  rows.forEach(r => {
    html += '<tr>' + r.map(v => `<td>${escapeHtml(String(v))}</td>`).join('') + '</tr>';
  });
  html += `<tr><td colspan="8" style="text-align:right;font-weight:bold;">TOTAL</td><td style="font-weight:bold;">${total}</td><td colspan="5"></td></tr>`;
  html += '</table></body></html>';
  downloadFile(`expenses_${expFilter.dateFrom}_to_${expFilter.dateTo}.xls`, html, 'application/vnd.ms-excel');
  toast('✅ Excel exported', 'success');
}

async function exportExpensesPDF(printNow) {
  const list = filteredExpenses();
  if (!list.length) { toast('No expenses to export', 'warning'); return; }
  const total = list.reduce((s, e) => s + (e.amount || 0), 0);
  const totalTax = list.reduce((s, e) => s + (e.tax || 0), 0);
  const totalDue = list.reduce((s, e) => s + (e.paymentDue || 0), 0);
  const s = DB.settings();

  const catTotals = {};
  list.forEach(e => {
    const cid = e.category || 'other';
    catTotals[cid] = (catTotals[cid] || 0) + (e.amount || 0);
  });
  const catRows = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
    .map(([cid, amt]) => {
      const cat = getExpCategory(cid);
      const pct = total > 0 ? (amt / total * 100).toFixed(1) : 0;
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(cat.label)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(amt)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:#666;">${pct}%</td>
      </tr>`;
    }).join('');

  const detailRows = list.map(e => {
    const cat = getExpCategory(e.category);
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;white-space:nowrap;">${e.date || (e.createdAt || '').slice(0, 10)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${escapeHtml(e.refNo || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${escapeHtml(cat.label)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${escapeHtml(e.subCategory || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;"><b>${escapeHtml(e.title)}</b></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${escapeHtml(e.contact || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${e.paymentStatus || 'Paid'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;text-align:right;">${e.tax ? fmtMoney(e.tax) : '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;text-align:right;">${fmtMoney(e.amount)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;text-align:right;">${fmtMoney(e.paymentDue || 0)}</td>
    </tr>`;
  }).join('');

  const logoSrc = s.logoImage ? (() => {
    try { return new URL(s.logoImage, location.href).href; } catch (e) { return s.logoImage; }
  })() : '';
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" style="max-width:70px;max-height:70px;object-fit:contain;" alt="logo"/>`
    : `<div style="font-size:42px;">${s.logo || '🧺'}</div>`;

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Expense Report — ${escapeHtml(s.shopName || 'Laundry POS')}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#000;padding:18px;margin:0;}
        h1{margin:6px 0;font-size:20px;}
        h2{font-size:13px;margin:16px 0 8px;color:#4f7cff;border-bottom:2px solid #4f7cff;padding-bottom:4px;}
        table{width:100%;border-collapse:collapse;margin-bottom:14px;}
        th{background:#4f7cff;color:#fff;padding:7px;font-size:10px;text-align:left;}
        .header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #4f7cff;padding-bottom:12px;margin-bottom:14px;}
        .totals{background:#fef2f2;border:2px solid #ef4444;padding:12px;border-radius:8px;margin:12px 0;}
        .totals .row{display:flex;justify-content:space-between;font-size:13px;font-weight:700;}
        .totals .grand{font-size:20px;font-weight:900;color:#dc2626;margin-top:6px;padding-top:6px;border-top:1px dashed #ef4444;}
        .footer{text-align:center;font-size:10px;color:#666;margin-top:26px;border-top:1px dashed #ccc;padding-top:8px;}
        @media print{body{padding:8px;} @page{margin:8mm;}}
      </style>
    </head><body>
      <div class="header">
        ${logoHtml}
        <div style="flex:1;">
          <h1>${escapeHtml(s.shopName || 'Laundry POS')}</h1>
          <div style="font-size:11px;color:#666;">${escapeHtml(s.address || '')}</div>
          <div style="font-size:11px;color:#666;">${escapeHtml(s.phone || '')}</div>
        </div>
        <div style="text-align:right;font-size:10px;color:#666;">
          <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
          <div><b>Period:</b> ${expFilter.dateFrom} → ${expFilter.dateTo}</div>
          <div><b>By:</b> ${escapeHtml((DB.currentUser() || {}).name || 'Admin')}</div>
        </div>
      </div>

      <h1 style="text-align:center;margin:16px 0;">EXPENSE REPORT</h1>

      <div class="totals">
        <div class="row"><span>Total Entries</span><span>${list.length}</span></div>
        <div class="row"><span>Categories Used</span><span>${Object.keys(catTotals).length}</span></div>
        <div class="row"><span>Total Tax</span><span>${fmtMoney(totalTax)}</span></div>
        <div class="row"><span>Payment Due</span><span>${fmtMoney(totalDue)}</span></div>
        <div class="row grand"><span>GRAND TOTAL</span><span>${fmtMoney(total)}</span></div>
      </div>

      <h2>Breakdown by Category</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right;">Amount</th><th style="text-align:right;">% of Total</th></tr></thead>
      <tbody>${catRows}</tbody></table>

      <h2>All Expense Entries (${list.length})</h2>
      <table>
        <thead><tr>
          <th>Date</th><th>Reference</th><th>Category</th><th>Sub category</th><th>Title</th>
          <th>Contact</th><th>Status</th><th style="text-align:right;">Tax</th>
          <th style="text-align:right;">Amount</th><th style="text-align:right;">Due</th>
        </tr></thead>
        <tbody>${detailRows}</tbody>
        <tfoot><tr style="background:#fef2f2;font-weight:800;">
          <td colspan="8" style="padding:9px;text-align:right;">GRAND TOTAL:</td>
          <td style="padding:9px;text-align:right;color:#dc2626;">${fmtMoney(total)}</td>
          <td style="padding:9px;text-align:right;">${fmtMoney(totalDue)}</td>
        </tr></tfoot>
      </table>

      <div class="footer">${escapeHtml(s.shopName || 'Laundry POS')} — Confidential Financial Report<br>
      Generated by Laundry POS • ${new Date().toLocaleString()}</div>
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast('Pop-up blocked! Allow pop-ups to export.', 'error'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 700);
  toast(printNow ? '🖨️ Print dialog opened' : '📄 Print dialog opened — choose "Save as PDF"', 'success');
}

/* expose for reports.js + console use */
window.EXPENSE_CATEGORIES = EXPENSE_CATEGORY_DEFAULTS;
window.getExpCategory = getExpCategory;
window.expenseCategoryList = expenseCategoryList;
