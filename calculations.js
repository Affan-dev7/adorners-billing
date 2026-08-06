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
