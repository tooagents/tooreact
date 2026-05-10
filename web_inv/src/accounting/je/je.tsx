import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { formatMoney } from 'src/core/format';
import { AccountRow, jeAPI, JournalEntryRow } from 'src/accounting/je/je-api';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Entries' }];

const getConfidence = (entry: JournalEntryRow) => {
    const value = Number(entry.confidence);
    return Number.isFinite(value) ? value.toFixed(2) : '-';
};

const getAccountLabel = (account: AccountRow) => {
    const code = String(account.account_code ?? account.code ?? account.coa_code ?? '').trim();
    const name = String(account.account_name ?? account.name ?? account.title ?? '').trim();

    if (code && name) return `${code} - ${name}`;
    if (name) return name;
    if (code) return code;
    return String(account.id);
};

const ledgerPaperStyle = {
    backgroundColor: '#f8f1de',
    backgroundImage: `
        linear-gradient(to right, rgba(225, 71, 71, 0.34) 0, rgba(225, 71, 71, 0.34) 1px, transparent 1px, transparent 4px, rgba(225, 71, 71, 0.34) 4px, rgba(225, 71, 71, 0.34) 5px, transparent 5px, transparent 100%),
        linear-gradient(to right, rgba(225, 71, 71, 0.34) 0, rgba(225, 71, 71, 0.34) 1px, transparent 1px, transparent 4px, rgba(225, 71, 71, 0.34) 4px, rgba(225, 71, 71, 0.34) 5px, transparent 5px, transparent 100%),
        linear-gradient(to right, rgba(225, 71, 71, 0.26) 0, rgba(225, 71, 71, 0.26) 1px, transparent 1px, transparent 100%),
        repeating-linear-gradient(to right, transparent 0, transparent 95px, rgba(47, 126, 214, 0.26) 95px, rgba(47, 126, 214, 0.26) 96px),
        repeating-linear-gradient(to bottom, transparent 0, transparent 29px, rgba(47, 126, 214, 0.22) 29px, rgba(47, 126, 214, 0.22) 30px)
    `,
    backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%',
    backgroundPosition: '23% 0, 56% 0, 48% 0, 0 0, 0 0',
} as const;

const Entries = () => {
    const [entries, setEntries] = useState<JournalEntryRow[]>([]);
    const [accountLabelById, setAccountLabelById] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [existingEntries, accounts] = await Promise.all([
                jeAPI.listEntries(),
                jeAPI.listAccounts(),
            ]);
            console.log('[JE API] /acc/journal-entries response:', existingEntries);
            console.log('[JE API] /acc/accounts response:', accounts);

            const map: Record<string, string> = {};
            for (const account of accounts) {
                if (account?.id) {
                    map[account.id] = getAccountLabel(account);
                }
            }

            setAccountLabelById(map);
            setEntries(existingEntries);
            setMsg(`Loaded ${existingEntries.length} journal entr${existingEntries.length === 1 ? 'y' : 'ies'}.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load entries.');
            setAccountLabelById({});
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const headBoxes = (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">{entries.length}</CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="Entries" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="flex gap-6 flex-col">
                <Card className="shadow-none border-secondary/20">
                    <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Journal entries are loaded directly from the ledger.
                            </div>
                            <Button
                                className="h-9 px-5 rounded-full shadow-sm"
                                onClick={refresh}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <LoadingSpinner size="sm" variant="dots" />
                                ) : (
                                    <Icon icon="mdi:refresh" className="h-4 w-4" />
                                )}
                                {isLoading ? 'Refreshing...' : 'Refresh Entries'}
                            </Button>
                        </div>
                        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
                        {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="shadow-none border-[#d8c6a1] bg-[#f8f1de]">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-[#2b2f38]">Journal Entries</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex flex-col gap-3">
                            {entries.map((entry) => (
                                <Card
                                    key={entry.id}
                                    className="shadow-none border-[#d8c6a1] rounded-md overflow-hidden"
                                    style={ledgerPaperStyle}
                                >
                                    <CardContent className="p-4 flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-sm text-[#1f2f4a]">{entry.memo || 'No memo'}</div>
                                                <div className="text-xs text-[#506080]">
                                                    Confidence {getConfidence(entry)}
                                                </div>
                                            </div>
                                            <div className="text-xs text-[#506080]">
                                                {entry.status || 'entry'}
                                            </div>
                                        </div>
                                        {entry.rationale ? (
                                            <p className="text-sm text-[#384869]">{entry.rationale}</p>
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
                                                    {(entry.lines ?? []).map((line, index) => (
                                                        <TRow
                                                            key={line.id ?? `${entry.id}-${index}`}
                                                            className="border-b border-[#6fa0d8]/35 last:border-b-0"
                                                        >
                                                            <TCell className="text-sm px-2 py-2 text-[#1f2f4a]">
                                                                {line.line_type || '-'}
                                                            </TCell>
                                                            <TCell className="text-sm px-2 py-2 text-right tabular-nums font-mono text-[#1f2f4a]">
                                                                {formatMoney(line.amount)}
                                                            </TCell>
                                                            <TCell className="text-sm px-2 py-2 text-[#1f2f4a]">
                                                                {(line.account_id && accountLabelById[line.account_id]) || line.account_id || '-'}
                                                            </TCell>
                                                        </TRow>
                                                    ))}
                                                    {(entry.lines ?? []).length === 0 ? (
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
                            ))}
                            {!isLoading && entries.length === 0 ? (
                                <div className="text-sm text-[#596986] p-2">
                                    No journal entries yet.
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border-secondary/20">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">Raw Material</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 min-h-[220px] flex items-center justify-center border-t border-ld">
                            <div className="text-sm font-medium text-muted-foreground">
                                link to raw material
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
};

export default Entries;
