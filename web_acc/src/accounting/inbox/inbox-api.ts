import { apiFetch } from 'src/core/apihttp';

export type AccountRow = {
    id: string;
    [key: string]: unknown;
};

export type TxRow = {
    id: string;
    txn_date?: string;
    description?: string;
    amount?: number | string;
    status?: string;
};

type ApplyCoaResponse = {
    created: number;
    existing: number;
};

type ImportCsvResponse = {
    imported_count: number;
    duplicate_count: number;
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

export const inboxAPI = {
    async listTransactions(): Promise<TxRow[]> {
        const response = await apiFetch('/acc/get_transactions?limit=200');
        return parseApiResponse<TxRow[]>(response, 'Failed to fetch transactions');
    },

    async listAccounts(): Promise<AccountRow[]> {
        const response = await apiFetch('/acc/accounts');
        return parseApiResponse<AccountRow[]>(response, 'Failed to fetch accounts');
    },

    async applyGenericCoa(): Promise<ApplyCoaResponse> {
        const response = await apiFetch('/acc/coa/templates/generic/apply', { method: 'POST' });
        return parseApiResponse<ApplyCoaResponse>(response, 'Failed to apply COA');
    },

    async importCsv(file: File): Promise<ImportCsvResponse> {
        const form = new FormData();
        form.append('file', file);

        const response = await apiFetch('/acc/transactions/import-csv', {
            method: 'POST',
            body: form,
        });

        return parseApiResponse<ImportCsvResponse>(response, 'Failed to import CSV');
    },
};
