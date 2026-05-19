import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Badge } from 'src/components/ui/badge';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'src/components/ui/card';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'src/components/ui/tabs';
import { apiFetch } from 'src/core/apihttp';
import { formatMoney } from 'src/core/format';
import type { COARow } from 'src/types/type_coa';

const BCrumb = [{ to: '/', title: 'Home' }, { title: 'Reports' }];
const MAX_COA_LEVEL = 4;

type TrialBalanceRow = {
    account_id?: string | null;
    coa_code?: string | null;
    coa_name?: string | null;
    coa_group_level1?: string | null;
    coa_group_level2?: string | null;
    coa_group_level3?: string | null;
    normal_balance?: string | null;
    code?: string | null;
    name?: string | null;
    type?: string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    net?: number | string | null;
    balance?: number | string | null;
};

type ReportLedgerRow = {
    id?: string;
    journal_entry_id?: string | null;
    journal_id?: string | null;
    entry_id?: string | null;
    je_id?: string | null;
    journalEntryId?: string | null;
    entry_no?: number | string | null;
    journal_entry?: ReportJournalEntryRow | null;
    journalEntry?: ReportJournalEntryRow | null;
    entry?: ReportJournalEntryRow | null;
    je?: ReportJournalEntryRow | null;
    journal_entry_line_id?: string | null;
    journalEntryLineId?: string | null;
    line_id?: string | null;
    lineId?: string | null;
    account_id?: string | null;
    coa_code?: string | null;
    coa_name?: string | null;
    code?: string | null;
    name?: string | null;
    entry_date?: string | null;
    line_type?: string | null;
    amount?: number | string | null;
    debit?: number | string | null;
    credit?: number | string | null;
    memo?: string | null;
    description?: string | null;
    [key: string]: unknown;
};

type ReportJournalEntryLine = {
    id?: string;
    [key: string]: unknown;
};

type ReportJournalEntryRow = {
    id: string;
    entry_no?: number | string | null;
    memo?: string | null;
    lines?: ReportJournalEntryLine[];
    [key: string]: unknown;
};

type StatementPostingAccount = {
    account_id?: string | null;
    coa_code?: string | null;
    coa_name?: string | null;
    coa_group_level1?: string | null;
    coa_group_level2?: string | null;
    coa_group_level3?: string | null;
    code?: string | null;
    name?: string | null;
    amount?: number | string | null;
};

type StatementLevel3 = {
    coa_group_level3?: string | null;
    amount?: number | string | null;
    posting_accounts?: StatementPostingAccount[];
};

type StatementLevel2 = {
    coa_group_level2?: string | null;
    amount?: number | string | null;
    level3?: StatementLevel3[];
};

type StatementSection = {
    coa_group_level1?: string | null;
    amount?: number | string | null;
    level2?: StatementLevel2[];
};

type BalanceSheetReport = {
    as_of?: string | null;
    sections?: Record<string, StatementSection | undefined>;
    totals?: {
        asset?: number | string | null;
        liability?: number | string | null;
        equity?: number | string | null;
        assets?: number | string | null;
        liabilities?: number | string | null;
    };
};

type IncomeStatementReport = {
    from_date?: string | null;
    to_date?: string | null;
    sections?: Record<string, StatementSection | undefined>;
    totals?: {
        revenue?: number | string | null;
        expense?: number | string | null;
        expenses?: number | string | null;
        net_income?: number | string | null;
    };
};

type DisplayStatementSection = {
    key: string;
    title: string;
    total: number;
    totalLabel: string;
    section?: StatementSection;
};

type HierarchyNode = {
    key: string;
    label: string;
    code?: string | null;
    amount: number;
    count: number;
    level: number;
    accounts: StatementPostingAccount[];
    sectionKey?: string;
    level2Name?: string | null;
    level3Name?: string | null;
};

type COAAccountMeta = {
    type?: string | null;
    group?: string | null;
    subgroup?: string | null;
};

type StatementAccountGroup = {
    key: string;
    label: string;
    amount: number;
    accounts: StatementPostingAccount[];
};

const getNumber = (value: unknown) => {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const getAccountCode = (row: StatementPostingAccount | TrialBalanceRow) => String(row.coa_code ?? row.code ?? '').trim();

const getAccountName = (row: StatementPostingAccount | TrialBalanceRow) => String(row.coa_name ?? row.name ?? '').trim();

const getAccountLabel = (row: StatementPostingAccount | TrialBalanceRow) => {
    const code = getAccountCode(row);
    const name = getAccountName(row);
    if (code && name) return `${code} ${name}`;
    return name || code || String(row.account_id ?? '-');
};

const getAccountLookupKeys = (row: StatementPostingAccount | TrialBalanceRow) =>
    [row.account_id, row.coa_code, row.code]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);

const getCurrentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getPeriodYyyymm = (monthValue: string) => Number(monthValue.replace('-', ''));

const getMonthDateRange = (monthValue: string) => {
    const [yearText, monthText] = monthValue.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    const formatDate = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    return {
        fromDate: formatDate(start),
        toDate: formatDate(end),
    };
};

const getSignedClass = (value: number) => {
    if (Math.abs(value) < 0.005) return 'text-emerald-700';
    return value > 0 ? 'text-blue-700' : 'text-red-700';
};

const getReportRowKey = (section: string, row: StatementPostingAccount, index: number) =>
    `${section}-${row.account_id ?? row.coa_code ?? row.code ?? row.coa_name ?? row.name ?? index}`;

const titleCase = (value: string) =>
    value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

const getGroupLabel = (value: string | null | undefined, fallback: string) => {
    const text = String(value ?? '').trim();
    return text ? titleCase(text) : fallback;
};

const getTrialBalanceType = (row: TrialBalanceRow, accountMetaByKey: Record<string, COAAccountMeta>) => {
    const meta = getAccountLookupKeys(row)
        .map((key) => accountMetaByKey[key])
        .find(Boolean);

    return getGroupLabel(meta?.type ?? row.coa_group_level1 ?? row.type, '-');
};

const getPostingAccountGroup = (row: StatementPostingAccount, accountMetaByKey: Record<string, COAAccountMeta>) => {
    const meta = getAccountMeta(row, accountMetaByKey);

    return getGroupLabel(
        meta?.subgroup ?? meta?.group ?? row.coa_group_level3 ?? row.coa_group_level2,
        '-',
    );
};

const getAccountMeta = (
    row: StatementPostingAccount | TrialBalanceRow,
    accountMetaByKey: Record<string, COAAccountMeta>,
) =>
    getAccountLookupKeys(row)
        .map((key) => accountMetaByKey[key])
        .find(Boolean);

const getFirstAccountMetaLabel = (
    accounts: StatementPostingAccount[],
    accountMetaByKey: Record<string, COAAccountMeta>,
    key: keyof COAAccountMeta,
    fallback?: string | null,
) => {
    const direct = String(fallback ?? '').trim();
    if (direct) return direct;

    return accounts
        .map((account) => String(getAccountMeta(account, accountMetaByKey)?.[key] ?? '').trim())
        .find(Boolean) ?? null;
};

const groupStatementAccountsByCOA = (
    sectionKey: string,
    accounts: StatementPostingAccount[],
    accountMetaByKey: Record<string, COAAccountMeta>,
) => {
    const groupsByLabel = new Map<string, StatementAccountGroup & { subgroupsByLabel: Map<string, StatementAccountGroup> }>();

    accounts.forEach((account) => {
        const meta = getAccountMeta(account, accountMetaByKey);
        const groupLabel = getGroupLabel(meta?.group ?? account.coa_group_level2, 'Unassigned');
        const subgroupLabel = getGroupLabel(meta?.subgroup ?? account.coa_group_level3, groupLabel);
        const amount = getNumber(account.amount);
        const groupKey = groupLabel.toLowerCase();
        const subgroupKey = subgroupLabel.toLowerCase();

        if (!groupsByLabel.has(groupKey)) {
            groupsByLabel.set(groupKey, {
                key: `${sectionKey}-l2-${groupKey}`,
                label: groupLabel,
                amount: 0,
                accounts: [],
                subgroupsByLabel: new Map(),
            });
        }

        const group = groupsByLabel.get(groupKey);
        if (!group) return;
        group.amount += amount;
        group.accounts.push(account);

        if (!group.subgroupsByLabel.has(subgroupKey)) {
            group.subgroupsByLabel.set(subgroupKey, {
                key: `${group.key}-l3-${subgroupKey}`,
                label: subgroupLabel,
                amount: 0,
                accounts: [],
            });
        }

        const subgroup = group.subgroupsByLabel.get(subgroupKey);
        if (!subgroup) return;
        subgroup.amount += amount;
        subgroup.accounts.push(account);
    });

    return [...groupsByLabel.values()].map((group) => ({
        ...group,
        subgroups: [...group.subgroupsByLabel.values()],
    }));
};

const getCOAChildren = (row: COARow) => (Array.isArray(row.children) ? row.children : []);

const getCOAName = (row: COARow) => String(row.coa_name ?? row.name ?? '').trim();

const getCOACode = (row: COARow) => String(row.coa_code ?? row.code ?? '').trim();

const getCOAId = (row: COARow) => String(row.id ?? '').trim();

const getCOALevel = (row: COARow, fallbackLevel = 1) => Number(row.coa_level ?? fallbackLevel);

const getBoundedCOALevel = (row: COARow, fallbackLevel = 1) => Math.min(Math.max(getCOALevel(row, fallbackLevel), 1), MAX_COA_LEVEL);

const flattenCOATree = (rows: COARow[], depth = 1): COARow[] =>
    rows.flatMap((row) => [row, ...(depth < MAX_COA_LEVEL ? flattenCOATree(getCOAChildren(row), depth + 1) : [])]);

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

const getNormalizedLabelKey = (value: string | null | undefined) => {
    const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
};

const getStatementAccountLookup = (accounts: StatementPostingAccount[]) => {
    const lookup = new Map<string, StatementPostingAccount[]>();

    accounts.forEach((account) => {
        getAccountLookupKeys(account).forEach((key) => {
            lookup.set(key, [...(lookup.get(key) ?? []), account]);
        });
    });

    return lookup;
};

const getCOALookupKeys = (row: COARow) => [getCOAId(row), getCOACode(row)].filter(Boolean);

const getDirectStatementAccounts = (row: COARow, lookup: Map<string, StatementPostingAccount[]>) => {
    const accounts = getCOALookupKeys(row).flatMap((key) => lookup.get(key) ?? []);
    return [...new Set(accounts)];
};

const getStatementAccountAmount = (accounts: StatementPostingAccount[]) =>
    accounts.reduce((sum, account) => sum + getNumber(account.amount), 0);

const getStatementSectionRoot = (section: DisplayStatementSection, coaRows: COARow[]) => {
    const sectionKeys = new Set([getNormalizedLabelKey(section.key), getNormalizedLabelKey(section.title)]);
    return coaRows.find((row) => sectionKeys.has(getNormalizedLabelKey(getCOAName(row))));
};

const buildCOAStatementNodes = (
    section: DisplayStatementSection,
    coaRows: COARow[],
    accounts: StatementPostingAccount[],
) => {
    const lookup = getStatementAccountLookup(accounts);
    const sectionRoot = getStatementSectionRoot(section, coaRows);
    if (!sectionRoot) return null;

    const visit = (row: COARow, level: number): HierarchyNode[] => {
        const childNodes = getCOAChildren(row).flatMap((child) => visit(child, level + 1));
        const directAccounts = getDirectStatementAccounts(row, lookup);
        const childAccounts = childNodes.flatMap((node) => node.accounts);
        const nodeAccounts = [...new Set([...directAccounts, ...childAccounts])];

        if (nodeAccounts.length === 0) return childNodes;

        const rowId = getCOAId(row) || getCOACode(row) || getCOAName(row);
        return [
            {
                key: `${section.key}-coa-${rowId}`,
                label: getGroupLabel(getCOAName(row), getCOACode(row) || 'Unassigned'),
                code: getCOACode(row),
                amount: getStatementAccountAmount(nodeAccounts),
                count: nodeAccounts.length,
                level,
                accounts: nodeAccounts,
                sectionKey: section.key,
            },
            ...childNodes,
        ];
    };

    return getCOAChildren(sectionRoot).flatMap((child) => visit(child, 1));
};

const buildCOAAccountMetaByKey = (rows: COARow[]) => {
    const metaByKey: Record<string, COAAccountMeta> = {};
    const entries: { row: COARow; ancestors: COARow[] }[] = [];
    const rowById = new Map<string, COARow>();

    const visit = (row: COARow, ancestors: COARow[]) => {
        const rowId = getCOAId(row);
        if (rowId) rowById.set(rowId, row);
        entries.push({ row, ancestors });
        getCOAChildren(row).forEach((child) => visit(child, [...ancestors, row]));
    };

    rows.forEach((row) => visit(row, []));

    const getParentAncestors = (row: COARow) => {
        const ancestors: COARow[] = [];
        const seen = new Set<string>();
        let parentId = String(row.parent_id ?? '').trim();

        while (parentId && !seen.has(parentId)) {
            seen.add(parentId);
            const parent = rowById.get(parentId);
            if (!parent) break;
            ancestors.unshift(parent);
            parentId = String(parent.parent_id ?? '').trim();
        }

        return ancestors;
    };

    entries.forEach(({ row, ancestors }) => {
        const effectiveAncestors = ancestors.length > 0 ? ancestors : getParentAncestors(row);
        const ancestorLabels = effectiveAncestors.map(getCOAName).filter(Boolean);
        const rowLabel = getCOAName(row);
        const meta: COAAccountMeta = {
            type: ancestorLabels[0] ?? rowLabel ?? null,
            group: ancestorLabels[1] ?? (ancestorLabels.length === 1 ? rowLabel : null),
            subgroup: ancestorLabels[2] ?? (ancestorLabels.length >= 2 ? rowLabel : null),
        };

        [getCOAId(row), getCOACode(row)].filter(Boolean).forEach((key) => {
            metaByKey[key] = meta;
        });
    });

    return metaByKey;
};

const getTrialBalanceNet = (row: TrialBalanceRow) => {
    const explicitBalance = row.balance ?? row.net;
    if (explicitBalance !== undefined && explicitBalance !== null) return getNumber(explicitBalance);
    return getNumber(row.debit) - getNumber(row.credit);
};

const getTrialBalanceDebitBalance = (row: TrialBalanceRow) => Math.max(getTrialBalanceNet(row), 0);

const getTrialBalanceCreditBalance = (row: TrialBalanceRow) => Math.max(-getTrialBalanceNet(row), 0);

const formatTrialBalanceAmount = (value: number) => (Math.abs(value) < 0.005 ? '-' : formatMoney(value));

const getTrialBalanceRowKey = (row: TrialBalanceRow) =>
    String(row.account_id ?? row.coa_code ?? row.code ?? getAccountLabel(row));

const getTrialBalanceSide = (row: TrialBalanceRow) => {
    const net = getTrialBalanceNet(row);
    if (Math.abs(net) < 0.005) return 'Zero';
    return net > 0 ? 'Debit' : 'Credit';
};

const getTrialBalanceNormalBalance = (row: TrialBalanceRow) => {
    const normalBalance = String(row.normal_balance ?? '').trim().toLowerCase();
    if (normalBalance === 'debit' || normalBalance === 'credit') return titleCase(normalBalance);
    return '-';
};

const hasUnexpectedTrialBalanceSide = (row: TrialBalanceRow) => {
    const normalBalance = getTrialBalanceNormalBalance(row).toLowerCase();
    const side = getTrialBalanceSide(row).toLowerCase();
    if (normalBalance !== 'debit' && normalBalance !== 'credit') return false;
    if (side === 'zero') return false;
    return normalBalance !== side;
};

const getLedgerAccountLookupKeys = (row: ReportLedgerRow) =>
    [row.account_id, row.coa_code, row.code, row.coa_name, row.name]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);

const getEmbeddedLedgerEntry = (row: ReportLedgerRow) => row.journal_entry ?? row.journalEntry ?? row.entry ?? row.je ?? null;

const getLedgerJournalEntryId = (row: ReportLedgerRow) => {
    const embeddedEntry = getEmbeddedLedgerEntry(row);
    const value =
        embeddedEntry?.id ??
        row.journal_entry_id ??
        row.journal_id ??
        row.entry_id ??
        row.je_id ??
        row.journalEntryId;

    return String(value ?? '').trim() || null;
};

const getLedgerLineId = (row: ReportLedgerRow) => {
    const value =
        row.journal_entry_line_id ??
        row.journalEntryLineId ??
        row.line_id ??
        row.lineId ??
        row.id;

    return String(value ?? '').trim() || null;
};

const getJournalEntryLabel = (entry: ReportJournalEntryRow | null | undefined) => {
    const entryNo = String(entry?.entry_no ?? '').trim();
    return entryNo ? `JE-${entryNo}` : null;
};

const getLedgerJournalEntryLabel = (
    row: ReportLedgerRow,
    entryById: Map<string, ReportJournalEntryRow>,
    entryByLineId: Map<string, ReportJournalEntryRow>,
) => {
    const entryNo =
        row.entry_no ??
        row.journal_entry?.entry_no ??
        row.journalEntry?.entry_no ??
        row.entry?.entry_no ??
        row.je?.entry_no;
    const entryNoText = String(entryNo ?? '').trim();
    if (entryNoText) return `JE-${entryNoText}`;

    const matchedEntry =
        entryById.get(getLedgerJournalEntryId(row) ?? '') ??
        entryByLineId.get(getLedgerLineId(row) ?? '');
    const matchedEntryLabel = getJournalEntryLabel(matchedEntry);
    if (matchedEntryLabel) return matchedEntryLabel;

    const value = getLedgerJournalEntryId(row);
    const text = String(value ?? '').trim();
    return text ? text.slice(0, 8) : '-';
};

const getLedgerDebitAmount = (row: ReportLedgerRow) => {
    if (row.debit !== undefined) return getNumber(row.debit);
    return String(row.line_type ?? '').toLowerCase() === 'debit' ? getNumber(row.amount) : 0;
};

const getLedgerCreditAmount = (row: ReportLedgerRow) => {
    if (row.credit !== undefined) return getNumber(row.credit);
    return String(row.line_type ?? '').toLowerCase() === 'credit' ? getNumber(row.amount) : 0;
};

const getSectionTotal = (
    reportTotals: Record<string, number | string | null | undefined> | undefined,
    section: StatementSection | undefined,
    keys: string[],
) => {
    for (const key of keys) {
        const total = reportTotals?.[key];
        if (total !== undefined && total !== null) return getNumber(total);
    }
    return getNumber(section?.amount);
};

const flattenSectionAccounts = (section: StatementSection | undefined) =>
    (section?.level2 ?? []).flatMap((level2) =>
        (level2.level3 ?? []).flatMap((level3) => level3.posting_accounts ?? []),
    );

const makeBalanceSheetSections = (report: BalanceSheetReport): DisplayStatementSection[] => [
    {
        key: 'asset',
        title: 'Assets',
        section: report.sections?.asset,
        total: getSectionTotal(report.totals, report.sections?.asset, ['asset', 'assets']),
        totalLabel: 'Total Assets',
    },
    {
        key: 'liability',
        title: 'Liabilities',
        section: report.sections?.liability,
        total: getSectionTotal(report.totals, report.sections?.liability, ['liability', 'liabilities']),
        totalLabel: 'Total Liabilities',
    },
    {
        key: 'equity',
        title: 'Equity',
        section: report.sections?.equity,
        total: getSectionTotal(report.totals, report.sections?.equity, ['equity']),
        totalLabel: 'Total Equity',
    },
];

const makeIncomeStatementSections = (report: IncomeStatementReport): DisplayStatementSection[] => [
    {
        key: 'revenue',
        title: 'Revenue',
        section: report.sections?.revenue,
        total: getSectionTotal(report.totals, report.sections?.revenue, ['revenue']),
        totalLabel: 'Total Revenue',
    },
    {
        key: 'expense',
        title: 'Expenses',
        section: report.sections?.expense,
        total: getSectionTotal(report.totals, report.sections?.expense, ['expense', 'expenses']),
        totalLabel: 'Total Expenses',
    },
];

async function parseApiResponse<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`${message}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }

    return response.json();
}

const reportsAPI = {
    async trialBalance(periodYyyymm: number): Promise<TrialBalanceRow[]> {
        const response = await apiFetch(`/acc/reports/trial-balance?period_yyyymm=${periodYyyymm}`);
        const data = await parseApiResponse<{ rows?: TrialBalanceRow[] }>(response, 'Failed to fetch trial balance');
        return data.rows ?? [];
    },

    async balanceSheet(asOf: string): Promise<BalanceSheetReport> {
        const response = await apiFetch(`/acc/reports/balance-sheet?as_of=${encodeURIComponent(asOf)}`);
        return parseApiResponse<BalanceSheetReport>(response, 'Failed to fetch balance sheet');
    },

    async incomeStatement(fromDate: string, toDate: string): Promise<IncomeStatementReport> {
        const response = await apiFetch(`/acc/reports/income-statement?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`);
        return parseApiResponse<IncomeStatementReport>(response, 'Failed to fetch income statement');
    },

    async coaTree(): Promise<COARow[]> {
        const response = await apiFetch('/acc/coa/get_tree');
        return parseApiResponse<COARow[]>(response, 'Failed to fetch COA tree');
    },

    async ledgerRows(): Promise<ReportLedgerRow[]> {
        const response = await apiFetch('/acc/ledger/general');
        const data = await parseApiResponse<{ rows?: ReportLedgerRow[] } | ReportLedgerRow[]>(
            response,
            'Failed to fetch general ledger',
        );
        return Array.isArray(data) ? data : (data.rows ?? []);
    },

    async journalEntries(): Promise<ReportJournalEntryRow[]> {
        const response = await apiFetch('/acc/je/getlist?limit=200');
        return parseApiResponse<ReportJournalEntryRow[]>(response, 'Failed to fetch journal entries');
    },

    async exportTaxPackage(periodYyyymm: number): Promise<Blob> {
        const response = await apiFetch(`/acc/reports/export-tax-package?period_yyyymm=${periodYyyymm}`);
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(`Failed to export tax package: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
        }
        return response.blob();
    },
};

const Reports = () => {
    const [periodMonth, setPeriodMonth] = useState(getCurrentMonthValue);
    const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
    const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport>({});
    const [incomeStatement, setIncomeStatement] = useState<IncomeStatementReport>({});
    const [ledgerRows, setLedgerRows] = useState<ReportLedgerRow[]>([]);
    const [journalEntries, setJournalEntries] = useState<ReportJournalEntryRow[]>([]);
    const [accountMetaByKey, setAccountMetaByKey] = useState<Record<string, COAAccountMeta>>({});
    const [coaRows, setCOARows] = useState<COARow[]>([]);
    const [selectedTrialBalanceKey, setSelectedTrialBalanceKey] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const periodYyyymm = getPeriodYyyymm(periodMonth);
    const { fromDate, toDate } = useMemo(() => getMonthDateRange(periodMonth), [periodMonth]);

    const loadReports = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [tb, bs, isData, coaTree, ledger, entries] = await Promise.all([
                reportsAPI.trialBalance(periodYyyymm),
                reportsAPI.balanceSheet(toDate),
                reportsAPI.incomeStatement(fromDate, toDate),
                reportsAPI.coaTree(),
                reportsAPI.ledgerRows(),
                reportsAPI.journalEntries(),
            ]);
            setTrialBalanceRows(tb);
            setBalanceSheet(bs);
            setIncomeStatement(isData);
            setLedgerRows(ledger);
            setJournalEntries(entries);
            const normalizedCOATree = normalizeCOATree(coaTree);
            setCOARows(normalizedCOATree);
            setAccountMetaByKey(buildCOAAccountMetaByKey(normalizedCOATree));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load reports.');
            setTrialBalanceRows([]);
            setBalanceSheet({});
            setIncomeStatement({});
            setLedgerRows([]);
            setJournalEntries([]);
            setAccountMetaByKey({});
            setCOARows([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadReports();
    }, [periodMonth]);

    const trialBalanceDisplayRows = useMemo(
        () =>
            [...trialBalanceRows].sort((a, b) =>
                getAccountCode(a).localeCompare(getAccountCode(b), undefined, { numeric: true }),
            ),
        [trialBalanceRows],
    );
    const selectedTrialBalanceRow = useMemo(
        () => trialBalanceDisplayRows.find((row) => getTrialBalanceRowKey(row) === selectedTrialBalanceKey) ?? null,
        [selectedTrialBalanceKey, trialBalanceDisplayRows],
    );
    const selectedTrialBalanceLedgerRows = useMemo(() => {
        if (!selectedTrialBalanceRow) return [];

        const selectedKeys = new Set([
            ...getAccountLookupKeys(selectedTrialBalanceRow),
            getAccountName(selectedTrialBalanceRow),
        ].filter(Boolean));

        return ledgerRows
            .filter((row) => {
                const rowDate = String(row.entry_date ?? '').slice(0, 10);
                const matchesDate = (!fromDate || rowDate >= fromDate) && (!toDate || rowDate <= toDate);
                const matchesAccount = getLedgerAccountLookupKeys(row).some((key) => selectedKeys.has(key));
                return matchesDate && matchesAccount;
            })
            .sort((a, b) => String(a.entry_date ?? '').localeCompare(String(b.entry_date ?? '')));
    }, [fromDate, ledgerRows, selectedTrialBalanceRow, toDate]);
    const selectedTrialBalanceLedgerDebit = selectedTrialBalanceLedgerRows.reduce((sum, row) => sum + getLedgerDebitAmount(row), 0);
    const selectedTrialBalanceLedgerCredit = selectedTrialBalanceLedgerRows.reduce((sum, row) => sum + getLedgerCreditAmount(row), 0);

    const journalEntryById = useMemo(() => {
        const map = new Map<string, ReportJournalEntryRow>();
        journalEntries.forEach((entry) => {
            const entryId = String(entry.id ?? '').trim();
            if (entryId) map.set(entryId, entry);
        });
        return map;
    }, [journalEntries]);

    const journalEntryByLineId = useMemo(() => {
        const map = new Map<string, ReportJournalEntryRow>();
        journalEntryById.forEach((entry) => {
            (entry.lines ?? []).forEach((line) => {
                const lineId = String(line.id ?? '').trim();
                if (lineId) map.set(lineId, entry);
            });
        });
        return map;
    }, [journalEntryById]);

    useEffect(() => {
        if (!selectedTrialBalanceKey) return;
        if (trialBalanceDisplayRows.some((row) => getTrialBalanceRowKey(row) === selectedTrialBalanceKey)) return;
        setSelectedTrialBalanceKey(null);
    }, [selectedTrialBalanceKey, trialBalanceDisplayRows]);

    const tbDebit = trialBalanceDisplayRows.reduce((sum, row) => sum + getTrialBalanceDebitBalance(row), 0);
    const tbCredit = trialBalanceDisplayRows.reduce((sum, row) => sum + getTrialBalanceCreditBalance(row), 0);
    const tbDifference = tbDebit - tbCredit;
    const isBalanced = Math.abs(tbDebit - tbCredit) < 0.005;
    const tbMissingTypeCount = trialBalanceDisplayRows.filter((row) => getTrialBalanceType(row, accountMetaByKey) === '-').length;
    const tbZeroBalanceCount = trialBalanceDisplayRows.filter((row) => Math.abs(getTrialBalanceNet(row)) < 0.005).length;
    const tbUnexpectedBalanceCount = trialBalanceDisplayRows.filter(hasUnexpectedTrialBalanceSide).length;
    const balanceSheetSections = useMemo(() => makeBalanceSheetSections(balanceSheet), [balanceSheet]);
    const incomeStatementSections = useMemo(() => makeIncomeStatementSections(incomeStatement), [incomeStatement]);
    const bsAssetsTotal = balanceSheetSections[0].total;
    const bsLiabilitiesTotal = balanceSheetSections[1].total;
    const bsEquityTotal = balanceSheetSections[2].total;
    const bsTotal = bsAssetsTotal - bsLiabilitiesTotal - bsEquityTotal;
    const revenueTotal = incomeStatementSections[0].total;
    const expenseTotal = incomeStatementSections[1].total;
    const isTotal = getNumber(incomeStatement.totals?.net_income);

    const exportReports = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const blob = await reportsAPI.exportTaxPackage(periodYyyymm);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `tax_package_${periodYyyymm}.zip`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export reports.');
        } finally {
            setIsExporting(false);
        }
    };

    const headBoxes = (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Period</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Input
                        type="month"
                        className="h-8 w-full px-2 text-sm font-semibold"
                        value={periodMonth}
                        onChange={(event) => setPeriodMonth(event.target.value)}
                    />
                </CardContent>
            </Card>
            <Card className="w-[150px] gap-1 p-3 rounded-md shadow-none border-secondary/20 bg-transparent">
                <CardHeader className="p-0 pb-1">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Badge className={`rounded-full ${isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isBalanced ? 'Balanced' : 'Review'}
                    </Badge>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <>
            <BreadcrumbComp title="Reports" items={BCrumb} leftContent={null} rightContent={headBoxes} />
            <div className="flex flex-col gap-4">
                {error ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <Tabs defaultValue="tb" className="w-full">
                    <div className="flex items-center justify-between gap-3 border-b border-secondary/20">
                        <TabsList className="min-w-0 justify-start overflow-x-auto rounded-none bg-transparent p-0">
                            <TabsTrigger
                                value="tb"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                            >
                                Trial Balance
                            </TabsTrigger>
                            <TabsTrigger
                                value="balance-sheet"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                            >
                                Balance Sheet
                            </TabsTrigger>
                            <TabsTrigger
                                value="pl"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                            >
                                P&L
                            </TabsTrigger>
                            <TabsTrigger
                                value="close"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                            >
                                Close
                            </TabsTrigger>
                        </TabsList>
                        <Button className="mr-1 h-8 shrink-0 rounded-full px-3 text-xs" onClick={exportReports} disabled={isExporting || isLoading}>
                            {isExporting ? <LoadingSpinner size="sm" variant="dots" /> : null}
                            Export
                        </Button>
                    </div>

                    <TabsContent value="tb" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="p-4">
                                <div>
                                    <CardTitle className="text-base">Trial Balance</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">Account balances for {periodMonth}</div>
                                </div>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 border-t border-ld p-0 xl:grid-cols-[minmax(0,50%)_minmax(320px,50%)]">
                                <div className="min-w-0 overflow-x-auto xl:border-r xl:border-ld">
                                    <Table>
                                        <THeader>
                                            <TRow>
                                                <THead className="min-w-56 px-2">Account</THead>
                                                <THead className="min-w-24 px-2">Type</THead>
                                                <THead className="min-w-28 px-2 text-right">Debit</THead>
                                                <THead className="min-w-28 px-2 text-right">Credit</THead>
                                            </TRow>
                                        </THeader>
                                        <TBody>
                                            {trialBalanceDisplayRows.map((row) => {
                                                const rowKey = getTrialBalanceRowKey(row);
                                                const isSelected = selectedTrialBalanceKey === rowKey;

                                                return (
                                                    <TRow
                                                        key={rowKey}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-selected={isSelected}
                                                        className={[
                                                            'cursor-pointer transition-colors hover:bg-muted/50',
                                                            isSelected ? 'bg-muted shadow-[inset_3px_0_0_hsl(var(--primary))]' : '',
                                                        ].filter(Boolean).join(' ')}
                                                        onClick={() => setSelectedTrialBalanceKey(rowKey)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                setSelectedTrialBalanceKey(rowKey);
                                                            }
                                                        }}
                                                    >
                                                        <TCell className="px-2 py-2 text-sm">{getAccountLabel(row)}</TCell>
                                                        <TCell className="px-2 py-2 text-sm">{getTrialBalanceType(row, accountMetaByKey)}</TCell>
                                                        <TCell className="px-2 py-2 text-right text-sm tabular-nums">
                                                            {formatTrialBalanceAmount(getTrialBalanceDebitBalance(row))}
                                                        </TCell>
                                                        <TCell className="px-2 py-2 text-right text-sm tabular-nums">
                                                            {formatTrialBalanceAmount(getTrialBalanceCreditBalance(row))}
                                                        </TCell>
                                                    </TRow>
                                                );
                                            })}
                                            {!isLoading && trialBalanceDisplayRows.length === 0 ? (
                                                <TRow>
                                                    <TCell className="px-2 py-3 text-sm text-muted-foreground" colSpan={4}>
                                                        No trial balance rows for this period.
                                                    </TCell>
                                                </TRow>
                                            ) : null}
                                            {trialBalanceDisplayRows.length > 0 ? (
                                                <TRow className="bg-muted/20">
                                                    <TCell className="px-2 py-2 text-sm font-semibold" colSpan={2}>
                                                        Total
                                                    </TCell>
                                                    <TCell className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                                                        {formatMoney(tbDebit)}
                                                    </TCell>
                                                    <TCell className="px-2 py-2 text-right text-sm font-semibold tabular-nums">
                                                        {formatMoney(tbCredit)}
                                                    </TCell>
                                                </TRow>
                                            ) : null}
                                        </TBody>
                                    </Table>
                                </div>

                                <div className="flex flex-col gap-4 p-4">
                                    <div>
                                        <div className="text-sm font-semibold">Review Summary</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{fromDate} to {toDate}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-right">
                                        <ReportMetric label="Debits" value={tbDebit} />
                                        <ReportMetric label="Credits" value={tbCredit} />
                                        <ReportMetric label="Diff" value={tbDifference} valueClass={getSignedClass(tbDifference)} />
                                    </div>

                                    <div className="overflow-hidden rounded-md border border-secondary/20">
                                        <div className="flex items-center justify-between border-b border-ld px-3 py-2">
                                            <span className="text-sm font-medium">Balanced</span>
                                            <Badge className={`rounded-full ${isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {isBalanced ? 'Yes' : 'Review'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-ld px-3 py-2">
                                            <span className="text-sm font-medium">Missing type</span>
                                            <span className="text-sm font-semibold tabular-nums">{tbMissingTypeCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-ld px-3 py-2">
                                            <span className="text-sm font-medium">Zero balance</span>
                                            <span className="text-sm font-semibold tabular-nums">{tbZeroBalanceCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-2">
                                            <span className="text-sm font-medium">Unexpected side</span>
                                            <span className="text-sm font-semibold tabular-nums">{tbUnexpectedBalanceCount}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-md border border-secondary/20 p-3">
                                        <div className="text-sm font-semibold">Selected Account</div>
                                        {selectedTrialBalanceRow ? (
                                            <>
                                                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                                                    <div className="text-muted-foreground">Account</div>
                                                    <div className="text-right font-medium">{getAccountLabel(selectedTrialBalanceRow)}</div>
                                                    <div className="text-muted-foreground">Side</div>
                                                    <div className="text-right">{getTrialBalanceSide(selectedTrialBalanceRow)}</div>
                                                    <div className="text-muted-foreground">Balance</div>
                                                    <div className="text-right font-mono font-semibold tabular-nums">
                                                        {formatMoney(Math.abs(getTrialBalanceNet(selectedTrialBalanceRow)))}
                                                    </div>
                                                    <div className="text-muted-foreground">Activity</div>
                                                    <div className="text-right font-mono text-xs font-semibold tabular-nums">
                                                        {formatMoney(selectedTrialBalanceLedgerDebit)} / {formatMoney(selectedTrialBalanceLedgerCredit)}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="mt-2 text-sm text-muted-foreground">
                                                Select an account in the trial balance to review the transactions behind its balance.
                                            </div>
                                        )}
                                    </div>

                                    {selectedTrialBalanceRow ? (
                                        <div className="overflow-hidden rounded-md border border-secondary/20">
                                            <div className="flex items-center justify-between border-b border-ld px-3 py-2">
                                                <div>
                                                    <div className="text-sm font-semibold">Transaction Detail</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {selectedTrialBalanceLedgerRows.length} ledger {selectedTrialBalanceLedgerRows.length === 1 ? 'row' : 'rows'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="max-h-[360px] overflow-y-auto">
                                                <Table>
                                                    <THeader>
                                                        <TRow>
                                                            <THead className="min-w-20 px-2 text-xs">Date</THead>
                                                            <THead className="min-w-16 px-2 text-xs">JE</THead>
                                                            <THead className="min-w-36 px-2 text-xs">Memo</THead>
                                                            <THead className="min-w-20 px-2 text-right text-xs">Debit</THead>
                                                            <THead className="min-w-20 px-2 text-right text-xs">Credit</THead>
                                                        </TRow>
                                                    </THeader>
                                                    <TBody>
                                                        {selectedTrialBalanceLedgerRows.map((row, index) => (
                                                            <TRow key={String(row.id ?? `${row.entry_date ?? 'ledger'}-${index}`)}>
                                                                <TCell className="px-2 py-2 text-xs">{row.entry_date || '-'}</TCell>
                                                                <TCell className="px-2 py-2 font-mono text-xs">
                                                                    {getLedgerJournalEntryLabel(row, journalEntryById, journalEntryByLineId)}
                                                                </TCell>
                                                                <TCell className="px-2 py-2 text-xs">
                                                                    <div className="line-clamp-2 whitespace-normal">
                                                                        {String(row.memo ?? row.description ?? '-')}
                                                                    </div>
                                                                </TCell>
                                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">
                                                                    {formatTrialBalanceAmount(getLedgerDebitAmount(row))}
                                                                </TCell>
                                                                <TCell className="px-2 py-2 text-right text-xs tabular-nums">
                                                                    {formatTrialBalanceAmount(getLedgerCreditAmount(row))}
                                                                </TCell>
                                                            </TRow>
                                                        ))}
                                                        {selectedTrialBalanceLedgerRows.length === 0 ? (
                                                            <TRow>
                                                                <TCell className="px-2 py-3 text-xs text-muted-foreground" colSpan={5}>
                                                                    No ledger rows found for this account in the selected period.
                                                                </TCell>
                                                            </TRow>
                                                        ) : null}
                                                    </TBody>
                                                </Table>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="balance-sheet" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-1 p-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="lg:basis-1/4">
                                    <CardTitle className="text-base">Balance Sheet</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">As of {toDate}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:basis-3/4">
                                    <ReportMetric label="Assets" value={bsAssetsTotal} />
                                    <ReportMetric label="Liabilities" value={bsLiabilitiesTotal} />
                                    <ReportMetric label="Equity" value={bsEquityTotal} />
                                    <ReportMetric label="Check" value={bsTotal} valueClass={getSignedClass(bsTotal)} />
                                </div>
                            </CardHeader>
                            <CardContent className="border-t border-ld p-0">
                                <HierarchicalStatementReport
                                    sections={balanceSheetSections}
                                    emptyLabel="No balance sheet rows for this period."
                                    defaultLabel="All Balance Sheet"
                                    accountMetaByKey={accountMetaByKey}
                                    coaRows={coaRows}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pl" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <CardTitle className="text-base">Profit & Loss</CardTitle>
                                    <div className="mt-1 text-xs text-muted-foreground">{fromDate} to {toDate}</div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 lg:max-w-[320px]">
                                    <ReportMetric label="Revenue" value={revenueTotal} />
                                    <ReportMetric label="Expenses" value={expenseTotal} />
                                    <ReportMetric label="Net" value={isTotal} valueClass={getSignedClass(isTotal)} />
                                </div>
                            </CardHeader>
                            <CardContent className="border-t border-ld p-0">
                                <HierarchicalStatementReport
                                    sections={incomeStatementSections}
                                    emptyLabel="No income statement rows for this period."
                                    defaultLabel="All Profit & Loss"
                                    accountMetaByKey={accountMetaByKey}
                                    coaRows={coaRows}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="close" className="mt-4">
                        <Card className="shadow-none border-secondary/20">
                            <CardHeader className="p-4">
                                <CardTitle className="text-base">Close Period</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 flex flex-col gap-4 border-t border-ld">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <CloseStep title="Trial balance reviewed" />
                                    <CloseStep title="Statements reviewed" />
                                    <CloseStep title="Period ready to lock" />
                                </div>
                                <div className="flex justify-end">
                                    <Button className="h-9 rounded-full">Close Period</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
};

const ReportMetric = ({ label, value, valueClass = 'text-[#172033]' }: { label: string; value: number; valueClass?: string }) => (
    <div className="min-w-0 rounded-md border border-secondary/20 bg-muted/20 px-2 py-2">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
        <div className={`mt-1 whitespace-nowrap font-mono text-sm font-semibold tabular-nums ${valueClass}`}>{formatMoney(value)}</div>
    </div>
);

const HierarchicalStatementReport = ({
    sections,
    emptyLabel,
    defaultLabel,
    accountMetaByKey,
    coaRows,
}: {
    sections: DisplayStatementSection[];
    emptyLabel: string;
    defaultLabel: string;
    accountMetaByKey: Record<string, COAAccountMeta>;
    coaRows: COARow[];
}) => {
    const [selectedKey, setSelectedKey] = useState('all');

    const nodes = useMemo<HierarchyNode[]>(() => {
        const allAccounts = sections.flatMap((section) => flattenSectionAccounts(section.section));
        const allTotal = sections.reduce((sum, section) => sum + section.total, 0);
        const hierarchy: HierarchyNode[] = [
            {
                key: 'all',
                label: defaultLabel,
                amount: allTotal,
                count: allAccounts.length,
                level: 0,
                accounts: allAccounts,
            },
        ];

        sections.forEach((displaySection) => {
            const sectionAccounts = flattenSectionAccounts(displaySection.section);
            hierarchy.push({
                key: displaySection.key,
                label: displaySection.title,
                amount: displaySection.total,
                count: sectionAccounts.length,
                level: 0,
                accounts: sectionAccounts,
                sectionKey: displaySection.key,
            });

            const coaNodes = buildCOAStatementNodes(displaySection, coaRows, sectionAccounts);
            if (coaNodes) {
                hierarchy.push(...coaNodes);
                return;
            }

            groupStatementAccountsByCOA(displaySection.key, sectionAccounts, accountMetaByKey).forEach((level2) => {
                hierarchy.push({
                    key: level2.key,
                    label: level2.label,
                    amount: level2.amount,
                    count: level2.accounts.length,
                    level: 1,
                    accounts: level2.accounts,
                    sectionKey: displaySection.key,
                    level2Name: getFirstAccountMetaLabel(level2.accounts, accountMetaByKey, 'group'),
                });

                level2.subgroups.forEach((level3) => {
                    hierarchy.push({
                        key: level3.key,
                        label: level3.label,
                        amount: level3.amount,
                        count: level3.accounts.length,
                        level: 2,
                        accounts: level3.accounts,
                        sectionKey: displaySection.key,
                        level2Name: getFirstAccountMetaLabel(level2.accounts, accountMetaByKey, 'group'),
                        level3Name: getFirstAccountMetaLabel(level3.accounts, accountMetaByKey, 'subgroup'),
                    });
                });
            });
        });

        return hierarchy;
    }, [accountMetaByKey, coaRows, defaultLabel, sections]);

    useEffect(() => {
        if (!nodes.some((node) => node.key === selectedKey)) {
            setSelectedKey('all');
        }
    }, [nodes, selectedKey]);

    const selectedNode = nodes.find((node) => node.key === selectedKey) ?? nodes[0];
    const selectedAccounts = useMemo(
        () =>
            [...(selectedNode?.accounts ?? [])].sort((a, b) =>
                getAccountCode(a).localeCompare(getAccountCode(b), undefined, { numeric: true }),
            ),
        [selectedNode],
    );

    const hasRows = nodes[0]?.count > 0;

    if (!hasRows) {
        return <div className="px-4 py-4 text-sm text-muted-foreground">{emptyLabel}</div>;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,40%)_minmax(0,1fr)]">
            <div className="border-b border-ld lg:border-b-0 lg:border-r">
                <div className="max-h-[560px] overflow-y-auto p-2">
                    {nodes.map((node, index) => {
                        const hasChildren = nodes[index + 1]?.level > node.level;
                        const isSelected = selectedKey === node.key;
                        const isPostingLeaf = !hasChildren && node.level > 0;

                        return (
                            <button
                                key={node.key}
                                type="button"
                                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 text-left transition-colors ${
                                    isSelected ? 'bg-primary/10 text-primary' : hasChildren ? 'bg-gray-50/80 hover:bg-muted/60 dark:bg-white/[0.03]' : 'hover:bg-muted/50'
                                }`}
                                onClick={() => setSelectedKey(node.key)}
                            >
                                <span className="flex min-w-0 items-center" style={{ paddingLeft: `${Math.min(node.level, MAX_COA_LEVEL - 1) * 32}px` }}>
                                    {node.level > 0 ? (
                                        <span className="relative mr-2 h-5 w-5 shrink-0" aria-hidden="true">
                                            <span className="absolute left-0 top-0 h-full border-l border-gray-200 dark:border-white/10" />
                                            <span className="absolute left-0 top-1/2 w-5 border-t border-gray-200 dark:border-white/10" />
                                        </span>
                                    ) : null}
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400">
                                        {hasChildren || node.level === 0 ? (
                                            <Icon icon="material-symbols:folder-outline-rounded" width={16} height={16} />
                                        ) : (
                                            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                        )}
                                    </span>
                                    <span className="ml-2 min-w-0">
                                        <span className={`block truncate text-sm ${isPostingLeaf ? 'font-normal text-gray-700 dark:text-white/70' : 'font-semibold text-gray-900 dark:text-white'}`}>
                                            {node.code ? (
                                                <span className="font-mono text-sm text-gray-700 dark:text-white/70">{node.code}</span>
                                            ) : null}
                                            {node.code ? <span className="ml-2">{node.label}</span> : node.label}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {node.count} {node.count === 1 ? 'account' : 'accounts'}
                                        </span>
                                    </span>
                                </span>
                                <span className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums">{formatMoney(node.amount)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 border-b border-ld px-4 py-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{selectedNode?.label ?? defaultLabel}</div>
                        <div className="text-xs text-muted-foreground">
                            {selectedAccounts.length} {selectedAccounts.length === 1 ? 'posting account' : 'posting accounts'}
                        </div>
                    </div>
                    <div className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
                        {formatMoney(selectedNode?.amount ?? 0)}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <THeader>
                            <TRow>
                                <THead className="min-w-24 px-4">Code</THead>
                                <THead className="min-w-56 px-4">Account</THead>
                                <THead className="min-w-40 px-4">Group</THead>
                                <THead className="min-w-32 px-4 text-right">Amount</THead>
                            </TRow>
                        </THeader>
                        <TBody>
                            {selectedAccounts.map((row, index) => (
                                <TRow key={getReportRowKey(selectedNode?.key ?? 'statement', row, index)}>
                                    <TCell className="px-4 py-2 font-mono text-sm">{getAccountCode(row) || '-'}</TCell>
                                    <TCell className="px-4 py-2 text-sm">{getAccountName(row) || '-'}</TCell>
                                    <TCell className="px-4 py-2 text-sm text-muted-foreground">
                                        {getPostingAccountGroup(row, accountMetaByKey)}
                                    </TCell>
                                    <TCell className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                                        {formatMoney(row.amount ?? 0)}
                                    </TCell>
                                </TRow>
                            ))}
                            {selectedAccounts.length === 0 ? (
                                <TRow>
                                    <TCell className="px-4 py-3 text-sm text-muted-foreground" colSpan={4}>
                                        No posting accounts in this group.
                                    </TCell>
                                </TRow>
                            ) : null}
                            <TRow className="bg-muted/20">
                                <TCell className="px-4 py-2 text-sm font-semibold" colSpan={3}>
                                    Total
                                </TCell>
                                <TCell className="px-4 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                                    {formatMoney(selectedNode?.amount ?? 0)}
                                </TCell>
                            </TRow>
                        </TBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

const CloseStep = ({ title }: { title: string }) => (
    <div className="rounded-md border border-secondary/20 p-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">Pending</div>
    </div>
);

export default Reports;
