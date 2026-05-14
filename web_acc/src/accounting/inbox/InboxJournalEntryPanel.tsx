import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { formatMoney } from 'src/core/format';
import { inboxAPI, TxRow } from 'src/accounting/inbox/inbox-api';
import {
    getConfidence,
    getEmbeddedJournalEntry,
    getTransactionJournalId,
    JournalEntryPreview,
    ledgerPaperStyle,
} from 'src/accounting/inbox/inbox-journal-entry';

type InboxJournalEntryPanelProps = {
    transaction?: TxRow;
    onEntryResolved?: (transactionId: string, entry: JournalEntryPreview) => void;
};

const InboxJournalEntryPanel = ({ transaction, onEntryResolved }: InboxJournalEntryPanelProps) => {
    const [loadedEntry, setLoadedEntry] = useState<JournalEntryPreview | null>(null);
    const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const embeddedEntry = getEmbeddedJournalEntry(transaction);
    const selectedJournalEntry = embeddedEntry ?? loadedEntry;

    useEffect(() => {
        setLoadedEntry(null);
        setError(null);

        if (!transaction || embeddedEntry) {
            setLoadingLabel(null);
            return;
        }

        let cancelled = false;
        setLoadingLabel('generating');

        const recoverGeneratedEntry = async () => {
            setLoadingLabel('loading');
            for (let attempt = 0; attempt < 6; attempt += 1) {
                if (cancelled) throw new Error('cancelled');
                if (attempt > 0) {
                    await new Promise((resolve) => window.setTimeout(resolve, 450));
                }

                const rows = await inboxAPI.listTransactions();
                const currentTransaction = rows.find((row) => row.id === transaction.id);
                const journalId = getTransactionJournalId(currentTransaction);
                if (journalId) {
                    return inboxAPI.getJournalEntry(journalId);
                }
            }

            throw new Error('Journal entry was generated but could not be loaded yet.');
        };

        inboxAPI.generateJournalEntry(transaction.id)
            .catch(() => recoverGeneratedEntry())
            .then((entry) => {
                if (!cancelled) {
                    setError(null);
                    setLoadedEntry(entry);
                    onEntryResolved?.(transaction.id, entry);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load journal entry.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingLabel(null);
            });

        return () => {
            cancelled = true;
        };
    }, [embeddedEntry, onEntryResolved, transaction]);

    return (
        <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
            <CardHeader className="p-4">
                <CardTitle className="text-base text-[#2b2f38]">Journal Entry</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col gap-3">
                {transaction && selectedJournalEntry ? (
                    <Card
                        className="shadow-none border-[#d8c6a1] rounded-md overflow-hidden"
                        style={ledgerPaperStyle}
                    >
                        <CardContent className="p-4 flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                    <div className="font-semibold text-sm text-[#1f2f4a]">
                                        {selectedJournalEntry.memo || transaction.description || 'No memo'}
                                    </div>
                                    <div className="text-xs text-[#506080]">
                                        Transaction {transaction.txn_date || '-'} | Confidence {getConfidence(selectedJournalEntry)}
                                    </div>
                                </div>
                                <div className="text-xs text-[#506080]">
                                    {loadingLabel || selectedJournalEntry.status || transaction.status || 'entry'}
                                </div>
                            </div>
                            {error ? (
                                <p className="text-sm text-red-700">{error}</p>
                            ) : null}
                            {selectedJournalEntry.rationale ? (
                                <p className="text-sm text-[#384869]">{selectedJournalEntry.rationale}</p>
                            ) : null}
                            <div className="overflow-x-auto border rounded-md border-[#9eb8dc]/70 bg-[#fdf8ec]/70">
                                <Table>
                                    <THeader>
                                        <TRow className="border-b border-[#6fa0d8]/60">
                                            <THead className="min-w-24 px-2 text-[#1f3a67]">Type</THead>
                                            <THead className="min-w-28 px-2 text-right text-[#1f3a67]">Amount</THead>
                                            <THead className="min-w-48 px-2 text-[#1f3a67]">Account</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {(selectedJournalEntry.lines ?? []).map((line, index) => (
                                            <TRow
                                                key={line.id ?? `${selectedJournalEntry.id}-${index}`}
                                                className="border-b border-[#6fa0d8]/35 last:border-b-0"
                                            >
                                                <TCell className="text-sm px-2 py-2 text-[#1f2f4a]">
                                                    {line.line_type || '-'}
                                                </TCell>
                                                <TCell className="text-sm px-2 py-2 text-right tabular-nums font-mono text-[#1f2f4a]">
                                                    {formatMoney(line.amount ?? 0)}
                                                </TCell>
                                                <TCell className="text-sm px-2 py-2 text-[#1f2f4a]">
                                                    {line.account_label || line.account_id || '-'}
                                                </TCell>
                                            </TRow>
                                        ))}
                                        {(selectedJournalEntry.lines ?? []).length === 0 ? (
                                            <TRow>
                                                <TCell className="text-sm px-2 py-3 text-[#596986]" colSpan={3}>
                                                    No lines found.
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                ) : transaction ? (
                    <div className="text-sm text-[#596986] p-2">
                        {loadingLabel ? 'Generating journal entry...' : error || 'No journal entry available.'}
                    </div>
                ) : (
                    <div className="text-sm text-[#596986] p-2">
                        Select an inbox transaction to preview its journal entry.
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default InboxJournalEntryPanel;
