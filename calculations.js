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
