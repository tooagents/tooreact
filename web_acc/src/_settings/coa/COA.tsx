import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,} from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue,} from 'src/components/ui/select';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { coaAPI } from './COA-api';
import type { COAFormState, COAGroupLevel1, COARow, NormalBalance } from './COA-schema';
import type { COATemplate } from './COA-schema';
import { coaTemplates } from './COA-template';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'COA' }];

const groupOptions: COAGroupLevel1[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
const normalBalanceOptions: NormalBalance[] = ['Debit', 'Credit'];

const emptyForm: COAFormState = {
    coa_code: '',
    coa_posting_name: '',
    coa_group_level1: 'Asset',
    coa_group_level2: '',
    coa_group_level3: '',
    normal_balance: 'Debit',
    is_posting: true,
};

const getCOAKey = (row: COARow, index: number) => String(row.id ?? `${'coa'}-${index}`);
const getCOAId = (row: COARow) => String(row.id ?? '').trim();
const getCOACode = (row: COARow) => String(row.coa_code ??  '').trim();
const getCOAName = (row: COARow) => String(row.coa_posting_name ?? '').trim();
const getCOAType = (row: COARow) => String(row.coa_group_level1 ?? row.type ?? '').trim();
const getCOAStatus = (row: COARow) => String(row.coa_status ?? row.staus ?? '').trim();

const rowToForm = (row: COARow): COAFormState => ({
    coa_code: getCOACode(row),
    coa_status: getCOAStatus(row),
    coa_posting_name: getCOAName(row),
    coa_group_level1: getCOAType(row) || 'Asset',
    coa_group_level2: String(row.coa_group_level2 ?? ''),
    coa_group_level3: String(row.coa_group_level3 ?? ''),
    normal_balance: (String(row.normal_balance ?? 'Debit') || 'Debit') as NormalBalance,
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
    const [pendingTemplate, setPendingTemplate] = useState<COATemplate | null>(null);
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

    const requestApplyTemplate = (template: COATemplate) => {
        setError(null);
        setMessage(null);
        setPendingTemplate(template);
    };

    const applyTemplate = async () => {
        if (!pendingTemplate) return;

        const template = pendingTemplate;
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
            setPendingTemplate(null);
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
    const headBoxes = (
        <div className="grid grid-cols-3 gap-2">
            {coaTemplates.map((template) => (
                <Button
                    key={template.key}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-[82px] w-[154px] items-start justify-start whitespace-normal rounded-md border-secondary/20 bg-transparent px-3 py-2 text-left shadow-none"
                    onClick={() => requestApplyTemplate(template)}
                    disabled={anyBusy}
                >
                    <span className="min-w-0">
                        <span className="block text-sm font-semibold">{template.label}</span>
                        <span className="block text-[11px] font-normal leading-snug text-muted-foreground">{template.name}</span>
                        <span className="mt-1 block text-[11px] font-normal leading-snug text-muted-foreground">{template.description}</span>
                    </span>
                </Button>
            ))}
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="COA" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="flex flex-col gap-4">
                {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
                {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

                <div className="grid gap-2 px-4 sm:grid-cols-3 lg:grid-cols-6">
                    {groupOptions.map((type) => (
                        <div key={type} className="rounded-md border border-ld px-3 py-2">
                            <div className="text-xs text-muted-foreground">{type}</div>
                            <div className="text-lg font-semibold">{accountCountByType[type] ?? 0}</div>
                        </div>
                    ))}
                    <div className="rounded-md border border-ld px-3 py-2">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-lg font-semibold">{coaRows.length}</div>
                    </div>
                </div>

                <div className="space-y-4 p-4 pt-0">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative min-w-0 flex-1">
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
                        <div className="flex flex-wrap items-center gap-2">
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
                                                <TCell className="text-gray-700 dark:text-white/70">{getCOAType(row) || '-'}</TCell>
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

            <Dialog
                open={Boolean(pendingTemplate)}
                onOpenChange={(open) => {
                    if (!open && !applyingTemplate) setPendingTemplate(null);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Apply {pendingTemplate?.label} template?</DialogTitle>
                        <DialogDescription>
                            This may overwrite or replace parts of your current chart of accounts. Please think again before continuing.
                            This action cannot be recovered from this page.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Template: {pendingTemplate?.name}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPendingTemplate(null)} disabled={Boolean(applyingTemplate)}>
                            Cancel
                        </Button>
                        <Button type="button" className="bg-red-600 text-white hover:bg-red-700" onClick={applyTemplate} disabled={Boolean(applyingTemplate)}>
                            {applyingTemplate ? <LoadingSpinner size="sm" variant="dots" /> : null}
                            Apply template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                            <SelectItem key={option} value={option}>
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
