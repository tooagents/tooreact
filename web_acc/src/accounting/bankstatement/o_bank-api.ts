import { apiFetch } from 'src/core/apihttp';

// AI classification for a bank row.
export type BankTxnType = 'opening_balance' | 'invoice' | 'expense' | 'transfer' | 'other';

export type BankTxn = {
    id: string;
    txn_date: string | null;
    description: string | null;
    debit: number | string | null;   // money out
    credit: number | string | null;  // money in
    balance: number | string | null;
    source: string | null;
    status: string | null;
    bank_name: string | null;  // short formal abbreviation, e.g. "TD"
    type: BankTxnType | string | null;
    note: string | null;
    is_reconciled: boolean;    // binary flag: true only when fully applied
    // Derived on read by the backend:
    applied_total: number | string;   // sum of linked invoice payments
    unapplied: number | string;       // credit - applied_total (>= 0)
    paid_inv_ids: string[];           // invoices this deposit paid
    created_at: string | null;
};

export type BankTxnCreate = {
    id?: string | null;
    txn_date?: string | null;
    description?: string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    balance?: number | string | null;
    source?: string | null;
    bank_name?: string | null;
    type?: BankTxnType | string | null;
    note?: string | null;
};

export type ReconcileCandidate = {
    inv_id: string;
    inv_number: string | null;
    inv_date: string | null;
    client_company_name: string | null;
    inv_total: number | string | null;
    inv_balance_due: number | string | null;
};

export type ReconcileView = {
    bank_txn: BankTxn;
    candidates: ReconcileCandidate[];
};

// One AI-suggested invoice match for a deposit.
export type ReconcileSuggestion = {
    inv_id: string;
    confidence: number;        // 0..1
    reason: string | null;
};

export type ReconcileSuggestResult = {
    suggestions: ReconcileSuggestion[];
    model: string | null;
};

export type InterpretedTxn = {
    type: BankTxnType | string;
    txn_date: string | null;
    description: string;
    debit: string | null;
    credit: string | null;
    balance: string | null;
    bank_name: string | null;
};

export type InterpretResult = {
    model: string;
    imported_count: number;
    first_id: string | null;
    transactions: InterpretedTxn[];
};

// (event, payload) for each SSE frame the interpret stream emits.
export type BankStreamCallback = (event: string, payload: Record<string, unknown>) => void;

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }
    return response.json();
}

async function parseSseResponse<T>(response: Response, onEvent?: BankStreamCallback): Promise<T> {
    const contentType = response.headers.get('content-type') || '';
    if (!response.body || !contentType.includes('text/event-stream')) {
        return response.json();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalPayload: T | null = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
            const lines = part.split('\n');
            let event = 'message';
            let data = '';

            for (const line of lines) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                if (line.startsWith('data:')) data += line.slice(5).trim();
            }

            if (!data) continue;

            const payload = JSON.parse(data) as Record<string, unknown>;
            onEvent?.(event, payload);

            if (event === 'final') {
                finalPayload = payload.response as T;
                await reader.cancel();
                break;
            }

            if (event === 'error') {
                throw new Error(String(payload.message || 'Streaming error'));
            }
        }

        if (finalPayload !== null) break;
    }

    if (finalPayload !== null) return finalPayload;
    throw new Error('Stream ended without a final response.');
}

export const oBankAPI = {
    async listTxns(): Promise<BankTxn[]> {
        const response = await apiFetch('/acc/o_bankstatement/get_list');
        return parseApiResponse<BankTxn[]>(response, 'Failed to fetch bank transactions');
    },

    async postTxn(payload: BankTxnCreate): Promise<BankTxn> {
        const response = await apiFetch('/acc/o_bankstatement/post_one', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return parseApiResponse<BankTxn>(response, 'Failed to save bank transaction');
    },

    // Edit reuses the create-or-update path: passing an id updates in place.
    async updateTxn(id: string, payload: BankTxnCreate): Promise<BankTxn> {
        return this.postTxn({ ...payload, id });
    },

    async deleteTxn(id: string): Promise<void> {
        const response = await apiFetch(`/acc/o_bankstatement/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to delete bank transaction: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
    },

    async interpretStream(text: string, onEvent?: BankStreamCallback): Promise<InterpretResult> {
        const response = await apiFetch('/acc/o_bankstatement/interpret_stream', {
            method: 'POST',
            headers: { Accept: 'text/event-stream' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to interpret bank text: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
        return parseSseResponse<InterpretResult>(response, onEvent);
    },

    async getReconcileView(bankTxnId: string): Promise<ReconcileView> {
        const response = await apiFetch(
            `/acc/o_bankstatement/get_reconcile_view?bank_txn_id=${encodeURIComponent(bankTxnId)}`,
        );
        return parseApiResponse<ReconcileView>(response, 'Failed to load reconcile view');
    },

    // AI suggestion of which invoices this deposit paid. Advisory: the backend
    // returns an empty list (never an error) when the AI is unavailable.
    async suggestReconcile(bankTxnId: string): Promise<ReconcileSuggestResult> {
        const response = await apiFetch(
            `/acc/o_bankstatement/suggest_reconcile?bank_txn_id=${encodeURIComponent(bankTxnId)}`,
        );
        return parseApiResponse<ReconcileSuggestResult>(response, 'Failed to load AI reconcile suggestion');
    },

    // Reconcile is a match: send the matched invoice ids. The backend records the
    // deposit as their payment and runs the payment logic (amounts are backend-owned).
    // Passing [] de-reconciles.
    async reconcile(bankTxnId: string, invIds: string[]): Promise<ReconcileView> {
        const response = await apiFetch('/acc/o_bankstatement/reconcile', {
            method: 'POST',
            body: JSON.stringify({ bank_txn_id: bankTxnId, inv_ids: invIds }),
        });
        return parseApiResponse<ReconcileView>(response, 'Failed to reconcile deposit');
    },
};
