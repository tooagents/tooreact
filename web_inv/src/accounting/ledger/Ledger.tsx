import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { formatMoney } from 'src/core/format';
import { jeAPI, LedgerRow } from 'src/accounting/je/je-api';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Ledger' }];

const Ledger = () => {
    const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);
    const [ledgerError, setLedgerError] = useState<string | null>(null);

    const loadLedger = async () => {
        setIsLedgerLoading(true);
        setLedgerError(null);
        try {
            const rows = await jeAPI.listLedger();
            console.log('[Ledger API] /acc/ledger/general response:', rows);
            setLedgerRows(rows);
        } catch (err) {
            setLedgerError(err instanceof Error ? err.message : 'Failed to load general ledger.');
            setLedgerRows([]);
        } finally {
            setIsLedgerLoading(false);
        }
    };

    useEffect(() => {
        loadLedger();
    }, []);

    const headBoxes = (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">GL Rows</CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-2xl font-semibold">{ledgerRows.length}</CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="Ledger" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="shadow-none border-secondary/20">
                    <CardHeader className="p-4 flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-base">General Ledger</CardTitle>
                        <Button
                            variant="outline"
                            className="h-8 px-3 rounded-full"
                            onClick={loadLedger}
                            disabled={isLedgerLoading}
                        >
                            {isLedgerLoading ? <LoadingSpinner size="sm" variant="dots" /> : <Icon icon="mdi:refresh" className="h-4 w-4" />}
                            {isLedgerLoading ? 'Loading...' : 'Refresh GL'}
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {ledgerError ? (
                            <div className="px-4 pb-3 text-sm text-red-600">Error: {ledgerError}</div>
                        ) : null}
                        <div className="overflow-x-auto border-t border-ld">
                            <Table>
                                <THeader>
                                    <TRow>
                                        <THead className="min-w-28 px-2">Date</THead>
                                        <THead className="min-w-48 px-2">Account</THead>
                                        <THead className="min-w-24 px-2">Type</THead>
                                        <THead className="min-w-24 px-2 text-right">Amount</THead>
                                        <THead className="min-w-28 px-2 text-right">Running</THead>
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {ledgerRows.map((row, idx) => (
                                        <TRow key={row.id ?? `${row.entry_date ?? 'row'}-${idx}`}>
                                            <TCell className="text-sm px-2 py-2">{row.entry_date || '-'}</TCell>
                                            <TCell className="text-sm px-2 py-2">
                                                {[row.code, row.name].filter(Boolean).join(' ') || '-'}
                                            </TCell>
                                            <TCell className="text-sm px-2 py-2">{row.line_type || '-'}</TCell>
                                            <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                {formatMoney(row.amount ?? 0)}
                                            </TCell>
                                            <TCell className="text-sm px-2 py-2 text-right tabular-nums">
                                                {formatMoney(row.running_balance ?? 0)}
                                            </TCell>
                                        </TRow>
                                    ))}
                                    {!isLedgerLoading && ledgerRows.length === 0 ? (
                                        <TRow>
                                            <TCell className="text-sm px-2 py-3 text-muted-foreground" colSpan={5}>
                                                No general ledger rows yet.
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
                        <CardTitle className="text-base">Journal</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 min-h-[220px] flex items-center justify-center border-t border-ld">
                        <div className="text-sm font-medium text-muted-foreground">
                            link to journal
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default Ledger;
