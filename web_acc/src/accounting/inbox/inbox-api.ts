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

type AgentChatResponse = Record<string, unknown>;
export type InboxFlowEvent = {
    id?: string;
    ts: string;
    source: string;
    step: string;
    level?: 'info' | 'success' | 'error';
    elapsedMs?: number;
    meta?: unknown;
};

type FlowCallback = (event: InboxFlowEvent) => void;

type AgentChatPayload = {
    tool_choice: 'tool_transaction2je';
    arguments: {
        message: string;
    };
};

function getVendorName(message: string): string {
    return message
        .trim()
        .replace(/^(check\s+vendor|vendor)\s*:?\s*/i, '')
        .trim()
        .toLowerCase();
}

function buildAgentChatPayload(message: string): AgentChatPayload {
    return {
        tool_choice: 'tool_transaction2je',
        arguments: {
            "message": message,
        },
    };
}

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(
            `${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
        );
    }

    return response.json();
}

function summarizePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') return payload;
    if (Array.isArray(payload)) return { type: 'array', length: payload.length };

    const record = payload as Record<string, unknown>;
    const summary: Record<string, unknown> = {
        keys: Object.keys(record),
    };

    if (record.answer) summary.answer = record.answer;
    if (record.tool) summary.tool = record.tool;
    if (record.transaction_id) summary.transaction_id = record.transaction_id;
    if (record.journal_entry_id) summary.journal_entry_id = record.journal_entry_id;
    if (record.statement_count) summary.statement_count = record.statement_count;
    if (Array.isArray(record.trace)) summary.trace_count = record.trace.length;

    const result = record.result;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const resultRecord = result as Record<string, unknown>;
        summary.result = {
            keys: Object.keys(resultRecord),
            transaction_id: resultRecord.transaction_id,
            journal_entry_id: resultRecord.journal_entry_id,
            statement_count: resultRecord.statement_count,
            trace_count: Array.isArray(resultRecord.trace) ? resultRecord.trace.length : undefined,
        };
    }

    return summary;
}

function emitFlow(onFlow: FlowCallback | undefined, event: Omit<InboxFlowEvent, 'ts'>): void {
    onFlow?.({
        ts: new Date().toLocaleTimeString(),
        level: 'info',
        ...event,
    });
}

function flowFromTraceItem(item: unknown): Omit<InboxFlowEvent, 'ts'> | null {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    const step = typeof record.step === 'string' ? record.step : null;
    if (!step) return null;

    const { source, elapsed_ms, elapsedMs, step: _step, ...meta } = record;
    return {
        source: typeof source === 'string' ? source : 'trace',
        step,
        elapsedMs: typeof elapsed_ms === 'number' ? elapsed_ms : typeof elapsedMs === 'number' ? elapsedMs : undefined,
        meta,
    };
}

function emitTracePayload(onFlow: FlowCallback | undefined, payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;
    const record = payload as Record<string, unknown>;
    const trace = Array.isArray(record.trace) ? record.trace : null;
    if (trace) {
        trace.forEach((item) => {
            const flow = flowFromTraceItem(item);
            if (flow) emitFlow(onFlow, flow);
        });
    }

    const result = record.result;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        const resultTrace = (result as Record<string, unknown>).trace;
        if (Array.isArray(resultTrace)) {
            resultTrace.forEach((item) => {
                const flow = flowFromTraceItem(item);
                if (flow) emitFlow(onFlow, flow);
            });
        }
    }
}

async function parseStreamingResponse<T>(response: Response, onFlow?: FlowCallback): Promise<T> {
    const contentType = response.headers.get('content-type') || '';
    emitFlow(onFlow, {
        source: 'tooreact',
        step: 'response_headers',
        meta: {
            status: response.status,
            statusText: response.statusText,
            contentType,
            transferEncoding: response.headers.get('transfer-encoding'),
        },
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        emitFlow(onFlow, {
            source: 'tooreact',
            step: 'http_error',
            level: 'error',
            meta: { status: response.status, statusText: response.statusText, details },
        });
        throw new Error(`Failed to add inbox message: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    if (!response.body || !contentType.includes('text/event-stream')) {
        emitFlow(onFlow, { source: 'tooreact', step: 'non_stream_response_json_fallback' });
        const payload = await response.json();
        emitFlow(onFlow, {
            source: 'tooreact',
            step: 'json_response_parsed',
            level: 'success',
            meta: summarizePayload(payload),
        });
        emitTracePayload(onFlow, payload);
        return payload;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalPayload: T | null = null;
    let chunkIndex = 0;

    const parseBlock = (block: string) => {
        const lines = block.split(/\r?\n/);
        let event = 'message';
        let data = '';

        for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
        }

        if (!data) return;

        let payload: any;
        try {
            payload = JSON.parse(data);
        } catch {
            emitFlow(onFlow, {
                source: 'tooreact',
                step: 'stream_event_json_parse_failed',
                level: 'error',
                meta: { event, preview: data.slice(0, 240) },
            });
            return;
        }

        if (event === 'status') {
            emitFlow(onFlow, {
                source: payload.source || 'stream',
                step: payload.step || payload.status || 'status',
                elapsedMs: typeof payload.elapsed_ms === 'number' ? payload.elapsed_ms : undefined,
                meta: payload.meta ?? payload,
            });
            return;
        }

        if (event === 'final') {
            finalPayload = payload.response as T;
            emitFlow(onFlow, {
                source: payload.source || 'stream',
                step: 'final_response_received',
                level: 'success',
                meta: summarizePayload(payload.response),
            });
            emitTracePayload(onFlow, payload.response);
            return;
        }

        if (event === 'error') {
            emitFlow(onFlow, {
                source: payload.source || 'stream',
                step: payload.step || 'stream_error',
                level: 'error',
                meta: payload,
            });
            throw new Error(payload.message || payload.body || 'Streaming error');
        }

        emitFlow(onFlow, {
            source: payload.source || 'stream',
            step: event,
            meta: payload,
        });
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        chunkIndex += 1;
        const decodedChunk = decoder.decode(value, { stream: true });
        emitFlow(onFlow, {
            source: 'tooreact',
            step: 'stream_chunk_received',
            meta: {
                chunkIndex,
                byteLength: value.byteLength,
                preview: decodedChunk.slice(0, 160),
            },
        });

        buffer += decodedChunk;
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';
        parts.forEach(parseBlock);
    }

    if (buffer.trim()) parseBlock(buffer);
    if (finalPayload !== null) return finalPayload;

    emitFlow(onFlow, { source: 'tooreact', step: 'stream_ended_without_final', level: 'error' });
    throw new Error('Stream ended without a final response.');
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

    async addToInbox(message: string, onFlow?: FlowCallback): Promise<AgentChatResponse> {
        const payload = buildAgentChatPayload(message);
        emitFlow(onFlow, {
            source: 'tooreact',
            step: 'request_start',
            meta: {
                path: '/too/proxy/chat/stream',
                method: 'POST',
                payload,
            },
        });
        const response = await apiFetch('/too/proxy/chat/stream', {
            method: 'POST',
            headers: { Accept: 'text/event-stream' },
            body: JSON.stringify(payload),
        });

        return parseStreamingResponse<AgentChatResponse>(response, onFlow);
    },
};
