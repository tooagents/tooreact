import { apiFetch } from 'src/core/apihttp';

export type FeedbackPayload = {
    feedback_type: 'up' | 'down' | 'flag';
    rating?: number | null;
    reason?: string | null;
    comment?: string | null;
    route?: string | null;
    model?: string | null;
    session_id?: string | null;
    message_id?: string | null;
    context?: Record<string, unknown> | null;
    meta?: Record<string, unknown> | null;
};

export const feedbackAPI = {
    async submitFeedback(payload: FeedbackPayload): Promise<void> {
        const response = await apiFetch('/rag2llm/feedback', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to submit feedback: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }
    },
};
