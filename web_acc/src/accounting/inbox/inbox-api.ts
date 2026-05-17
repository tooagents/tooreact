import { apiFetch } from 'src/core/apihttp';
import { JournalEntryPreview, unwrapJournalEntryResponse } from 'src/accounting/inbox/inbox-journal-entry';

export type AccountRow = {
    id: string;
    coa_code?: string | null;
    coa_posting_name?: string | null;
    coa_group_level1?: string | null;
    coa_group_level2?: string | null;
    coa_group_level3?: string | null;
    normal_balance?: string | null;
    is_posting?: boolean | null;
    is_active?: boolean | null;
    [key: string]: unknown;
};

export type TxRow = {
    id: string;
    txn_date?: string;
    description?: string;
    amount?: number | string;
    status?: string;
    journal_id?: string | null;
    journal_entry?: JournalEntryPreview | null;
    is_deleted?: boolean | null;
    [key: string]: unknown;
};

type ApplyCoaResponse = {
    created: number;
    existing: number;
};

type ImportCsvResponse = {
    imported_count: number;
    duplicate_count: number;
};

type AgentChatResponse = Record<string, unknown>;

type AgentChatPayload = {
    message: string;
};

type StreamCallback = (event: string, data: Record<string, unknown>) => void;

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(
            `${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
        );
    }

    return response.json();
}

async function parseSseResponse<T>(response: Response, onEvent?: StreamCallback): Promise<T> {
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

export const inboxAPI = {
    // add to inbox
    // async addToInbox(message: string): Promise<AgentChatResponse> {
    //     const payload: AgentChatPayload = { message };
    //     const response = await apiFetch('/acc/add2inbox', {
    //         method: 'POST',
    //         body: JSON.stringify(payload),
    //     });

    //     return parseApiResponse<AgentChatResponse>(response, 'Failed to add inbox message');
    // },


    async addToInboxStream(message: string, onEvent?: StreamCallback): Promise<AgentChatResponse> {
        const payload: AgentChatPayload = { message };
        const response = await apiFetch('/acc/add2inbox_stream', {
            method: 'POST',
            headers: { Accept: 'text/event-stream' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(`Failed to add inbox message: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,);
        }

        return parseSseResponse<AgentChatResponse>(response, onEvent);
    },


    async listTransactions(): Promise<TxRow[]> {
        const response = await apiFetch('/acc/get_transaction_list?limit=200');
        return parseApiResponse<TxRow[]>(response, 'Failed to fetch transactions');
    },

    async getJournalEntry(journalId: string): Promise<JournalEntryPreview> {
        const response = await apiFetch(`/acc/je/getone/${encodeURIComponent(journalId)}`);
        const data = await parseApiResponse<unknown>(response, 'Failed to fetch journal entry');
        return unwrapJournalEntryResponse(data);
    },

    async generateJournalEntry(transactionId: string, options: { force?: boolean } = {}): Promise<JournalEntryPreview> {
        const response = await apiFetch('/acc/je/generate', {
            method: 'POST',
            body: JSON.stringify({ transaction_id: transactionId, force: Boolean(options.force) }),
        });
        const data = await parseApiResponse<unknown>(response, 'Failed to generate journal entry');
        return unwrapJournalEntryResponse(data);
    },

    async updateTransaction(transactionId: string, updates: Partial<TxRow>): Promise<TxRow> {
        const response = await apiFetch(`/acc/update_transaction/${encodeURIComponent(transactionId)}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
        return parseApiResponse<TxRow>(response, 'Failed to update inbox transaction');
    },

    async voidTransaction(transactionId: string): Promise<TxRow> {
        const response = await apiFetch(`/acc/void_transaction/${encodeURIComponent(transactionId)}`, {
            method: 'POST',
        });
        return parseApiResponse<TxRow>(response, 'Failed to void inbox transaction');
    },


    async listAccounts(): Promise<AccountRow[]> {
        const response = await apiFetch('/acc/coa');
        return parseApiResponse<AccountRow[]>(response, 'Failed to fetch COA accounts');
    },

    async applyGenericCoa(): Promise<ApplyCoaResponse> {
        const response = await apiFetch('/acc/coa/templates/generic/apply', { method: 'POST' });
        return parseApiResponse<ApplyCoaResponse>(response, 'Failed to apply COA');
    },


};
