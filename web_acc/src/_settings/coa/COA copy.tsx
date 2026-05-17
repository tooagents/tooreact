import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Card, CardContent } from 'src/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from 'src/components/ui/select';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { apiFetch } from 'src/core/apihttp';

type NormalBalance = 'debit' | 'credit';
type COAGroupLevel1 = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

type COARow = {
    id?: string | null;
    account_id?: string | null;
    coa_code?: string | null;
    coa_posting_name?: string | null;
    coa_group_level1?: string | null;
    coa_group_level2?: string | null;
    coa_group_level3?: string | null;
    code?: string | null;
    name?: string | null;
    type?: string | null;
    normal_balance?: string | null;
    is_posting?: boolean | null;
    is_active?: boolean | null;
    [key: string]: unknown;
};

type COAFormState = {
    coa_code: string;
    coa_posting_name: string;
    coa_group_level1: COAGroupLevel1;
    coa_group_level2: string;
    coa_group_level3: string;
    normal_balance: NormalBalance;
    is_posting: boolean;
};

type COATemplate = {
    key: string;
    name: string;
    label: string;
    description: string;
};

type ApplyCOAResponse = {
    template?: string;
    created?: number;
    existing?: number;
};

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'COA' }];

const groupOptions: COAGroupLevel1[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const normalBalanceOptions: NormalBalance[] = ['debit', 'credit'];
const coaTemplates: COATemplate[] = [
    {
        key: 'minimal-ca',
        name: 'Minimal Canada',
        label: 'Basic',
        description: 'Small starter chart for common accounts.',
    },
    {
        key: 'regular-sme-ca',
        name: 'Regular SME Canada',
        label: 'SME',
        description: 'Broader chart for operating businesses.',
    },
    {
        key: 'cra-reporting-ca',
        name: 'CRA Reporting Canada',
        label: 'CRA',
        description: 'Accounts aligned to Canadian reporting categories.',
    },
];

const emptyForm: COAFormState = {
    coa_code: '',
    coa_posting_name: '',
    coa_group_level1: 'asset',
    coa_group_level2: '',
    coa_group_level3: '',
    normal_balance: 'debit',
    is_posting: true,
};

async function parseCOAResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
}

const coaAPI = {
    async listCOA(): Promise<COARow[]> {
        const response = await apiFetch('/acc/coa');
        return parseCOAResponse<COARow[]>(response, 'Failed to fetch COA');
    },

    async applyTemplate(templateKey: string): Promise<ApplyCOAResponse> {
        const response = await apiFetch(`/acc/coa/templates/${encodeURIComponent(templateKey)}/apply`, { method: 'POST' });
        return parseCOAResponse<ApplyCOAResponse>(response, 'Failed to apply COA template');
    },

    async createCOA(payload: COAFormState): Promise<COARow> {
        const response = await apiFetch('/acc/coa', {
            method: 'POST',
            body: JSON.stringify(toCOAPayload(payload)),
        });
        return parseCOAResponse<COARow>(response, 'Failed to create COA account');
    },

    async updateCOA(coaId: string, payload: COAFormState): Promise<COARow> {
        const response = await apiFetch(`/acc/coa/${encodeURIComponent(coaId)}`, {
            method: 'PATCH',
            body: JSON.stringify(toCOAPayload(payload)),
        });
        return parseCOAResponse<COARow>(response, 'Failed to update COA account');
    },

    async deleteCOA(coaId: string): Promise<void> {
        const response = await apiFetch(`/acc/coa/${encodeURIComponent(coaId)}`, { method: 'DELETE' });
        await parseCOAResponse<void>(response, 'Failed to archive COA account');
    },
};

const toCOAPayload = (form: COAFormState) => ({
    coa_code: form.coa_code.trim(),
    coa_posting_name: form.coa_posting_name.trim(),
    coa_group_level1: form.coa_group_level1,
    coa_group_level2: form.coa_group_level2.trim() || null,
    coa_group_level3: form.coa_group_level3.trim() || null,
    normal_balance: form.normal_balance,
    is_posting: form.is_posting,
});

const getCOAKey = (row: COARow, index: number) =>
    String(row.id ?? row.account_id ?? row.coa_code ?? row.code ?? `${row.coa_posting_name ?? row.name ?? 'coa'}-${index}`);

const getCOAId = (row: COARow) => String(row.id ?? row.account_id ?? '').trim();

const getCOACode = (row: COARow) => String(row.coa_code ?? row.code ?? '').trim();

const getCOAName = (row: COARow) => String(row.coa_posting_name ?? row.name ?? '').trim();

const getCOAType = (row: COARow) => String(row.coa_group_level1 ?? row.type ?? '').trim();

const getCOAStatus = (row: COARow) => {
    if (row.is_active === false) return 'Inactive';
    return 'Active';
};

const rowToForm = (row: COARow): COAFormState => ({
    coa_code: getCOACode(row),
    coa_posting_name: getCOAName(row),
    coa_group_level1: (getCOAType(row) || 'asset') as COAGroupLevel1,
    coa_group_level2: String(row.coa_group_level2 ?? ''),
    coa_group_level3: String(row.coa_group_level3 ?? ''),
    normal_balance: (String(row.normal_balance ?? 'debit') || 'debit') as NormalBalance,
    is_posting: row.is_posting !== false,
});

const downloadCOACsv = (rows: COARow[]) => {
    const headers = ['Code', 'Name', 'Type', 'Group', 'Subgroup', 'Normal Balance', 'Status'];
    const values = rows.map((row) => [
        getCOACode(row),
        getCOAName(row),
        getCOAType(row),
        row.coa_group_level2 ?? '',
        row.coa_group_level3 ?? '',
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
    const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
    const [savingAccount, setSavingAccount] = useState(false);
    const [archivingAccount, setArchivingAccount] = useState<string | null>(null);
    const [editingRow, setEditingRow] = useState<COARow | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [form, setForm] = useState<COAFormState>(emptyForm);
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
            [getCOACode(row), getCOAName(row), getCOAType(row), row.coa_group_level2, row.coa_group_level3, row.normal_balance, getCOAStatus(row)]
                .some((value) => String(value ?? '').toLowerCase().includes(needle)),
        );
    }, [coaRows, query]);

    const accountCountByType = useMemo(() => {
        return coaRows.reduce<Record<string, number>>((totals, row) => {
            const type = getCOAType(row) || 'unassigned';
            totals[type] = (totals[type] ?? 0) + 1;
            return totals;
        }, {});
    }, [coaRows]);

    const applyTemplate = async (template: COATemplate) => {
        setApplyingTemplate(template.key);
        setError(null);
        setMessage(null);
        try {
            const result = await coaAPI.applyTemplate(template.key);
            setMessage(`${template.label} template applied. Created ${result.created ?? 0}, existing ${result.existing ?? 0}.`);
            await loadCOA();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply COA template.');
        } finally {
            setApplyingTemplate(null);
        }
    };

    const openNewAccount = () => {
        setEditingRow(null);
        setForm(emptyForm);
        setIsFormOpen(true);
    };

    const openEditAccount = (row: COARow) => {
        setEditingRow(row);
        setForm(rowToForm(row));
        setIsFormOpen(true);
    };

    const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSavingAccount(true);
        setError(null);
        setMessage(null);
        try {
            const accountId = editingRow ? getCOAId(editingRow) : '';
            if (editingRow && accountId) {
                await coaAPI.updateCOA(accountId, form);
                setMessage('COA account updated.');
            } else {
                await coaAPI.createCOA(form);
                setMessage('COA account added.');
            }
            setIsFormOpen(false);
            await loadCOA();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save COA account.');
        } finally {
            setSavingAccount(false);
        }
    };

    const archiveAccount = async (row: COARow) => {
        const accountId = getCOAId(row);
        if (!accountId) return;
        setArchivingAccount(accountId);
        setError(null);
        setMessage(null);
        try {
            await coaAPI.deleteCOA(accountId);
            setMessage('COA account archived.');
            await loadCOA();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to archive COA account.');
        } finally {
            setArchivingAccount(null);
        }
    };

    const anyBusy = isLoading || Boolean(applyingTemplate) || savingAccount || Boolean(archivingAccount);

    return (
        <>
            <BreadcrumbComp title="COA" items={BCrumb} />
            <div className="flex flex-col gap-4">
                <Card className="border-secondary/20 shadow-none">
                    <CardContent className="flex flex-col gap-4 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <div className="text-sm font-medium">Chart of accounts</div>
                                <div className="text-sm text-muted-foreground">Start from a template, then customize accounts for this business.</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" className="h-9 rounded-full" onClick={loadCOA} disabled={anyBusy}>
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
                                <Button className="h-9 rounded-full" onClick={openNewAccount} disabled={anyBusy}>
                                    <Icon icon="material-symbols:add-rounded" width={18} height={18} />
                                    Add account
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                            {coaTemplates.map((template) => (
                                <Button
                                    key={template.key}
                                    type="button"
                                    variant="outline"
                                    className="h-auto min-h-16 justify-start rounded-md border-ld px-3 py-3 text-left"
                                    onClick={() => applyTemplate(template)}
                                    disabled={anyBusy}
                                >
                                    <span className="flex w-full items-center justify-between gap-3">
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold">{template.label}</span>
                                            <span className="block truncate text-xs font-normal text-muted-foreground">
                                                {template.name} · {template.description}
                                            </span>
                                        </span>
                                        {applyingTemplate === template.key ? <LoadingSpinner size="sm" variant="dots" /> : null}
                                    </span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
                {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

                <div className="grid gap-2 px-4 sm:grid-cols-3 lg:grid-cols-6">
                    {['asset', 'liability', 'equity', 'revenue', 'expense'].map((type) => (
                        <div key={type} className="rounded-md border border-ld px-3 py-2">
                            <div className="text-xs capitalize text-muted-foreground">{type}</div>
                            <div className="text-lg font-semibold">{accountCountByType[type] ?? 0}</div>
                        </div>
                    ))}
                    <div className="rounded-md border border-ld px-3 py-2">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-lg font-semibold">{coaRows.length}</div>
                    </div>
                </div>

                <div className="space-y-4 p-4 pt-0">
                    <div className="relative min-w-0">
                        <Icon
                            icon="solar:magnifer-linear"
                            width="18"
                            height="18"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 opacity-70"
                        />
                        <Input
                            type="text"
                            className="rounded-md border-0 bg-gray-100/80 pl-9 shadow-none placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 dark:bg-slate-900/50 dark:placeholder:text-white/20"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search COA..."
                        />
                    </div>

                    <div className="overflow-x-auto rounded-md border border-ld">
                        <Table>
                            <THeader>
                                <TRow>
                                    <THead className="font-semibold">Code</THead>
                                    <THead className="font-semibold">Name</THead>
                                    <THead className="font-semibold">Type</THead>
                                    <THead className="font-semibold">Group</THead>
                                    <THead className="font-semibold">Normal Balance</THead>
                                    <THead className="font-semibold">Status</THead>
                                    <THead className="w-32 text-right font-semibold">Actions</THead>
                                </TRow>
                            </THeader>
                            <TBody>
                                {isLoading ? (
                                    <TRow>
                                        <TCell colSpan={7} className="p-6 text-center text-gray-500">
                                            <LoadingSpinner size="md" />
                                        </TCell>
                                    </TRow>
                                ) : filteredCOA.length > 0 ? (
                                    filteredCOA.map((row, index) => {
                                        const accountId = getCOAId(row);
                                        return (
                                            <TRow key={getCOAKey(row, index)}>
                                                <TCell className="font-mono text-sm text-gray-700 dark:text-white/70">{getCOACode(row) || '-'}</TCell>
                                                <TCell className="text-gray-700 dark:text-white/70">{getCOAName(row) || '-'}</TCell>
                                                <TCell className="capitalize text-gray-700 dark:text-white/70">{getCOAType(row) || '-'}</TCell>
                                                <TCell className="text-gray-700 dark:text-white/70">
                                                    {[row.coa_group_level2, row.coa_group_level3].filter(Boolean).join(' / ') || '-'}
                                                </TCell>
                                                <TCell className="capitalize text-gray-700 dark:text-white/70">{row.normal_balance || '-'}</TCell>
                                                <TCell>
                                                    <Badge className={`rounded-full ${row.is_active === false ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {getCOAStatus(row)}
                                                    </Badge>
                                                </TCell>
                                                <TCell>
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-8 w-8 rounded-md p-0"
                                                            onClick={() => openEditAccount(row)}
                                                            disabled={anyBusy || !accountId}
                                                            title="Edit account"
                                                        >
                                                            <Icon icon="material-symbols:edit-outline-rounded" width={16} height={16} />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-8 w-8 rounded-md p-0 text-red-600 hover:text-red-700"
                                                            onClick={() => archiveAccount(row)}
                                                            disabled={anyBusy || !accountId}
                                                            title="Archive account"
                                                        >
                                                            {archivingAccount === accountId ? (
                                                                <LoadingSpinner size="sm" variant="dots" />
                                                            ) : (
                                                                <Icon icon="material-symbols:archive-outline-rounded" width={16} height={16} />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TCell>
                                            </TRow>
                                        );
                                    })
                                ) : (
                                    <TRow>
                                        <TCell colSpan={7} className="p-6 text-center font-medium text-gray-500 dark:text-white/70">
                                            No COA data available.
                                        </TCell>
                                    </TRow>
                                )}
                            </TBody>
                        </Table>
                    </div>
                </div>
            </div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl">
                    <form onSubmit={submitAccount} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{editingRow ? 'Edit account' : 'Add account'}</DialogTitle>
                            <DialogDescription>Customize the chart of accounts for this business.</DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">Code</div>
                                <Input
                                    required
                                    value={form.coa_code}
                                    onChange={(event) => setForm((current) => ({ ...current, coa_code: event.target.value }))}
                                    placeholder="1000"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">Name</div>
                                <Input
                                    required
                                    value={form.coa_posting_name}
                                    onChange={(event) => setForm((current) => ({ ...current, coa_posting_name: event.target.value }))}
                                    placeholder="Bank"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">Type</div>
                                <Select
                                    value={form.coa_group_level1}
                                    onValueChange={(value) => setForm((current) => ({ ...current, coa_group_level1: value as COAGroupLevel1 }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groupOptions.map((option) => (
                                            <SelectItem key={option} value={option} className="capitalize">
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">Normal balance</div>
                                <Select
                                    value={form.normal_balance}
                                    onValueChange={(value) => setForm((current) => ({ ...current, normal_balance: value as NormalBalance }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {normalBalanceOptions.map((option) => (
                                            <SelectItem key={option} value={option} className="capitalize">
                                                {option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">Group</div>
                                <Input
                                    value={form.coa_group_level2}
                                    onChange={(event) => setForm((current) => ({ ...current, coa_group_level2: event.target.value }))}
                                    placeholder="current_asset"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">Subgroup</div>
                                <Input
                                    value={form.coa_group_level3}
                                    onChange={(event) => setForm((current) => ({ ...current, coa_group_level3: event.target.value }))}
                                    placeholder="cash_and_bank"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={savingAccount}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={savingAccount}>
                                {savingAccount ? <LoadingSpinner size="sm" variant="dots" /> : null}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default COA;
