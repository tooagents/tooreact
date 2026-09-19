// Default invoice terms & conditions / late-payment footer.
//
// Effective T&C is resolved as: invoice.inv_tnc -> business.be_inv_tnc ->
// DEFAULT_INV_TNC (see templates/adapter.ts). Kept in sync with the backend
// seed constant (toocore/app/db/seed/seed_catalog.py DEFAULT_INV_TNC).
export const DEFAULT_INV_TNC =
    'Payment is due within 15 days. Overdue invoices are subject to a $25 late fee plus 2% monthly interest on the outstanding balance.';
