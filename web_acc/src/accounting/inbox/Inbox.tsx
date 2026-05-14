import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Icon } from '@iconify/react/dist/iconify.js';
import { formatMoney } from 'src/core/format';
import { inboxAPI, TxRow } from 'src/accounting/inbox/inbox-api';
import InboxJournalEntryPanel from 'src/accounting/inbox/InboxJournalEntryPanel';
import { getTransactionJournalId } from 'src/accounting/inbox/inbox-journal-entry';

type StreamItem = {
    event: string;
    title: string;
    detail?: string;
    pending?: boolean;
    injectionText?: string;
};

type TransactionDraft = {
    txn_date: string;
    description: string;
    amount: string;
    status: string;
};

type TransactionField = keyof TransactionDraft;

const pageSize = 10;
const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'mapped', label: 'Mapped' },
    { value: 'needs_review', label: 'Review' },
    { value: 'posted', label: 'Posted' },
];

const normalizeTransactionStatus = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'review') return 'needs_review';
    return normalized;
};

const formatTransactionStatus = (value: string) => {
    const normalized = normalizeTransactionStatus(value);
    const option = statusOptions.find((status) => status.value === normalized);
    return option?.label || value || '-';
};

const transactionFields: TransactionField[] = ['txn_date', 'description', 'amount', 'status'];

const areTransactionValuesEqual = (field: TransactionField, nextValue: string, currentValue: unknown) => {
    if (field === 'amount') {
        const nextAmount = Number(nextValue);
        const currentAmount = Number(currentValue ?? 0);
        return Number.isFinite(nextAmount) && Number.isFinite(currentAmount) && nextAmount === currentAmount;
    }

    if (field === 'status') {
        return normalizeTransactionStatus(nextValue) === normalizeTransactionStatus(String(currentValue ?? ''));
    }

    return nextValue.trim() === String(currentValue ?? '').trim();
};

const toTransactionUpdateValue = (field: TransactionField, value: string) => {
    if (field === 'amount') return Number(value) || 0;
    if (field === 'status') return normalizeTransactionStatus(value);
    return value.trim();
};

const getResponseTransactions = (response: Record<string, unknown>): TxRow[] => {
    const rows = Array.isArray(response.transactions) ? response.transactions : [];
    return rows.filter((row): row is TxRow =>
        row !== null &&
        typeof row === 'object' &&
        typeof (row as TxRow).id === 'string',
    );
};

const mergeTransactionsWithEntries = (
    transactions: TxRow[],
    entries: { transaction: TxRow; entry: Awaited<ReturnType<typeof inboxAPI.generateJournalEntry>> }[],
) =>
    transactions.map((transaction) => {
        const generated = entries.find((item) => item.transaction.id === transaction.id);
        return generated
            ? {
                ...transaction,
                status: 'posted',
                journal_id: generated.entry.id,
                journal_entry: generated.entry,
            }
            : transaction;
    });

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

const Inbox = () => {
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [editingRows, setEditingRows] = useState<Record<string, boolean>>({});
    const [transactionDrafts, setTransactionDrafts] = useState<Record<string, TransactionDraft>>({});
    const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [transactionNote, setTransactionNote] = useState('');
    const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
    const [streamModel, setStreamModel] = useState<string | null>(null);
    const [streamConfidence, setStreamConfidence] = useState<number | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

    const toTransactionDraft = (row: TxRow): TransactionDraft => ({
        txn_date: row.txn_date || '',
        description: row.description || '',
        amount: String(row.amount ?? ''),
        status: row.status || '',
    });

    const refresh = async (): Promise<TxRow[]> => {
        setLoading(true);
        setError(null);
        try {
            const tx = await inboxAPI.listTransactions();
            setTransactions((prev) =>
                tx.map((transaction) => {
                    const existing = prev.find((row) => row.id === transaction.id);
                    return existing?.journal_entry
                        ? {
                            ...transaction,
                            journal_id: transaction.journal_id ?? existing.journal_id,
                            journal_entry: existing.journal_entry,
                        }
                        : transaction;
                }),
            );
            return tx;
        } catch (e: any) {
            setError(e?.message || 'Failed to load inbox data.');
            return [];
        } finally {
            setLoading(false);
        }
    };

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

            const addedTransactions = getResponseTransactions(addResponse);
            const generatedResults = addedTransactions.length > 0
                ? await Promise.allSettled(
                    addedTransactions.map(async (transaction) => ({
                        transaction,
                        entry: await inboxAPI.generateJournalEntry(transaction.id),
                    })),
                )
                : [];
            const generatedEntries = generatedResults
                .filter((result): result is PromiseFulfilledResult<{
                    transaction: TxRow;
                    entry: Awaited<ReturnType<typeof inboxAPI.generateJournalEntry>>;
                }> => result.status === 'fulfilled')
                .map((result) => result.value);
            const failedGenerationCount = generatedResults.filter((result) => result.status === 'rejected').length;

            if (addedTransactions.length > 0) {
                setStreamItems((prev) => [
                    ...prev,
                    {
                        event: 'journal_entries_generated',
                        title: `Journal Entries Generated: ${generatedEntries.length}`,
                        detail: failedGenerationCount > 0 ? `Failed: ${failedGenerationCount}` : undefined,
                    },
                ]);
            }

            if (generatedEntries.length > 0) {
                setTransactions((prev) =>
                    mergeTransactionsWithEntries(prev, generatedEntries),
                );
                setSelectedTransactionId(generatedEntries[0].transaction.id);
            } else if (addedTransactions[0]?.id) {
                setSelectedTransactionId(addedTransactions[0].id);
            }

            setTransactionNote('');
            const refreshedTransactions = await refresh();
            if (generatedEntries.length > 0) {
                setTransactions(mergeTransactionsWithEntries(refreshedTransactions, generatedEntries));
            }
            const generatedOrRecoveredCount = addedTransactions.filter((transaction) =>
                generatedEntries.some((item) => item.transaction.id === transaction.id) ||
                refreshedTransactions.some((row) => row.id === transaction.id && row.journal_id),
            ).length;
            const unresolvedGenerationCount = Math.max(0, addedTransactions.length - generatedOrRecoveredCount);

            setMsg(`Added to inbox: ${note}${generatedOrRecoveredCount > 0 ? ' and generated journal entry.' : ''}`);
            if (unresolvedGenerationCount > 0 && failedGenerationCount > 0) {
                setError(`Added to inbox, but ${unresolvedGenerationCount} journal entr${unresolvedGenerationCount === 1 ? 'y' : 'ies'} failed to generate.`);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to add transaction note.');
        } finally {
            setIsStreaming(false);
        }
    };

    const startEditingTransaction = (row: TxRow) => {
        setMsg(null);
        setEditingRows((prev) => ({ ...prev, [row.id]: true }));
        setTransactionDrafts((prev) => ({
            ...prev,
            [row.id]: prev[row.id] ?? toTransactionDraft(row),
        }));
    };

    const updateTransactionDraft = (rowId: string, field: TransactionField, value: string) => {
        setTransactionDrafts((prev) => ({
            ...prev,
            [rowId]: {
                ...(prev[rowId] ?? { txn_date: '', description: '', amount: '', status: '' }),
                [field]: value,
            },
        }));
    };

    const mergeGeneratedEntry = useCallback((transactionId: string, entry: Awaited<ReturnType<typeof inboxAPI.generateJournalEntry>>) => {
        setTransactions((prev) =>
            prev.map((transaction) =>
                transaction.id === transactionId
                    ? {
                        ...transaction,
                        status: 'posted',
                        journal_id: entry.id,
                        journal_entry: entry,
                    }
                    : transaction,
            ),
        );
    }, []);

    const saveTransactionUpdates = async (
        row: TxRow,
        updates: Partial<TxRow>,
        changedFields: TransactionField[],
    ) => {
        const shouldRegenerateEntry = changedFields.includes('description');
        const shouldReloadSyncedEntry = !shouldRegenerateEntry &&
            (changedFields.includes('amount') || changedFields.includes('txn_date'));

        setSavingRows((prev) => ({ ...prev, [row.id]: true }));
        setTransactions((prev) =>
            prev.map((transaction) =>
                transaction.id === row.id
                    ? { ...transaction, ...updates }
                    : transaction,
            ),
        );
        setError(null);

        try {
            const savedTransaction = await inboxAPI.updateTransaction(row.id, updates);
            setTransactions((prev) =>
                prev.map((transaction) =>
                    transaction.id === row.id
                        ? {
                            ...transaction,
                            ...savedTransaction,
                            journal_entry: shouldRegenerateEntry || shouldReloadSyncedEntry
                                ? undefined
                                : transaction.journal_entry,
                        }
                        : transaction,
                ),
            );
            try {
                if (shouldRegenerateEntry) {
                    const entry = await inboxAPI.generateJournalEntry(row.id, { force: true });
                    mergeGeneratedEntry(row.id, entry);
                    setMsg('Inbox transaction saved and journal entry regenerated.');
                } else if (shouldReloadSyncedEntry) {
                    const journalId = getTransactionJournalId(savedTransaction) ?? getTransactionJournalId(row);
                    if (journalId) {
                        const entry = await inboxAPI.getJournalEntry(journalId);
                        mergeGeneratedEntry(row.id, entry);
                        setMsg('Inbox transaction saved and journal entry updated.');
                    } else {
                        setMsg('Inbox transaction saved.');
                    }
                } else {
                    setMsg('Inbox transaction saved.');
                }
            } catch (entryError: any) {
                setMsg('Inbox transaction saved.');
                setError(entryError?.message || 'Failed to update journal entry.');
            }
            return true;
        } catch (e: any) {
            setError(e?.message || 'Failed to save inbox transaction.');
            setTransactions((prev) =>
                prev.map((transaction) =>
                    transaction.id === row.id
                        ? row
                        : transaction,
                ),
            );
            return false;
        } finally {
            setSavingRows((prev) => ({ ...prev, [row.id]: false }));
        }
    };

    const saveTransactionDraft = async (row: TxRow, field: TransactionField, overrideValue?: string) => {
        const draft = transactionDrafts[row.id];
        if (!draft && overrideValue === undefined) return false;

        const nextValue = (overrideValue ?? draft?.[field] ?? '').trim();
        if (areTransactionValuesEqual(field, nextValue, row[field])) return true;

        return saveTransactionUpdates(row, {
            [field]: toTransactionUpdateValue(field, nextValue),
        }, [field]);
    };

    const saveAllTransactionDrafts = async (row: TxRow) => {
        const draft = transactionDrafts[row.id];
        if (!draft) {
            stopEditingTransaction(row.id);
            return;
        }

        const updates: Partial<TxRow> = {};
        const changedFields = transactionFields.filter((field) => {
            const nextValue = (draft[field] ?? '').trim();
            if (areTransactionValuesEqual(field, nextValue, row[field])) return false;
            updates[field] = toTransactionUpdateValue(field, nextValue) as never;
            return true;
        });

        if (changedFields.length === 0) {
            stopEditingTransaction(row.id);
            return;
        }

        const saved = await saveTransactionUpdates(row, updates, changedFields);
        if (saved) stopEditingTransaction(row.id);
    };

    const stopEditingTransaction = (rowId: string) => {
        setEditingRows((prev) => ({ ...prev, [rowId]: false }));
    };

    const updateTransactionStatus = (row: TxRow, value: string) => {
        updateTransactionDraft(row.id, 'status', value);
        void saveTransactionDraft(row, 'status', value);
    };

    const deleteTransaction = async (row: TxRow) => {
        setError(null);
        setMsg(null);
        setSavingRows((prev) => ({ ...prev, [row.id]: true }));
        setTransactions((prev) => prev.filter((transaction) => transaction.id !== row.id));
        setEditingRows((prev) => ({ ...prev, [row.id]: false }));

        try {
            await inboxAPI.voidTransaction(row.id);
            setMsg('Inbox transaction and journal entry voided.');
            if (selectedTransactionId === row.id) {
                const nextTransaction = transactions.find((transaction) => transaction.id !== row.id);
                setSelectedTransactionId(nextTransaction?.id ?? null);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to void inbox transaction.');
            setTransactions((prev) => [row, ...prev]);
        } finally {
            setSavingRows((prev) => ({ ...prev, [row.id]: false }));
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        setPageIndex(0);
    }, [transactions.length]);

    const pageCount = Math.max(1, Math.ceil(transactions.length / pageSize));
    const pageData = useMemo(
        () => transactions.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [transactions, pageIndex],
    );
    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    useEffect(() => {
        if (transactions.length === 0) {
            setSelectedTransactionId(null);
            return;
        }

        const selectedExists = selectedTransactionId
            ? transactions.some((transaction) => transaction.id === selectedTransactionId)
            : false;

        if (!selectedExists) {
            setSelectedTransactionId(transactions[0].id);
        }
    }, [selectedTransactionId, transactions]);

    const selectedTransaction = useMemo(
        () => transactions.find((transaction) => transaction.id === selectedTransactionId) ?? transactions[0],
        [selectedTransactionId, transactions],
    );

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
                    <Card className="shadow-none border-secondary/20">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">Inbox Transactions</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto border-t border-ld">
                                <Table>
                                    <THeader>
                                        <TRow>
                                            <THead className="min-w-3 px-2">Transaction Date</THead>
                                            <THead className="min-w-3 px-2">Description</THead>
                                            <THead className="min-w-3 px-2 text-right">Amount</THead>
                                            <THead className="min-w-3 px-2">Status</THead>
                                            <THead className="min-w-3 px-2 text-right">Action</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {pageData.map((row) => {
                                            const isEditing = Boolean(editingRows[row.id]);
                                            const isSaving = Boolean(savingRows[row.id]);
                                            const draft = transactionDrafts[row.id] ?? toTransactionDraft(row);
                                            const inputClassName = 'h-9 rounded-md px-2 text-sm';
                                            const isSelected = row.id === selectedTransaction?.id;

                                            return (
                                                <TRow
                                                    key={row.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-selected={isSelected}
                                                    className={[
                                                        'cursor-pointer transition-colors hover:bg-primary/10',
                                                        isSelected ? 'bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]' : '',
                                                    ].filter(Boolean).join(' ')}
                                                    onClick={() => setSelectedTransactionId(row.id)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault();
                                                            setSelectedTransactionId(row.id);
                                                        }
                                                    }}
                                                >
                                                    <TCell className="text-sm px-2 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                type="date"
                                                                className={inputClassName}
                                                                value={draft.txn_date}
                                                                disabled={isSaving}
                                                                onChange={(e) => updateTransactionDraft(row.id, 'txn_date', e.target.value)}
                                                                onBlur={() => saveTransactionDraft(row, 'txn_date')}
                                                            />
                                                        ) : (
                                                            row.txn_date || '-'
                                                        )}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-3">
                                                        {isEditing ? (
                                                            <Input
                                                                className={inputClassName}
                                                                value={draft.description}
                                                                disabled={isSaving}
                                                                onChange={(e) => updateTransactionDraft(row.id, 'description', e.target.value)}
                                                                onBlur={() => saveTransactionDraft(row, 'description')}
                                                            />
                                                        ) : (
                                                            row.description || '-'
                                                        )}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-3 text-right tabular-nums">
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className={`${inputClassName} text-right tabular-nums`}
                                                                value={draft.amount}
                                                                disabled={isSaving}
                                                                onChange={(e) => updateTransactionDraft(row.id, 'amount', e.target.value)}
                                                                onBlur={() => saveTransactionDraft(row, 'amount')}
                                                            />
                                                        ) : (
                                                            formatMoney(row.amount ?? 0)
                                                        )}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-3">
                                                        {isEditing ? (
                                                            <Select
                                                                value={statusOptions.some((status) => status.value === normalizeTransactionStatus(draft.status))
                                                                    ? normalizeTransactionStatus(draft.status)
                                                                    : undefined}
                                                                disabled={isSaving}
                                                                onValueChange={(value) => updateTransactionStatus(row, value)}
                                                            >
                                                                <SelectTrigger className={inputClassName}>
                                                                    <SelectValue placeholder="Select status" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {statusOptions.map((status) => (
                                                                        <SelectItem key={status.value} value={status.value}>
                                                                            {status.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            formatTransactionStatus(row.status || '')
                                                        )}
                                                    </TCell>
                                                    <TCell className="text-sm px-2 py-3 text-right">
                                                        <div className="ml-auto flex justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-lightprimary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                                                                disabled={isSaving}
                                                                aria-label={isSaving ? 'Saving transaction' : isEditing ? 'Save transaction' : 'Edit transaction'}
                                                                onMouseDown={(event) => {
                                                                    if (isEditing) event.preventDefault();
                                                                }}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setSelectedTransactionId(row.id);
                                                                    if (isEditing) {
                                                                        void saveAllTransactionDrafts(row);
                                                                        return;
                                                                    }
                                                                    startEditingTransaction(row);
                                                                }}
                                                            >
                                                                <Icon
                                                                    icon={isSaving ? 'mdi:loading' : isEditing ? 'mdi:check' : 'solar:pen-new-square-broken'}
                                                                    height={18}
                                                                    className={isSaving ? 'animate-spin' : undefined}
                                                                />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                                                                disabled={isSaving}
                                                                aria-label="Void transaction"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    void deleteTransaction(row);
                                                                }}
                                                            >
                                                                <Icon icon="mdi:trash-can-outline" height={18} />
                                                            </button>
                                                        </div>
                                                    </TCell>
                                                </TRow>
                                            );
                                        })}
                                        {loading ? (
                                            <TRow>
                                                <TCell className="text-sm px-2 py-4 text-muted-foreground" colSpan={5}>
                                                    Loading inbox transactions...
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                        {!loading && transactions.length === 0 ? (
                                            <TRow>
                                                <TCell className="text-sm px-2 py-4 text-muted-foreground" colSpan={5}>
                                                    No inbox transactions yet.
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>
                            {transactions.length > 0 ? (
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

                    <InboxJournalEntryPanel transaction={selectedTransaction} onEntryResolved={mergeGeneratedEntry} />
                </div>

            </div>
        </>
    );
};

export default Inbox;
