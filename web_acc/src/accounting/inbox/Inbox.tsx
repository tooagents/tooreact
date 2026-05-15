import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { formatMoney } from 'src/core/format';
import { inboxAPI } from 'src/accounting/inbox/inbox-api';
import { ledgerPaperStyle } from 'src/accounting/inbox/inbox-journal-entry';
import { AccountRow, jeAPI, JournalEntryLine, JournalEntryRow } from 'src/accounting/je/je-api';

type StreamItem = {
    event: string;
    title: string;
    detail?: string;
    pending?: boolean;
    injectionText?: string;
};

type JournalLineDraft = {
    client_id: string;
    id?: string | null;
    account_id: string;
    line_type: 'debit' | 'credit';
    amount: string;
    description: string;
};

type JournalEntryDraft = {
    entry_date: string;
    memo: string;
    lines: JournalLineDraft[];
};

const pageSize = 10;

const getInjectionItems = (value: string): StreamItem[] => {
    if (value.trim().length === 0) return [];

    const injectedTokens: string[] = [];
    const matches = [...value.matchAll(/\S+/g)];
    const firstNumberMatch = matches.find((match) => /\d/.test(match[0]));
    const firstNumberIndex = firstNumberMatch?.index;

    matches.forEach((match) => {
        const token = match[0];
        const startIndex = match.index ?? 0;
        if (firstNumberIndex !== undefined && startIndex >= firstNumberIndex) return;

        const endIndex = (match.index ?? 0) + token.length;
        const isComplete = endIndex < value.length && /\s/.test(value.charAt(endIndex));
        const hasNumber = /\d/.test(token);

        if (isComplete || hasNumber) {
            injectedTokens.push(token);
        }
    });

    const injectionText =
        firstNumberIndex === undefined
            ? injectedTokens.join(' ')
            : [
                injectedTokens.join(' '),
                value.slice(firstNumberIndex).trimStart(),
            ].filter(Boolean).join(' ');

    return [
        {
            event: 'ai_injection_waiting',
            title: 'AI Injection',
            injectionText,
            pending: true,
        },
    ];
};

const getAccountLabel = (account: AccountRow) => {
    const code = String(account.account_code ?? account.code ?? account.coa_code ?? '').trim();
    const name = String(account.account_name ?? account.name ?? account.title ?? '').trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;
    return String(account.id);
};

const getLineAccountLabel = (line: JournalEntryLine, accountLabelById: Record<string, string>) => {
    const accountCode = String(line.account_code ?? '').trim();
    const accountName = String(line.account_name ?? '').trim();
    const accountLabel = String(line.account_label ?? '').trim();
    const accountId = String(line.account_id ?? '').trim();

    if (accountCode && accountName) return `${accountCode} ${accountName}`;
    if (accountCode) return accountCode;
    if (accountName) return accountName;
    if (accountId && accountLabelById[accountId]) return accountLabelById[accountId];
    return accountLabel || accountId || '-';
};

const getEntryTotal = (entry: JournalEntryRow) => {
    const debitLines = (entry.lines ?? []).filter((line) => String(line.line_type ?? '').toLowerCase() === 'debit');
    const totalLines = debitLines.length > 0 ? debitLines : (entry.lines ?? []);

    return totalLines.reduce((sum, line) => {
        const amount = Number(line.amount ?? 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
};

const getEntryLineTotals = (entry: JournalEntryRow | undefined) => {
    const lines = entry?.lines ?? [];
    const debit = lines.reduce((sum, line) => {
        const amount = Number(line.amount ?? 0);
        return String(line.line_type ?? '').toLowerCase() === 'debit' && Number.isFinite(amount)
            ? sum + amount
            : sum;
    }, 0);
    const credit = lines.reduce((sum, line) => {
        const amount = Number(line.amount ?? 0);
        return String(line.line_type ?? '').toLowerCase() === 'credit' && Number.isFinite(amount)
            ? sum + amount
            : sum;
    }, 0);

    return {
        debit,
        credit,
        difference: debit - credit,
    };
};

const getEntryLabel = (entry: JournalEntryRow) => {
    const entryNo = String(entry.entry_no ?? '').trim();
    return entryNo ? `JE-${entryNo}` : entry.id.slice(0, 8);
};

const getDisplayStatus = (entry: JournalEntryRow) => {
    const status = String(entry.status ?? '').trim();
    if (status) return status;
    const period = String(entry.period_yyyymm ?? '').trim();
    return period || 'entry';
};

const toDraft = (entry: JournalEntryRow): JournalEntryDraft => ({
    entry_date: String(entry.entry_date ?? ''),
    memo: String(entry.memo ?? ''),
    lines: (entry.lines ?? []).map((line, index) => ({
        client_id: line.id ?? `${entry.id}-${index}`,
        id: line.id ?? null,
        account_id: String(line.account_id ?? ''),
        line_type: String(line.line_type ?? 'debit').toLowerCase() === 'credit' ? 'credit' : 'debit',
        amount: String(line.amount ?? ''),
        description: String(line.description ?? ''),
    })),
});

const createBlankLine = (): JournalLineDraft => ({
    client_id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    account_id: '',
    line_type: 'debit',
    amount: '',
    description: '',
});

const getDraftTotals = (draft: JournalEntryDraft | null) => {
    const lines = draft?.lines ?? [];
    const debit = lines.reduce((sum, line) => line.line_type === 'debit' ? sum + (Number(line.amount) || 0) : sum, 0);
    const credit = lines.reduce((sum, line) => line.line_type === 'credit' ? sum + (Number(line.amount) || 0) : sum, 0);
    return {
        debit,
        credit,
        difference: debit - credit,
    };
};

const getEntryIdFromResponse = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const directId = record.journal_entry_id ?? record.journalId ?? record.entry_id;
    if (typeof directId === 'string' && directId.trim()) return directId;

    const nested = record.journal_entry ?? record.journalEntry ?? record.entry ?? record.data;
    if (nested && typeof nested === 'object') {
        const nestedId = (nested as Record<string, unknown>).id;
        if (typeof nestedId === 'string' && nestedId.trim()) return nestedId;
    }

    return null;
};

const Inbox = () => {
    const [entries, setEntries] = useState<JournalEntryRow[]>([]);
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [accountLabelById, setAccountLabelById] = useState<Record<string, string>>({});
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [entryDraft, setEntryDraft] = useState<JournalEntryDraft | null>(null);
    const [isSavingEntry, setIsSavingEntry] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [transactionNote, setTransactionNote] = useState('');
    const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
    const [streamModel, setStreamModel] = useState<string | null>(null);
    const [streamConfidence, setStreamConfidence] = useState<number | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    const refresh = async (preferredEntryId?: string | null): Promise<JournalEntryRow[]> => {
        setLoading(true);
        setError(null);
        try {
            const [existingEntries, accountRows] = await Promise.all([
                jeAPI.listEntries(),
                jeAPI.listAccounts(),
            ]);
            const map: Record<string, string> = {};
            for (const account of accountRows) {
                if (account?.id) map[account.id] = getAccountLabel(account);
            }

            setAccountLabelById(map);
            setAccounts(accountRows);
            setEntries(existingEntries);
            setSelectedEntryId((currentId) => {
                if (preferredEntryId && existingEntries.some((entry) => entry.id === preferredEntryId)) {
                    return preferredEntryId;
                }
                if (currentId && existingEntries.some((entry) => entry.id === currentId)) {
                    return currentId;
                }
                return existingEntries[0]?.id ?? null;
            });
            return existingEntries;
        } catch (e: any) {
            setError(e?.message || 'Failed to load inbox data.');
            setEntries([]);
            setAccounts([]);
            setAccountLabelById({});
            setSelectedEntryId(null);
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    useEffect(() => {
        setPageIndex(0);
    }, [entries.length]);

    const injectionItems = useMemo(() => getInjectionItems(transactionNote), [transactionNote]);
    const previewItems = useMemo<StreamItem[]>(() => {
        if (injectionItems.length === 0) return streamItems;
        return [
            ...injectionItems,
            ...streamItems,
        ];
    }, [injectionItems, streamItems]);

    const formatStreamStatus = (value: string) =>
        value
            .split('_')
            .filter(Boolean)
            .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
            .join(' ');

    const formatTransactionSummary = (meta: Record<string, unknown>) => {
        const transactions = Array.isArray(meta.transactions) ? meta.transactions : [];
        const firstTransaction = transactions.find((row): row is Record<string, unknown> =>
            row !== null && typeof row === 'object',
        );
        const confidence =
            typeof meta.confidence_score === 'number'
                ? `Confidence: ${Math.round(meta.confidence_score * 100)}%`
                : '';

        if (!firstTransaction) return confidence;

        const description = String(firstTransaction.description || 'Transaction');
        const txnDate = String(firstTransaction.txn_date || '-');
        const amount = String(firstTransaction.amount || '0');
        const currency = String(firstTransaction.currency || '');
        return [
            `${description}.`,
            `Date: ${txnDate}`,
            `Amount: ${currency ? `${currency} ` : ''}${amount}`,
            confidence,
        ].filter(Boolean).join(' | ');
    };

    const formatStreamItem = (status: string, meta: Record<string, unknown>): StreamItem | null => {
        if (status === 'start' || status === 'interpreting_transaction') return null;
        if (status === 'validating_note' || status === 'import_summary') return null;

        if (status === 'calling_ai_model') {
            const model = typeof meta.model === 'string' ? meta.model : '';
            return {
                event: status,
                title: 'Calling Ai Model (ok)',
                detail: model ? `Model: ${model}` : undefined,
            };
        }

        if (status === 'understanding_transaction' || status === 'ai_interpretation_ready') {
            return {
                event: status,
                title: 'Understanding Transaction',
                detail: formatTransactionSummary(meta) || 'AI returned a standard accounting description.',
            };
        }

        if (status === 'transactions_found') {
            return {
                event: status,
                title: `Transactions Found: ${String(meta.count ?? 0)}`,
            };
        }

        if (status === 'saving_inbox') {
            return {
                event: status,
                title: 'Saving Inbox',
            };
        }

        return {
            event: status,
            title: formatStreamStatus(status),
        };
    };

    const handleTransactionNoteChange = (value: string) => {
        setTransactionNote(value);
        if (isStreaming) return;
        setMsg(null);
        setStreamItems([]);
        setStreamModel(null);
        setStreamConfidence(null);
    };

    const addTypedTransaction = async () => {
        const note = transactionNote.trim();
        if (!note) return;
        setError(null);
        setMsg(null);
        setStreamItems([]);
        setStreamModel(null);
        setStreamConfidence(null);
        setIsStreaming(true);

        const previousEntryIds = new Set(entries.map((entry) => entry.id));

        try {
            const addResponse = await inboxAPI.addToInboxStream(note, (event, data) => {
                if (event === 'status') {
                    const status = String(data.status || 'Working');
                    const meta = data.meta && typeof data.meta === 'object'
                        ? data.meta as Record<string, unknown>
                        : {};
                    if (typeof meta.model === 'string') setStreamModel(meta.model);
                    if (typeof meta.confidence_score === 'number') setStreamConfidence(meta.confidence_score);
                    const item = formatStreamItem(status, meta);
                    if (item) setStreamItems((prev) => [...prev, item]);
                    return;
                }

                if (event === 'final') {
                    const response = data.response && typeof data.response === 'object'
                        ? data.response as Record<string, unknown>
                        : {};
                    if (typeof response.model === 'string') setStreamModel(response.model);
                    if (typeof response.confidence_score === 'number') {
                        setStreamConfidence(response.confidence_score);
                    }
                    const confidence = typeof response.confidence_score === 'number'
                        ? `Confidence: ${Math.round(response.confidence_score * 100)}%`
                        : undefined;
                    setStreamItems((prev) => [
                        ...prev,
                        { event: 'inbox_updated', title: 'Inbox updated:', detail: confidence },
                    ]);
                    return;
                }

                setStreamItems((prev) => [...prev, { event, title: formatStreamStatus(event) }]);
            });

            setTransactionNote('');
            const responseEntryId = getEntryIdFromResponse(addResponse);
            const refreshedEntries = await refresh(responseEntryId);
            const newEntry = refreshedEntries.find((entry) => !previousEntryIds.has(entry.id));
            const selectedId = responseEntryId ?? newEntry?.id ?? refreshedEntries[0]?.id ?? null;
            setSelectedEntryId(selectedId);
            setMsg(`Added to inbox: ${note}`);
        } catch (e: any) {
            setError(e?.message || 'Failed to add transaction note.');
        } finally {
            setIsStreaming(false);
        }
    };

    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    const pageData = useMemo(
        () => entries.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [entries, pageIndex],
    );
    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    const selectedEntry = useMemo(
        () => entries.find((entry) => entry.id === selectedEntryId) ?? entries[0],
        [selectedEntryId, entries],
    );

    const isEditingSelectedEntry = Boolean(selectedEntry && editingEntryId === selectedEntry.id && entryDraft);
    const selectedEntryTotals = getEntryLineTotals(selectedEntry);
    const draftTotals = getDraftTotals(entryDraft);
    const isDraftBalanced = entryDraft !== null &&
        entryDraft.lines.length > 0 &&
        Math.abs(draftTotals.difference) < 0.005 &&
        draftTotals.debit > 0 &&
        draftTotals.credit > 0;
    const isDraftComplete = entryDraft !== null &&
        entryDraft.lines.every((line) =>
            line.account_id &&
            line.line_type &&
            Number(line.amount) > 0,
        );

    const startEditingEntry = (entry: JournalEntryRow) => {
        setEditingEntryId(entry.id);
        setEntryDraft(toDraft(entry));
        setSelectedEntryId(entry.id);
        setError(null);
        setMsg(null);
    };

    const cancelEditingEntry = () => {
        setEditingEntryId(null);
        setEntryDraft(null);
    };

    const updateDraftHeader = (field: keyof Omit<JournalEntryDraft, 'lines'>, value: string) => {
        setEntryDraft((current) => current ? { ...current, [field]: value } : current);
    };

    const updateDraftLine = (clientId: string, updates: Partial<JournalLineDraft>) => {
        setEntryDraft((current) => current
            ? {
                ...current,
                lines: current.lines.map((line) =>
                    line.client_id === clientId ? { ...line, ...updates } : line,
                ),
            }
            : current,
        );
    };

    const addDraftLine = () => {
        setEntryDraft((current) => current
            ? { ...current, lines: [...current.lines, createBlankLine()] }
            : current,
        );
    };

    const removeDraftLine = (clientId: string) => {
        setEntryDraft((current) => current
            ? { ...current, lines: current.lines.filter((line) => line.client_id !== clientId) }
            : current,
        );
    };

    const saveEntryDraft = async () => {
        if (!selectedEntry || !entryDraft || !isDraftBalanced || !isDraftComplete) return;

        setIsSavingEntry(true);
        setError(null);
        setMsg(null);
        try {
            const savedEntry = await jeAPI.updateEntry(selectedEntry.id, {
                entry_date: entryDraft.entry_date,
                memo: entryDraft.memo,
                lines: entryDraft.lines.map((line) => ({
                    id: line.id || null,
                    account_id: line.account_id,
                    line_type: line.line_type,
                    amount: Number(line.amount),
                    description: line.description || null,
                })),
            });
            setEntries((current) => current.map((entry) => entry.id === savedEntry.id ? savedEntry : entry));
            setSelectedEntryId(savedEntry.id);
            setEditingEntryId(null);
            setEntryDraft(null);
            setMsg('Inbox transaction saved.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save inbox transaction.');
        } finally {
            setIsSavingEntry(false);
        }
    };

    return (
        <>
            <div className="flex gap-6 flex-col">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div>
                        <div className="rounded-md border border-secondary/20 bg-muted/20 p-3">
                            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
                                <Icon icon="mdi:message-text-outline" className="h-4 w-4 text-muted-foreground" />
                                <input
                                    className="h-10 w-full bg-transparent text-sm outline-none"
                                    value={transactionNote}
                                    onChange={(e) => handleTransactionNoteChange(e.target.value)}
                                    placeholder='Type transaction (e.g. "Uber 23 yesterday")'
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                            <Button
                                className="h-9 px-5 rounded-full shadow-sm"
                                onClick={addTypedTransaction}
                                disabled={!transactionNote.trim() || isStreaming}
                            >
                                <Icon icon="mdi:plus-circle-outline" className="h-4 w-4" />
                                {isStreaming ? 'Adding...' : 'Add to Inbox'}
                            </Button>
                        </div>
                        {msg ? <p className="mt-3 text-sm text-muted-foreground">{msg}</p> : null}
                        {error ? <p className="mt-3 text-sm text-red-600">Error: {error}</p> : null}
                    </div>

                    <div className="h-full min-w-0 max-w-full overflow-hidden">
                        <div className="flex h-full min-h-28 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-dashed border-secondary/30 bg-background px-4 py-3 text-xs text-muted-foreground shadow-sm">
                            {previewItems.length > 0 || isStreaming ? (
                                <div className="flex min-h-0 flex-1 flex-col gap-3">
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <span className="max-w-full rounded-full border border-secondary/20 bg-muted/40 px-2 py-1 font-medium text-foreground">
                                            AI stream
                                        </span>
                                        {streamModel ? (
                                            <span className="max-w-full truncate rounded-full border border-secondary/20 px-2 py-1">
                                                Model: {streamModel}
                                            </span>
                                        ) : null}
                                        {streamConfidence !== null ? (
                                            <span className="max-w-full rounded-full border border-secondary/20 px-2 py-1">
                                                Confidence: {Math.round(streamConfidence * 100)}%
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                        {previewItems.map((item, index) => (
                                            <div key={`${item.event}-${index}`} className="flex min-w-0 gap-2">
                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/80" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-center gap-1.5 break-words text-foreground">
                                                        <span className="font-medium">
                                                            {item.title}{item.injectionText ? ':' : ''}
                                                        </span>
                                                        {item.injectionText ? (
                                                            <span className="font-normal">{item.injectionText}</span>
                                                        ) : null}
                                                        {item.detail ? (
                                                            <span className="font-normal text-muted-foreground">{item.detail}</span>
                                                        ) : null}
                                                        {item.pending ? (
                                                            <span className="flex items-center gap-0.5 text-primary" aria-label="Waiting for typing">
                                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                                                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                                                            </span>
                                                        ) : null}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {isStreaming ? (
                                        <div className="flex shrink-0 items-center gap-2 border-t border-secondary/10 pt-2 text-muted-foreground">
                                            <Icon icon="mdi:loading" className="h-4 w-4 animate-spin text-primary" />
                                            <span>Thinking...</span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    <p className="font-medium text-foreground">AI understands natural transaction notes.</p>
                                    <p className="mt-2">Just type normally:</p>
                                    <div className="mt-1 space-y-1">
                                        <p>"paid rent"</p>
                                        <p>"coffee with sam"</p>
                                        <p>"uber after airport"</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-[#2b2f38]">Inbox Transactions</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto border-t border-[#d8c6a1]">
                                <Table>
                                    <THeader>
                                        <TRow className="border-b border-[#d8c6a1]">
                                            <THead className="min-w-28 px-3 text-[#1f3a67]">Transaction Date</THead>
                                            <THead className="min-w-56 px-3 text-[#1f3a67]">Description</THead>
                                            <THead className="min-w-28 px-3 text-right text-[#1f3a67]">Amount</THead>
                                            <THead className="min-w-24 px-3 text-[#1f3a67]">Status</THead>
                                            <THead className="min-w-20 px-3 text-right text-[#1f3a67]">Action</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {pageData.map((entry) => {
                                            const isSelected = entry.id === selectedEntry?.id;
                                            const isEditing = editingEntryId === entry.id;

                                            return (
                                                <TRow
                                                    key={entry.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-selected={isSelected}
                                                    className={[
                                                        'cursor-pointer border-b border-[#d8c6a1]/70 transition-colors last:border-b-0 hover:bg-[#efe4c7]',
                                                        isSelected ? 'bg-[#efe4c7] shadow-[inset_3px_0_0_#1f3a67]' : '',
                                                    ].filter(Boolean).join(' ')}
                                                    onClick={() => {
                                                        setSelectedEntryId(entry.id);
                                                        if (entry.id !== editingEntryId) cancelEditingEntry();
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault();
                                                            setSelectedEntryId(entry.id);
                                                            if (entry.id !== editingEntryId) cancelEditingEntry();
                                                        }
                                                    }}
                                                >
                                                    <TCell className="px-3 py-3 text-sm font-semibold text-[#1f2f4a]">
                                                        {entry.entry_date || '-'}
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-sm text-[#1f2f4a]">
                                                        <div className="line-clamp-2">{entry.memo || 'No description'}</div>
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-right text-sm font-mono tabular-nums text-[#1f2f4a]">
                                                        {formatMoney(getEntryTotal(entry))}
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-sm text-[#506080]">
                                                        {getDisplayStatus(entry)}
                                                    </TCell>
                                                    <TCell className="px-3 py-3 text-right text-sm text-[#1f2f4a]">
                                                        <button
                                                            type="button"
                                                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#1f3a67] hover:bg-[#efe4c7] disabled:pointer-events-none disabled:opacity-50"
                                                            disabled={isSavingEntry}
                                                            aria-label={isEditing ? 'Save inbox transaction' : 'Edit inbox transaction'}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                if (isEditing) {
                                                                    void saveEntryDraft();
                                                                    return;
                                                                }
                                                                startEditingEntry(entry);
                                                            }}
                                                        >
                                                            <Icon
                                                                icon={isSavingEntry && isEditing ? 'mdi:loading' : isEditing ? 'mdi:check' : 'solar:pen-new-square-broken'}
                                                                height={16}
                                                                className={isSavingEntry && isEditing ? 'animate-spin' : undefined}
                                                            />
                                                        </button>
                                                    </TCell>
                                                </TRow>
                                            );
                                        })}
                                        {loading ? (
                                            <TRow>
                                                <TCell className="px-3 py-4 text-sm text-[#596986]" colSpan={5}>
                                                    Loading inbox transactions...
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                        {!loading && entries.length === 0 ? (
                                            <TRow>
                                                <TCell className="px-3 py-4 text-sm text-[#596986]" colSpan={5}>
                                                    No inbox transactions yet.
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>
                            {entries.length > 0 ? (
                                <div className="flex flex-col gap-4 p-4">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Button
                                                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                                disabled={!canPrev}
                                                variant="secondary"
                                                className="flex-1 sm:flex-none text-xs sm:text-sm"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                                disabled={!canNext}
                                                className="flex-1 sm:flex-none text-xs sm:text-sm"
                                            >
                                                Next
                                            </Button>
                                        </div>

                                        <div className="text-forest-black dark:text-white/90 font-medium text-xs sm:text-base whitespace-nowrap">
                                            Page {pageIndex + 1} of {pageCount}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                        <CardHeader className="p-4 pb-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex flex-col gap-1">
                                    <CardTitle className="text-base text-[#2b2f38]">Journal Entry</CardTitle>
                                    <p className="text-xs text-[#506080]">
                                        Review the selected ledger entry before posting changes.
                                    </p>
                                </div>
                                {selectedEntry ? (
                                    <div className="flex shrink-0 items-center gap-2">
                                        {isEditingSelectedEntry ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-9 rounded-full px-4"
                                                    onClick={cancelEditingEntry}
                                                    disabled={isSavingEntry}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="button"
                                                    className="h-9 rounded-full px-4"
                                                    onClick={saveEntryDraft}
                                                    disabled={isSavingEntry || !isDraftBalanced || !isDraftComplete}
                                                >
                                                    {isSavingEntry ? (
                                                        <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
                                                    )}
                                                    Save
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                className="h-9 rounded-full px-4"
                                                onClick={() => startEditingEntry(selectedEntry)}
                                            >
                                                <Icon icon="solar:pen-new-square-broken" className="h-4 w-4" />
                                                Edit
                                            </Button>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 pt-0 flex flex-col gap-3">
                            {selectedEntry ? (
                                <Card
                                    className="shadow-none border-[#d8c6a1] rounded-md overflow-hidden"
                                    style={ledgerPaperStyle}
                                >
                                    <CardContent className="p-4 flex flex-col gap-6">
                                        <div>
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            {isEditingSelectedEntry && entryDraft ? (
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[#1f3a67]">
                                                            {getEntryLabel(selectedEntry)}
                                                        </span>
                                                        <Badge className="border-[#d8c6a1] bg-[#fdf8ec] px-2 py-0.5 text-[#335376]">
                                                            {getDisplayStatus(selectedEntry)}
                                                        </Badge>
                                                    </div>
                                                    <Input
                                                        className="mt-1.5 h-7 max-w-full border-[#d8c6a1] bg-[#fdf8ec] px-2 text-sm font-semibold text-[#172033]"
                                                        value={entryDraft.memo}
                                                        onChange={(event) => updateDraftHeader('memo', event.target.value)}
                                                        placeholder="Memo"
                                                        disabled={isSavingEntry}
                                                    />
                                                    <Input
                                                        type="date"
                                                        className="mt-1 h-7 w-[135px] border-[#d8c6a1] bg-[#fdf8ec] px-2 text-xs text-[#506080]"
                                                        value={entryDraft.entry_date}
                                                        onChange={(event) => updateDraftHeader('entry_date', event.target.value)}
                                                        disabled={isSavingEntry}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[#1f3a67]">
                                                            {getEntryLabel(selectedEntry)}
                                                        </span>
                                                        <Badge className="border-[#d8c6a1] bg-[#fdf8ec] px-2 py-0.5 text-[#335376]">
                                                            {getDisplayStatus(selectedEntry)}
                                                        </Badge>
                                                    </div>
                                                    <div className="mt-2 text-sm font-semibold text-[#172033]">
                                                        {selectedEntry.memo || 'No memo'}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#506080]">
                                                        <span>{selectedEntry.entry_date || '-'}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2 lg:min-w-[300px]">
                                                <div className="rounded-md border border-[#d8c6a1] bg-[#fdf8ec]/80 px-3 py-2">
                                                    <div className="text-[11px] font-medium uppercase text-[#506080]">Debit</div>
                                                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#172033]">
                                                        {formatMoney(isEditingSelectedEntry ? draftTotals.debit : selectedEntryTotals.debit)}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-[#d8c6a1] bg-[#fdf8ec]/80 px-3 py-2">
                                                    <div className="text-[11px] font-medium uppercase text-[#506080]">Credit</div>
                                                    <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#172033]">
                                                        {formatMoney(isEditingSelectedEntry ? draftTotals.credit : selectedEntryTotals.credit)}
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-[#d8c6a1] bg-[#fdf8ec]/80 px-3 py-2">
                                                    <div className="text-[11px] font-medium uppercase text-[#506080]">Diff</div>
                                                    <div className={`mt-1 font-mono text-sm font-semibold tabular-nums ${Math.abs((isEditingSelectedEntry ? draftTotals : selectedEntryTotals).difference) < 0.005 ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                                                        {formatMoney(isEditingSelectedEntry ? draftTotals.difference : selectedEntryTotals.difference)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                        <div className="overflow-x-auto border rounded-md border-[#9eb8dc]/70 bg-[#fdf8ec]/70">
                                        <Table>
                                            <THeader>
                                                <TRow className="border-b border-[#6fa0d8]/60 bg-[#fdf8ec]/70">
                                                    <THead className="min-w-24 px-4 text-xs uppercase text-[#1f3a67]">Type</THead>
                                                    <THead className="min-w-48 px-3 text-xs uppercase text-[#1f3a67]">Account</THead>
                                                    <THead className="min-w-28 px-3 text-right text-xs uppercase text-[#1f3a67]">Debit</THead>
                                                    <THead className="min-w-28 px-4 text-right text-xs uppercase text-[#1f3a67]">Credit</THead>
                                                </TRow>
                                            </THeader>
                                            <TBody>
                                                {isEditingSelectedEntry && entryDraft ? (
                                                    entryDraft.lines.map((line) => (
                                                        <TRow key={line.client_id} className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]">
                                                            <TCell className="px-4 py-3 text-sm">
                                                                <div className="flex items-center gap-1">
                                                                    <Select
                                                                        value={line.line_type}
                                                                        onValueChange={(value) => updateDraftLine(line.client_id, {
                                                                            line_type: value === 'credit' ? 'credit' : 'debit',
                                                                        })}
                                                                        disabled={isSavingEntry}
                                                                    >
                                                                        <SelectTrigger className={`h-7 w-[72px] rounded-full border-0 px-2 text-xs font-medium shadow-none focus:ring-1 focus:ring-[#b7c7df] ${line.line_type === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="text-xs">
                                                                            <SelectItem className="py-1 text-xs" value="debit">Debit</SelectItem>
                                                                            <SelectItem className="py-1 text-xs" value="credit">Credit</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#94a3b8] hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
                                                                        onClick={() => removeDraftLine(line.client_id)}
                                                                        disabled={isSavingEntry || entryDraft.lines.length <= 1}
                                                                        aria-label="Remove journal line"
                                                                    >
                                                                        <Icon icon="mdi:trash-can-outline" height={16} />
                                                                    </button>
                                                                </div>
                                                            </TCell>
                                                            <TCell className="px-3 py-3">
                                                                <Select
                                                                    value={line.account_id || undefined}
                                                                    onValueChange={(value) => updateDraftLine(line.client_id, { account_id: value })}
                                                                    disabled={isSavingEntry}
                                                                >
                                                                <SelectTrigger className="h-8 min-w-48 border-0 bg-transparent px-0 text-sm font-medium text-[#172033] shadow-none focus:ring-1 focus:ring-[#b7c7df]">
                                                                        <SelectValue placeholder="Account" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="text-xs">
                                                                        {accounts.map((account) => (
                                                                            <SelectItem className="py-1 text-xs" key={account.id} value={account.id}>
                                                                                {getAccountLabel(account)}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TCell>
                                                            <TCell className="px-3 py-3 text-right">
                                                                {line.line_type === 'debit' ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="ml-auto h-8 w-[112px] border-0 bg-transparent px-0 text-right font-mono text-sm tabular-nums text-[#172033] shadow-none focus-visible:ring-1 focus-visible:ring-[#b7c7df]"
                                                                        value={line.amount}
                                                                        onChange={(event) => updateDraftLine(line.client_id, { amount: event.target.value })}
                                                                        disabled={isSavingEntry}
                                                                    />
                                                                ) : (
                                                                    <span className="font-mono text-sm tabular-nums text-[#94a3b8]">-</span>
                                                                )}
                                                            </TCell>
                                                            <TCell className="px-4 py-3 text-right">
                                                                {line.line_type === 'credit' ? (
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="ml-auto h-8 w-[112px] border-0 bg-transparent px-0 text-right font-mono text-sm tabular-nums text-[#172033] shadow-none focus-visible:ring-1 focus-visible:ring-[#b7c7df]"
                                                                        value={line.amount}
                                                                        onChange={(event) => updateDraftLine(line.client_id, { amount: event.target.value })}
                                                                        disabled={isSavingEntry}
                                                                    />
                                                                ) : (
                                                                    <span className="font-mono text-sm tabular-nums text-[#94a3b8]">-</span>
                                                                )}
                                                            </TCell>
                                                        </TRow>
                                                    ))
                                                ) : (
                                                    (selectedEntry.lines ?? []).map((line, index) => {
                                                        const lineType = String(line.line_type ?? '').toLowerCase();
                                                        const amount = formatMoney(line.amount ?? 0);

                                                        return (
                                                            <TRow
                                                                key={line.id ?? `${selectedEntry.id}-${index}`}
                                                                className="border-b border-[#e2e8f0] last:border-b-0 hover:bg-[#f8fafc]"
                                                            >
                                                                <TCell className="px-4 py-3 text-sm">
                                                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${lineType === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                        {line.line_type || '-'}
                                                                    </span>
                                                                </TCell>
                                                                <TCell className="px-3 py-3 text-sm font-medium text-[#172033]">
                                                                    {getLineAccountLabel(line, accountLabelById)}
                                                                </TCell>
                                                                <TCell className="px-3 py-3 text-right text-sm font-mono tabular-nums text-[#172033]">
                                                                    {lineType === 'debit' ? amount : '-'}
                                                                </TCell>
                                                                <TCell className="px-4 py-3 text-right text-sm font-mono tabular-nums text-[#172033]">
                                                                    {lineType === 'credit' ? amount : '-'}
                                                                </TCell>
                                                            </TRow>
                                                        );
                                                    })
                                                )}
                                                {(!isEditingSelectedEntry && (selectedEntry.lines ?? []).length === 0) ||
                                                (isEditingSelectedEntry && entryDraft && entryDraft.lines.length === 0) ? (
                                                    <TRow>
                                                        <TCell className="px-4 py-4 text-sm text-[#64748b]" colSpan={4}>
                                                            No lines found.
                                                        </TCell>
                                                    </TRow>
                                                ) : null}
                                                {isEditingSelectedEntry && entryDraft ? (
                                                    <TRow className="border-t border-[#dbe4f0] bg-[#f8fafc]">
                                                        <TCell className="px-4 py-2" colSpan={4}>
                                                            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                                                                <span className={isDraftBalanced ? 'text-[#15803d]' : 'text-[#dc2626]'}>
                                                                    {isDraftBalanced ? 'Entry is balanced.' : 'Debit and credit totals must match before saving.'}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="h-7 rounded-full border-[#b7c7df] px-3 text-xs text-[#1f3a67]"
                                                                    onClick={addDraftLine}
                                                                    disabled={isSavingEntry}
                                                                >
                                                                    <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
                                                                    Add line
                                                                </Button>
                                                            </div>
                                                        </TCell>
                                                    </TRow>
                                                ) : null}
                                            </TBody>
                                        </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="flex min-h-[180px] items-center justify-center text-sm font-medium text-muted-foreground">
                                    Select an inbox transaction.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default Inbox;
