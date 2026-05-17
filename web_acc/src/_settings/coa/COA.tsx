import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { apiFetch } from 'src/core/apihttp';

type COARow = {
    id?: string | null;
    account_id?: string | null;
    code?: string | null;
    name?: string | null;
    type?: string | null;
    normal_balance?: string | null;
    is_active?: boolean | null;
    [key: string]: unknown;
};

type ApplyCOAResponse = {
    created?: number;
    existing?: number;
};

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'COA' }];

async function parseCOAResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    return response.json();
}

const coaAPI = {
    async listCOA(): Promise<COARow[]> {
        const response = await apiFetch('/acc/accounts');
        return parseCOAResponse<COARow[]>(response, 'Failed to fetch COA');
    },

    async applyGenericCOA(): Promise<ApplyCOAResponse> {
        const response = await apiFetch('/acc/coa/templates/generic/apply', { method: 'POST' });
        return parseCOAResponse<ApplyCOAResponse>(response, 'Failed to apply COA');
    },
};

const getCOAKey = (row: COARow, index: number) =>
    String(row.id ?? row.account_id ?? row.code ?? `${row.name ?? 'coa'}-${index}`);

const getCOAStatus = (row: COARow) => {
    if (row.is_active === false) return 'Inactive';
    return 'Active';
};

const downloadCOACsv = (rows: COARow[]) => {
    const headers = ['Code', 'Name', 'Type', 'Normal Balance', 'Status'];
    const values = rows.map((row) => [
        row.code ?? '',
        row.name ?? '',
        row.type ?? '',
        row.normal_balance ?? '',
        getCOAStatus(row),
    ]);
    const csv = [headers, ...values]
        .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'coa.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const COA = () => {
    const [coaRows, setCOARows] = useState<COARow[]>([]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadCOA = async () => {
        setIsLoading(true);
        setError(null);
        try {
            setCOARows(await coaAPI.listCOA());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch COA.');
            setCOARows([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadCOA();
    }, []);

    const filteredCOA = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return coaRows;
        return coaRows.filter((row) =>
            [row.code, row.name, row.type, row.normal_balance, getCOAStatus(row)]
                .some((value) => String(value ?? '').toLowerCase().includes(needle)),
        );
    }, [coaRows, query]);

    const applyGenericCOA = async () => {
        setIsApplying(true);
        setError(null);
        setMessage(null);
        try {
            const result = await coaAPI.applyGenericCOA();
            setMessage(`COA applied. Created ${result.created ?? 0}, existing ${result.existing ?? 0}.`);
            await loadCOA();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply COA.');
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <>
            <BreadcrumbComp title="COA" items={BCrumb} />
            <div className="flex flex-col gap-4">
                <Card className="shadow-none border-secondary/20">
                    <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="text-sm font-medium">COA</div>
                            <div className="text-sm text-muted-foreground">Review and apply the working COA.</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" className="h-9 rounded-full" onClick={loadCOA} disabled={isLoading || isApplying}>
                                {isLoading ? <LoadingSpinner size="sm" variant="dots" /> : null}
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                className="h-9 rounded-full"
                                onClick={() => downloadCOACsv(filteredCOA)}
                                disabled={filteredCOA.length === 0}
                            >
                                <Icon icon="material-symbols:download-rounded" width={18} height={18} />
                                Export
                            </Button>
                            <Button className="h-9 rounded-full" onClick={applyGenericCOA} disabled={isLoading || isApplying}>
                                {isApplying ? <LoadingSpinner size="sm" variant="dots" /> : null}
                                Apply COA
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
                {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

                <div className="p-4 pt-0 space-y-4">
                    <div className="relative min-w-0">
                        <Icon
                            icon="solar:magnifer-linear"
                            width="18"
                            height="18"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-70 pointer-events-none"
                        />
                        <Input
                            type="text"
                            className="pl-9 rounded-md border-0 bg-gray-100/80 shadow-none placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 dark:bg-slate-900/50 dark:placeholder:text-white/20"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search COA..."
                        />
                    </div>

                    <div className="overflow-x-auto border rounded-md border-ld">
                        <Table>
                            <THeader>
                                <TRow>
                                    <THead className="font-semibold">Code</THead>
                                    <THead className="font-semibold">Name</THead>
                                    <THead className="font-semibold">Type</THead>
                                    <THead className="font-semibold">Normal Balance</THead>
                                    <THead className="font-semibold">Status</THead>
                                </TRow>
                            </THeader>
                            <TBody>
                                {isLoading ? (
                                    <TRow>
                                        <TCell colSpan={5} className="p-6 text-center text-gray-500">
                                            <LoadingSpinner size="md" />
                                        </TCell>
                                    </TRow>
                                ) : filteredCOA.length > 0 ? (
                                    filteredCOA.map((row, index) => (
                                        <TRow key={getCOAKey(row, index)}>
                                            <TCell className="font-mono text-sm text-gray-700 dark:text-white/70">{row.code || '-'}</TCell>
                                            <TCell className="text-gray-700 dark:text-white/70">{row.name || '-'}</TCell>
                                            <TCell className="capitalize text-gray-700 dark:text-white/70">{row.type || '-'}</TCell>
                                            <TCell className="capitalize text-gray-700 dark:text-white/70">{row.normal_balance || '-'}</TCell>
                                            <TCell>
                                                <Badge className={`rounded-full ${row.is_active === false ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {getCOAStatus(row)}
                                                </Badge>
                                            </TCell>
                                        </TRow>
                                    ))
                                ) : (
                                    <TRow>
                                        <TCell colSpan={5} className="p-6 text-center font-medium text-gray-500 dark:text-white/70">
                                            No COA data available.
                                        </TCell>
                                    </TRow>
                                )}
                            </TBody>
                        </Table>
                    </div>
                </div>
            </div>
        </>
    );
};

export default COA;
