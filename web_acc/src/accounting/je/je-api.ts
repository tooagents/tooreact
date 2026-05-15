import { apiFetch } from 'src/core/apihttp';

export type AccountRow = {
    id: string;
    [key: string]: unknown;
};

export type TxRow = {
    id: string;
    txn_date?: string | null;
    description?: string | null;
    amount?: number | string | null;
    status?: string | null;
    [key: string]: unknown;
};

export type JournalEntryLine = {
    id?: string;
    line_type?: string | null;
    amount?: number | string | null;
    account_id?: string | null;
    account_code?: string | null;
    account_name?: string | null;
    account_label?: string | null;
    description?: string | null;
    [key: string]: unknown;
};

export type JournalEntryRow = {
    id: string;
    transaction_id?: string | null;
    entry_no?: number | string | null;
    entry_date?: string | null;
    memo?: string | null;
    confidence?: number | string | null;
    rationale?: string | null;
    source?: string | null;
    period_yyyymm?: number | string | null;
    posted_at?: string | null;
    is_reversal?: boolean | null;
    lines?: JournalEntryLine[];
    entry_status?: string | null;
    status?: string | null;
    [key: string]: unknown;
};

export type LedgerRow = {
    id?: string;
    journal_entry_id?: string | null;
    journal_id?: string | null;
    entry_id?: string | null;
    je_id?: string | null;
    jeId?: string | null;
    journalEntryId?: string | null;
    account_id?: string | null;
    entry_date?: string | null;
    code?: string | null;
    name?: string | null;
    line_type?: string | null;
    amount?: number | string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    running_balance?: number | string | null;
    memo?: string | null;
    description?: string | null;
    [key: string]: unknown;
};

type ApplyCoaResponse = {
    created: number;
    existing: number;
};

export type JournalEntryUpdatePayload = {
    entry_date?: string | null;
    memo?: string | null;
    lines: {
        id?: string | null;
        account_id: string;
        line_type: 'debit' | 'credit';
        amount: number | string;
        description?: string | null;
    }[];
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

export const jeAPI = {
    async listAccounts(): Promise<AccountRow[]> {
        const response = await apiFetch('/acc/accounts');
        return parseApiResponse<AccountRow[]>(response, 'Failed to fetch accounts');
    },

    async applyGenericCoa(): Promise<ApplyCoaResponse> {
        const response = await apiFetch('/acc/coa/templates/generic/apply', { method: 'POST' });
        return parseApiResponse<ApplyCoaResponse>(response, 'Failed to apply COA');
    },

    async listTransactions(): Promise<TxRow[]> {
        const response = await apiFetch('/acc/transactions?limit=200');
        return parseApiResponse<TxRow[]>(response, 'Failed to fetch transactions');
    },

    async listEntries(): Promise<JournalEntryRow[]> {
        const response = await apiFetch('/acc/je/getlist?limit=200');
        return parseApiResponse<JournalEntryRow[]>(response, 'Failed to fetch journal entries');
    },

    async listLedger(): Promise<LedgerRow[]> {
        const response = await apiFetch('/acc/ledger/general');
        const data = await parseApiResponse<{ rows?: LedgerRow[] } | LedgerRow[]>(
            response,
            'Failed to fetch general ledger',
        );
        return Array.isArray(data) ? data : (data.rows ?? []);
    },

    async generateEntry(transactionId: string): Promise<JournalEntryRow> {
        const response = await apiFetch('/acc/je/generate', {
            method: 'POST',
            body: JSON.stringify({ transaction_id: transactionId, force: false }),
        });
        return parseApiResponse<JournalEntryRow>(response, 'Failed to generate journal entry');
    },

    async updateEntry(journalEntryId: string, payload: JournalEntryUpdatePayload): Promise<JournalEntryRow> {
        const response = await apiFetch(`/acc/je/${encodeURIComponent(journalEntryId)}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
        return parseApiResponse<JournalEntryRow>(response, 'Failed to update journal entry');
    },

    async deleteEntry(journalEntryId: string): Promise<void> {
        const response = await apiFetch(`/acc/je/${encodeURIComponent(journalEntryId)}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to delete journal entry: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
    },
};
