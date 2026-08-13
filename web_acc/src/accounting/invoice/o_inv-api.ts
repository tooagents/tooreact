import { apiFetch } from 'src/core/apihttp';

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
