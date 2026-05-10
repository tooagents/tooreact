import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router';
import SimpleBar from 'simplebar-react';
import { Input } from 'src/components/ui/input';
import { Badge } from 'src/components/ui/badge';
import { FeedbackPanel } from 'src/_ai/feedback/FeedbackPanel';
import { historyAPI, PayrollHistoryResponse } from 'src/accounting/history/payroll-history-api';
import { formatDate, formatMoney } from 'src/core/format';

interface EvidenceItem {
    label: string;
    value: string | number;
}

interface GenericItem {
    title: string;
    subtitle?: string;
    snippet?: string;
    url?: string;
    payload?: unknown;
}

interface NormalizedSearch {
    mode?: string;
    answer?: string;
    evidence: EvidenceItem[];
    rows: PayrollHistoryResponse[] | null;
    items: GenericItem[];
    raw: unknown;
}

type RagEvidence = {
    evidence_id?: number | string;
    score?: number;
    source_id?: string;
    chunk?: string;
    history?: PayrollHistoryResponse & Record<string, unknown>;
};

type RagAnswer = {
    query?: string;
    top_k?: number;
    model?: string;
    sql?: string;
    route?: string;
    tool?: string;
    answer?: string;
    confidence?: number;
    reasoning_summary?: string[] | string;
    citations?: Array<number | string>;
    limitations?: string;
    evidence?: RagEvidence[];
    model_reasoning_summary?: string[] | string;
};

const isPayrollRow = (value: unknown): value is PayrollHistoryResponse => {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return Boolean(
        row.period_start ||
        row.period_end ||
        row.pay_day ||
        row.total_net ||
        row.total_gross ||
        row.employee_count ||
        row.period_key,
    );
};

const toEvidenceList = (value: unknown): EvidenceItem[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const entry = item as Record<string, unknown>;
            const label =
                (entry.label as string) ??
                (entry.name as string) ??
                (entry.month as string) ??
                (entry.period as string);
            const value = entry.value ?? entry.amount ?? entry.total ?? entry.sum;
            if (!label || value === undefined || value === null) return null;
            return { label: String(label), value: value as string | number };
        })
        .filter((item): item is EvidenceItem => Boolean(item));
};

const trimText = (value: string, maxLength: number) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trim()}…`;
};

const toStringSafe = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
};

const pickFirstString = (...values: Array<unknown>): string | null => {
    for (const value of values) {
        const candidate = toStringSafe(value);
        if (candidate && candidate.trim()) return candidate;
    }
    return null;
};

const toNumberSafe = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
};

const resolvePayrollItemTitle = (row: Record<string, unknown>): string | null => {
    const periodStart = toStringSafe(row.period_start);
    const periodEnd = toStringSafe(row.period_end);
    const payDay = toStringSafe(row.pay_day);
    const periodKey = toStringSafe(row.period_key);
    const fullName = toStringSafe(row.full_name);

    if (periodStart && periodEnd) return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;
    if (payDay) return `Pay Day: ${formatDate(payDay)}`;
    if (periodKey) return `Period #${periodKey}`;
    if (fullName) return fullName;
    return null;
};

const toGenericItem = (value: unknown, index: number): GenericItem => {
    if (!value || typeof value !== 'object') {
        return { title: String(value ?? `Result ${index + 1}`), payload: value };
    }
    const entry = value as Record<string, unknown>;
    const nestedHistory =
        entry.history && typeof entry.history === 'object' ? (entry.history as Record<string, unknown>) : null;
    const sourceRow =
        nestedHistory ??
        (isPayrollRow(entry) ? entry : null);

    const snippet = pickFirstString(
        entry.snippet,
        entry.summary,
        entry.text,
        entry.content,
        entry.chunk,
        entry.page_content,
        entry.document,
        entry.doc,
        entry.answer,
        entry.result,
        entry.message,
        nestedHistory?.notes,
        nestedHistory?.memo,
    );
    const rawTitle = pickFirstString(
        entry.title,
        entry.name,
        entry.label,
        entry.question,
        entry.query,
        nestedHistory?.full_name,
    );
    const payrollTitle = sourceRow ? resolvePayrollItemTitle(sourceRow) : null;
    const title = payrollTitle ?? rawTitle ?? (snippet ? trimText(snippet, 64) : `Result ${index + 1}`);

    const moneyValue = sourceRow
        ? toNumberSafe(sourceRow.total_net) ??
            toNumberSafe(sourceRow.net) ??
            toNumberSafe(sourceRow.total_gross) ??
            toNumberSafe(sourceRow.gross)
        : null;
    const moneyLabel = moneyValue !== null ? formatMoney(moneyValue) : null;

    const subtitle = pickFirstString(
        entry.source,
        entry.type,
        entry.mode,
        entry.provider,
        entry.engine,
        nestedHistory?.employment_type,
        entry.source_id,
    );
    const resolvedSnippet = sourceRow
        ? pickFirstString(
            snippet,
            nestedHistory?.full_name ? `Employee: ${nestedHistory.full_name}` : null,
            moneyLabel ? `Amount: ${moneyLabel}` : null,
            nestedHistory?.employee_count ? `Employees: ${nestedHistory.employee_count}` : null,
        )
        : snippet;
    const url = (entry.url as string) ?? (entry.link as string);
    return {
        title: String(title),
        subtitle: subtitle ? trimText(String(subtitle), 60) : undefined,
        snippet: resolvedSnippet ? trimText(String(resolvedSnippet), 280) : undefined,
        url: url ? String(url) : undefined,
        payload: value,
    };
};

const normalizeSearchResponse = (payload: unknown): NormalizedSearch => {
    const base: NormalizedSearch = {
        mode: undefined,
        answer: undefined,
        evidence: [],
        rows: null,
        items: [],
        raw: payload,
    };

    if (!payload) return base;

    if (Array.isArray(payload)) {
        const payrollRows = payload.filter(isPayrollRow);
        if (payrollRows.length) {
            base.rows = payrollRows;
        } else {
            base.items = payload.map(toGenericItem);
        }
        return base;
    }

    if (typeof payload !== 'object') {
        base.answer = String(payload);
        return base;
    }

    const data = payload as Record<string, unknown>;
    const nested =
        data.response ??
        data.output ??
        data.tool_output ??
        data.tool_result ??
        data.toolResponse ??
        data.payload ??
        data.body ??
        data.result ??
        data.data ??
        data.value;
    if (nested && nested !== payload && (Array.isArray(nested) || typeof nested === 'object')) {
        const nestedNormalized = normalizeSearchResponse(nested);
        return {
            ...base,
            ...nestedNormalized,
            mode:
                nestedNormalized.mode ??
                (data.route as string) ??
                (data.tool as string) ??
                (data.mode as string) ??
                (data.type as string) ??
                (data.source as string) ??
                (data.kind as string),
        };
    }
    base.mode =
        (data.route as string) ??
        (data.tool as string) ??
        (data.mode as string) ??
        (data.type as string) ??
        (data.source as string) ??
        (data.kind as string);

    const answerValue = data.answer ?? data.summary ?? data.message ?? data.result ?? data.text;
    if (answerValue !== undefined && answerValue !== null) {
        base.answer = typeof answerValue === 'string' ? answerValue : JSON.stringify(answerValue);
    }

    base.evidence =
        toEvidenceList(data.evidence) ||
        toEvidenceList(data.breakdown) ||
        toEvidenceList(data.details) ||
        toEvidenceList(data.sources) ||
        toEvidenceList(data.citations) ||
        toEvidenceList(data.provenance);

    const itemsCandidate =
        (Array.isArray(data.results) && data.results) ||
        (Array.isArray(data.items) && data.items) ||
        (Array.isArray(data.data) && data.data) ||
        (Array.isArray(data.rows) && data.rows) ||
        (Array.isArray(data.matches) && data.matches) ||
        (Array.isArray(data.documents) && data.documents) ||
        (Array.isArray(data.search_results) && data.search_results) ||
        (Array.isArray(data.web_search) && data.web_search) ||
        (Array.isArray(data.output) && data.output) ||
        null;

    if (itemsCandidate) {
        const payrollRows = itemsCandidate.filter(isPayrollRow);
        if (payrollRows.length) {
            base.rows = payrollRows;
        } else {
            base.items = itemsCandidate.map(toGenericItem);
        }
    }

    return base;
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

const toTitleCase = (value?: string) =>
    (value ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const formatConfidence = (value?: number) => {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value)) return null;
    const percent = value > 1 ? Math.round(value) : Math.round(value * 100);
    return `${percent}%`;
};

const truncateValue = (value: string, maxLen: number) => {
    if (value.length <= maxLen) return value;
    return `${value.slice(0, maxLen).trim()}…`;
};

const formatMetaValue = (value: unknown, maxLen = 120): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        return truncateValue(trimmed, maxLen);
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        const text = JSON.stringify(value);
        return truncateValue(text, maxLen);
    } catch {
        return String(value);
    }
};

const formatStatusMeta = (meta: Record<string, unknown>) => {
    const pairs: Array<[string, unknown, number?]> = [
        ['query', meta.query, 140],
        ['top_k', meta.top_k, 40],
        ['route', meta.route, 40],
        ['confidence', meta.confidence, 40],
        ['model', meta.model, 60],
        ['rerank_model', meta.rerank_model ?? meta.rerankModel, 60],
        ['row_count', meta.row_count ?? meta.rows, 40],
        ['count', meta.count ?? meta.total, 40],
        ['sql', meta.sql, 200],
        ['reason', meta.reason ?? meta.error, 140],
        ['rationale', meta.rationale, 140],
    ];
    const rendered = pairs
        .map(([key, value, maxLen]) => {
            const formatted = formatMetaValue(value, maxLen);
            if (!formatted) return null;
            const safe = typeof value === 'string' ? `"${formatted}"` : formatted;
            return `${key}=${safe}`;
        })
        .filter((item): item is string => Boolean(item));
    if (!rendered.length) return '';
    return `(${rendered.join('; ')})`;
};

const formatStatusLabel = (status: string, meta: Record<string, unknown> = {}) => {
    const route = meta.route ? String(meta.route).toUpperCase() : null;
    const metaText = formatStatusMeta(meta);
    switch (status) {
        case 'start':
            return `Thinking... ${metaText}`.trim();
        case 'routing_start':
            return `Routing question... ${metaText}`.trim();
        case 'routing_done':
            return route ? `Route: ${route} ${metaText}`.trim() : `Route selected ${metaText}`.trim();
        case 'rag_start':
            return `Searching records... ${metaText}`.trim();
        case 'rag_cache_check':
            return `Checking cache... ${metaText}`.trim();
        case 'rag_cache_hit':
            return `Using cached answer... ${metaText}`.trim();
        case 'rag_cache_miss':
            return `Cache miss. Searching... ${metaText}`.trim();
        case 'rag_retrieve_start':
            return `Retrieving candidates... ${metaText}`.trim();
        case 'rag_top_k':
            return `Top K decided ${metaText}`.trim();
        case 'rag_retrieve_done': {
            const count = meta.count ?? meta.total;
            return count ? `Retrieved ${count} candidates ${metaText}`.trim() : `Retrieved candidates ${metaText}`.trim();
        }
        case 'rag_rerank_start':
            return `Reranking results... ${metaText}`.trim();
        case 'rag_rerank_done': {
            const count = meta.count ?? meta.total;
            return count ? `Reranked ${count} items ${metaText}`.trim() : `Rerank complete ${metaText}`.trim();
        }
        case 'rag_rerank_fallback':
            return `Rerank unavailable, using base results ${metaText}`.trim();
        case 'rag_generate_start':
            return `Drafting answer... ${metaText}`.trim();
        case 'rag_generate_done':
            return `Answer ready ${metaText}`.trim();
        case 'rag_done':
            return `Answer ready ${metaText}`.trim();
        case 'sql_start':
            return `Preparing SQL... ${metaText}`.trim();
        case 'sql_generated':
            return `SQL generated ${metaText}`.trim();
        case 'sql_execute':
            return `Running SQL... ${metaText}`.trim();
        case 'sql_execute_failed':
            return `SQL failed, falling back... ${metaText}`.trim();
        case 'sql_guardrail_rejected':
            return `SQL guardrail rejected ${metaText}`.trim();
        case 'sql_done':
            return `SQL complete ${metaText}`.trim();
        case 'general_start':
            return `Generating response... ${metaText}`.trim();
        case 'general_done':
            return `Answer ready ${metaText}`.trim();
        case 'rag_no_evidence':
            return `No evidence retrieved ${metaText}`.trim();
        default:
            return `Working: ${status.replace(/_/g, ' ')} ${metaText}`.trim();
    }
};

const toRagAnswer = (payload: unknown): RagAnswer | null => {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as Record<string, unknown>;
    if (!('answer' in data) && !('evidence' in data)) return null;
    if (data.evidence && !Array.isArray(data.evidence)) return null;
    return data as RagAnswer;
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

function Search() {
    const [query, setQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchResult, setSearchResult] = useState<NormalizedSearch | null>(null);
    const [searchStatusLines, setSearchStatusLines] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<{ left: number; top: number; width: number }>({
        left: 0,
        top: 0,
        width: 0,
    });
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const searchReqIdRef = useRef(0);

    const traceSearch = (requestId: number, message: string, data?: unknown) => {
        if (data !== undefined) {
            console.log(`[SSE][Search req=${requestId}] ${message}`, data);
            return;
        }
        console.log(`[SSE][Search req=${requestId}] ${message}`);
    };

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            traceSearch(0, 'query empty -> clear search state');
            setSearchResult(null);
            setSearchError(null);
            setSearchLoading(false);
            setIsOpen(false);
            return;
        }

        let cancelled = false;
        const requestId = ++searchReqIdRef.current;
        const requestedAt = performance.now();
        traceSearch(requestId, 'query changed -> debounce scheduled', { query: trimmed });

        const handle = window.setTimeout(async () => {
            traceSearch(requestId, 'debounce fired -> start request');
            try {
                setSearchLoading(true);
                setSearchError(null);
                setSearchStatusLines(['Thinking...']);
                const payload = await historyAPI.searchPayrollHistory(trimmed, 5, (status, meta) => {
                    if (cancelled) return;
                    traceSearch(requestId, 'status callback', { status, meta });
                    const next = formatStatusLabel(status, meta);
                    setSearchStatusLines((prev) => {
                        if (status === 'start') {
                            traceSearch(requestId, 'status lines reset', { next });
                            return [next];
                        }
                        if (prev[prev.length - 1] === next) return prev;
                        const updated = [...prev, next];
                        traceSearch(requestId, 'status lines append', {
                            previousCount: prev.length,
                            nextCount: updated.length,
                            line: next,
                        });
                        return updated;
                    });
                });
                if (cancelled) return;
                traceSearch(requestId, 'request resolved', {
                    elapsedMs: (performance.now() - requestedAt).toFixed(1),
                    payloadType: Array.isArray(payload) ? 'array' : typeof payload,
                });
                setSearchResult(normalizeSearchResponse(payload));
            } catch (err) {
                if (cancelled) return;
                traceSearch(requestId, 'request failed', err);
                setSearchError(err instanceof Error ? err.message : 'Search failed');
                setSearchResult(null);
            } finally {
                if (!cancelled) {
                    traceSearch(requestId, 'request finished');
                    setSearchLoading(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
            traceSearch(requestId, 'effect cleanup -> request cancelled');
        };
    }, [query]);

    useEffect(() => {
        console.log('[SSE][Search] status lines state changed', {
            count: searchStatusLines.length,
            lines: searchStatusLines,
        });
    }, [searchStatusLines]);


    useEffect(() => {
        if (!isOpen) return;
        const updatePosition = () => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return;
            const left = rect.left;
            const rightEdge = window.innerWidth - 24;
            const width = Math.max(320, Math.round((rightEdge - left) * 0.8));
            const top = rect.bottom + 8;
            setDropdownStyle({ left, top, width });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (wrapperRef.current?.contains(target)) return;
            if (dropdownRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    const showDropdown = isOpen && Boolean(query.trim());
    const hasResults =
        Boolean(searchResult?.answer) ||
        Boolean(searchResult?.evidence.length) ||
        Boolean(searchResult?.rows?.length) ||
        Boolean(searchResult?.items.length);
    const ragAnswer = toRagAnswer(searchResult?.raw);
    const answerText = ragAnswer?.answer ?? searchResult?.answer ?? null;
return (
        <div className="relative w-full">
            <div ref={wrapperRef} className="flex items-center relative lg:w-xs mx-auto">
                <Icon
                    icon="solar:magnifer-linear"
                    width="18"
                    height="18"
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                />

                <Input
                    placeholder="Ask AI..."
                    className="rounded-xl pl-10"
                    required
                    value={query}
                    onChange={(e) => {
                        const next = e.target.value;
                        setQuery(next);
                        setIsOpen(Boolean(next.trim()));
                    }}
                    onFocus={() => {
                        if (query.trim()) setIsOpen(true);
                    }}
                />
            </div>
            <div
                ref={dropdownRef}
                className={`fixed bg-background rounded-md z-20 shadow-md border border-border ${showDropdown ? 'block' : 'hidden'
                    }`}
                style={{
                    left: dropdownStyle.left,
                    top: dropdownStyle.top,
                    width: dropdownStyle.width,
                }}
            >
                <SimpleBar className="h-[36rem] p-4 custom-scroll">
                    {searchLoading ? (
                        <div className="flex flex-col items-start justify-start h-full text-sm text-muted-foreground space-y-1">
                            {searchStatusLines.length ? (
                                searchStatusLines.map((line, idx) => <div key={`status-${idx}`}>{line}</div>)
                            ) : (
                                <div>Thinking...</div>
                            )}
                        </div>
                    ) : searchError ? (
                        <div className="space-y-3">
                            {searchStatusLines.length > 0 && (
                                <div className="rounded border border-border bg-input/30 p-2 text-sm text-muted-foreground space-y-1">
                                    {searchStatusLines.map((line, idx) => (
                                        <div key={`status-${idx}`}>{line}</div>
                                    ))}
                                </div>
                            )}
                            <div className="p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
                                {searchError}
                            </div>
                        </div>
                    ) : searchResult ? (
                        <div className="space-y-4">
                            {searchStatusLines.length > 0 && (
                                <div className="rounded border border-border bg-input/30 p-2 text-sm text-muted-foreground space-y-1">
                                    {searchStatusLines.map((line, idx) => (
                                        <div key={`status-${idx}`}>{line}</div>
                                    ))}
                                </div>
                            )}
                            {ragAnswer ? (
                                <div className="space-y-3 rounded-md border border-border bg-input/20 p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h5 className="text-sm font-semibold text-foreground">Answer</h5>
                                        {formatConfidence(ragAnswer.confidence) && (
                                            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                Confidence {formatConfidence(ragAnswer.confidence)}
                                            </Badge>
                                        )}
                                        {ragAnswer.model && (
                                            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                {ragAnswer.model}
                                            </Badge>
                                        )}
                                        {ragAnswer.route && (
                                            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                {ragAnswer.route ?? ragAnswer.tool ?? '-'}
                                            </Badge>
                                        )}
                                        {ragAnswer.top_k && (
                                            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                {ragAnswer.top_k ? `${ragAnswer.top_k}` : '='}
                                            </Badge>
                                        )}
                                        {ragAnswer.sql && (
                                            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                {ragAnswer.sql}
                                            </Badge>
                                        )}
                                    </div>
                                    {ragAnswer.answer && (
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{ragAnswer.answer}</p>
                                    )}
                                    {ragAnswer.reasoning_summary && (
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            {(Array.isArray(ragAnswer.reasoning_summary)
                                                ? ragAnswer.reasoning_summary
                                                : [ragAnswer.reasoning_summary]
                                            ).map((line, idx) => (
                                                <p key={`reason-${idx}`}>{line}</p>
                                            ))}
                                        </div>
                                    )}
                                    {ragAnswer.model_reasoning_summary && (
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p className="text-xs font-semibold text-foreground">Model Reasoning</p>
                                            {(Array.isArray(ragAnswer.model_reasoning_summary)
                                                ? ragAnswer.model_reasoning_summary
                                                : [ragAnswer.model_reasoning_summary]
                                            ).map((line, idx) => (
                                                <p key={`model-reason-${idx}`}>{line}</p>
                                            ))}
                                        </div>
                                    )}
                                    {ragAnswer.limitations && (
                                        <p className="text-xs text-muted-foreground italic">{ragAnswer.limitations}</p>
                                    )}
                                    {ragAnswer.citations && ragAnswer.citations.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Citations: {ragAnswer.citations.join(', ')}
                                        </p>
                                    )}
                                </div>
                            ) : (searchResult.answer || searchResult.evidence.length > 0) ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-semibold text-foreground">Answer</h5>
                                        {searchResult.mode && (
                                            <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                {toTitleCase(searchResult.mode)}
                                            </Badge>
                                        )}
                                    </div>
                                    {searchResult.answer && (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{searchResult.answer}</p>
                                    )}
                                    {searchResult.evidence.length > 0 && (
                                        <div className="flex flex-col gap-2 text-sm">
                                            {searchResult.evidence.map((item) => (
                                                <div
                                                    key={`${item.label}-${item.value}`}
                                                    className="flex items-center justify-between rounded border border-border bg-input/30 px-3 py-2"
                                                >
                                                    <span className="text-muted-foreground">{item.label}</span>
                                                    <span className="font-medium text-foreground">{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <FeedbackPanel
                                visible={hasResults}
                                query={query}
                                answerText={answerText}
                                ragAnswer={ragAnswer}
                                searchResult={searchResult}
                                statusLines={searchStatusLines}
                            />

                            {searchResult.rows && searchResult.rows.length > 0 && (
                                <div className="space-y-2">
                                    <h5 className="text-sm font-semibold text-foreground">Payroll History</h5>
                                    {searchResult.rows.map((row, index) => {
                                        const viewId = resolveHistoryId(row);
                                        const periodLabel =
                                            row.period_start && row.period_end
                                                ? `${formatDate(row.period_start)} - ${formatDate(row.period_end)}`
                                                : row.period_key
                                                    ? `Period #${row.period_key}`
                                                    : row.pay_day
                                                        ? formatDate(row.pay_day)
                                                        : row.full_name ?? `Payroll Result ${index + 1}`;
                                        const subtitle = row.full_name
                                            ? `Employee: ${row.full_name}`
                                            : row.pay_day
                                                ? `Pay Day: ${formatDate(row.pay_day)}`
                                                : undefined;
                                        const amount = row.total_net ?? row.net ?? row.total_gross ?? row.gross;
                                        const content = (
                                            <div className="p-2 rounded-md bg-input/30 hover:bg-primary/10 transition-colors">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium text-foreground">{periodLabel}</span>
                                                    {amount !== null && amount !== undefined && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatMoney(amount)}
                                                        </span>
                                                    )}
                                                </div>
                                                {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
                                            </div>
                                        );

                                        return viewId ? (
                                            <Link
                                                key={`${viewId}-${index}`}
                                                to={`/app/acc/je/${viewId}`}
                                                onClick={() => setQuery('')}
                                                className="block"
                                            >
                                                {content}
                                            </Link>
                                        ) : (
                                            <div key={`row-${index}`} className="block">
                                                {content}
                                            </div>
                                        );
                                    })}
</div>
                            )}

                            {searchResult.items.length > 0 && !searchResult.rows && (
                                <div className="space-y-2">
                                    <h5 className="text-sm font-semibold text-foreground">Results</h5>
                                    {searchResult.items.map((item, index) => (
                                        <div key={`${item.title}-${index}`} className="p-2 rounded-md bg-input/30">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-foreground">{item.title}</span>
                                                {item.subtitle && (
                                                    <Badge className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                        {item.subtitle}
                                                    </Badge>
                                                )}
                                            </div>
                                            {item.snippet && (
                                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{item.snippet}</p>
                                            )}
                                            {item.url && (
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-600 mt-1 block break-all"
                                                    onClick={() => setQuery('')}
                                                >
                                                    {item.url}
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!hasResults && (
                                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                    No results found.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            Type a question to search.
                        </div>
                    )}
                </SimpleBar>
            </div>
        </div>
    );
}

export default Search;




