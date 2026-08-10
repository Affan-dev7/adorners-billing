// Pure calculation functions for Adorners billing documents.
// No DOM, no storage access — safe to unit test in isolation.

function calcLineAmount(qty, rate) {
  return qty * rate;
}

function calcCategorySubtotal(items) {
  return items.reduce((sum, item) => sum + calcLineAmount(item.qty, item.rate), 0);
}

function calcCategorizedGrandTotal(categories) {
  return categories.reduce((sum, cat) => sum + calcCategorySubtotal(cat.items), 0);
}

function calcLedgerGrandTotal(entries) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

function calcTotalAmount(itemsTotal, quotationApprovalAmount) {
  return itemsTotal + quotationApprovalAmount;
}

function calcBalance(totalAmount, paymentReceived, adjustments) {
  return adjustments.reduce((balance, adj) => balance - adj.amount, totalAmount - paymentReceived);
}

// Groups flat Daily Expense Tracker entries by date, sorted chronologically,
// each with its own subtotal — the grouping/subtotal is purely a display
// concern, entries themselves stay a flat list for simple data entry.
function groupEntriesByDate(entries) {
  const byDate = {};
  for (const entry of entries) {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }
  return Object.keys(byDate).sort().map(date => ({
    date,
    entries: byDate[date],
    subtotal: calcLedgerGrandTotal(byDate[date]),
  }));
}

// Totals Daily Expense Tracker entries by recipient regardless of date —
// "how much has gone to Labor overall" vs groupEntriesByDate's "what happened
// on this day". Sorted by total descending (biggest recipient first).
function groupByPaidTo(entries) {
  const byPerson = {};
  for (const entry of entries) {
    const key = entry.paidTo.trim() || '(unspecified)';
    byPerson[key] = (byPerson[key] || 0) + entry.amount;
  }
  return Object.entries(byPerson)
    .map(([paidTo, total]) => ({ paidTo, total }))
    .sort((a, b) => b.total - a.total);
}

// Turns flat Daily Expense Tracker entries into Categorized-shape categories
// (for the "Save as Quotation/Billing" conversion) — one category per unique
// recipient, with every payment to them as its own line item inside it,
// instead of a separate category per entry (which would show "Labor" three
// times over for three separate payments to Labor).
function groupEntriesForConversion(entries) {
  const byPerson = {};
  const order = [];
  for (const entry of entries) {
    const key = entry.paidTo.trim() || entry.detail.trim() || '(untitled)';
    if (!byPerson[key]) { byPerson[key] = []; order.push(key); }
    byPerson[key].push(entry);
  }
  return order.map(name => ({
    name,
    items: byPerson[name].map(e => ({ description: e.detail, qty: 1, unit: '', rate: e.amount })),
  }));
}
