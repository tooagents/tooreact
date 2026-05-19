import type { FormEvent, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { TbDotsVertical } from 'react-icons/tb';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'src/components/ui/dropdown-menu';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { coaAPI } from './COA-api';
import { AccountFormDialog, ApplyTemplateDialog } from './dialog';
import type { COAFormState, COARow, NormalBalance } from '../../types/type_coa';
import type { COATemplate } from '../../types/type_coa';
import { coaTemplates } from './COA-template';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'COA' }];
const MAX_COA_LEVEL = 4;

const emptyForm: COAFormState = {
    coa_code: '',
    coa_name: '',
    normal_balance: 'Debit',
    is_posting: true,
    is_deleted: false,
};

const getCOAKey = (row: COARow, index: number) => String(row.id ?? `${'coa'}-${index}`);
const getCOAId = (row: COARow) => String(row.id ?? '').trim();
const getCOACode = (row: COARow) => String(row.coa_code ??  '').trim();
const getCOAName = (row: COARow) => String(row.coa_name ?? '').trim();
const getCOAStatus = (row: COARow) => String(row.coa_status ?? row.staus ?? '').trim();
const getCOAChildren = (row: COARow) => (Array.isArray(row.children) ? row.children : []);
const getCOALevel = (row: COARow, fallbackLevel = 1) => Number(row.coa_level ?? fallbackLevel);
const getBoundedCOALevel = (row: COARow, fallbackLevel = 1) => Math.min(Math.max(getCOALevel(row, fallbackLevel), 1), MAX_COA_LEVEL);
const getNormalBalance = (row: COARow) => String(row.normal_balance ?? '').trim();
const toFormNormalBalance = (value: string): NormalBalance => (value.toLowerCase() === 'credit' ? 'Credit' : 'Debit');

const rowToForm = (row: COARow): COAFormState => ({
    coa_code: getCOACode(row),
    coa_status: getCOAStatus(row),
    coa_name: getCOAName(row),
    coa_level: getCOALevel(row),
    normal_balance: toFormNormalBalance(String(row.normal_balance ?? 'Debit')),
    is_posting: row.is_posting !== false,
    is_deleted: row.is_deleted === true,
});

const flattenCOATree = (rows: COARow[], depth = 1): COARow[] =>
    rows.flatMap((row) => [row, ...(depth < MAX_COA_LEVEL ? flattenCOATree(getCOAChildren(row), depth + 1) : [])]);

const rowMatchesQuery = (row: COARow, needle: string) =>
    [getCOACode(row), getCOAName(row), getNormalBalance(row), getCOAStatus(row), row.coa_level]
        .some((value) => String(value ?? '').toLowerCase().includes(needle));

const filterCOATree = (rows: COARow[], needle: string, depth = 1): COARow[] =>
    rows.reduce<COARow[]>((matches, row) => {
        const filteredChildren = depth < MAX_COA_LEVEL ? filterCOATree(getCOAChildren(row), needle, depth + 1) : [];
        if (rowMatchesQuery(row, needle) || filteredChildren.length > 0) {
            matches.push({ ...row, children: filteredChildren });
        }
        return matches;
    }, []);

const sortCOATree = (rows: COARow[]): COARow[] =>
    [...rows]
        .sort((left, right) => getCOACode(left).localeCompare(getCOACode(right), undefined, { numeric: true }))
        .map((row) => ({ ...row, children: sortCOATree(getCOAChildren(row)) }));

const normalizeCOATree = (rows: COARow[]): COARow[] => {
    const flatRows = flattenCOATree(rows).sort((left, right) => getCOACode(left).localeCompare(getCOACode(right), undefined, { numeric: true }));
    const nodesById = new Map<string, COARow>();
    const roots: COARow[] = [];
    const lastNodeByLevel = new Map<number, COARow>();

    flatRows.forEach((row) => {
        const id = getCOAId(row);
        if (id) nodesById.set(id, { ...row, children: [] });
    });

    flatRows.forEach((sourceRow) => {
        const sourceId = getCOAId(sourceRow);
        const row = sourceId ? nodesById.get(sourceId) : null;
        if (!row) return;

        const level = getBoundedCOALevel(row);
        const parentId = String(row.parent_id ?? '').trim();
        const parentById = parentId ? nodesById.get(parentId) : null;
        const parent = parentById && getBoundedCOALevel(parentById) === level - 1 ? parentById : lastNodeByLevel.get(level - 1);

        if (parent) {
            parent.children = [...getCOAChildren(parent), row];
        } else {
            roots.push(row);
        }

        lastNodeByLevel.set(level, row);
        for (let deeperLevel = level + 1; deeperLevel <= MAX_COA_LEVEL; deeperLevel += 1) {
            lastNodeByLevel.delete(deeperLevel);
        }
    });

    return sortCOATree(roots);
};

const downloadCOACsv = (rows: COARow[]) => {
    const headers = ['Code', 'Name', 'Level', 'Normal Balance', 'Status', 'Posting'];
    const values = flattenCOATree(rows).map((row) => [
        getCOACode(row),
        getCOAName(row),
        row.coa_level ?? '',
        getNormalBalance(row),
        getCOAStatus(row),
        row.is_posting ? 'Yes' : 'No',
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
            setCOARows(normalizeCOATree(await coaAPI.getTree()));
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
        return filterCOATree(coaRows, needle);
    }, [coaRows, query]);

    const flatCOA = useMemo(() => flattenCOATree(coaRows), [coaRows]);
    const flatFilteredCOA = useMemo(() => flattenCOATree(filteredCOA), [filteredCOA]);

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
        const isDeleted = row.is_deleted === true;
        setArchivingAccount(accountId);
        setError(null);
        setMessage(null);
        try {
            if (isDeleted) {
                await coaAPI.updateCOA(accountId, { ...rowToForm(row), is_deleted: false });
                setMessage('COA account restored.');
            } else {
                await coaAPI.deleteCOA(accountId);
                setMessage('COA account archived.');
            }
            await loadCOA();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${isDeleted ? 'restore' : 'archive'} COA account.`);
        } finally {
            setArchivingAccount(null);
        }
    };

    const anyBusy = isLoading || Boolean(applyingTemplate) || savingAccount || Boolean(archivingAccount);
    const cellClassName = 'px-3 py-2';
    const renderCOARows = (rows: COARow[], depth = 0): ReactElement[] =>
        rows.flatMap((row, index) => {
            const accountId = getCOAId(row);
            const level = getCOALevel(row, depth + 1);
            const children = depth < MAX_COA_LEVEL - 1 ? getCOAChildren(row) : [];
            const hasChildren = children.length > 0;
            const isPosting = row.is_posting === true;
            const isReadonly = row.is_readonly === true;
            const isDeleted = row.is_deleted === true;
            const rowKey = getCOAKey(row, index);
            const rowClassName = [
                isPosting ? '' : 'bg-gray-50/80 dark:bg-white/[0.03]',
                isDeleted ? 'bg-gray-100/80 opacity-70 dark:bg-white/[0.04]' : '',
            ].filter(Boolean).join(' ');
            const deletedClassName = isDeleted ? 'text-gray-400 line-through dark:text-white/40' : '';
            const nameClassName = [
                !hasChildren && (level >= MAX_COA_LEVEL || isPosting) ? 'font-normal text-gray-700 dark:text-white/70' : 'font-semibold text-gray-900 dark:text-white',
                deletedClassName,
            ].filter(Boolean).join(' ');
            const mutedCellClassName = isDeleted ? deletedClassName : 'text-gray-700 dark:text-white/70';

            return [
                <TRow key={rowKey} className={rowClassName}>
                    <TCell className={`${cellClassName} ${nameClassName}`}>
                        <div className="flex min-w-[280px] items-center" style={{ paddingLeft: `${Math.min(depth, MAX_COA_LEVEL - 1) * 32}px` }}>
                            {depth > 0 ? (
                                <span className="relative mr-2 h-5 w-5 shrink-0" aria-hidden="true">
                                    <span className="absolute left-0 top-0 h-full border-l border-gray-200 dark:border-white/10" />
                                    <span className="absolute left-0 top-1/2 w-5 border-t border-gray-200 dark:border-white/10" />
                                </span>
                            ) : null}
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400">
                                {hasChildren ? (
                                    <Icon icon="material-symbols:folder-outline-rounded" width={16} height={16} />
                                ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                )}
                            </span>
                            <span className="ml-2">
                                <span className={`font-mono text-sm ${isDeleted ? 'text-gray-400 dark:text-white/40' : 'text-gray-700 dark:text-white/70'}`}>{getCOACode(row) || '-'}</span>
                                <span className="ml-2">{getCOAName(row) || '-'}</span>
                            </span>
                        </div>
                    </TCell>
                    <TCell className={`${cellClassName} ${mutedCellClassName}`}>Level {level}</TCell>
                    <TCell className={`${cellClassName} capitalize ${mutedCellClassName}`}>{getNormalBalance(row) || '-'}</TCell>
                    <TCell className={cellClassName}>
                        <Badge className={`rounded-full ${isDeleted ? 'bg-gray-100 text-gray-400 line-through' : getCOAStatus(row).toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                            {getCOAStatus(row) || '-'}
                        </Badge>
                    </TCell>
                    <TCell className={cellClassName}>
                        <Badge className={`rounded-full ${isDeleted ? 'bg-gray-100 text-gray-400 line-through' : isPosting ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-700'}`}>
                            {isPosting ? 'Posting' : 'Header'}
                        </Badge>
                    </TCell>
                    <TCell className={cellClassName}>
                        {isReadonly ? null : (
                            <div className="flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-lightprimary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                                            disabled={anyBusy || !accountId}
                                            title="Account actions"
                                        >
                                            <TbDotsVertical size={20} />
                                            <span className="sr-only">Account actions</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem className="flex cursor-pointer items-center gap-3" onClick={() => openEditAccount(row)}>
                                            <Icon icon="solar:pen-new-square-broken" height={18} />
                                            <span>Edit</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className={`flex cursor-pointer items-center gap-3 ${isDeleted ? 'text-emerald-600 focus:text-emerald-600' : 'text-red-600 focus:text-red-600'}`}
                                            onClick={() => archiveAccount(row)}
                                        >
                                            {archivingAccount === accountId ? (
                                                <LoadingSpinner size="sm" variant="dots" />
                                            ) : isDeleted ? (
                                                <Icon icon="solar:refresh-circle-outline" height={18} />
                                            ) : (
                                                <Icon icon="solar:trash-bin-minimalistic-outline" height={18} />
                                            )}
                                            <span>{isDeleted ? 'Restore' : 'Archive'}</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </TCell>
                </TRow>,
                ...renderCOARows(children, depth + 1),
            ];
        });

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
                                disabled={flatFilteredCOA.length === 0}
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
                            <THeader className="[&_tr]:border-0">
                                <TRow>
                                    <THead className="h-8 px-3 py-2 font-semibold">Account</THead>
                                    <THead className="h-8 px-3 py-2 font-semibold">Level</THead>
                                    <THead className="h-8 px-3 py-2 font-semibold">Normal Balance</THead>
                                    <THead className="h-8 px-3 py-2 font-semibold">Status</THead>
                                    <THead className="h-8 px-3 py-2 font-semibold">Kind</THead>
                                    <THead className="h-8 w-32 px-3 py-2 text-right font-semibold">Actions</THead>
                                </TRow>
                            </THeader>
                            <TBody className="[&_tr]:border-0">
                                {isLoading ? (
                                    <TRow>
                                        <TCell colSpan={6} className="p-6 text-center text-gray-500">
                                            <LoadingSpinner size="md" />
                                        </TCell>
                                    </TRow>
                                ) : flatFilteredCOA.length > 0 ? (
                                    renderCOARows(filteredCOA)
                                ) : (
                                    <TRow>
                                        <TCell colSpan={6} className="p-6 text-center font-medium text-gray-500 dark:text-white/70">
                                            No COA data available.
                                        </TCell>
                                    </TRow>
                                )}
                            </TBody>
                        </Table>
                    </div>
                </div>
            </div>

            <ApplyTemplateDialog
                pendingTemplate={pendingTemplate}
                applyingTemplate={applyingTemplate}
                onCancel={() => setPendingTemplate(null)}
                onApply={applyTemplate}
            />

            <AccountFormDialog
                open={isFormOpen}
                form={form}
                isEditing={Boolean(editingRow)}
                savingAccount={savingAccount}
                setForm={setForm}
                onOpenChange={setIsFormOpen}
                onSubmit={submitAccount}
            />
        </>
    );
};

export default COA;
