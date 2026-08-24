import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Textarea } from 'src/components/ui/textarea';
import { formatDate, formatMoney } from 'src/core/format';
import { FeeOption, INV_STATUS, Invoice as InvoiceType, InvoiceItem, InvoiceUpdate, ItemCatalog, PaymentMethod, TaxOption, deriveInvStatus, oInvAPI } from 'src/accounting/invoice/o_inv-api';
import { clientsAPI } from 'src/settings/clients/clients-api';
import { ClientDB, getClientDisplayName, getClientId } from 'src/types/type_client';

/* ------------------------------------------------------------------ */
/* Payment status visual config                                        */
/* ------------------------------------------------------------------ */

type StatusConfig = { label: string; chip: string };

const STATUS_CONFIG: Record<string, StatusConfig> = {
    [INV_STATUS.Paid]: { label: 'Paid', chip: 'border-[#9fca9f] bg-[#e9f5e9] text-[#1f5a34]' },
    [INV_STATUS.Partial]: { label: 'Partial', chip: 'border-[#e0cfa0] bg-[#faf3df] text-[#8a6d3b]' },
    [INV_STATUS.Unpaid]: { label: 'Unpaid', chip: 'border-[#d3dae3] bg-[#f1f4f8] text-[#64748b]' },
    [INV_STATUS.Overdue]: { label: 'Overdue', chip: 'border-[#e0a0a0] bg-[#fbe9e9] text-[#7a2a2a]' },
    [INV_STATUS.Settled]: { label: 'Settled', chip: 'border-[#a9bfe0] bg-[#eaf0fb] text-[#3b5b8a]' },
};

const statusConfig = (status: string | null | undefined): StatusConfig =>
    STATUS_CONFIG[String(status || '').toLowerCase()] ?? {
        label: status ? String(status) : '—',
        chip: 'border-[#d3dae3] bg-[#f1f4f8] text-[#64748b]',
    };

// Editable fields of the compact edit dialog. Line items and payments are
// handled elsewhere — this dialog only touches the invoice header.
type InvoiceDraft = {
    inv_number: string;
    inv_date: string;
    inv_due_date: string;
    inv_title: string;
    client_company_name: string;
    client_contact_name: string;
    client_email: string;
    inv_payment_status: string;
    inv_payment_term: string;
    inv_currency: string;
    inv_reference: string;
    inv_notes: string;
};

// One line-item row. The item itself is PICKED from the catalog (fills name,
// rate, description); only quantity is typed. Amount is derived (qty * rate).
type ItemDraft = {
    catalog_id: string;
    item_name: string;
    item_description: string;
    item_sku: string;
    item_unit_of_measure: string;
    item_quantity: string;
    item_rate: string;
};

const emptyItemRow = (): ItemDraft => ({
    catalog_id: '',
    item_name: '',
    item_description: '',
    item_sku: '',
    item_unit_of_measure: '',
    item_quantity: '1',
    item_rate: '',
});

const num = (v: string | number | null | undefined): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// Tax rates may arrive as "8.25%" strings; strip and parse.
const normalizeRate = (v: number | string | null | undefined): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
        const p = Number.parseFloat(v.replace('%', '').trim());
        return Number.isFinite(p) ? p : 0;
    }
    return 0;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Editable-field affordance: a subtle grey fill (no border) that darkens on
// hover/focus — the compact "this is editable" cue used by Stripe/QuickBooks/Xero.
// Preferred over an underline rule, which reads too sparse in tight rows.
const FIELD =
    'rounded-md border-0 bg-muted/60 shadow-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring';
// Same fill for native <select> (needs its own focus/disabled resets).
const SELECT_FIELD =
    'rounded-md border-0 bg-muted/60 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const rowAmount = (row: ItemDraft): number => num(row.item_quantity) * num(row.item_rate);

// datetime string -> value for <input type="date"> (YYYY-MM-DD).
const toDateInput = (value: string | null): string => (value ? String(value).slice(0, 10) : '');

// Date -> local YYYY-MM-DD. Avoids toISOString(), which serializes in UTC and
// can shift the calendar day in non-UTC-offset timezones.
const toLocalDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Compact "Mon D" (no year) for the tight list columns. Same tz-safe slicing
// as formatDate — the year is dropped to save horizontal space.
const formatDateShort = (value?: string | null): string => {
    if (!value) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// YYYY-MM-DD + N days -> YYYY-MM-DD ('' if the input date is unparseable).
const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return toLocalDateStr(d);
};

// Denormalize a client onto the invoice's client_* columns — the same copy the
// Android app makes when a client is picked (see ainv_app Inv2Client). Only the
// write-side fields; the visible company/contact/email get set on the draft too.
const denormalizeClient = (c: ClientDB): InvoiceUpdate => ({
    client_id: getClientId(c) || null,
    client_company_name: c.client_company_name ?? null,
    client_contact_name: c.client_contact_name ?? null,
    client_contact_title: c.client_contact_title ?? null,
    client_email: c.client_email ?? null,
    client_address: c.client_address ?? null,
    client_mainphone: c.client_mainphone ?? null,
    client_secondphone: c.client_secondphone ?? null,
    client_fax: c.client_fax ?? null,
    client_website: c.client_website ?? null,
    client_business_number: c.client_business_number ?? null,
    client_tax_id: c.client_tax_id ?? null,
    client_payment_method: c.client_payment_method ?? null,
    client_note: c.client_note ?? null,
    client_currency: c.client_currency ?? null,
    inv_tnc: c.client_terms_conditions ?? null,
});

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Invoice' }];
const pageSize = 20;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const Invoice = () => {
    const [invoices, setInvoices] = useState<InvoiceType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    // Row actions (3-dot menu): edit dialog + delete confirm.
    // The compact dialog doubles as the "New invoice" form: editing === null
    // while isCreating is true means a blank create.
    const [editing, setEditing] = useState<InvoiceType | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editDraft, setEditDraft] = useState<InvoiceDraft | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [toDelete, setToDelete] = useState<InvoiceType | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [cloningId, setCloningId] = useState<string | null>(null);
    const [pageIndex, setPageIndex] = useState(0);

    // Master-detail: the selected row (left list) drives the detail pane (right).
    // The list endpoint omits line items, so the full invoice is fetched lazily
    // for whichever row is selected.
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<InvoiceType | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Record-payment dialog for the selected invoice.
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [payFor, setPayFor] = useState<InvoiceType | null>(null);
    const [payDraft, setPayDraft] = useState<{
        pay_amount: string;
        pay_date: string;
        pm_id: string;
        pay_reference: string;
        pay_note: string;
    } | null>(null);
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    // Inline payment-method management (no separate settings screen).
    const [newMethodName, setNewMethodName] = useState('');
    const [savingMethod, setSavingMethod] = useState(false);

    // Clients for the picker. On select we denormalize the client onto the
    // draft (visible fields) and keep the full record for the save payload.
    const [clients, setClients] = useState<ClientDB[]>([]);
    const [pickedClient, setPickedClient] = useState<ClientDB | null>(null);
    const [pickedClientId, setPickedClientId] = useState('');

    // Next invoice number (be_inv_prefix + be_inv_integer), auto-filled on create.
    const [nextNumber, setNextNumber] = useState('');
    // Line items shown in the bottom half of the editor.
    const [items, setItems] = useState<ItemDraft[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    // Picker catalogs (items / taxes / other-charge fees).
    const [catalogItems, setCatalogItems] = useState<ItemCatalog[]>([]);
    const [taxOptions, setTaxOptions] = useState<TaxOption[]>([]);
    const [feeOptions, setFeeOptions] = useState<FeeOption[]>([]);

    // Totals block: discount (percent or flat), a picked tax, a picked fee.
    const [discount, setDiscount] = useState<{ value: string; type: 'percent' | 'flat' }>({ value: '', type: 'flat' });
    const [tax, setTax] = useState<{ label: string; rate: number } | null>(null);
    const [fee, setFee] = useState<{ label: string; amount: number } | null>(null);

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await oInvAPI.listInvoices();
            // Reconcile: inv_payment_status is the source of truth, so recompute
            // the derived (non-`settled`) statuses against today and persist any
            // that drifted — e.g. an unpaid invoice that has now crossed its due
            // date becomes `overdue`. Display reads the stored status directly;
            // this is the only place time enters the status.
            const todayLocal = toLocalDateStr(new Date());
            const drifted: InvoiceType[] = [];
            const reconciled = rows.map((inv) => {
                const derived = deriveInvStatus(inv, todayLocal);
                if (derived === String(inv.inv_payment_status || '').toLowerCase()) return inv;
                const next = { ...inv, inv_payment_status: derived };
                drifted.push(next);
                return next;
            });
            setInvoices(reconciled);
            // Write the drift back so the DB stays the source of truth for other
            // consumers (e.g. the Android app). Best-effort; UI already reflects it.
            if (drifted.length) {
                void Promise.all(
                    drifted.map((inv) =>
                        oInvAPI
                            .saveInvoice({ inv_id: inv.inv_id, inv_payment_status: inv.inv_payment_status })
                            .catch(() => undefined),
                    ),
                );
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load invoices.');
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
        void (async () => {
            try {
                const { clients: rows } = await clientsAPI.listClients();
                setClients(rows);
            } catch {
                setClients([]);
            }
        })();
        void (async () => {
            setNextNumber(await oInvAPI.getNextInvoiceNumber());
        })();
        void (async () => {
            const [its, taxes, fees, methods] = await Promise.all([
                oInvAPI.listItems(),
                oInvAPI.listTaxes(),
                oInvAPI.listFees(),
                oInvAPI.listPaymentMethods(),
            ]);
            setCatalogItems(its);
            setTaxOptions(taxes);
            setFeeOptions(fees);
            setPaymentMethods(methods);
        })();
    }, []);

    /* ---------------- row actions: clone ---------------- */

    const cloneInvoice = async (inv: InvoiceType) => {
        if (cloningId) return;
        setCloningId(inv.inv_id);
        setError(null);
        setMsg(null);
        try {
            await oInvAPI.cloneInvoice(inv.inv_id);
            setMsg('Invoice cloned.');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to clone invoice.');
        } finally {
            setCloningId(null);
        }
    };

    /* ---------------- create: new invoice ---------------- */

    const startCreating = () => {
        setEditing(null);
        setIsCreating(true);
        setPickedClient(null);
        setPickedClientId('');
        // Defaults mirror the Android emptyInvoice(): INVOICE title, 14-day term,
        // USD, Unpaid. Issue date = today, due = today + term.
        const today = toLocalDateStr(new Date());
        setItems([emptyItemRow()]);
        setDiscount({ value: '', type: 'flat' });
        setTax(null);
        setFee(null);
        setEditDraft({
            inv_number: nextNumber,
            inv_date: today,
            inv_due_date: addDaysToDate(today, 14),
            inv_title: 'INVOICE',
            client_company_name: '',
            client_contact_name: '',
            client_email: '',
            inv_payment_status: 'unpaid',
            inv_payment_term: '14',
            inv_currency: 'USD',
            inv_reference: '',
            inv_notes: '',
        });
        setError(null);
        setMsg(null);
    };

    // Picking a client denormalizes it onto the draft (per ainv_app handleSelectClient):
    // copy company/contact/email, adopt its term + currency, and recompute the due date.
    const handlePickClient = (clientId: string) => {
        setPickedClientId(clientId);
        if (!clientId) {
            setPickedClient(null);
            return;
        }
        const c = clients.find((x) => getClientId(x) === clientId);
        if (!c) {
            setPickedClient(null);
            return;
        }
        setPickedClient(c);
        setEditDraft((cur) => {
            if (!cur) return cur;
            const term = c.client_payment_term != null ? String(c.client_payment_term) : cur.inv_payment_term;
            const termNum = Number(term);
            const due = cur.inv_date && Number.isFinite(termNum)
                ? addDaysToDate(cur.inv_date, termNum)
                : cur.inv_due_date;
            return {
                ...cur,
                client_company_name: c.client_company_name ?? '',
                client_contact_name: c.client_contact_name ?? '',
                client_email: c.client_email ?? '',
                inv_payment_term: term,
                inv_currency: c.client_currency ?? cur.inv_currency,
                inv_due_date: due,
            };
        });
    };

    // Issue-date / term changes auto-recompute the due date (issue + term).
    const handleDateChange = (value: string) => {
        setEditDraft((cur) => {
            if (!cur) return cur;
            const termNum = Number(cur.inv_payment_term);
            const due = value && cur.inv_payment_term.trim() && Number.isFinite(termNum)
                ? addDaysToDate(value, termNum)
                : cur.inv_due_date;
            return { ...cur, inv_date: value, inv_due_date: due };
        });
    };

    const handleTermChange = (value: string) => {
        setEditDraft((cur) => {
            if (!cur) return cur;
            const termNum = Number(value);
            const due = cur.inv_date && value.trim() && Number.isFinite(termNum)
                ? addDaysToDate(cur.inv_date, termNum)
                : cur.inv_due_date;
            return { ...cur, inv_payment_term: value, inv_due_date: due };
        });
    };

    /* ---------------- row actions: edit ---------------- */

    const startEditing = (inv: InvoiceType) => {
        setIsCreating(false);
        setEditing(inv);
        setPickedClient(null);
        setPickedClientId(inv.client_id ?? '');
        setEditDraft({
            inv_number: inv.inv_number ?? '',
            inv_date: toDateInput(inv.inv_date),
            inv_due_date: toDateInput(inv.inv_due_date),
            inv_title: inv.inv_title ?? '',
            client_company_name: inv.client_company_name ?? '',
            client_contact_name: inv.client_contact_name ?? '',
            client_email: inv.client_email ?? '',
            inv_payment_status: (inv.inv_payment_status ?? INV_STATUS.Unpaid).toLowerCase(),
            inv_payment_term: inv.inv_payment_term != null ? String(inv.inv_payment_term) : '',
            inv_currency: inv.inv_currency ?? '',
            inv_reference: inv.inv_reference ?? '',
            inv_notes: inv.inv_notes ?? '',
        });
        // Restore the totals block from the stored invoice. Discount is stored as
        // an amount, so it comes back as a flat value.
        setDiscount({ value: inv.inv_discount != null && num(inv.inv_discount) ? String(inv.inv_discount) : '', type: 'flat' });
        setTax(inv.inv_tax_label ? { label: inv.inv_tax_label, rate: normalizeRate(inv.inv_tax_rate) } : null);
        setFee(inv.inv_other_charges_label ? { label: inv.inv_other_charges_label, amount: num(inv.inv_other_charges_amount) } : null);
        // The list endpoint omits line items; pull the full invoice to edit them.
        setItems([]);
        setItemsLoading(true);
        void (async () => {
            try {
                const full = await oInvAPI.getInvoice(inv.inv_id);
                const rows: ItemDraft[] = (full.inv_items ?? []).map((it) => ({
                    catalog_id: '',
                    item_name: it.item_name ?? '',
                    item_description: it.item_description ?? '',
                    item_sku: it.item_sku ?? '',
                    item_unit_of_measure: it.item_unit_of_measure ?? '',
                    item_quantity: it.item_quantity != null ? String(it.item_quantity) : '',
                    item_rate: it.item_rate != null ? String(it.item_rate) : '',
                }));
                setItems(rows.length ? rows : [emptyItemRow()]);
            } catch {
                setItems([emptyItemRow()]);
            } finally {
                setItemsLoading(false);
            }
        })();
        setError(null);
        setMsg(null);
    };

    const closeEditDialog = () => {
        if (isSavingEdit) return;
        setEditing(null);
        setIsCreating(false);
        setEditDraft(null);
        setPickedClient(null);
        setPickedClientId('');
        setItems([]);
        setDiscount({ value: '', type: 'flat' });
        setTax(null);
        setFee(null);
    };

    const updateEditDraft = (field: keyof InvoiceDraft, value: string) => {
        setEditDraft((cur) => (cur ? { ...cur, [field]: value } : cur));
    };

    /* ---------------- line items ---------------- */

    const updateItem = (index: number, field: keyof ItemDraft, value: string) => {
        setItems((cur) => cur.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };
    // Pick a catalog item into a row: copies name/rate/description/sku/uom.
    const pickItemForRow = (index: number, catalogId: string) => {
        const c = catalogItems.find((x) => x.id === catalogId);
        setItems((cur) =>
            cur.map((row, i) => {
                if (i !== index) return row;
                if (!c) return { ...row, catalog_id: '' };
                return {
                    ...row,
                    catalog_id: c.id,
                    item_name: c.item_name ?? '',
                    item_description: c.item_description ?? '',
                    item_sku: c.item_sku ?? '',
                    item_unit_of_measure: c.item_unit_of_measure ?? '',
                    item_rate: c.item_rate != null ? String(c.item_rate) : '',
                    item_quantity: row.item_quantity || '1',
                };
            }),
        );
    };
    const addItem = () => setItems((cur) => [...cur, emptyItemRow()]);
    const removeItem = (index: number) => setItems((cur) => cur.filter((_, i) => i !== index));

    /* ---------------- totals (mirror ainv_app Inv4Total) ---------------- */

    const itemsSubtotal = useMemo(
        () => round2(items.reduce((sum, row) => sum + rowAmount(row), 0)),
        [items],
    );
    const discountAmount = useMemo(() => {
        const v = num(discount.value);
        if (v <= 0) return 0;
        return round2(discount.type === 'percent' ? itemsSubtotal * (v / 100) : v);
    }, [discount, itemsSubtotal]);
    const otherChargesAmount = fee?.amount ?? 0;
    const taxableAmount = itemsSubtotal - discountAmount + otherChargesAmount;
    const taxRate = tax?.rate ?? 0;
    const taxAmount = useMemo(() => round2((taxableAmount * taxRate) / 100), [taxableAmount, taxRate]);
    const invoiceTotal = round2(taxableAmount + taxAmount);

    const saveEdit = async () => {
        if (!editDraft || isSavingEdit) return;
        setIsSavingEdit(true);
        setError(null);
        setMsg(null);
        try {
            const trimmed = (v: string) => (v.trim() ? v.trim() : null);
            const termRaw = editDraft.inv_payment_term.trim();
            const termNum = termRaw ? Number(termRaw) : NaN;
            const inv_payment_term = Number.isFinite(termNum) ? termNum : null;

            // Keep rows that have a picked item; derive amount from qty * rate.
            const inv_items: InvoiceItem[] = items
                .filter((row) => row.item_name.trim() || num(row.item_rate))
                .map((row) => ({
                    item_name: row.item_name.trim() || null,
                    item_description: row.item_description.trim() || null,
                    item_sku: row.item_sku.trim() || null,
                    item_unit_of_measure: row.item_unit_of_measure.trim() || null,
                    item_quantity: num(row.item_quantity),
                    item_rate: num(row.item_rate),
                    item_amount: rowAmount(row),
                }));

            // Visible/editable fields. These win over any denormalized client copy
            // so manual edits after picking a client are respected.
            const base: InvoiceUpdate = {
                ...(editing ? { inv_id: editing.inv_id } : {}),
                inv_number: trimmed(editDraft.inv_number),
                inv_date: editDraft.inv_date || null,
                inv_due_date: editDraft.inv_due_date || null,
                inv_title: trimmed(editDraft.inv_title),
                client_company_name: trimmed(editDraft.client_company_name),
                client_contact_name: trimmed(editDraft.client_contact_name),
                client_email: trimmed(editDraft.client_email),
                // Status is derived from the (recomputed) money + due date, unless
                // the user has manually marked it `settled` — that sticks.
                inv_payment_status:
                    editDraft.inv_payment_status === INV_STATUS.Settled
                        ? INV_STATUS.Settled
                        : deriveInvStatus(
                              {
                                  inv_paid_total: editing?.inv_paid_total ?? 0,
                                  inv_balance_due: invoiceTotal,
                                  inv_due_date: editDraft.inv_due_date || null,
                                  inv_payment_status: null,
                              },
                              todayStr,
                          ),
                inv_payment_term,
                inv_currency: trimmed(editDraft.inv_currency),
                inv_reference: trimmed(editDraft.inv_reference),
                inv_notes: editDraft.inv_notes.trim() ? editDraft.inv_notes.trim() : null,

                // Totals block (computed, mirroring ainv_app Inv4Total).
                inv_subtotal: itemsSubtotal,
                inv_discount: discountAmount,
                inv_tax_label: tax?.label ?? null,
                inv_tax_rate: tax?.rate ?? 0,
                inv_tax_amount: taxAmount,
                inv_other_charges_label: fee?.label ?? null,
                inv_other_charges_amount: otherChargesAmount,
                inv_total: invoiceTotal,
                inv_balance_due: invoiceTotal,

                inv_items,
            };

            // On create: seed the full client_* denormalization (if a client was
            // picked) and a default template, then let the visible fields override.
            // No inv_id -> backend creates and auto-assigns the next number.
            const payload: InvoiceUpdate = editing
                ? base
                : {
                    inv_template_id: 't1',
                    ...(pickedClient ? denormalizeClient(pickedClient) : {}),
                    ...base,
                };
            await oInvAPI.saveInvoice(payload);
            const created = !editing;
            setEditing(null);
            setIsCreating(false);
            setEditDraft(null);
            setMsg(created ? 'Invoice created.' : 'Invoice saved.');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to save invoice.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    /* ---------------- row actions: delete ---------------- */

    const confirmDelete = async () => {
        if (!toDelete || isDeleting) return;
        setIsDeleting(true);
        setError(null);
        setMsg(null);
        try {
            await oInvAPI.deleteInvoice(toDelete.inv_id);
            setToDelete(null);
            setMsg('Invoice deleted.');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete invoice.');
        } finally {
            setIsDeleting(false);
        }
    };

    /* ---------------- record payment ---------------- */

    const startPayment = (inv: InvoiceType) => {
        const balance = num(inv.inv_balance_due);
        setPayFor(inv);
        setPayDraft({
            pay_amount: balance > 0 ? String(round2(balance)) : '',
            pay_date: toLocalDateStr(new Date()),
            pm_id: '',
            pay_reference: '',
            pay_note: '',
        });
        setError(null);
        setMsg(null);
    };

    const closePaymentDialog = () => {
        if (isSavingPayment) return;
        setPayFor(null);
        setPayDraft(null);
        setNewMethodName('');
    };

    const savePayment = async () => {
        if (!payFor || !payDraft || isSavingPayment) return;
        const amount = num(payDraft.pay_amount);
        if (amount <= 0) {
            setError('Enter a payment amount greater than zero.');
            return;
        }
        setIsSavingPayment(true);
        setError(null);
        setMsg(null);
        try {
            const method = paymentMethods.find((m) => m.id === payDraft.pm_id);
            await oInvAPI.createPayment({
                inv_id: payFor.inv_id,
                pay_amount: round2(amount),
                pay_date: payDraft.pay_date || null,
                pm_id: payDraft.pm_id || null,
                pm_name: method?.pm_name ?? null,
                pay_reference: payDraft.pay_reference.trim() || null,
                pay_note: payDraft.pay_note.trim() || null,
            });
            setPayFor(null);
            setPayDraft(null);
            setMsg('Payment recorded.');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to record payment.');
        } finally {
            setIsSavingPayment(false);
        }
    };

    const addPaymentMethod = async () => {
        const name = newMethodName.trim();
        if (!name || savingMethod) return;
        setSavingMethod(true);
        setError(null);
        try {
            const created = await oInvAPI.createPaymentMethod(name);
            setNewMethodName('');
            const methods = await oInvAPI.listPaymentMethods();
            setPaymentMethods(methods);
            // Auto-select the newly created method for this payment.
            const match = methods.find((m) => m.id === created.id) ?? created;
            setPayDraft((d) => (d ? { ...d, pm_id: match.id } : d));
        } catch (e: any) {
            setError(e?.message || 'Failed to add payment method.');
        } finally {
            setSavingMethod(false);
        }
    };

    const removePaymentMethod = async (id: string) => {
        if (savingMethod) return;
        setSavingMethod(true);
        setError(null);
        try {
            await oInvAPI.deletePaymentMethod(id);
            const methods = await oInvAPI.listPaymentMethods();
            setPaymentMethods(methods);
            setPayDraft((d) => (d && d.pm_id === id ? { ...d, pm_id: '' } : d));
        } catch (e: any) {
            setError(e?.message || 'Failed to delete payment method.');
        } finally {
            setSavingMethod(false);
        }
    };

    const deletePayment = async (paymentId: string) => {
        setError(null);
        setMsg(null);
        try {
            await oInvAPI.deletePayment(paymentId);
            setMsg('Payment deleted.');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete payment.');
        }
    };

    const activeInvoices = useMemo(
        () => invoices.filter((inv) => !inv.is_deleted),
        [invoices],
    );

    // Today's LOCAL date (YYYY-MM-DD), the single reference for all status
    // derivation on this page — passed into deriveInvStatus so the list badge
    // and the summary boxes always agree.
    const todayStr = toLocalDateStr(new Date());

    const pageCount = Math.max(1, Math.ceil(activeInvoices.length / pageSize));
    const pageData = useMemo(
        () => activeInvoices.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [activeInvoices, pageIndex],
    );
    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    useEffect(() => {
        setPageIndex(0);
    }, [activeInvoices.length]);

    // Keep a valid selection: fall back to the first invoice if the current one
    // disappears (deleted / filtered) or nothing is selected yet.
    useEffect(() => {
        setSelectedId((cur) =>
            cur && activeInvoices.some((inv) => inv.inv_id === cur)
                ? cur
                : activeInvoices[0]?.inv_id ?? null,
        );
    }, [activeInvoices]);

    // Fetch the full invoice (with line items) for the detail pane whenever the
    // selection changes or the list is refreshed after a save.
    useEffect(() => {
        if (!selectedId) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        setDetailLoading(true);
        void (async () => {
            try {
                const full = await oInvAPI.getInvoice(selectedId);
                if (!cancelled) setDetail(full);
            } catch {
                if (!cancelled) setDetail(null);
            } finally {
                if (!cancelled) setDetailLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedId, invoices]);

    const selectedInvoice = useMemo(
        () => activeInvoices.find((inv) => inv.inv_id === selectedId) ?? null,
        [activeInvoices, selectedId],
    );

    // Action-focused summary boxes. They read the reconciled stored status
    // (refresh() keeps inv_payment_status current), so the boxes and list badge
    // agree. "Due soon" is a date sub-window of the open statuses, not a status.
    // Amounts are summed raw across currencies (single-currency assumed).
    const summary = useMemo(() => {
        const monthPrefix = todayStr.slice(0, 7); // YYYY-MM
        const today = new Date(`${todayStr}T00:00:00`);
        const soonCutoff = new Date(today);
        soonCutoff.setDate(soonCutoff.getDate() + 7);
        const soonStr = toLocalDateStr(soonCutoff);
        let overdueAmount = 0;
        let overdueCount = 0;
        let awaiting = 0;
        let dueSoon = 0;
        let dueSoonCount = 0;
        let collectedThisMonth = 0;
        for (const inv of activeInvoices) {
            const balance = Number(inv.inv_balance_due ?? 0);
            const paid = Number(inv.inv_paid_total ?? 0);
            const dueStr = inv.inv_due_date ? String(inv.inv_due_date).slice(0, 10) : '';
            const status = String(inv.inv_payment_status || '').toLowerCase();

            if (status === INV_STATUS.Overdue) {
                overdueAmount += balance;
                overdueCount += 1;
            } else if (status === INV_STATUS.Unpaid || status === INV_STATUS.Partial) {
                // Open, not yet past due.
                awaiting += balance;
                // Due within the next 7 days (inclusive of today).
                if (dueStr !== '' && dueStr >= todayStr && dueStr <= soonStr) {
                    dueSoon += balance;
                    dueSoonCount += 1;
                }
            }
            // Payments recorded this month (uses invoice date as the proxy for
            // when it was collected — no separate payment-date field available).
            const invStr = inv.inv_date ? String(inv.inv_date).slice(0, 10) : '';
            if (paid > 0 && invStr.slice(0, 7) === monthPrefix) collectedThisMonth += paid;
        }
        return { overdueAmount, overdueCount, awaiting, dueSoon, dueSoonCount, collectedThisMonth };
    }, [activeInvoices, todayStr]);

    // Summary boxes styled after the Tickets filter tiles, but in the Invoice
    // page's warm palette: a big money figure over a label, one colored tile per
    // key state (overdue / awaiting / due soon / collected this month).
    const headBoxes = (
        <div className="grid grid-cols-12 gap-4">
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
                <div className="p-[24px] text-center rounded-md border border-[#e0a0a0] bg-[#fbe9e9]">
                    <h3 className="text-[#7a2a2a] text-2xl font-semibold tabular-nums">
                        {formatMoney(summary.overdueAmount)}
                    </h3>
                    <h6 className="text-base text-[#7a2a2a]">
                        Overdue
                        {summary.overdueCount > 0 && (
                            <span className="ml-1 text-sm font-normal opacity-70">· {summary.overdueCount}</span>
                        )}
                    </h6>
                </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
                <div className="p-[24px] text-center rounded-md border border-[#d3dae3] bg-[#f1f4f8]">
                    <h3 className="text-[#3b5b8a] text-2xl font-semibold tabular-nums">
                        {formatMoney(summary.awaiting)}
                    </h3>
                    <h6 className="text-base text-[#3b5b8a]">Awaiting payment</h6>
                </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
                <div className="p-[24px] text-center rounded-md border border-[#e0cfa0] bg-[#faf3df]">
                    <h3 className="text-[#8a6d3b] text-2xl font-semibold tabular-nums">
                        {formatMoney(summary.dueSoon)}
                    </h3>
                    <h6 className="text-base text-[#8a6d3b]">
                        Due soon
                        {summary.dueSoonCount > 0 && (
                            <span className="ml-1 text-sm font-normal opacity-70">· {summary.dueSoonCount}</span>
                        )}
                    </h6>
                </div>
            </div>
            <div className="lg:col-span-3 md:col-span-6 col-span-12">
                <div className="p-[24px] text-center rounded-md border border-[#9fca9f] bg-[#e9f5e9]">
                    <h3 className="text-[#1f5a34] text-2xl font-semibold tabular-nums">
                        {formatMoney(summary.collectedThisMonth)}
                    </h3>
                    <h6 className="text-base text-[#1f5a34]">Collected this month</h6>
                </div>
            </div>
        </div>
    );

    /* ------------------------------------------------------------------ */
    /* Render                                                              */
    /* ------------------------------------------------------------------ */

    return (
        <>
            {/* Edit dialog */}
            <Dialog open={Boolean(editing) || isCreating} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">{isCreating ? 'New invoice' : 'Edit invoice'}</DialogTitle>
                    </DialogHeader>
                    {editDraft ? (
                        <div className="-mr-1 flex max-h-[68vh] flex-col gap-4 overflow-y-auto pr-1 text-xs [&_input]:h-8 [&_input]:text-xs [&_select]:h-8 [&_select]:text-xs [&_textarea]:text-xs">
                            {/* -------- Top: header form -------- */}
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Invoice #</span>
                                    <Input value={editDraft.inv_number} readOnly disabled className="opacity-70" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Date</span>
                                    <Input
                                        type="date"
                                        value={editDraft.inv_date}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        disabled={isSavingEdit}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Due date</span>
                                    <Input
                                        type="date"
                                        value={editDraft.inv_due_date}
                                        onChange={(e) => updateEditDraft('inv_due_date', e.target.value)}
                                        disabled={isSavingEdit}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Term (days)</span>
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        value={editDraft.inv_payment_term}
                                        onChange={(e) => handleTermChange(e.target.value)}
                                        placeholder="14"
                                        disabled={isSavingEdit}
                                    />
                                </label>

                                <label className="col-span-2 flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Client</span>
                                    <select
                                        value={pickedClientId}
                                        onChange={(e) => handlePickClient(e.target.value)}
                                        disabled={isSavingEdit}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="">Select a client…</option>
                                        {clients.map((c) => {
                                            const id = getClientId(c);
                                            return (
                                                <option key={id} value={id}>
                                                    {getClientDisplayName(c) || c.client_contact_name || id}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                                <label className="col-span-2 flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Reference</span>
                                    <Input
                                        value={editDraft.inv_reference}
                                        onChange={(e) => updateEditDraft('inv_reference', e.target.value)}
                                        placeholder="PO number, period…"
                                        disabled={isSavingEdit}
                                    />
                                </label>
                            </div>

                            {/* -------- Bottom: line items (picked from catalog) -------- */}
                            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Line items</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 gap-1 px-2 text-xs"
                                        onClick={addItem}
                                        disabled={isSavingEdit}
                                    >
                                        <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                                        Add line
                                    </Button>
                                </div>

                                <div className="grid grid-cols-[1.5fr_1.5fr_64px_96px_96px_32px] items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    <span>Item</span>
                                    <span>Description</span>
                                    <span className="text-right">Qty</span>
                                    <span className="text-right">Rate</span>
                                    <span className="text-right">Amount</span>
                                    <span />
                                </div>

                                {itemsLoading ? (
                                    <p className="px-1 py-2 text-xs text-muted-foreground">Loading items…</p>
                                ) : items.length === 0 ? (
                                    <p className="px-1 py-2 text-xs text-muted-foreground">No items yet. Add a line above.</p>
                                ) : (
                                    items.map((row, index) => (
                                        <div
                                            key={index}
                                            className="grid grid-cols-[1.5fr_1.5fr_64px_96px_96px_32px] items-center gap-2"
                                        >
                                            <select
                                                value={row.catalog_id}
                                                onChange={(e) => pickItemForRow(index, e.target.value)}
                                                disabled={isSavingEdit}
                                                className={`h-9 w-full px-1 ${SELECT_FIELD}`}
                                            >
                                                <option value="">{row.item_name || 'Select item…'}</option>
                                                {catalogItems.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.item_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <Input
                                                value={row.item_description}
                                                onChange={(e) => updateItem(index, 'item_description', e.target.value)}
                                                placeholder="Description"
                                                className={FIELD}
                                                disabled={isSavingEdit}
                                            />
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                value={row.item_quantity}
                                                onChange={(e) => updateItem(index, 'item_quantity', e.target.value)}
                                                className={`text-right ${FIELD}`}
                                                disabled={isSavingEdit}
                                            />
                                            <div className="flex h-9 items-center justify-end px-1 text-xs tabular-nums text-muted-foreground">
                                                {num(row.item_rate).toFixed(2)}
                                            </div>
                                            <div className="flex h-9 items-center justify-end px-1 text-xs tabular-nums">
                                                {rowAmount(row).toFixed(2)}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-8 text-muted-foreground hover:text-red-600"
                                                onClick={() => removeItem(index)}
                                                disabled={isSavingEdit}
                                            >
                                                <Icon icon="mdi:trash-can-outline" className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* -------- Notes (left) + Totals (right), side by side -------- */}
                            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                                <label className="flex flex-1 flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</span>
                                    <Textarea
                                        value={editDraft.inv_notes}
                                        onChange={(e) => updateEditDraft('inv_notes', e.target.value)}
                                        placeholder="Add a note for this invoice (optional)"
                                        rows={6}
                                        disabled={isSavingEdit}
                                    />
                                </label>

                                {/* pr-10 = trash col (32px) + gap-2 (8px), so amounts align with the item Amount column's right edge */}
                                <div className="flex w-full flex-col gap-2 pr-10 text-xs md:max-w-md">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="tabular-nums">{itemsSubtotal.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <select
                                            value={fee?.label ?? ''}
                                            onChange={(e) => {
                                                const f = feeOptions.find((x) => x.fee_name === e.target.value);
                                                setFee(f ? { label: f.fee_name ?? '', amount: num(f.fee_amount) } : null);
                                            }}
                                            disabled={isSavingEdit}
                                            className={`h-8 max-w-[220px] flex-1 px-1 ${SELECT_FIELD}`}
                                        >
                                            <option value="">Other charges…</option>
                                            {fee && !feeOptions.some((f) => f.fee_name === fee.label) ? (
                                                <option value={fee.label}>{fee.label}</option>
                                            ) : null}
                                            {feeOptions.map((f) => (
                                                <option key={f.id} value={f.fee_name ?? ''}>
                                                    {f.fee_name} ({num(f.fee_amount).toFixed(2)})
                                                </option>
                                            ))}
                                        </select>
                                        <span className="tabular-nums">{otherChargesAmount.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Discount</span>
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                value={discount.value}
                                                onChange={(e) => setDiscount((d) => ({ ...d, value: e.target.value }))}
                                                placeholder="0"
                                                className={`h-8 w-20 text-right ${FIELD}`}
                                                disabled={isSavingEdit}
                                            />
                                            <select
                                                value={discount.type}
                                                onChange={(e) => setDiscount((d) => ({ ...d, type: e.target.value as 'percent' | 'flat' }))}
                                                disabled={isSavingEdit}
                                                className={`h-8 w-16 pl-1 pr-5 ${SELECT_FIELD}`}
                                            >
                                                <option value="flat">{editDraft.inv_currency || '$'}</option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                        <span className="tabular-nums">-{discountAmount.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <select
                                            value={tax?.label ?? ''}
                                            onChange={(e) => {
                                                const t = taxOptions.find((x) => x.tax_name === e.target.value);
                                                setTax(t ? { label: t.tax_name ?? '', rate: normalizeRate(t.tax_rate) } : null);
                                            }}
                                            disabled={isSavingEdit}
                                            className={`h-8 max-w-[220px] flex-1 px-1 ${SELECT_FIELD}`}
                                        >
                                            <option value="">No tax</option>
                                            {tax && !taxOptions.some((t) => t.tax_name === tax.label) ? (
                                                <option value={tax.label}>{tax.label} ({tax.rate}%)</option>
                                            ) : null}
                                            {taxOptions.map((t) => (
                                                <option key={t.id} value={t.tax_name ?? ''}>
                                                    {t.tax_name} ({normalizeRate(t.tax_rate)}%)
                                                </option>
                                            ))}
                                        </select>
                                        <span className="tabular-nums">{taxAmount.toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                                        <span>Total</span>
                                        <span className="tabular-nums">{invoiceTotal.toFixed(2)}</span>
                                    </div>

                                    {/* Settled: sticky manual close for an invoice that still
                                        carries a balance (e.g. writing off the last few dollars).
                                        Only meaningful on an existing invoice with money owed. */}
                                    {editing && (Number(editing.inv_balance_due ?? 0) > 0
                                        || editDraft?.inv_payment_status === INV_STATUS.Settled) ? (
                                        <label className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                                            <span className="flex flex-col">
                                                <span className="font-medium">Mark as settled</span>
                                                <span className="text-[10px] font-normal text-muted-foreground">
                                                    Close despite the remaining balance; stops auto status updates.
                                                </span>
                                            </span>
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 shrink-0"
                                                disabled={isSavingEdit}
                                                checked={editDraft?.inv_payment_status === INV_STATUS.Settled}
                                                onChange={(e) =>
                                                    setEditDraft((cur) =>
                                                        cur
                                                            ? {
                                                                  ...cur,
                                                                  inv_payment_status: e.target.checked
                                                                      ? INV_STATUS.Settled
                                                                      : INV_STATUS.Unpaid,
                                                              }
                                                            : cur,
                                                    )
                                                }
                                            />
                                        </label>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="outline" onClick={closeEditDialog} disabled={isSavingEdit}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={saveEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? (
                                <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                            ) : (
                                <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                            )}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add-payment dialog */}
            <Dialog open={Boolean(payFor)} onOpenChange={(open) => { if (!open) closePaymentDialog(); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Record payment</DialogTitle>
                        <DialogDescription>
                            {payFor
                                ? `${payFor.inv_number || payFor.inv_id.slice(0, 8)} · balance ${formatMoney(payFor.inv_balance_due)}`
                                : ''}
                        </DialogDescription>
                    </DialogHeader>
                    {payDraft ? (
                        <div className="flex flex-col gap-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amount</span>
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={payDraft.pay_amount}
                                        onChange={(e) => setPayDraft((d) => (d ? { ...d, pay_amount: e.target.value } : d))}
                                        disabled={isSavingPayment}
                                        autoFocus
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Date</span>
                                    <Input
                                        type="date"
                                        value={payDraft.pay_date}
                                        onChange={(e) => setPayDraft((d) => (d ? { ...d, pay_date: e.target.value } : d))}
                                        disabled={isSavingPayment}
                                    />
                                </label>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Method</span>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={payDraft.pm_id}
                                        onChange={(e) => setPayDraft((d) => (d ? { ...d, pm_id: e.target.value } : d))}
                                        disabled={isSavingPayment || savingMethod}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="">No method</option>
                                        {paymentMethods.map((m) => (
                                            <option key={m.id} value={m.id}>{m.pm_name || m.id}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#94a3b8] hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
                                        aria-label="Delete selected payment method"
                                        title="Delete selected method"
                                        disabled={!payDraft.pm_id || isSavingPayment || savingMethod}
                                        onClick={() => void removePaymentMethod(payDraft.pm_id)}
                                    >
                                        <Icon icon="mdi:trash-can-outline" height={16} />
                                    </button>
                                </div>
                                {/* Inline add — avoids a separate manage-methods screen */}
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newMethodName}
                                        onChange={(e) => setNewMethodName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void addPaymentMethod();
                                            }
                                        }}
                                        placeholder="Add a new method…"
                                        className="h-8"
                                        disabled={isSavingPayment || savingMethod}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                        onClick={() => void addPaymentMethod()}
                                        disabled={!newMethodName.trim() || isSavingPayment || savingMethod}
                                    >
                                        <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                                        Add
                                    </Button>
                                </div>
                            </div>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Reference</span>
                                <Input
                                    value={payDraft.pay_reference}
                                    onChange={(e) => setPayDraft((d) => (d ? { ...d, pay_reference: e.target.value } : d))}
                                    placeholder="Cheque #, txn id…"
                                    disabled={isSavingPayment}
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Note</span>
                                <Textarea
                                    value={payDraft.pay_note}
                                    onChange={(e) => setPayDraft((d) => (d ? { ...d, pay_note: e.target.value } : d))}
                                    rows={2}
                                    disabled={isSavingPayment}
                                />
                            </label>
                        </div>
                    ) : null}
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="outline" onClick={closePaymentDialog} disabled={isSavingPayment}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={savePayment} disabled={isSavingPayment}>
                            {isSavingPayment ? (
                                <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                            ) : (
                                <Icon icon="mdi:cash-plus" className="h-4 w-4" />
                            )}
                            Record payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog
                open={Boolean(toDelete)}
                onOpenChange={(open) => { if (!open && !isDeleting) setToDelete(null); }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete invoice?</DialogTitle>
                        <DialogDescription>
                            This removes invoice {toDelete?.inv_number || toDelete?.inv_id?.slice(0, 8)}.
                            Confirm to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setToDelete(null)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={confirmDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Confirm delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* <BreadcrumbComp title="Invoice" items={BCrumb} leftContent={null} rightContent={headBoxes} /> */}

            <div className="flex flex-col gap-6">
                {headBoxes}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {/* -------- Left: invoice list (compact, two rows per item) -------- */}
                    <Card className="gap-4 shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                        <CardHeader className="p-4 pb-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative sm:max-w-60 w-full">
                                        <Icon
                                            icon="tabler:search"
                                            height={16}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7d95]"
                                        />
                                        <Input
                                            type="text"
                                            placeholder="Search"
                                            className="h-8 pl-9 text-xs"
                                        />
                                    </div>
                                    {msg ? <span className="text-xs text-[#506080]">{msg}</span> : null}
                                </div>
                                <Button
                                    type="button"
                                    onClick={startCreating}
                                    className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                >
                                    <Icon icon="mdi:plus" className="h-4 w-4" />
                                    New invoice
                                </Button>
                            </div>
                            {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto border-t border-[#d8c6a1]">
                                <Table className="w-full table-fixed">
                                    <THeader>
                                        <TRow className="border-b border-[#d8c6a1]">
                                            <THead className="h-7 pt-0 pl-4 pr-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                                Invoice
                                            </THead>
                                            <THead className="h-7 w-[70px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                                Date
                                            </THead>
                                            <THead className="h-7 w-[82px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                                Due
                                            </THead>
                                            <THead className="h-7 w-[80px] pt-0 px-1 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                                Status
                                            </THead>
                                            <THead className="h-7 w-[84px] pt-0 px-4 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                                Amount
                                            </THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {pageData.map((inv) => {
                                            const sc = statusConfig(inv.inv_payment_status);
                                            const isSelected = inv.inv_id === selectedId;
                                            return (
                                                <TRow
                                                    key={inv.inv_id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-selected={isSelected}
                                                    onClick={() => setSelectedId(inv.inv_id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedId(inv.inv_id);
                                                        }
                                                    }}
                                                    className={[
                                                        'cursor-pointer border-b border-[#d8c6a1]/70 transition-colors last:border-b-0 hover:bg-[#efe4c7]',
                                                        isSelected ? 'bg-[#efe4c7] shadow-[inset_3px_0_0_#1f3a67]' : '',
                                                    ].filter(Boolean).join(' ')}
                                                >
                                                    {/* Invoice # + client — flexible, client takes the space */}
                                                    <TCell className="min-w-0 py-2.5 pl-4 pr-1 align-middle">
                                                        <div className="flex min-w-0 items-baseline gap-2">
                                                            <span className="shrink-0 text-xs font-medium text-[#172033]">
                                                                {inv.inv_number || inv.inv_id.slice(0, 8)}
                                                            </span>
                                                            <span className="truncate text-[11px] text-[#6f7d95]">
                                                                {inv.client_company_name || inv.client_contact_name || '—'}
                                                            </span>
                                                        </div>
                                                    </TCell>
                                                    {/* Date */}
                                                    <TCell className="w-[74px] truncate py-2.5 px-1 text-left align-middle font-mono text-[11px] tabular-nums text-[#6f7d95]">
                                                        {formatDateShort(inv.inv_date) || '—'}
                                                    </TCell>
                                                    {/* Due date — full date incl. year */}
                                                    <TCell className="w-[96px] truncate py-2.5 px-1 text-left align-middle font-mono text-[11px] tabular-nums text-[#6f7d95]">
                                                        {formatDate(inv.inv_due_date ?? undefined) || '—'}
                                                    </TCell>
                                                    {/* Status badge — fixed width, right aligned */}
                                                    <TCell className="w-[80px] py-2.5 px-1 text-right align-middle">
                                                        <Badge className={`whitespace-nowrap px-1.5 py-0 text-[10px] ${sc.chip}`}>
                                                            {sc.label}
                                                        </Badge>
                                                    </TCell>
                                                    {/* Amount — fixed width, right */}
                                                    <TCell className="w-[84px] py-2.5 pl-1 pr-4 text-right align-middle whitespace-nowrap font-mono text-xs tabular-nums text-[#172033]">
                                                        {formatMoney(inv.inv_total)}
                                                    </TCell>
                                                </TRow>
                                            );
                                        })}
                                        {loading ? (
                                            <TRow>
                                                <TCell colSpan={5} className="px-3 py-4 text-sm text-[#596986]">
                                                    Loading…
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                        {!loading && activeInvoices.length === 0 ? (
                                            <TRow>
                                                <TCell colSpan={5} className="px-3 py-4 text-sm text-[#596986]">
                                                    No invoices yet.
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>
                            {activeInvoices.length > pageSize ? (
                                <div className="flex flex-col items-center justify-between gap-3 border-t border-[#d8c6a1] p-4 sm:flex-row">
                                    <div className="flex w-full gap-2 sm:w-auto">
                                        <Button
                                            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                            disabled={!canPrev}
                                            variant="secondary"
                                            className="flex-1 text-xs sm:flex-none sm:text-sm"
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                            disabled={!canNext}
                                            className="flex-1 text-xs sm:flex-none sm:text-sm"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                    <div className="whitespace-nowrap text-xs text-[#506080] xs:text-base">
                                        Page {pageIndex + 1} of {pageCount}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* -------- Right: selected invoice detail -------- */}
                    <Card className="shadow-none border-[#cdd8e8] bg-white">
                        <CardHeader className="p-4 pb-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex flex-col gap-1">
                                    <CardTitle className="text-base text-[#1f2f4a]">Invoice</CardTitle>
                                    <p className="text-xs text-[#64748b]">Review the selected invoice.</p>
                                </div>
                                {selectedInvoice ? (
                                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                            onClick={() => cloneInvoice(selectedInvoice)}
                                            disabled={cloningId === selectedInvoice.inv_id}
                                        >
                                            {cloningId === selectedInvoice.inv_id ? (
                                                <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Icon icon="solar:copy-broken" className="h-4 w-4" />
                                            )}
                                            Clone
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                            onClick={() => startEditing(selectedInvoice)}
                                        >
                                            <Icon icon="solar:pen-new-square-broken" className="h-4 w-4" />
                                            Edit
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            aria-label="Delete invoice"
                                            onClick={() => setToDelete(selectedInvoice)}
                                        >
                                            <Icon icon="solar:trash-bin-minimalistic-outline" className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="min-h-[220px] border-t border-[#dbe4f0] p-0">
                            {selectedInvoice ? (
                                (() => {
                                    // Prefer freshly fetched detail (has line items); fall back to
                                    // the list row for header fields while it loads.
                                    const head = detail ?? selectedInvoice;
                                    const sc = statusConfig(head.inv_payment_status);
                                    const lineItems = detail?.inv_items ?? [];
                                    return (
                                        <div className="flex flex-col">
                                            {/* Payments — on top; doubles as the add-payment entry point.
                                                Kept as its own bordered card, separate from the invoice strip,
                                                but full-bleed so it matches the invoice strip's width. */}
                                            <div className="border-b border-[#dbe4f0] py-4">
                                                <div className="mb-2 flex items-center justify-between px-4">
                                                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">Payments</span>
                                                    <Button
                                                        type="button"
                                                        className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                                        onClick={() => startPayment(head)}
                                                    >
                                                        <Icon icon="mdi:plus" className="h-4 w-4" />
                                                        Add payment
                                                    </Button>
                                                </div>
                                                {(detail?.inv_payments ?? []).length === 0 ? (
                                                    <p className="px-4 text-xs text-[#64748b]">
                                                        {detailLoading ? 'Loading payments…' : 'No payments recorded yet.'}
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5">
                                                        {(detail?.inv_payments ?? []).map((p) => (
                                                            <div
                                                                key={p.id}
                                                                className="flex items-center justify-between gap-2 border-y border-[#e2e8f0] bg-[#f8fafc] px-4 py-2"
                                                            >
                                                                <div className="flex min-w-0 items-baseline gap-2 text-xs">
                                                                    <span className="shrink-0 font-medium text-[#172033]">
                                                                        {formatDate(p.pay_date ?? undefined) || '—'}
                                                                    </span>
                                                                    <span className="truncate text-[#64748b]">
                                                                        {[p.pm_name, p.pay_reference, p.pay_note].filter(Boolean).join(' · ')}
                                                                    </span>
                                                                </div>
                                                                <div className="flex shrink-0 items-center gap-2">
                                                                    <span className="whitespace-nowrap font-mono text-xs tabular-nums text-[#1f5a34]">
                                                                        {formatMoney(p.pay_amount)}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#94a3b8] hover:bg-red-50 hover:text-red-600"
                                                                        aria-label="Delete payment"
                                                                        onClick={() => void deletePayment(p.id)}
                                                                    >
                                                                        <Icon icon="mdi:trash-can-outline" height={15} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Header strip */}
                                            <div className="border-b border-[#dbe4f0] bg-[#f8fafc] p-4">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[#1f3a67]">
                                                                {head.inv_number || head.inv_id.slice(0, 8)}
                                                            </span>
                                                            <Badge className={`whitespace-nowrap ${sc.chip}`}>{sc.label}</Badge>
                                                        </div>
                                                        <div className="mt-2 text-sm font-semibold text-[#172033]">
                                                            {head.client_company_name || head.client_contact_name || 'No client'}
                                                        </div>
                                                        {head.client_email ? (
                                                            <div className="text-xs text-[#64748b]">{head.client_email}</div>
                                                        ) : null}
                                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#64748b]">
                                                            <span>Issued {formatDate(head.inv_date ?? undefined) || '—'}</span>
                                                            <span>Due {formatDate(head.inv_due_date ?? undefined) || '—'}</span>
                                                            {head.inv_reference ? <span>Ref {head.inv_reference}</span> : null}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 lg:min-w-[300px]">
                                                        <div className="rounded-md border border-[#dbe4f0] bg-white px-3 py-2">
                                                            <div className="text-[11px] font-medium uppercase text-[#64748b]">Total</div>
                                                            <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#172033]">
                                                                {formatMoney(head.inv_total)}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-md border border-[#dbe4f0] bg-white px-3 py-2">
                                                            <div className="text-[11px] font-medium uppercase text-[#64748b]">Paid</div>
                                                            <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#1f5a34]">
                                                                {formatMoney(head.inv_paid_total)}
                                                            </div>
                                                        </div>
                                                        <div className="rounded-md border border-[#dbe4f0] bg-white px-3 py-2">
                                                            <div className="text-[11px] font-medium uppercase text-[#64748b]">Balance</div>
                                                            <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#7a2a2a]">
                                                                {formatMoney(head.inv_balance_due)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Line items */}
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <THeader>
                                                        <TRow className="border-b border-[#dbe4f0] bg-white">
                                                            <THead className="min-w-40 px-4 text-xs uppercase text-[#64748b]">Item</THead>
                                                            <THead className="min-w-16 px-3 text-right text-xs uppercase text-[#64748b]">Qty</THead>
                                                            <THead className="min-w-24 px-3 text-right text-xs uppercase text-[#64748b]">Rate</THead>
                                                            <THead className="min-w-24 px-4 text-right text-xs uppercase text-[#64748b]">Amount</THead>
                                                        </TRow>
                                                    </THeader>
                                                    <TBody>
                                                        {detailLoading && lineItems.length === 0 ? (
                                                            <TRow>
                                                                <TCell colSpan={4} className="px-4 py-4 text-sm text-[#64748b]">
                                                                    Loading items…
                                                                </TCell>
                                                            </TRow>
                                                        ) : lineItems.length === 0 ? (
                                                            <TRow>
                                                                <TCell colSpan={4} className="px-4 py-4 text-sm text-[#64748b]">
                                                                    No line items.
                                                                </TCell>
                                                            </TRow>
                                                        ) : (
                                                            lineItems.map((it, index) => {
                                                                const amount = it.item_amount != null
                                                                    ? num(it.item_amount)
                                                                    : num(it.item_quantity) * num(it.item_rate);
                                                                return (
                                                                    <TRow
                                                                        key={index}
                                                                        className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]"
                                                                    >
                                                                        <TCell className="px-4 py-3 align-top">
                                                                            <div className="text-sm font-medium text-[#172033]">
                                                                                {it.item_name || '—'}
                                                                            </div>
                                                                            {it.item_description ? (
                                                                                <div className="text-xs text-[#64748b]">{it.item_description}</div>
                                                                            ) : null}
                                                                        </TCell>
                                                                        <TCell className="px-3 py-3 text-right align-top font-mono text-sm tabular-nums text-[#172033]">
                                                                            {num(it.item_quantity)}
                                                                        </TCell>
                                                                        <TCell className="px-3 py-3 text-right align-top font-mono text-sm tabular-nums text-[#172033]">
                                                                            {formatMoney(it.item_rate)}
                                                                        </TCell>
                                                                        <TCell className="px-4 py-3 text-right align-top font-mono text-sm tabular-nums text-[#172033]">
                                                                            {formatMoney(amount)}
                                                                        </TCell>
                                                                    </TRow>
                                                                );
                                                            })
                                                        )}
                                                    </TBody>
                                                </Table>
                                            </div>

                                            {/* Totals + notes */}
                                            <div className="flex flex-col gap-6 border-t border-[#dbe4f0] p-4 md:flex-row md:items-start md:justify-between">
                                                <div className="flex-1">
                                                    {head.inv_notes ? (
                                                        <>
                                                            <div className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">Notes</div>
                                                            <p className="mt-1 whitespace-pre-wrap text-xs text-[#334155]">{head.inv_notes}</p>
                                                        </>
                                                    ) : null}
                                                </div>
                                                <div className="flex w-full flex-col gap-1.5 text-xs md:max-w-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[#64748b]">Subtotal</span>
                                                        <span className="font-mono tabular-nums text-[#172033]">{formatMoney(head.inv_subtotal)}</span>
                                                    </div>
                                                    {num(head.inv_discount) > 0 ? (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[#64748b]">Discount</span>
                                                            <span className="font-mono tabular-nums text-[#172033]">-{formatMoney(head.inv_discount)}</span>
                                                        </div>
                                                    ) : null}
                                                    {head.inv_other_charges_label || num(head.inv_other_charges_amount) > 0 ? (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[#64748b]">{head.inv_other_charges_label || 'Other charges'}</span>
                                                            <span className="font-mono tabular-nums text-[#172033]">{formatMoney(head.inv_other_charges_amount)}</span>
                                                        </div>
                                                    ) : null}
                                                    {head.inv_tax_label || num(head.inv_tax_amount) > 0 ? (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[#64748b]">
                                                                {head.inv_tax_label || 'Tax'}
                                                                {num(head.inv_tax_rate) ? ` (${num(head.inv_tax_rate)}%)` : ''}
                                                            </span>
                                                            <span className="font-mono tabular-nums text-[#172033]">{formatMoney(head.inv_tax_amount)}</span>
                                                        </div>
                                                    ) : null}
                                                    <div className="flex items-center justify-between border-t border-[#dbe4f0] pt-2 text-sm font-semibold">
                                                        <span>Total</span>
                                                        <span className="font-mono tabular-nums">{formatMoney(head.inv_total)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[#64748b]">Paid</span>
                                                        <span className="font-mono tabular-nums text-[#1f5a34]">{formatMoney(head.inv_paid_total)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm font-semibold">
                                                        <span>Balance due</span>
                                                        <span className="font-mono tabular-nums text-[#7a2a2a]">{formatMoney(head.inv_balance_due)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex min-h-[180px] items-center justify-center text-sm font-medium text-muted-foreground">
                                    Select an invoice.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default Invoice;
