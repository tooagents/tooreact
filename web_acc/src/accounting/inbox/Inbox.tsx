import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Icon } from '@iconify/react/dist/iconify.js';
import { formatMoney } from 'src/core/format';
import { inboxAPI, TxRow } from 'src/accounting/inbox/inbox-api';

type StreamItem = {
    event: string;
    title: string;
    detail?: string;
};

const Inbox = () => {
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [transactionNote, setTransactionNote] = useState('');
    const [streamItems, setStreamItems] = useState<StreamItem[]>([]);
    const [streamModel, setStreamModel] = useState<string | null>(null);
    const [streamConfidence, setStreamConfidence] = useState<number | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [firstLineDraft, setFirstLineDraft] = useState({
        txn_date: '',
        description: '',
        amount: '',
        status: '',
    });

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            const tx = await inboxAPI.listTransactions();
            setTransactions(tx);
        } catch (e: any) {
            setError(e?.message || 'Failed to load inbox data.');
        } finally {
            setLoading(false);
        }
    };

    const formatStreamStatus = (value: string) =>
        value
            .split('_')
            .filter(Boolean)
            .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
            .join(' ');

    const formatStreamMeta = (meta: Record<string, unknown>) =>
        Object.entries(meta)
            .filter(([key]) => !['message', 'model', 'confidence_score'].includes(key))
            .map(([key, value]) => `${formatStreamStatus(key)}: ${String(value)}`)
            .join(' | ');

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
            await inboxAPI.addToInboxStream(note, (event, data) => {
                if (event === 'status') {
                    const status = String(data.status || 'Working');
                    const meta = data.meta && typeof data.meta === 'object'
                        ? data.meta as Record<string, unknown>
                        : {};
                    if (typeof meta.model === 'string') setStreamModel(meta.model);
                    if (typeof meta.confidence_score === 'number') setStreamConfidence(meta.confidence_score);
                    setStreamItems((prev) => [
                        ...prev,
                        {
                            event,
                            title: formatStreamStatus(status),
                            detail: formatStreamMeta(meta),
                        },
                    ]);
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
                    setStreamItems((prev) => [...prev, { event, title: 'Done', detail: 'Inbox updated.' }]);
                    return;
                }

                setStreamItems((prev) => [...prev, { event, title: formatStreamStatus(event) }]);
            });
            setMsg(`Added to inbox: ${note}`);
            setTransactionNote('');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Failed to add transaction note.');
        } finally {
            setIsStreaming(false);
        }
    };

    const startVoiceInput = () => {
        setError(null);
        setMsg('Voice input coming soon.');
    };

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        const firstRow = transactions[0];
        if (!firstRow) {
            setFirstLineDraft({ txn_date: '', description: '', amount: '', status: '' });
            return;
        }

        setFirstLineDraft({
            txn_date: firstRow.txn_date || '',
            description: firstRow.description || '',
            amount: String(firstRow.amount ?? ''),
            status: firstRow.status || '',
        });
    }, [transactions]);

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
                                    onChange={(e) => setTransactionNote(e.target.value)}
                                    placeholder='Type transaction (e.g. "Uber 23 yesterday")'
                                />
                            </div>
                            {/* <div className="mt-2 flex flex-wrap gap-2">
                                {composerTokens.map((token) => (
                                    <button
                                        key={token}
                                        type="button"
                                        className="rounded-full border border-secondary/30 bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-muted/60"
                                        onClick={() => setTransactionNote((prev) => `${prev ? `${prev} ` : ''}${token}`)}
                                    >
                                        + {token}
                                    </button>
                                ))}
                            </div> */}
                        </div>

                        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <Button
                                className="h-9 px-5 rounded-full shadow-sm"
                                onClick={addTypedTransaction}
                                disabled={!transactionNote.trim() || isStreaming}
                            >
                                <Icon icon="mdi:plus-circle-outline" className="h-4 w-4" />
                                {isStreaming ? 'Adding...' : 'Add to Inbox'}
                            </Button>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="h-9 px-4 rounded-full"
                                    onClick={startVoiceInput}
                                >
                                    <Icon icon="mdi:microphone-outline" className="h-4 w-4" />
                                    Voice
                                </Button>
                            </div>
                        </div>
                        {msg ? <p className="mt-3 text-sm text-muted-foreground">{msg}</p> : null}
                        {error ? <p className="mt-3 text-sm text-red-600">Error: {error}</p> : null}
                    </div>

                    <div className="h-full min-w-0 max-w-full overflow-hidden">
                        <div className="flex h-full min-h-28 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-dashed border-secondary/30 bg-background px-4 py-3 text-xs text-muted-foreground shadow-sm">
                            {streamItems.length > 0 || isStreaming ? (
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
                                        {streamItems.map((item, index) => (
                                            <div key={`${item.event}-${index}`} className="flex min-w-0 gap-2">
                                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/80" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="break-words font-medium text-foreground">{item.title}</p>
                                                    {item.detail ? <p className="mt-0.5 break-words">{item.detail}</p> : null}
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
                                            <THead className="min-w-3 px-2">Date</THead>
                                            <THead className="min-w-3 px-2">Description</THead>
                                            <THead className="min-w-3 px-2 text-right">Amount</THead>
                                            <THead className="min-w-3 px-2">Status</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {transactions.map((row) => (
                                            <TRow key={row.id} className="hover:bg-primary/10 transition-colors">
                                                <TCell className="text-sm px-2 py-3">{row.txn_date || '-'}</TCell>
                                                <TCell className="text-sm px-2 py-3">{row.description || '-'}</TCell>
                                                <TCell className="text-sm px-2 py-3 text-right tabular-nums">
                                                    {formatMoney(row.amount ?? 0)}
                                                </TCell>
                                                <TCell className="text-sm px-2 py-3">{row.status || '-'}</TCell>
                                            </TRow>
                                        ))}
                                        {!loading && transactions.length === 0 ? (
                                            <TRow>
                                                <TCell className="text-sm px-2 py-4 text-muted-foreground" colSpan={4}>
                                                    No inbox transactions yet.
                                                </TCell>
                                            </TRow>
                                        ) : null}
                                    </TBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border-secondary/20">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">First Line Edit</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto border-t border-ld">
                                <Table>
                                    <THeader>
                                        <TRow>
                                            <THead className="min-w-3 px-2">Date</THead>
                                            <THead className="min-w-3 px-2">Description</THead>
                                            <THead className="min-w-3 px-2 text-right">Amount</THead>
                                            <THead className="min-w-3 px-2">Status</THead>
                                        </TRow>
                                    </THeader>
                                    <TBody>
                                        {transactions.length > 0 ? (
                                            <TRow>
                                                <TCell className="px-2 py-3">
                                                    <input
                                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                        value={firstLineDraft.txn_date}
                                                        onChange={(e) =>
                                                            setFirstLineDraft((prev) => ({ ...prev, txn_date: e.target.value }))
                                                        }
                                                    />
                                                </TCell>
                                                <TCell className="px-2 py-3">
                                                    <input
                                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                        value={firstLineDraft.description}
                                                        onChange={(e) =>
                                                            setFirstLineDraft((prev) => ({ ...prev, description: e.target.value }))
                                                        }
                                                    />
                                                </TCell>
                                                <TCell className="px-2 py-3">
                                                    <input
                                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-right tabular-nums"
                                                        value={firstLineDraft.amount}
                                                        onChange={(e) =>
                                                            setFirstLineDraft((prev) => ({ ...prev, amount: e.target.value }))
                                                        }
                                                    />
                                                </TCell>
                                                <TCell className="px-2 py-3">
                                                    <input
                                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                        value={firstLineDraft.status}
                                                        onChange={(e) =>
                                                            setFirstLineDraft((prev) => ({ ...prev, status: e.target.value }))
                                                        }
                                                    />
                                                </TCell>
                                            </TRow>
                                        ) : (
                                            <TRow>
                                                <TCell className="text-sm px-2 py-4 text-muted-foreground" colSpan={4}>
                                                    No first line to edit.
                                                </TCell>
                                            </TRow>
                                        )}
                                    </TBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </>
    );
};

export default Inbox;
