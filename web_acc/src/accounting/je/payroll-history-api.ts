import { apiFetch } from 'src/core/apihttp';

interface ListPayrollHistoryParams {
    skip?: number;
    limit?: number;
}

export interface PayrollHistoryResponse {
    id?: string;
    history_id?: string;
    period_key?: string;
    biz_id?: string;
    schedule_id?: string;
    employee_id?: string;
    period_start?: string;
    period_end?: string;
    pay_date?: string | null;
    pay_day?: string | null;
    total_gross?: number | string | null;
    payroll_cost?: number | string | null;
    total_net?: number | string | null;
    taxes_and_deductions?: number | string | null;
    employee_count?: number | null;
    excluded_count?: number | null;
    employment_type?: string | null;
    full_name?: string | null;
    annual_salary_snapshot?: number | string | null;
    hourly_rate_snapshot?: number | string | null;
    federal_claim_snapshot?: number | string | null;
    ontario_claim_snapshot?: number | string | null;
    regular_hours?: number | string | null;
    overtime_hours?: number | string | null;
    bonus?: number | string | null;
    vacation?: number | string | null;
    cpp?: number | string | null;
    ei?: number | string | null;
    tax?: number | string | null;
    gross?: number | string | null;
    total_deduction?: number | string | null;
    adjustment?: number | string | null;
    net?: number | string | null;
    cpp_exempt_snapshot?: boolean;
    ei_exempt_snapshot?: boolean;
    status?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export interface PayrollHistoryDetailResponse {
    summary: PayrollHistoryResponse;
    entries: PayrollHistoryResponse[];
}

type StatusCallback = (status: string, meta: Record<string, unknown>) => void;

async function parseSseResponse<T>(response: Response, onStatus?: StatusCallback): Promise<T> {
    const startedAt = performance.now();
    const trace = (message: string, data?: unknown) => {
        const elapsedMs = (performance.now() - startedAt).toFixed(1);
        if (data !== undefined) {
            console.log(`[SSE][payroll-history +${elapsedMs}ms] ${message}`, data);
            return;
        }
        console.log(`[SSE][payroll-history +${elapsedMs}ms] ${message}`);
    };

    const contentType = response.headers.get('content-type') || '';
    trace('response headers', {
        status: response.status,
        contentType,
        transferEncoding: response.headers.get('transfer-encoding'),
        cacheControl: response.headers.get('cache-control'),
        connection: response.headers.get('connection'),
    });

    if (!response.body || !contentType.includes('text/event-stream')) {
        trace('non-SSE response detected; parsing as JSON');
        return response.json();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalPayload: T | null = null;
    let chunkIndex = 0;

    let doneEarly = false;
    while (true) {
        const { value, done } = await reader.read();
        chunkIndex += 1;
        trace('reader chunk', {
            chunkIndex,
            done,
            byteLength: value?.byteLength ?? 0,
        });
        if (done) break;

        const decodedChunk = decoder.decode(value, { stream: true });
        trace('chunk preview', {
            chunkIndex,
            preview: decodedChunk.slice(0, 180),
            hasCrlfSeparator: decodedChunk.includes('\r\n\r\n'),
            hasLfSeparator: decodedChunk.includes('\n\n'),
        });
        buffer += decodedChunk;
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        trace('buffer split', {
            completeEventBlocks: parts.length,
            pendingBufferLength: buffer.length,
            hasPendingCrlfSeparator: buffer.includes('\r\n\r\n'),
        });

        for (const part of parts) {
            const lines = part.split('\n');
            let event = 'message';
            let data = '';

            for (const line of lines) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                if (line.startsWith('data:')) data += line.slice(5).trim();
            }

            if (!data) continue;
            let payload: any;
            try {
                payload = JSON.parse(data);
            } catch {
                trace('json parse failed for event block', { preview: data.slice(0, 220) });
                continue;
            }

            trace('event parsed', {
                event,
                status: payload?.status,
                keys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
            });

            if (event === 'status') {
                trace('status callback fired', { status: payload.status, meta: payload.meta ?? {} });
                onStatus?.(payload.status, payload.meta ?? {});
            } else if (event === 'final') {
                finalPayload = payload.response as T;
                trace('final event received');
                doneEarly = true;
                break;
            } else if (event === 'error') {
                trace('error event received', payload);
                throw new Error(payload.message || 'Streaming error');
            }
        }

        if (doneEarly) {
            await reader.cancel();
            trace('stream cancelled after final event');
            break;
        }
    }

    if (finalPayload !== null) {
        trace('stream complete with final payload');
        return finalPayload;
    }
    trace('stream ended without final payload');
    throw new Error('Stream ended without a final response.');
}

export const historyAPI = {
    async listPayrollHistory(params?: ListPayrollHistoryParams): Promise<PayrollHistoryResponse[]> {
        const queryParams = new URLSearchParams();

        if (params?.skip !== undefined) queryParams.append('skip', String(params.skip));
        if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));

        const path = queryParams.toString()
            ? `/t4/getaccounting_history_list?${queryParams.toString()}`
            : '/t4/getaccounting_history_list';

        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch payroll history: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        const payload = await response.json();
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray((payload as { data?: unknown }).data)) {
            return (payload as { data: PayrollHistoryResponse[] }).data;
        }
        if (payload && Array.isArray((payload as { items?: unknown }).items)) {
            return (payload as { items: PayrollHistoryResponse[] }).items;
        }
        return [];
    },

    async getPayrollHistoryDetail(id: string): Promise<PayrollHistoryDetailResponse | PayrollHistoryResponse | PayrollHistoryResponse[]> {
        const path = `/t4/getaccounting_history_detail?id=${encodeURIComponent(id)}`;
        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch payroll history detail: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },

    async searchPayrollHistory(query: string, topK = 5, onStatus?: StatusCallback): Promise<unknown> {
        console.log('[SSE][payroll-history] request start', {
            path: '/mcpbrain/lgstream',
            query,
            topK,
            ts: new Date().toISOString(),
        });
        // const response = await apiFetch('/rag1unit/cosine', {
        // const response = await apiFetch('/rag1unit/vector', {
        // const response = await apiFetch('/rag1unit/keyword', {
        // const response = await apiFetch('/rag1unit/hybrid', {
        // const response = await apiFetch('/rag2llm/llm_answer', {
        // const response = await apiFetch('/rag2llm/rerank', {
        // const response = await apiFetch('/rag2llm/rerank_stream', {
        // const response = await apiFetch('/mcpbrain/python', {
        // const response = await apiFetch('/mcpbrain/langgraph', {
        const response = await apiFetch('/mcpbrain/lgstream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ query, top_k: topK }),
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to search payroll history: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return parseSseResponse(response, onStatus);
    },

};
