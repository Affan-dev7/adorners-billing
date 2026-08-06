# Adorners Billing Tool — Design Spec

## Purpose

Adorners (architecture / interior / civil design-build firm, Bahria Town Karachi) currently
produces two kinds of client documents by hand in Word / a notes app: **Payment Vouchers**
(a running log of payments made against a job) and **Quotations** (itemized cost estimates
grouped by trade/category). Both are manually typed and manually totaled for every client.

This tool removes that manual work: pick a document type, fill in structured fields, and
totals/subtotals calculate automatically. Output is printed on the business's existing
pre-printed letterhead paper, so the generated document itself carries no logo or branding —
just content, laid out to match the paper he already uses.

## Non-goals

- No branding, logo, or color scheme in the generated document (printed on physical letterhead).
- No backend, database, accounts, or hosting. Runs entirely from one local HTML file.
- No invoice document type (explicitly dropped in favor of Payment Voucher + Quotation).

## Architecture

Single self-contained file: `adorners-billing.html`. Plain HTML/CSS/JS, no framework, no
build step, no external dependencies (no CDN scripts). Opened directly in a browser
(double-click the file).

- **Storage:** Browser `localStorage`. Each saved document is a JSON record. No server,
  no sync, no login — data lives in the browser it was created in.
- **PDF output:** Browser-native print-to-PDF (`window.print()` with a dedicated print
  stylesheet), triggered by a "Download PDF" button. Avoids bundling a PDF library and
  keeps the file dependency-free.
- **Print layout:** A generous blank top margin (approx. 2in) is reserved on every printed
  page so the document can be printed directly onto the pre-printed Adorners letterhead
  without overlapping the letterhead artwork. This margin is a CSS constant, easy to
  adjust if it doesn't align with the physical paper.

## Data model

```
Document
  id: string (generated)
  type: "voucher" | "quotation"
  clientName: string
  date: string (date the document is for)
  createdAt / updatedAt: timestamps

  # type === "voucher"
  entries: [
    { date: string, detail: string, amount: number }
  ]
  # grand total = sum(entries.amount), computed, not stored redundantly

  # type === "quotation"
  categories: [
    {
      name: string,          # e.g. "Electrician"
      items: [
        { description: string, qty: number, unit: string, rate: number }
        # amount = qty * rate, computed
      ]
      # subtotal = sum(items.amount), computed
    }
  ]
  # grand total = sum(categories.subtotal), computed
```

Computed values (line amounts, subtotals, grand totals) are never persisted — they are
derived from the stored inputs every time a document is opened or rendered, so edits
always stay consistent.

## Screens

### 1. Document list (home)
- All saved documents, most recently updated first.
- Search/filter by client name.
- Each row: client name, type badge (Voucher/Quotation), date, grand total.
- "+ New Payment Voucher" and "+ New Quotation" buttons.
- Click a row to reopen it in the editor.

### 2. Payment Voucher editor
- Header fields: Client name, Date.
- Repeatable row list: Date, Detail, Amount. S.No is automatic (row position), not
  user-entered.
- Add/remove row controls.
- Live grand total row at the bottom (sum of all entries).
- Matches the existing Word format: dark header row, alternating row shading, in the
  print/PDF output.
- Save (writes to localStorage) and Download PDF actions.

### 3. Quotation editor
- Header fields: Client name, Date.
- Add category (free text, no fixed list — e.g. "Electrician", "Plumbing", "Masonry").
- Within each category, add line items: description, qty, unit (e.g. "M", "sq.ft", "pc"),
  rate. Amount = qty × rate, computed live.
- Each category displays its own subtotal.
- Grand total (sum of all category subtotals) shown at the end.
- Categories and items can be freely added, reordered, and removed.
- Save and Download PDF actions.

### 4. Print / PDF output
- Plain black-on-white, no logo/color branding.
- Top margin reserved for physical letterhead.
- Voucher: table matching current Word layout (S.No / Date / Detail / Amount, header
  row + alternating bands), plus grand total row.
- Quotation: category headings, itemized sub-rows (Description / Qty / Rate / Amount),
  per-category subtotal, grand total at the end.
- "Download PDF" opens the browser print dialog pre-styled for print-to-PDF.

## Error handling / edge cases

- Empty client name or date: block save, inline validation message.
- A category with zero items, or a voucher with zero rows: allowed to exist while
  editing, but excluded from the saved document if left empty (no empty subtotal rows
  in output).
- Non-numeric qty/rate/amount input: rejected at the field level, no silent coercion.
- `localStorage` unavailable or full: show an explicit error, do not fail silently.

## Testing

Manual verification (no build/test framework, single static file):
- Create, edit, and reopen a Payment Voucher; confirm totals recompute correctly after
  edits.
- Create a Quotation with multiple categories and items; confirm subtotals and grand
  total are correct, including after adding/removing items.
- Print-preview both document types; confirm the top margin clears a physical letterhead
  sheet and the table layout matches the existing Word documents.
- Confirm documents persist after closing and reopening the browser (same profile).
