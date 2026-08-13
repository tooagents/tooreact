import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'src/components/ui/dropdown-menu';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Textarea } from 'src/components/ui/textarea';
import { formatDate, formatMoney } from 'src/core/format';
import { FeeOption, Invoice as InvoiceType, InvoiceItem, InvoiceUpdate, ItemCatalog, TaxOption, oInvAPI } from 'src/accounting/invoice/o_inv-api';
import { clientsAPI } from 'src/settings/clients/clients-api';
import { ClientDB, getClientDisplayName, getClientId } from 'src/types/type_client';

/* ------------------------------------------------------------------ */
/* Payment status visual config                                        */
/* ------------------------------------------------------------------ */

type StatusConfig = { label: string; chip: string };

const STATUS_CONFIG: Record<string, StatusConfig> = {
    paid: { label: 'Paid', chip: 'border-[#9fca9f] bg-[#e9f5e9] text-[#1f5a34]' },
    partial: { label: 'Partial', chip: 'border-[#e0cfa0] bg-[#faf3df] text-[#8a6d3b]' },
    unpaid: { label: 'Unpaid', chip: 'border-[#d3dae3] bg-[#f1f4f8] text-[#64748b]' },
    overdue: { label: 'Overdue', chip: 'border-[#e0a0a0] bg-[#fbe9e9] text-[#7a2a2a]' },
    draft: { label: 'Draft', chip: 'border-[#cbd0d8] bg-[#eef0f3] text-[#4b5563]' },
    sent: { label: 'Sent', chip: 'border-[#a9bfe0] bg-[#eaf0fb] text-[#3b5b8a]' },
    void: { label: 'Void', chip: 'border-[#cbd0d8] bg-[#eef0f3] text-[#94a3b8]' },
};

const statusConfig = (status: string | null | undefined): StatusConfig =>
    STATUS_CONFIG[String(status || '').toLowerCase()] ?? {
        label: status ? String(status) : '—',
        chip: 'border-[#d3dae3] bg-[#f1f4f8] text-[#64748b]',
    };

// Order shown in the Edit dialog's Status dropdown.
const STATUS_ORDER = ['draft', 'sent', 'unpaid', 'partial', 'paid', 'overdue', 'void'] as const;

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

// Underline ("____") field style: no box, just a bottom rule, to signal editable.
const UNDERLINE =
    'rounded-none border-0 border-b border-input bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-ring';

const rowAmount = (row: ItemDraft): number => num(row.item_quantity) * num(row.item_rate);

// datetime string -> value for <input type="date"> (YYYY-MM-DD).
const toDateInput = (value: string | null): string => (value ? String(value).slice(0, 10) : '');

// YYYY-MM-DD + N days -> YYYY-MM-DD ('' if the input date is unparseable).
const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
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
            setInvoices(rows);
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
            const [its, taxes, fees] = await Promise.all([
                oInvAPI.listItems(),
                oInvAPI.listTaxes(),
                oInvAPI.listFees(),
            ]);
            setCatalogItems(its);
            setTaxOptions(taxes);
            setFeeOptions(fees);
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
        const today = new Date().toISOString().slice(0, 10);
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
            inv_payment_status: (inv.inv_payment_status ?? 'draft').toLowerCase(),
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
                inv_payment_status: editDraft.inv_payment_status,
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

    const activeInvoices = useMemo(
        () => invoices.filter((inv) => !inv.is_deleted),
        [invoices],
    );

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

    const totals = useMemo(
        () =>
            activeInvoices.reduce(
                (sum, inv) => ({
                    total: sum.total + Number(inv.inv_total ?? 0),
                    paid: sum.paid + Number(inv.inv_paid_total ?? 0),
                    balance: sum.balance + Number(inv.inv_balance_due ?? 0),
                }),
                { total: 0, paid: 0, balance: 0 },
            ),
        [activeInvoices],
    );

    const headBoxes = (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">{activeInvoices.length}</CardContent>
            </Card>
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-lg font-semibold tabular-nums">{formatMoney(totals.total)}</CardContent>
            </Card>
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-lg font-semibold tabular-nums">{formatMoney(totals.paid)}</CardContent>
            </Card>
            <Card className="w-[132px] gap-1 rounded-md border-secondary/20 bg-transparent p-3 shadow-none">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Balance due</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-lg font-semibold tabular-nums">{formatMoney(totals.balance)}</CardContent>
            </Card>
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
                        <DialogTitle>{isCreating ? 'New invoice' : 'Edit invoice'}</DialogTitle>
                    </DialogHeader>
                    {editDraft ? (
                        <div className="-mr-1 flex max-h-[68vh] flex-col gap-4 overflow-y-auto pr-1">
                            {/* -------- Top: header form -------- */}
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Invoice #</span>
                                    <Input value={editDraft.inv_number} readOnly disabled className="opacity-70" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Date</span>
                                    <Input
                                        type="date"
                                        value={editDraft.inv_date}
                                        onChange={(e) => handleDateChange(e.target.value)}
                                        disabled={isSavingEdit}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due date</span>
                                    <Input
                                        type="date"
                                        value={editDraft.inv_due_date}
                                        onChange={(e) => updateEditDraft('inv_due_date', e.target.value)}
                                        disabled={isSavingEdit}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Term (days)</span>
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
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Client</span>
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
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reference</span>
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
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Line items</span>
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

                                <div className="grid grid-cols-[1.5fr_1.5fr_64px_96px_96px_32px] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                                                className="h-9 w-full rounded-none border-0 border-b border-input bg-transparent px-1 text-sm text-foreground focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                                className={UNDERLINE}
                                                disabled={isSavingEdit}
                                            />
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                value={row.item_quantity}
                                                onChange={(e) => updateItem(index, 'item_quantity', e.target.value)}
                                                className={`text-right ${UNDERLINE}`}
                                                disabled={isSavingEdit}
                                            />
                                            <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums text-muted-foreground">
                                                {num(row.item_rate).toFixed(2)}
                                            </div>
                                            <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums">
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

                            {/* -------- Totals: subtotal / other charges / discount / tax / total -------- */}
                            <div className="flex justify-end">
                                <div className="flex w-full max-w-md flex-col gap-2 text-sm">
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
                                            className="h-8 max-w-[220px] flex-1 rounded-none border-0 border-b border-input bg-transparent px-1 text-sm text-foreground focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                                className={`h-8 w-20 text-right ${UNDERLINE}`}
                                                disabled={isSavingEdit}
                                            />
                                            <select
                                                value={discount.type}
                                                onChange={(e) => setDiscount((d) => ({ ...d, type: e.target.value as 'percent' | 'flat' }))}
                                                disabled={isSavingEdit}
                                                className="h-8 w-16 rounded-none border-0 border-b border-input bg-transparent pl-1 pr-5 text-sm text-foreground focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                            className="h-8 max-w-[220px] flex-1 rounded-none border-0 border-b border-input bg-transparent px-1 text-sm text-foreground focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
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

                                    <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                                        <span>Total</span>
                                        <span className="tabular-nums">{invoiceTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</span>
                                <Textarea
                                    value={editDraft.inv_notes}
                                    onChange={(e) => updateEditDraft('inv_notes', e.target.value)}
                                    placeholder="Add a note for this invoice (optional)"
                                    rows={2}
                                    disabled={isSavingEdit}
                                />
                            </label>
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

            <BreadcrumbComp title="Invoice" items={BCrumb} leftContent={null} rightContent={headBoxes} />

            <div className="flex flex-col gap-6">
                <Card className="gap-4 shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                    <CardHeader className="p-4 pb-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-base text-[#2b2f38]">Invoices</CardTitle>
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
                        <div className="overflow-x-auto">
                            <Table className="table-fixed">
                                <THeader>
                                    <TRow className="border-b border-[#d8c6a1]">
                                        <THead className="h-7 pt-0 pl-4 pr-1 align-middle text-xs font-normal text-[#1f3a67]">
                                            Invoice #
                                        </THead>
                                        <THead className="h-7 pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                            Client
                                        </THead>
                                        <THead className="h-7 w-[92px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                            Date
                                        </THead>
                                        <THead className="h-7 w-[92px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                            Due date
                                        </THead>
                                        <THead className="h-7 w-[100px] pt-0 px-1 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                            Total
                                        </THead>
                                        <THead className="h-7 w-[100px] pt-0 px-1 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                            Paid
                                        </THead>
                                        <THead className="h-7 w-[104px] pt-0 px-1 text-right align-middle text-xs font-normal text-[#1f3a67]">
                                            Balance due
                                        </THead>
                                        <THead className="h-7 w-[84px] pt-0 px-1 text-left align-middle text-xs font-normal text-[#1f3a67]">
                                            Status
                                        </THead>
                                        <THead className="h-7 w-8 pl-0 pr-1" />
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {pageData.map((inv) => {
                                        const sc = statusConfig(inv.inv_payment_status);
                                        const isCloning = cloningId === inv.inv_id;
                                        return (
                                            <TRow
                                                key={inv.inv_id}
                                                className="border-b border-[#d8c6a1]/70 transition-colors last:border-b-0 hover:bg-[#efe4c7]"
                                            >
                                                <TCell className="min-w-0 py-2.5 pl-4 pr-1 align-middle text-xs font-medium text-[#172033]">
                                                    <span className="block truncate">
                                                        {inv.inv_number || inv.inv_id.slice(0, 8)}
                                                    </span>
                                                </TCell>
                                                <TCell className="min-w-0 py-2.5 px-1 align-middle text-xs text-[#1f2f4a]">
                                                    <span className="block truncate">
                                                        {inv.client_company_name || inv.client_contact_name || '—'}
                                                    </span>
                                                </TCell>
                                                <TCell className="w-[92px] truncate py-2.5 px-1 text-left align-middle font-mono text-[11px] tabular-nums text-[#6f7d95]">
                                                    {formatDate(inv.inv_date ?? undefined) || '—'}
                                                </TCell>
                                                <TCell className="w-[92px] truncate py-2.5 px-1 text-left align-middle font-mono text-[11px] tabular-nums text-[#6f7d95]">
                                                    {formatDate(inv.inv_due_date ?? undefined) || '—'}
                                                </TCell>
                                                <TCell className="w-[100px] whitespace-nowrap py-2.5 px-1 text-right align-middle font-mono text-xs tabular-nums text-[#172033]">
                                                    {formatMoney(inv.inv_total)}
                                                </TCell>
                                                <TCell className="w-[100px] whitespace-nowrap py-2.5 px-1 text-right align-middle font-mono text-xs tabular-nums text-[#1f5a34]">
                                                    {formatMoney(inv.inv_paid_total)}
                                                </TCell>
                                                <TCell className="w-[104px] whitespace-nowrap py-2.5 px-1 text-right align-middle font-mono text-xs tabular-nums text-[#7a2a2a]">
                                                    {formatMoney(inv.inv_balance_due)}
                                                </TCell>
                                                <TCell className="w-[84px] py-2.5 px-1 text-left align-middle">
                                                    <Badge className={`whitespace-nowrap ${sc.chip}`}>
                                                        {sc.label}
                                                    </Badge>
                                                </TCell>
                                                <TCell className="w-8 py-2.5 pl-0 pr-1 text-right align-middle">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#1f3a67] hover:bg-[#efe4c7]"
                                                                aria-label="Invoice actions"
                                                            >
                                                                {isCloning ? (
                                                                    <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Icon icon="mdi:dots-vertical" height={18} />
                                                                )}
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-44">
                                                            <DropdownMenuItem
                                                                className="flex items-center gap-2"
                                                                onClick={() => cloneInvoice(inv)}
                                                            >
                                                                <Icon icon="solar:copy-broken" height={16} />
                                                                <span>Clone</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="flex items-center gap-2"
                                                                onClick={() => startEditing(inv)}
                                                            >
                                                                <Icon icon="solar:pen-new-square-broken" height={16} />
                                                                <span>Edit</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                                                onClick={() => setToDelete(inv)}
                                                            >
                                                                <Icon icon="solar:trash-bin-minimalistic-outline" height={16} />
                                                                <span>Delete</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TCell>
                                            </TRow>
                                        );
                                    })}
                                    {loading ? (
                                        <TRow>
                                            <TCell colSpan={9} className="px-3 py-4 text-sm text-[#596986]">
                                                Loading…
                                            </TCell>
                                        </TRow>
                                    ) : null}
                                    {!loading && activeInvoices.length === 0 ? (
                                        <TRow>
                                            <TCell colSpan={9} className="px-3 py-4 text-sm text-[#596986]">
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
            </div>
        </>
    );
};

export default Invoice;
