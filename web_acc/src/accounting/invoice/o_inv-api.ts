import { apiFetch } from 'src/core/apihttp';

/* ------------------------------------------------------------------ */
/* Payment status enum + derivation                                    */
/* ------------------------------------------------------------------ */

// Canonical invoice payment statuses. All are auto-derived from
// paid_total / balance_due / due_date EXCEPT `settled`, which is a sticky
// manual state: the user closed an invoice that still carries a balance
// (e.g. writing off the last $1 of a $100 invoice). Derivation must never
// override `settled`.
export const INV_STATUS = {
    Unpaid: 'unpaid',
    Partial: 'partial',
    Paid: 'paid',
    Overdue: 'overdue',
    Settled: 'settled',
} as const;

export type InvStatus = (typeof INV_STATUS)[keyof typeof INV_STATUS];

// Statuses a user may set by hand. Derivation leaves these untouched.
export const INV_MANUAL_STATUSES: readonly InvStatus[] = [INV_STATUS.Settled];

const isManualStatus = (status: string | null | undefined): boolean =>
    INV_MANUAL_STATUSES.includes(String(status || '').toLowerCase() as InvStatus);

// Derive the payment status from money + dates.
// `todayStr` is the caller's LOCAL date as YYYY-MM-DD — passed in (rather than
// read here) so this stays pure and timezone-correct at the call site.
// Precedence: settled (sticky) > paid > overdue > partial > unpaid.
// Note: `overdue` wins over `partial` — a partly-paid, past-due invoice reads
// as overdue so it still surfaces as "needs chasing".
export function deriveInvStatus(
    inv: Pick<Invoice, 'inv_paid_total' | 'inv_balance_due' | 'inv_due_date' | 'inv_payment_status'>,
    todayStr: string,
): InvStatus {
    if (isManualStatus(inv.inv_payment_status)) {
        return String(inv.inv_payment_status).toLowerCase() as InvStatus;
    }
    const balance = Number(inv.inv_balance_due ?? 0);
    const paid = Number(inv.inv_paid_total ?? 0);
    if (balance <= 0) return INV_STATUS.Paid;

    const dueStr = inv.inv_due_date ? String(inv.inv_due_date).slice(0, 10) : '';
    if (dueStr !== '' && dueStr < todayStr) return INV_STATUS.Overdue;

    return paid > 0 ? INV_STATUS.Partial : INV_STATUS.Unpaid;
}

// A single invoice line item (subset the editor reads/writes).
export type InvoiceItem = {
    item_id?: string | null;
    item_number?: string | null;
    item_name?: string | null;
    item_description?: string | null;
    item_sku?: string | null;
    item_unit_of_measure?: string | null;
    item_quantity?: number | string | null;
    item_rate?: number | string | null;
    item_amount?: number | string | null;
};

// A catalog item, tax, and fee — picked in the editor (get_item_list etc).
export type ItemCatalog = {
    id: string;
    item_number: string | null;
    item_name: string | null;
    item_rate: number | string | null;
    item_unit_of_measure: string | null;
    item_unit: string | null;
    item_sku: string | null;
    item_description: string | null;
    item_quantity: number | string | null;
    item_note: string | null;
    item_amount: number | string | null;
};

export type TaxOption = {
    id: string;
    tax_name: string | null;
    tax_rate: number | string | null;
    tax_type: string | null;
    tax_note: string | null;
};

export type FeeOption = {
    id: string;
    fee_name: string | null;
    fee_amount: number | string | null;
    fee_note: string | null;
};

// A payment method (settings/get_pm_list), picked when recording a payment.
export type PaymentMethod = {
    id: string;
    pm_name: string | null;
    pm_note: string | null;
};

// A recorded payment against an invoice (InvPaymentOut).
export type InvoicePayment = {
    id: string;
    inv_id: string;
    pm_id: string | null;
    pm_name: string | null;
    pm_note: string | null;
    pay_date: string | null;
    pay_amount: number | string | null;
    pay_reference: string | null;
    pay_note: string | null;
    status: string | null;
    created_at: string | null;
};

// Fields the "Add payment" form sends (InvPaymentCreate).
export type InvoicePaymentCreate = {
    inv_id: string;
    pay_amount: number;
    pay_date?: string | null;
    pm_id?: string | null;
    pm_name?: string | null;
    pay_reference?: string | null;
    pay_note?: string | null;
};

// Shape returned by /inv/get_inv_list and /inv/get_inv_one (InvOut).
// Only the fields the list + compact editor use are typed; the rest ride along.
export type Invoice = {
    inv_id: string;
    inv_number: string | null;
    inv_date: string | null;
    inv_due_date: string | null;
    inv_title: string | null;

    client_id: string | null;
    client_company_name: string | null;
    client_contact_name: string | null;
    client_email: string | null;

    inv_currency: string | null;
    inv_payment_term: number | null;
    inv_reference: string | null;
    inv_total: number | string | null;
    inv_paid_total: number | string | null;
    inv_balance_due: number | string | null;
    inv_payment_status: string | null;

    inv_template_id: string | null;
    inv_notes: string | null;
    inv_tnc: string | null;
    inv_subtotal: number | string | null;
    inv_discount: number | string | null;
    inv_tax_label: string | null;
    inv_tax_rate: number | string | null;
    inv_tax_amount: number | string | null;
    inv_other_charges_label: string | null;
    inv_other_charges_amount: number | string | null;
    inv_items?: InvoiceItem[];
    inv_payments?: InvoicePayment[];

    status: string | null;
    is_active: number;
    is_locked: number;
    is_deleted: number;
    created_at: string | null;
    updated_at: string | null;
};

// Fields the compact dialog can send. post_inv_one is create-or-update:
// passing inv_id updates in place, and unset fields are left untouched.
// On create we also denormalize the picked client onto the invoice (the same
// client_* columns the Android app copies), plus currency/term/reference.
export type InvoiceUpdate = {
    inv_id?: string | null;
    inv_number?: string | null;
    inv_date?: string | null;
    inv_due_date?: string | null;
    inv_title?: string | null;
    inv_template_id?: string | null;

    client_id?: string | null;
    client_company_name?: string | null;
    client_contact_name?: string | null;
    client_contact_title?: string | null;
    client_email?: string | null;
    client_address?: string | null;
    client_mainphone?: string | null;
    client_secondphone?: string | null;
    client_fax?: string | null;
    client_website?: string | null;
    client_business_number?: string | null;
    client_tax_id?: string | null;
    client_payment_method?: string | null;
    client_note?: string | null;
    client_currency?: string | null;

    inv_currency?: string | null;
    inv_payment_term?: number | null;
    inv_reference?: string | null;
    inv_payment_status?: string | null;
    inv_notes?: string | null;
    inv_tnc?: string | null;

    // Totals block (computed client-side, mirroring the Android app).
    inv_subtotal?: number | null;
    inv_discount?: number | null;
    inv_tax_label?: string | null;
    inv_tax_rate?: number | null;
    inv_tax_amount?: number | null;
    inv_other_charges_label?: string | null;
    inv_other_charges_amount?: number | null;
    inv_total?: number | null;
    inv_balance_due?: number | null;

    inv_items?: InvoiceItem[];
};

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(
            `${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
        );
    }
    return response.json();
}

export const oInvAPI = {
    async listInvoices(): Promise<Invoice[]> {
        const response = await apiFetch('/inv/get_inv_list');
        return parseApiResponse<Invoice[]>(response, 'Failed to fetch invoices');
    },

    async getInvoice(invId: string): Promise<Invoice> {
        const response = await apiFetch(`/inv/get_inv_one?inv_id=${encodeURIComponent(invId)}`);
        return parseApiResponse<Invoice>(response, 'Failed to fetch invoice');
    },

    // Picker catalogs. Return [] on failure so the editor still opens.
    async listItems(): Promise<ItemCatalog[]> {
        try {
            const response = await apiFetch('/inv/settings/get_item_list');
            if (!response.ok) return [];
            return (await response.json()) as ItemCatalog[];
        } catch {
            return [];
        }
    },

    async listTaxes(): Promise<TaxOption[]> {
        try {
            const response = await apiFetch('/inv/settings/get_tax_list');
            if (!response.ok) return [];
            return (await response.json()) as TaxOption[];
        } catch {
            return [];
        }
    },

    async listFees(): Promise<FeeOption[]> {
        try {
            const response = await apiFetch('/inv/settings/get_fee_list');
            if (!response.ok) return [];
            return (await response.json()) as FeeOption[];
        } catch {
            return [];
        }
    },

    async listPaymentMethods(): Promise<PaymentMethod[]> {
        try {
            const response = await apiFetch('/inv/settings/get_pm_list');
            if (!response.ok) return [];
            return (await response.json()) as PaymentMethod[];
        } catch {
            return [];
        }
    },

    async createPaymentMethod(pm_name: string, pm_note?: string | null): Promise<PaymentMethod> {
        const response = await apiFetch('/inv/settings/post_pm', {
            method: 'POST',
            body: JSON.stringify({ pm_name, pm_note: pm_note ?? null }),
        });
        return parseApiResponse<PaymentMethod>(response, 'Failed to create payment method');
    },

    async deletePaymentMethod(pmId: string): Promise<void> {
        const response = await apiFetch(
            `/inv/settings/delete_pm?pm_id=${encodeURIComponent(pmId)}`,
            { method: 'DELETE' },
        );
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to delete payment method: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
    },

    // Record a payment. The backend recalculates paid_total / balance_due /
    // payment_status, so the invoice list should be refreshed after this.
    async createPayment(payload: InvoicePaymentCreate): Promise<InvoicePayment> {
        const response = await apiFetch('/inv/create_inv_payment', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return parseApiResponse<InvoicePayment>(response, 'Failed to record payment');
    },

    async deletePayment(paymentId: string): Promise<void> {
        const response = await apiFetch(
            `/inv/delete_inv_payment?payment_id=${encodeURIComponent(paymentId)}`,
            { method: 'DELETE' },
        );
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to delete payment: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
    },

    // Next invoice number from the business entity (be_inv_prefix + be_inv_integer),
    // the same source the Android form auto-fills from. '' if it can't be read.
    async getNextInvoiceNumber(): Promise<string> {
        try {
            const response = await apiFetch('/too/getbe');
            if (!response.ok) return '';
            const be = await response.json();
            const prefix = be?.be_inv_prefix ?? 'INV-';
            const n = be?.be_inv_integer ?? be?.be_inv_integer_max ?? 1;
            return `${prefix}${n}`;
        } catch {
            return '';
        }
    },

    // Create-or-update. Passing inv_id updates in place.
    async saveInvoice(payload: InvoiceUpdate): Promise<Invoice> {
        const response = await apiFetch('/inv/post_inv_one', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return parseApiResponse<Invoice>(response, 'Failed to save invoice');
    },

    async cloneInvoice(invId: string): Promise<Invoice> {
        const response = await apiFetch(
            `/inv/duplicate_inv_one?inv_id=${encodeURIComponent(invId)}`,
            { method: 'POST' },
        );
        return parseApiResponse<Invoice>(response, 'Failed to clone invoice');
    },

    async deleteInvoice(invId: string): Promise<void> {
        const response = await apiFetch(
            `/inv/delete_inv_one?inv_id=${encodeURIComponent(invId)}`,
            { method: 'POST' },
        );
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to delete invoice: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
    },
};
