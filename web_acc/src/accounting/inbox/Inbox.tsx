import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Button } from 'src/components/ui/button';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Icon } from '@iconify/react/dist/iconify.js';
import { formatMoney } from 'src/core/format';
import { AccountRow, inboxAPI, InboxFlowEvent, TxRow } from 'src/accounting/inbox/inbox-api';

const MAX_FLOW_EVENTS = 120;
const FLOW_META_PREVIEW_LIMIT = 900;

function formatFlowMeta(meta: unknown): string {
    const text = typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2);
    if (text.length <= FLOW_META_PREVIEW_LIMIT) return text;
    return `${text.slice(0, FLOW_META_PREVIEW_LIMIT)}\n... truncated ${text.length - FLOW_META_PREVIEW_LIMIT} chars`;
}

const Inbox = () => {
    const uploadInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [flowEvents, setFlowEvents] = useState<InboxFlowEvent[]>([]);
    const [transactionNote, setTransactionNote] = useState('');
    const [firstLineDraft, setFirstLineDraft] = useState({
        txn_date: '',
        description: '',
        amount: '',
        status: '',
    });

    const recordFlow = (event: InboxFlowEvent) => {
        const id = event.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setFlowEvents((prev) => [{ ...event, id }, ...prev].slice(0, MAX_FLOW_EVENTS));
    };

    const recordLocalFlow = (
        step: string,
        meta?: unknown,
        level: InboxFlowEvent['level'] = 'info',
        source = 'tooreact',
    ) => {
        recordFlow({
            ts: new Date().toLocaleTimeString(),
            source,
            step,
            level,
            meta,
        });
    };

    const refresh = async (flowLabel = 'manual') => {
        setLoading(true);
        setError(null);
        recordLocalFlow('refresh_start', { flowLabel, endpoints: ['/acc/get_transactions?limit=200', '/acc/accounts'] });
        try {
            const [tx, accts] = await Promise.all([
                inboxAPI.listTransactions(),
                inboxAPI.listAccounts(),
            ]);
            setTransactions(tx);
            setAccounts(accts);
            recordLocalFlow('refresh_done', { transaction_count: tx.length, account_count: accts.length }, 'success');
        } catch (e: any) {
            recordLocalFlow('refresh_error', { message: e?.message || String(e) }, 'error');
            setError(e?.message || 'Failed to load inbox data.');
        } finally {
            setLoading(false);
        }
    };

    const uploadCsv = async (nextFile?: File) => {
        if (!nextFile) return;
        setError(null);
        recordLocalFlow('csv_import_start', { file_name: nextFile.name, size: nextFile.size });
        try {
            const res = await inboxAPI.importCsv(nextFile);
            setMsg(`Imported ${res.imported_count}, duplicates ${res.duplicate_count}.`);
            recordLocalFlow('csv_import_done', res, 'success');
            await refresh('after_csv_import');
        } catch (e: any) {
            recordLocalFlow('csv_import_error', { message: e?.message || String(e) }, 'error');
            setError(e?.message || 'Failed to upload CSV.');
        }
    };

    const addTypedTransaction = async () => {
        const note = transactionNote.trim();
        if (!note) return;
        setError(null);
        setMsg(null);
        setFlowEvents([]);
        recordLocalFlow('add_to_inbox_clicked', { note });
        try {
            const response = await inboxAPI.addToInbox(note, recordFlow);
            recordLocalFlow('add_to_inbox_response_ready', response, 'success');
            setMsg(`Added to inbox: ${note}`);
            setTransactionNote('');
            await refresh('after_add_to_inbox');
        } catch (e: any) {
            recordLocalFlow('add_to_inbox_error', { message: e?.message || String(e) }, 'error');
            setError(e?.message || 'Failed to add transaction note.');
        }
    };

    const handleCameraFile = async (nextFile?: File) => {
        if (!nextFile) return;
        setError(null);
        recordLocalFlow('camera_file_selected', { file_name: nextFile.name, size: nextFile.size });
        setMsg(`Captured image: ${nextFile.name}`);
        await refresh('after_camera_file');
    };

    const parsedAmount = transactionNote.match(/(-?\d+(?:\.\d+)?)/)?.[1] || '-';
    const parsedDate = /\btoday\b/i.test(transactionNote) ? 'Today' : /\byesterday\b/i.test(transactionNote) ? 'Yesterday' : '-';
    const parsedDesc = transactionNote.replace(/-?\d+(?:\.\d+)?/g, '').replace(/\b(today|yesterday)\b/gi, '').trim() || '-';

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
                                disabled={!transactionNote.trim() || loading}
                            >
                                {loading ? <LoadingSpinner size="sm" variant="dots" /> : <Icon icon="mdi:plus-circle-outline" className="h-4 w-4" />}
                                Add to Inbox
                            </Button>

                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        uploadCsv(e.target.files?.[0] || undefined);
                                        e.target.value = '';
                                    }}
                                />
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleCameraFile(e.target.files?.[0])}
                                />
                                <Button
                                    variant="outline"
                                    className="h-9 px-4 rounded-full"
                                    onClick={() => uploadInputRef.current?.click()}
                                    disabled={loading}
                                >
                                    {loading ? <LoadingSpinner size="sm" variant="dots" /> : <Icon icon="material-symbols:upload-rounded" className="h-4 w-4" />}
                                    Upload
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-9 px-4 rounded-full"
                                    onClick={() => cameraInputRef.current?.click()}
                                >
                                    <Icon icon="mdi:camera-outline" className="h-4 w-4" />
                                    Camera
                                </Button>
                            </div>
                        </div>
                        {msg ? <p className="mt-3 text-sm text-muted-foreground">{msg}</p> : null}
                        {error ? <p className="mt-3 text-sm text-red-600">Error: {error}</p> : null}
                    </div>

                    <div className={flowEvents.length > 0 ? 'xl:col-span-2' : 'h-full'}>
                            <div className={`${flowEvents.length > 0 ? 'h-[72vh]' : 'h-72'} overflow-hidden rounded-md border border-secondary/30 bg-background text-xs`}>
                                <div className="flex items-center justify-between border-b border-secondary/20 px-3 py-2">
                                    <div className="flex items-center gap-2 font-medium text-foreground">
                                        <Icon icon="mdi:timeline-clock-outline" className="h-4 w-4 text-primary" />
                                        Flow Stream
                                    </div>
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => setFlowEvents([])}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="border-b border-secondary/20 px-3 py-2 text-muted-foreground">
                                    Draft: Date {parsedDate} | Desc {parsedDesc} | Amount {parsedAmount}
                                </div>
                                <div className={`${flowEvents.length > 0 ? 'h-[calc(72vh-76px)]' : 'h-[205px]'} overflow-y-auto px-3 py-2`}>
                                    {flowEvents.length === 0 ? (
                                        <div className="py-8 text-center text-muted-foreground">
                                            Flow events will appear here after Add to Inbox.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {flowEvents.map((event) => (
                                                <div
                                                    key={event.id}
                                                    className="rounded-md border border-secondary/20 bg-muted/20 px-2 py-2"
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={
                                                                event.level === 'error'
                                                                    ? 'h-2 w-2 rounded-full bg-error'
                                                                    : event.level === 'success'
                                                                        ? 'h-2 w-2 rounded-full bg-success'
                                                                        : 'h-2 w-2 rounded-full bg-primary'
                                                            }
                                                        />
                                                        <span className="font-medium text-foreground">{event.step}</span>
                                                        <span className="text-muted-foreground">{event.source}</span>
                                                        <span className="ml-auto text-muted-foreground">{event.ts}</span>
                                                        {typeof event.elapsedMs === 'number' ? (
                                                            <span className="text-muted-foreground">{event.elapsedMs}ms</span>
                                                        ) : null}
                                                    </div>
                                                    {event.meta !== undefined ? (
                                                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 text-[11px] leading-4 text-muted-foreground">
                                                            {formatFlowMeta(event.meta)}
                                                        </pre>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
