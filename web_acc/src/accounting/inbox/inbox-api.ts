import { apiFetch } from 'src/core/apihttp';
import { COARow, StreamCallback, AgentChatPayload, AgentChatResponse } from 'src/types/type_coa';


async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,);
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


    async listAccounts(): Promise<COARow[]> {
        const response = await apiFetch('/acc/coa/get_list_active');
        return parseApiResponse<COARow[]>(response, 'Failed to fetch COA accounts');
    },

    // async applyGenericCoa(): Promise<ApplyCoaResponse> {
    //     const response = await apiFetch('/acc/coa/templates/generic/apply', { method: 'POST' });
    //     return parseApiResponse<ApplyCoaResponse>(response, 'Failed to apply COA');
    // },


};
