import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from 'src/components/ui/button';
import { Checkbox } from 'src/components/ui/checkbox';
import { Textarea } from 'src/components/ui/textarea';
import { feedbackAPI } from 'src/_ai/feedback/ai-feedback-api';
import { PayrollHistoryResponse } from 'src/accounting/history/payroll-history-api';
import { formatDate } from 'src/core/format';

type EvidenceItem = {
    label: string;
    value: string | number;
};

type GenericItem = {
    title: string;
    subtitle?: string;
    snippet?: string;
    url?: string;
};

type RagAnswer = {
    route?: string;
    tool?: string;
    model?: string;
    top_k?: number;
    confidence?: number;
    citations?: Array<number | string>;
    limitations?: string;
    evidence?: unknown[];
};

type NormalizedSearch = {
    mode?: string;
    evidence: EvidenceItem[];
    rows: PayrollHistoryResponse[] | null;
    items: GenericItem[];
    raw: unknown;
};

type FeedbackType = 'up' | 'down' | 'flag';

type FeedbackReasonOption = {
    value: string;
    label: string;
};

type FeedbackPanelProps = {
    visible: boolean;
    query: string;
    answerText: string | null;
    ragAnswer: RagAnswer | null;
    searchResult: NormalizedSearch | null;
    statusLines: string[];
};

const FEEDBACK_SESSION_KEY = 'ai_feedback_session_id';

const FEEDBACK_REASONS: FeedbackReasonOption[] = [
    { value: 'incorrect', label: 'Incorrect' },
    { value: 'incomplete', label: 'Missing details' },
    { value: 'confusing', label: 'Confusing' },
    { value: 'outdated', label: 'Outdated' },
    { value: 'other', label: 'Other' },
];

const FLAG_REASONS: FeedbackReasonOption[] = [
    { value: 'incorrect', label: 'Incorrect facts' },
    { value: 'policy', label: 'Policy / Safety' },
    { value: 'sensitive', label: 'Sensitive data' },
    { value: 'offensive', label: 'Offensive' },
    { value: 'other', label: 'Other' },
];

const createLocalId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as Crypto).randomUUID();
    }
    return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateSessionId = () => {
    if (typeof window === 'undefined') return null;
    const existing = window.localStorage.getItem(FEEDBACK_SESSION_KEY);
    if (existing) return existing;
    const next = createLocalId();
    window.localStorage.setItem(FEEDBACK_SESSION_KEY, next);
    return next;
};

const safeJson = (value: unknown, maxLen = 4000): string | null => {
    if (value === null || value === undefined) return null;
    try {
        const text = JSON.stringify(value);
        if (text.length <= maxLen) return text;
        return `${text.slice(0, maxLen).trim()}...`;
    } catch {
        return null;
    }
};

const resolveHistoryId = (item: PayrollHistoryResponse): string | null => {
    const candidate =
        item.id ??
        (item as { history_id?: string | number }).history_id ??
        (item as { period_key?: string | number }).period_key;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
    return null;
};

const resolvePeriodLabel = (history?: PayrollHistoryResponse | null) => {
    if (!history) return null;
    if (history.period_start && history.period_end) {
        return `${formatDate(history.period_start)} - ${formatDate(history.period_end)}`;
    }
    if (history.period_key) return `Period #${history.period_key}`;
    if (history.pay_day) return `Pay Day: ${formatDate(history.pay_day)}`;
    return null;
};

export function FeedbackPanel({
    visible,
    query,
    answerText,
    ragAnswer,
    searchResult,
    statusLines,
}: FeedbackPanelProps) {
    const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
    const [feedbackReason, setFeedbackReason] = useState('');
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [includeContext, setIncludeContext] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messageId, setMessageId] = useState<string | null>(null);

    useEffect(() => {
        setSessionId(getOrCreateSessionId());
    }, []);

    useEffect(() => {
        if (!searchResult) return;
        setFeedbackType(null);
        setFeedbackReason('');
        setFeedbackComment('');
        setFeedbackSent(false);
        setFeedbackError(null);
        setIncludeContext(true);
        setMessageId(createLocalId());
    }, [searchResult]);

    const buildFeedbackContext = () => {
        if (!includeContext) return null;
        const rows =
            searchResult?.rows?.slice(0, 5).map((row) => ({
                id: resolveHistoryId(row),
                period: resolvePeriodLabel(row),
                pay_day: row.pay_day,
                total_net: row.total_net,
                total_gross: row.total_gross,
                employee_count: row.employee_count,
                full_name: row.full_name,
            })) ?? [];
        const items =
            searchResult?.items?.slice(0, 5).map((item) => ({
                title: item.title,
                subtitle: item.subtitle,
                url: item.url,
                snippet: item.snippet,
            })) ?? [];

        return {
            query: query.trim(),
            answer: answerText,
            mode: searchResult?.mode,
            route: ragAnswer?.route ?? ragAnswer?.tool,
            model: ragAnswer?.model,
            top_k: ragAnswer?.top_k,
            confidence: ragAnswer?.confidence,
            citations: ragAnswer?.citations,
            limitations: ragAnswer?.limitations,
            evidence: ragAnswer?.evidence ?? searchResult?.evidence ?? [],
            rows,
            items,
            status_lines: statusLines,
            raw: safeJson(searchResult?.raw, 4000),
            client: {
                url: typeof window !== 'undefined' ? window.location.href : undefined,
                user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
            },
        };
    };

    const submitFeedback = async (type: FeedbackType) => {
        const effectiveMessageId = messageId ?? createLocalId();
        if (!messageId) setMessageId(effectiveMessageId);
        setFeedbackSubmitting(true);
        setFeedbackError(null);
        try {
            await feedbackAPI.submitFeedback({
                feedback_type: type,
                rating: type === 'up' ? 1 : type === 'down' ? -1 : 0,
                reason: feedbackReason || null,
                comment: feedbackComment.trim() || null,
                route: ragAnswer?.route ?? searchResult?.mode ?? null,
                model: ragAnswer?.model ?? null,
                session_id: sessionId,
                message_id: effectiveMessageId,
                context: buildFeedbackContext(),
                meta: {
                    ui: 'header_search',
                    query_length: query.trim().length,
                    has_results: visible,
                    result_type: ragAnswer ? 'rag' : 'generic',
                },
            });
            setFeedbackSent(true);
        } catch (error) {
            setFeedbackError(error instanceof Error ? error.message : 'Failed to submit feedback');
        } finally {
            setFeedbackSubmitting(false);
        }
    };

    const handleFeedbackSelect = (type: FeedbackType) => {
        if (type !== feedbackType) {
            setFeedbackReason('');
            setFeedbackComment('');
        }
        setFeedbackType(type);
        setFeedbackSent(false);
        setFeedbackError(null);
        if (type === 'up') {
            void submitFeedback(type);
        }
    };

    const handleFeedbackSubmit = () => {
        if (!feedbackType || feedbackType === 'up') return;
        void submitFeedback(feedbackType);
    };

    const handleFeedbackReset = () => {
        setFeedbackType(null);
        setFeedbackReason('');
        setFeedbackComment('');
        setFeedbackSent(false);
        setFeedbackError(null);
    };

    if (!visible) return null;
    const showForm = feedbackType === 'down' || feedbackType === 'flag';
    const reasonOptions = feedbackType === 'flag' ? FLAG_REASONS : FEEDBACK_REASONS;

    return (
        <div className="mt-3 border-t border-border pt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Was this helpful?</span>
                <Button
                    type="button"
                    size="sm"
                    variant={feedbackType === 'up' ? 'secondary' : 'outline'}
                    onClick={() => handleFeedbackSelect('up')}
                    disabled={feedbackSubmitting}
                    className="h-8 px-3"
                >
                    <Icon icon="solar:like-bold" width="16" height="16" />
                    Thumbs up
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={feedbackType === 'down' ? 'secondary' : 'outline'}
                    onClick={() => handleFeedbackSelect('down')}
                    disabled={feedbackSubmitting}
                    className="h-8 px-3"
                >
                    <Icon icon="solar:dislike-bold" width="16" height="16" />
                    Thumbs down
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={feedbackType === 'flag' ? 'secondary' : 'outline'}
                    onClick={() => handleFeedbackSelect('flag')}
                    disabled={feedbackSubmitting}
                    className="h-8 px-3"
                >
                    <Icon icon="solar:flag-bold" width="16" height="16" />
                    Flag as incorrect
                </Button>
            </div>
            {feedbackSent && (
                <div className="text-xs text-success">Thanks for the feedback. We use it to improve answers.</div>
            )}
            {feedbackError && (
                <div className="text-xs text-error bg-lighterror/40 border border-error/40 rounded px-2 py-1">
                    {feedbackError}
                </div>
            )}
            {showForm && (
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        {reasonOptions.map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={feedbackReason === option.value ? 'secondary' : 'outline'}
                                onClick={() => setFeedbackReason(option.value)}
                                className="h-7 px-2 text-xs"
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <Textarea
                        placeholder="Tell us what went wrong (optional)"
                        value={feedbackComment}
                        onChange={(event) => setFeedbackComment(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                                checked={includeContext}
                                onCheckedChange={(value) => setIncludeContext(value === true)}
                            />
                            Include session context
                        </label>
                        <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={handleFeedbackReset}>
                                Cancel
                            </Button>
                            <Button type="button" size="sm" onClick={handleFeedbackSubmit} disabled={feedbackSubmitting}>
                                {feedbackSubmitting ? 'Sending...' : 'Send feedback'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
