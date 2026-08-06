# Adorners Billing Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-folder, dependency-free tool that lets Adorners generate Payment
Vouchers and Quotations with automatic totals, replacing manual typing in Word.

**Architecture:** Two files shipped together: `calculations.js` (pure money-math functions,
unit-tested in isolation) and `adorners-billing.html` (the actual app — storage, screens,
rendering, print output — loads `calculations.js` via `<script src>`). No build step, no
server, no framework. Documents persist in the browser via `localStorage`. PDF export uses
the browser's native print-to-PDF.

**Tech Stack:** Vanilla HTML/CSS/JS only. No npm, no bundler, no CDN dependencies.

**Testing approach:** `calculations.js` holds all the money math (line amounts, subtotals,
grand totals) as pure functions with no DOM/storage access, so it gets real TDD (red/green)
via a zero-dependency assertion runner (`calculations.test.html`). The rest of the app is
DOM wiring and storage I/O with no framework available to unit-test it in isolation, so it's
verified manually at the end of each task — this matches the spec's own Testing section
(`docs/superpowers/specs/2026-08-06-adorners-billing-tool-design.md`).

Reference: @docs/superpowers/specs/2026-08-06-adorners-billing-tool-design.md

---

### Task 1: Pure calculation functions (TDD)

**Files:**
- Create: `calculations.js`
- Create: `calculations.test.html`

**Step 1: Write the failing test file**

Create `calculations.test.html`:

```html
<!DOCTYPE html>
<html>
<head><title>calculations.js tests</title></head>
<body>
<pre id="output"></pre>
<script src="calculations.js"></script>
<script>
  const results = [];
  function assertEqual(actual, expected, label) {
    const pass = actual === expected;
    results.push(`${pass ? 'PASS' : 'FAIL'} — ${label} (expected ${expected}, got ${actual})`);
  }

  assertEqual(calcLineAmount(30, 7200), 216000, 'calcLineAmount: 30 x 7200');
  assertEqual(calcLineAmount(0, 500), 0, 'calcLineAmount: zero qty');

  assertEqual(
    calcCategorySubtotal([{ qty: 30, rate: 7200 }, { qty: 1, rate: 6000 }]),
    222000,
    'calcCategorySubtotal: two items'
  );
  assertEqual(calcCategorySubtotal([]), 0, 'calcCategorySubtotal: empty list');

  assertEqual(
    calcQuotationGrandTotal([
      { items: [{ qty: 30, rate: 7200 }, { qty: 1, rate: 6000 }] },
      { items: [{ qty: 1, rate: 28000 }] }
    ]),
    250000,
    'calcQuotationGrandTotal: two categories'
  );

  assertEqual(
    calcVoucherGrandTotal([{ amount: 300000 }, { amount: 200000 }, { amount: 50000 }]),
    550000,
    'calcVoucherGrandTotal: three entries'
  );
  assertEqual(calcVoucherGrandTotal([]), 0, 'calcVoucherGrandTotal: empty list');

  document.getElementById('output').textContent = results.join('\n');
  const failed = results.filter(r => r.startsWith('FAIL'));
  document.title = failed.length
    ? `${failed.length} FAILED — calculations.js tests`
    : 'ALL PASS — calculations.js tests';
</script>
</body>
</html>
```

**Step 2: Verify it fails**

Open `calculations.test.html` directly in a browser (double-click it).
Expected: a browser console error that `calcLineAmount is not defined` (since
`calculations.js` doesn't exist yet), and the page title stays as the raw `<title>` text
(the inline script throws before it can update `document.title`).

**Step 3: Write the minimal implementation**

Create `calculations.js`:

```js
// Pure calculation functions for Adorners billing documents.
// No DOM, no storage access — safe to unit test in isolation.

function calcLineAmount(qty, rate) {
  return qty * rate;
}

function calcCategorySubtotal(items) {
  return items.reduce((sum, item) => sum + calcLineAmount(item.qty, item.rate), 0);
}

function calcQuotationGrandTotal(categories) {
  return categories.reduce((sum, cat) => sum + calcCategorySubtotal(cat.items), 0);
}

function calcVoucherGrandTotal(entries) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}
```

**Step 4: Verify it passes**

Reload `calculations.test.html` in the browser.
Expected: page title reads `ALL PASS — calculations.js tests`, and the `<pre>` block shows
6 lines all starting with `PASS`.

**Step 5: Commit**

```bash
git add calculations.js calculations.test.html
git commit -m "test: add calculation functions for voucher/quotation totals"
```

---

### Task 2: App shell — storage layer, screens, base styles

**Files:**
- Create: `adorners-billing.html`

**Step 1: Write the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Adorners — Billing Tool</title>
<style>
  :root {
    --navy: #1a2744;
    --band: #dbe5f1;
    --border: #c7c7c7;
    --error: #b3261e;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Segoe UI, Arial, sans-serif;
    margin: 0;
    color: #1a1a1a;
    background: #f4f4f5;
  }
  #app { max-width: 900px; margin: 0 auto; padding: 24px; }
  .screen.hidden { display: none; }
  h1, h2 { margin: 0 0 16px; }
  button {
    font: inherit;
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
  }
  button.primary { background: var(--navy); color: #fff; border-color: var(--navy); }
  input[type=text], input[type=number], input[type=date] {
    font: inherit;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    width: 100%;
  }
  label { display: block; font-size: 13px; color: #444; margin-bottom: 4px; }
  .field-row { display: flex; gap: 16px; margin-bottom: 16px; }
  .field-row > div { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid var(--border); padding: 6px 8px; text-align: left; }
  thead th { background: var(--navy); color: #fff; }
  tbody tr:nth-child(even) { background: var(--band); }
  tfoot td { font-weight: bold; }
  .error { color: var(--error); font-size: 13px; margin-bottom: 12px; }
  .error.hidden { display: none; }
  .actions { display: flex; gap: 8px; margin-top: 16px; }
  .doc-row { display: flex; justify-content: space-between; padding: 10px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 8px; cursor: pointer; background: #fff; }
  .doc-row:hover { background: #eef1f7; }
  .badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: var(--band); }

  @media print {
    body { background: #fff; margin: 0; }
    #app { max-width: none; padding: 0; }
    .no-print { display: none !important; }
    @page { margin: 2in 0.75in 0.75in 0.75in; }
  }
</style>
</head>
<body>
<div id="app">
  <div id="screen-list" class="screen"></div>
  <div id="screen-voucher" class="screen hidden"></div>
  <div id="screen-quotation" class="screen hidden"></div>
</div>

<script src="calculations.js"></script>
<script>
/* ===== STORAGE ===== */
const STORAGE_KEY = 'adorners_billing_documents';

function loadDocuments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    alert('Could not read saved documents: ' + err.message);
    return [];
  }
}

function saveDocument(doc) {
  try {
    const docs = loadDocuments();
    doc.updatedAt = new Date().toISOString();
    const idx = docs.findIndex(d => d.id === doc.id);
    if (idx === -1) {
      doc.createdAt = doc.updatedAt;
      docs.push(doc);
    } else {
      docs[idx] = doc;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    return true;
  } catch (err) {
    alert('Could not save document: ' + err.message);
    return false;
  }
}

function getDocument(id) {
  return loadDocuments().find(d => d.id === id) || null;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ===== HELPERS ===== */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatCurrency(amount) {
  const rounded = Math.round(amount || 0);
  return `Rs.${rounded.toLocaleString('en-US')}/-`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* ===== SCREEN SWITCHING ===== */
let currentDoc = null;

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById('screen-' + name).classList.remove('hidden');
}

/* ===== INIT ===== */
function init() {
  showScreen('list');
}
init();
</script>
</body>
</html>
```

**Step 2: Manually verify**

Open `adorners-billing.html` in a browser. Expected: a plain page with no visible content
yet (the list screen renderer doesn't exist until Task 3), no console errors.

Open the browser console and run:
```js
saveDocument({ id: 'x1', type: 'voucher', clientName: 'Test', date: todayIso(), entries: [] });
loadDocuments();
```
Expected: returns an array containing the object you just saved.

**Step 3: Commit**

```bash
git add adorners-billing.html
git commit -m "feat: app shell with storage layer and screen switching"
```

---

### Task 3: Document list screen

**Files:**
- Modify: `adorners-billing.html` (replace the `/* ===== INIT ===== */` block)

**Step 1: Insert the list renderer**

Insert this new section directly above `/* ===== INIT ===== */`:

```js
/* ===== RENDER: LIST ===== */
function renderList(filter = '') {
  const docs = loadDocuments()
    .filter(d => d.clientName.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const rows = docs.map(d => {
    const total = d.type === 'voucher'
      ? calcVoucherGrandTotal(d.entries)
      : calcQuotationGrandTotal(d.categories);
    return `
      <div class="doc-row" data-id="${d.id}" data-type="${d.type}">
        <div>
          <strong>${escapeHtml(d.clientName)}</strong>
          <span class="badge">${d.type === 'voucher' ? 'Voucher' : 'Quotation'}</span>
          <div style="font-size:13px;color:#666;">${d.date}</div>
        </div>
        <div>${formatCurrency(total)}</div>
      </div>`;
  }).join('') || '<p style="color:#666;">No documents yet.</p>';

  document.getElementById('screen-list').innerHTML = `
    <h1>Adorners Billing</h1>
    <div class="actions">
      <button class="primary" id="new-voucher-btn">+ New Payment Voucher</button>
      <button class="primary" id="new-quotation-btn">+ New Quotation</button>
    </div>
    <div style="margin:16px 0;">
      <input type="text" id="search-input" placeholder="Search by client name..." value="${escapeHtml(filter)}">
    </div>
    <div id="doc-rows">${rows}</div>
  `;

  document.getElementById('new-voucher-btn').addEventListener('click', () => openNewVoucher());
  document.getElementById('new-quotation-btn').addEventListener('click', () => openNewQuotation());
  document.getElementById('search-input').addEventListener('input', (e) => renderList(e.target.value));
  document.querySelectorAll('.doc-row').forEach(row => {
    row.addEventListener('click', () => openExistingDocument(row.dataset.id, row.dataset.type));
  });
}

function openExistingDocument(id, type) {
  currentDoc = getDocument(id);
  if (!currentDoc) return;
  if (type === 'voucher') { showScreen('voucher'); renderVoucherEditor(); }
  else { showScreen('quotation'); renderQuotationEditor(); }
}
```

Replace the `init()` function's body:

```js
function init() {
  showScreen('list');
  renderList();
}
init();
```

**Step 2: Manually verify**

In the browser console, seed two fake documents, then reload the page:
```js
saveDocument({ id: 'v1', type: 'voucher', clientName: 'Faiz Bhai', date: '2026-07-28', entries: [{date:'2026-05-18', detail:'Cash Deposit', amount: 300000}] });
saveDocument({ id: 'q1', type: 'quotation', clientName: 'Mairaj Bhai', date: '2026-07-28', categories: [{name:'Electrician', items:[{description:'AC Wiring', qty:30, unit:'M', rate:7200}]}] });
```
Reload `adorners-billing.html`. Expected: two rows shown, "Faiz Bhai" with `Rs.300,000/-`
and a Voucher badge, "Mairaj Bhai" with `Rs.216,000/-` and a Quotation badge. Typing
"faiz" into the search box should leave only the first row visible. (Clicking a row will
error — `openNewVoucher`/`renderVoucherEditor` don't exist until Task 4 — that's expected
at this point.)

**Step 3: Commit**

```bash
git add adorners-billing.html
git commit -m "feat: document list screen with search"
```

---

### Task 4: Payment Voucher editor

**Files:**
- Modify: `adorners-billing.html` (insert above `/* ===== RENDER: LIST ===== */`)

**Step 1: Insert the voucher editor**

```js
/* ===== RENDER: VOUCHER EDITOR ===== */
function openNewVoucher() {
  currentDoc = { id: generateId(), type: 'voucher', clientName: '', date: todayIso(), entries: [] };
  showScreen('voucher');
  renderVoucherEditor();
}

function renderVoucherEditor() {
  const d = currentDoc;
  const rows = d.entries.map((entry, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><input type="date" data-idx="${i}" data-field="date" value="${entry.date}"></td>
      <td><input type="text" data-idx="${i}" data-field="detail" value="${escapeHtml(entry.detail)}"></td>
      <td><input type="number" data-idx="${i}" data-field="amount" value="${entry.amount}"></td>
      <td class="no-print"><button class="remove-row" data-idx="${i}">Remove</button></td>
    </tr>`).join('');

  document.getElementById('screen-voucher').innerHTML = `
    <div class="no-print"><button id="back-btn">&larr; Back</button></div>
    <h2>Payment Voucher</h2>
    <div id="validation-msg" class="error hidden"></div>
    <div class="field-row">
      <div><label>Client Name</label><input type="text" id="f-client" value="${escapeHtml(d.clientName)}"></div>
      <div><label>Date</label><input type="date" id="f-date" value="${d.date}"></div>
    </div>
    <table>
      <thead><tr><th>S.No</th><th>Date</th><th>Detail</th><th>Amount</th><th class="no-print"></th></tr></thead>
      <tbody id="entries-tbody">${rows}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td id="voucher-total">${formatCurrency(calcVoucherGrandTotal(d.entries))}</td><td class="no-print"></td></tr></tfoot>
    </table>
    <button class="no-print" id="add-row-btn">+ Add Row</button>
    <div class="actions no-print">
      <button class="primary" id="save-btn">Save</button>
      <button id="pdf-btn">Download PDF</button>
    </div>
  `;
  attachVoucherEditorEvents();
}

function attachVoucherEditorEvents() {
  document.getElementById('back-btn').addEventListener('click', () => { showScreen('list'); renderList(); });

  document.getElementById('f-client').addEventListener('input', e => { currentDoc.clientName = e.target.value; });
  document.getElementById('f-date').addEventListener('input', e => { currentDoc.date = e.target.value; });

  document.querySelectorAll('#entries-tbody input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      currentDoc.entries[idx][field] = field === 'amount' ? Number(e.target.value) || 0 : e.target.value;
      if (field === 'amount') {
        document.getElementById('voucher-total').textContent = formatCurrency(calcVoucherGrandTotal(currentDoc.entries));
      }
    });
  });

  document.getElementById('add-row-btn').addEventListener('click', () => {
    currentDoc.entries.push({ date: currentDoc.date, detail: '', amount: 0 });
    renderVoucherEditor();
  });

  document.querySelectorAll('.remove-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentDoc.entries.splice(Number(e.target.dataset.idx), 1);
      renderVoucherEditor();
    });
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    const msg = document.getElementById('validation-msg');
    if (!currentDoc.clientName.trim() || !currentDoc.date) {
      msg.textContent = 'Client name and date are required.';
      msg.classList.remove('hidden');
      return;
    }
    msg.classList.add('hidden');
    currentDoc.entries = currentDoc.entries.filter(e => e.detail.trim() || e.amount);
    if (saveDocument(currentDoc)) { showScreen('list'); renderList(); }
  });

  document.getElementById('pdf-btn').addEventListener('click', () => window.print());
}
```

**Step 2: Manually verify**

Open `adorners-billing.html`, click "+ New Payment Voucher". Expected: empty editor with
today's date pre-filled. Click "+ Add Row" three times, type a detail and amount into each
(e.g. 300000, 200000, 50000) — the Total in the table footer should update live to
`Rs.550,000/-` as you type each amount. Click "Remove" on one row — it should disappear and
renumber. Try clicking "Save" with the Client Name field blank — expect the red validation
message and no navigation. Fill in a client name, click Save — expect it returns to the list
screen and shows the new voucher with the correct total.

**Step 3: Commit**

```bash
git add adorners-billing.html
git commit -m "feat: payment voucher editor with live totals and validation"
```

---

### Task 5: Quotation editor

**Files:**
- Modify: `adorners-billing.html` (insert above `/* ===== RENDER: LIST ===== */`, after the voucher editor block)

**Step 1: Insert the quotation editor**

```js
/* ===== RENDER: QUOTATION EDITOR ===== */
function openNewQuotation() {
  currentDoc = { id: generateId(), type: 'quotation', clientName: '', date: todayIso(), categories: [] };
  showScreen('quotation');
  renderQuotationEditor();
}

function renderQuotationEditor() {
  const d = currentDoc;

  const categoriesHtml = d.categories.map((cat, ci) => {
    const itemRows = cat.items.map((item, ii) => `
      <tr>
        <td><input type="text" data-ci="${ci}" data-ii="${ii}" data-field="description" value="${escapeHtml(item.description)}"></td>
        <td><input type="number" data-ci="${ci}" data-ii="${ii}" data-field="qty" value="${item.qty}" style="width:70px;"></td>
        <td><input type="text" data-ci="${ci}" data-ii="${ii}" data-field="unit" value="${escapeHtml(item.unit || '')}" style="width:60px;"></td>
        <td><input type="number" data-ci="${ci}" data-ii="${ii}" data-field="rate" value="${item.rate}" style="width:100px;"></td>
        <td>${formatCurrency(calcLineAmount(item.qty, item.rate))}</td>
        <td class="no-print"><button class="remove-item" data-ci="${ci}" data-ii="${ii}">Remove</button></td>
      </tr>`).join('');

    return `
      <div style="margin-bottom:20px;border:1px solid var(--border);border-radius:4px;padding:12px;">
        <div class="field-row" style="align-items:flex-end;">
          <div style="flex:2;">
            <label>Category</label>
            <input type="text" data-ci="${ci}" data-field="name" value="${escapeHtml(cat.name)}" placeholder="e.g. Electrician">
          </div>
          <button class="no-print remove-category" data-ci="${ci}">Remove Category</button>
        </div>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th class="no-print"></th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr><td colspan="4">Subtotal</td><td>${formatCurrency(calcCategorySubtotal(cat.items))}</td><td class="no-print"></td></tr></tfoot>
        </table>
        <button class="no-print add-item-btn" data-ci="${ci}">+ Add Item</button>
      </div>`;
  }).join('');

  document.getElementById('screen-quotation').innerHTML = `
    <div class="no-print"><button id="back-btn">&larr; Back</button></div>
    <h2>Quotation</h2>
    <div id="validation-msg" class="error hidden"></div>
    <div class="field-row">
      <div><label>Client Name</label><input type="text" id="f-client" value="${escapeHtml(d.clientName)}"></div>
      <div><label>Date</label><input type="date" id="f-date" value="${d.date}"></div>
    </div>
    <div id="categories-container">${categoriesHtml}</div>
    <button class="no-print" id="add-category-btn">+ Add Category</button>
    <h3 class="no-print">Grand Total: <span id="quotation-total">${formatCurrency(calcQuotationGrandTotal(d.categories))}</span></h3>
    <div class="actions no-print">
      <button class="primary" id="save-btn">Save</button>
      <button id="pdf-btn">Download PDF</button>
    </div>
  `;
  attachQuotationEditorEvents();
}

function attachQuotationEditorEvents() {
  document.getElementById('back-btn').addEventListener('click', () => { showScreen('list'); renderList(); });
  document.getElementById('f-client').addEventListener('input', e => { currentDoc.clientName = e.target.value; });
  document.getElementById('f-date').addEventListener('input', e => { currentDoc.date = e.target.value; });

  document.querySelectorAll('[data-field="name"]').forEach(input => {
    input.addEventListener('input', e => {
      currentDoc.categories[Number(e.target.dataset.ci)].name = e.target.value;
    });
  });

  document.querySelectorAll('#categories-container input[data-ii]').forEach(input => {
    input.addEventListener('input', e => {
      const ci = Number(e.target.dataset.ci);
      const ii = Number(e.target.dataset.ii);
      const field = e.target.dataset.field;
      const item = currentDoc.categories[ci].items[ii];
      item[field] = (field === 'qty' || field === 'rate') ? Number(e.target.value) || 0 : e.target.value;
      if (field === 'qty' || field === 'rate') {
        document.getElementById('quotation-total').textContent = formatCurrency(calcQuotationGrandTotal(currentDoc.categories));
      }
    });
  });

  document.getElementById('add-category-btn').addEventListener('click', () => {
    currentDoc.categories.push({ name: '', items: [] });
    renderQuotationEditor();
  });

  document.querySelectorAll('.remove-category').forEach(btn => {
    btn.addEventListener('click', e => {
      currentDoc.categories.splice(Number(e.target.dataset.ci), 1);
      renderQuotationEditor();
    });
  });

  document.querySelectorAll('.add-item-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      currentDoc.categories[Number(e.target.dataset.ci)].items.push({ description: '', qty: 1, unit: '', rate: 0 });
      renderQuotationEditor();
    });
  });

  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.addEventListener('click', e => {
      currentDoc.categories[Number(e.target.dataset.ci)].items.splice(Number(e.target.dataset.ii), 1);
      renderQuotationEditor();
    });
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    const msg = document.getElementById('validation-msg');
    if (!currentDoc.clientName.trim() || !currentDoc.date) {
      msg.textContent = 'Client name and date are required.';
      msg.classList.remove('hidden');
      return;
    }
    msg.classList.add('hidden');
    currentDoc.categories = currentDoc.categories
      .map(cat => ({ ...cat, items: cat.items.filter(i => i.description.trim() || i.qty || i.rate) }))
      .filter(cat => cat.name.trim() && cat.items.length > 0);
    if (saveDocument(currentDoc)) { showScreen('list'); renderList(); }
  });

  document.getElementById('pdf-btn').addEventListener('click', () => window.print());
}
```

**Step 2: Manually verify**

Open `adorners-billing.html`, click "+ New Quotation". Click "+ Add Category", type
"Electrician" as the category name. Click "+ Add Item" under it, fill Qty 30 / Rate 7200 —
the row Amount should show `Rs.216,000/-` and the Grand Total at the bottom should update
live to match. Add a second category "Plumbing" with one item (Qty 1, Rate 28000) — Grand
Total should become `Rs.244,000/-`. Remove the Electrician category entirely — Grand Total
should drop back to `Rs.28,000/-`. Save with a client name filled in — expect it returns to
the list and shows the correct total there too.

**Step 3: Commit**

```bash
git add adorners-billing.html
git commit -m "feat: quotation editor with categories, subtotals, and grand total"
```

---

### Task 6: Print output verification and manual QA pass

**Files:**
- No code changes expected — this task verifies the `@media print` rules already in place
  from Task 2 (`.no-print` hiding, `@page` top margin) actually produce a usable printed
  page, and runs the full manual test pass called for in the spec.

**Step 1: Print-preview the Payment Voucher**

Open a saved voucher, use the browser's Print Preview (Ctrl+P). Expected: no buttons,
back link, "+ Add Row" controls, or Remove buttons are visible; only the client/date fields,
the table, and the total row appear; roughly a 2 inch blank margin sits above the content on
every page (matching where the physical letterhead artwork sits). If the margin doesn't look
right against an actual sheet of the Adorners letterhead, adjust the `2in` value in the
`@page` rule in `adorners-billing.html` and re-check.

**Step 2: Print-preview the Quotation**

Same check for a saved quotation: category boxes, item tables, subtotals, and grand total
should all appear; "+ Add Item"/"+ Add Category"/"Remove" controls should not.

**Step 3: Full manual QA pass**

Walk through the spec's Testing section end-to-end:
- Create, edit, and reopen a Payment Voucher; confirm totals recompute correctly after edits.
- Create a Quotation with multiple categories and items; confirm subtotals and grand total
  are correct, including after adding/removing items.
- Close the browser tab and reopen `adorners-billing.html`; confirm both documents are still
  listed (persistence via `localStorage` survives a browser restart on the same machine).
- Try saving a voucher/quotation with an empty client name; confirm the validation message
  blocks the save.
- Type a non-numeric value into an Amount/Qty/Rate field; confirm it's rejected or coerced
  to `0` rather than silently producing `NaN` in a total (the `Number(x) || 0` pattern used
  throughout should already guarantee this — verify it holds).

**Step 4: Commit**

If Step 1 required adjusting the `@page` margin:

```bash
git add adorners-billing.html
git commit -m "fix: adjust print top margin to match letterhead paper"
```

If no changes were needed, no commit is required for this task.

---

### Task 7: Merge to main

**Step 1: Review the full diff**

```bash
git log --oneline main..feature/billing-tool
git diff main...feature/billing-tool --stat
```

**Step 2: Merge**

```bash
git checkout main
git merge feature/billing-tool
```

(Per global instructions, do not push — this stays local unless the user asks otherwise.)
