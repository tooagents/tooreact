import { apiFetch } from 'src/core/apihttp';

export type BankTxn = {
    id: string;
    txn_date: string | null;
    description: string | null;
    debit: number | string | null;   // money out
    credit: number | string | null;  // money in
    balance: number | string | null;
    source: string | null;
    status: string | null;
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

export type ReconcileAllocation = {
    inv_id: string;
    pay_amount: number;
};

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }
    return response.json();
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

    async getReconcileView(bankTxnId: string): Promise<ReconcileView> {
        const response = await apiFetch(
            `/acc/o_bankstatement/get_reconcile_view?bank_txn_id=${encodeURIComponent(bankTxnId)}`,
        );
        return parseApiResponse<ReconcileView>(response, 'Failed to load reconcile view');
    },

    async reconcile(bankTxnId: string, allocations: ReconcileAllocation[]): Promise<ReconcileView> {
        const response = await apiFetch('/acc/o_bankstatement/reconcile', {
            method: 'POST',
            body: JSON.stringify({ bank_txn_id: bankTxnId, allocations }),
        });
        return parseApiResponse<ReconcileView>(response, 'Failed to reconcile deposit');
    },
};
