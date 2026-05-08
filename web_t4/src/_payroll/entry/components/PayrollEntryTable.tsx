'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Badge } from 'src/components/ui/badge';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import CardBox from 'src/components/shared/CardBox';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Icon } from '@iconify/react/dist/iconify.js';
import { User, UserX } from 'lucide-react';
import { downloadPayrollEntriesCsv } from './payrollEntryDownload';

export type PayrollEntryRow = {
    row_index: number;
    employee: string;
    employment_type: string;
    rate: string;
    regular_hours: string;
    overtime_hours: string;
    gross: string;
    cpp: string;
    ei: string;
    tax: string;
    total_deduction: string;
    adjustment: string;
    net: string;
    status: string;
    excluded: string;
};

type PayrollEntryTableProps = {
    data?: PayrollEntryRow[];
    onEdit?: (row: PayrollEntryRow) => void;
    onDelete?: (row: PayrollEntryRow) => void;
    onExclude?: (row: PayrollEntryRow) => void;
    onAdd?: () => void;
    onFinalize?: () => void;
    isFinalizing?: boolean;
    onUpdate?: (
        rowIndex: number,
        field: 'rate' | 'regular_hours' | 'overtime_hours' | 'adjustment',
        value: string,
    ) => void;
    onCommit?: (
        rowIndex: number,
        field: 'rate' | 'regular_hours' | 'overtime_hours' | 'adjustment',
        value: string,
    ) => void;
};

const pageSize = 20;

const toTitleCase = (value?: string) =>
    (value ?? '-').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

const statusClass = (status?: string) => {
    const normalized = (status ?? '').trim().toLowerCase();
    if (normalized === 'approved' || normalized === 'completed') return 'bg-green-100 text-green-700';
    if (normalized === 'draft') return 'bg-transparent border border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-300';
    return 'bg-blue-100 text-blue-700';
};

const formatDecimalDisplay = (value?: string) => {
    if (value === undefined || value === null || value === '') return '-';
    const normalized = String(value).replace(/,/g, '');
    const numberValue = Number(normalized);
    if (Number.isNaN(numberValue)) return String(value);
    return numberValue.toFixed(2);
};

const formatDecimalCommit = (value: string) => {
    if (!value) return value;
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return value;
    return numberValue.toFixed(2);
};

const formatDecimalInputValue = (value?: string) => {
    if (value === undefined || value === null || value === '') return '';
    const normalized = String(value).replace(/,/g, '');
    const numberValue = Number(normalized);
    if (Number.isNaN(numberValue)) return String(value);
    return numberValue.toFixed(2);
};

const formatCurrencyInputValue = (value?: string) => {
    const formatted = formatDecimalInputValue(value);
    if (!formatted) return '';
    return `$${formatted}`;
};

const stripCurrencyInput = (value: string) => value.replace(/\$/g, '').replace(/,/g, '').trim();

export const PayrollEntryTable = ({
    data = [],
    onEdit: _onEdit,
    onDelete: _onDelete,
    onExclude,
    onAdd,
    onFinalize,
    isFinalizing = false,
    onUpdate,
    onCommit,
}: PayrollEntryTableProps) => {
    const [query, setQuery] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const derivedCellClass = 'bg-transparent';

    const filtered = useMemo(() => {
        if (!query.trim()) return data;
        const needle = query.trim().toLowerCase();
        return data.filter((row) =>
            Object.values(row).some((val) => String(val).toLowerCase().includes(needle)),
        );
    }, [data, query]);

    useEffect(() => {
        setPageIndex(0);
    }, [query, data.length]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageData = useMemo(
        () => filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [filtered, pageIndex],
    );

    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    const handleDownload = () => {
        downloadPayrollEntriesCsv(filtered);
    };

    return (
            <div>
                {data.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">No data available.</p>
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-4">
                            <Input
                                type="text"
                                className="flex-1 min-w-0 rounded-md border-0 bg-gray-100/80 px-3 shadow-none placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 dark:bg-slate-900/50 dark:placeholder:text-white/20"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search..."
                            />
                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                <Button
                                    onClick={handleDownload}
                                    variant="lightsecondary"
                                    size="icon"
                                    className="h-9 w-9 rounded-md border border-secondary/20"
                                    title="Download CSV"
                                >
                                    <Icon icon="material-symbols:download-rounded" width={18} height={18} />
                                    <span className="sr-only">Download CSV</span>
                                </Button>
                                <Button
                                    className="h-9 px-4 rounded-full border-secondary/30 text-secondary hover:bg-secondary/10"
                                    variant="outline"
                                    onClick={onAdd}
                                    disabled={!onAdd}
                                >
                                    <Icon icon="mdi:plus-circle-outline" className="h-4 w-4" />
                                    Add Employee
                                </Button>
                                <Button
                                    className="h-9 px-5 rounded-full shadow-sm"
                                    onClick={onFinalize}
                                    disabled={!onFinalize || isFinalizing}
                                >
                                    {isFinalizing ? <LoadingSpinner size="sm" variant="dots" /> : <Icon icon="mdi:check-decagram-outline" className="h-4 w-4" />}
                                    {isFinalizing ? 'Thinking...' : 'Finalize'}
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-md border-ld">
                            <Table>
                                <THeader>
                                    <TRow>
                                        <THead className="min-w-3 px-2">Employee</THead>
                                        <THead className="min-w-3 px-2">
                                            <span className="inline-flex flex-col items-start text-left leading-tight">
                                                <span>Type</span>
                                            </span>
                                        </THead>
                                        <THead className="min-w-3 px-2 text-right">Rate</THead>
                                        <THead className="min-w-3 px-2 text-right">Reg Hrs</THead>
                                        <THead className="min-w-3 px-2 text-right">OT Hrs</THead>
                                        <THead className={`min-w-3 px-2 text-right`}>Gross</THead>
                                        <THead className="min-w-3 px-2 text-right">CPP</THead>
                                        <THead className="min-w-3 px-2 text-right">EI</THead>
                                        <THead className="min-w-3 px-2 text-right">Tax</THead>
                                        <THead className={`min-w-3 px-2 text-right`}>Tot Deduction</THead>
                                        <THead className="min-w-3 px-2 text-right">Adjustment</THead>
                                        <THead className={`min-w-3 px-2 text-right`}>Net</THead>
                                        <THead className="min-w-28 px-2">Status</THead>
                                        <THead className="min-w-3 px-2 text-right">Action</THead>
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {pageData.map((row) => {
                                        const isExcluded =
                                            row.excluded === 'Yes' ||
                                            row.excluded === 'true' ||
                                            row.excluded === 'Excluded';
                                        const isSalary =
                                            (row.employment_type ?? '').toLowerCase() === 'salary';
                                        return (
                                            <TRow
                                                key={row.row_index}
                                                className={`hover:bg-primary/10 transition-colors ${isExcluded ? 'text-gray-400 line-through' : ''}`}
                                            >
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                    {row.employee}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3">
                                                    {row.employment_type}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-2 text-right tabular-nums">
                                                    {(row.employment_type ?? '').toLowerCase() === 'salary' ? (
                                                        <span>{formatDecimalDisplay(row.rate)}</span>
                                                    ) : (
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            inputMode="decimal"
                                                            placeholder="0"
                                                            className={`h-8 min-w-[72px] rounded-md border-0 bg-gray-100/80 px-2 text-right tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:bg-slate-900/50 ${isExcluded ? 'line-through text-gray-400' : ''}`}
                                                            value={row.rate}
                                                            onChange={(e) => onUpdate?.(row.row_index, 'rate', e.target.value)}
                                                            onBlur={(e) =>
                                                                onCommit?.(row.row_index, 'rate', formatDecimalCommit(e.target.value))
                                                            }
                                                        />
                                                    )}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-2 text-right">
                                                    {isSalary ? (
                                                        <span className="block px-2 tabular-nums text-gray-500 dark:text-white/40">
                                                            {row.regular_hours
                                                                ? formatDecimalDisplay(row.regular_hours)
                                                                : '-'}
                                                        </span>
                                                    ) : (
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            pattern="^-?\\d*(\\.\\d{0,2})?$"
                                                            placeholder="0"
                                                            className={`h-8 min-w-[72px] rounded-md border-0 bg-gray-100/80 px-2 text-right tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:bg-slate-900/50 ${isExcluded ? 'line-through text-gray-400' : ''}`}
                                                            value={formatDecimalInputValue(row.regular_hours)}
                                                            onChange={(e) =>
                                                                onUpdate?.(row.row_index, 'regular_hours', e.target.value)
                                                            }
                                                            onBlur={(e) =>
                                                                onCommit?.(
                                                                    row.row_index,
                                                                    'regular_hours',
                                                                    formatDecimalCommit(e.target.value),
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-2 text-right">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        inputMode="decimal"
                                                        placeholder="0"
                                                        className={`h-8 min-w-[72px] rounded-md border-0 bg-gray-100/80 px-2 text-right tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:bg-slate-900/50 ${isExcluded ? 'line-through text-gray-400' : ''}`}
                                                        value={row.overtime_hours}
                                                        onChange={(e) => onUpdate?.(row.row_index, 'overtime_hours', e.target.value)}
                                                        onBlur={(e) =>
                                                            onCommit?.(
                                                                row.row_index,
                                                                'overtime_hours',
                                                                formatDecimalCommit(e.target.value),
                                                            )
                                                        }
                                                    />
                                                </TCell>
                                                <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                    {formatDecimalDisplay(row.gross)}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                    {formatDecimalDisplay(row.cpp)}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                    {formatDecimalDisplay(row.ei)}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums">
                                                    {formatDecimalDisplay(row.tax)}
                                                </TCell>
                                                <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                    {formatDecimalDisplay(row.total_deduction)}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-2 py-2 text-right">
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        pattern="^-?\\$?\\d*(\\.\\d{0,2})?$"
                                                        placeholder="$0.00"
                                                        className={`h-8 min-w-[84px] rounded-md border-0 bg-gray-100/80 px-2 text-right tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 dark:bg-slate-900/50 ${isExcluded ? 'line-through text-gray-400' : ''}`}
                                                        value={formatCurrencyInputValue(row.adjustment)}
                                                        onChange={(e) =>
                                                            onUpdate?.(
                                                                row.row_index,
                                                                'adjustment',
                                                                stripCurrencyInput(e.target.value),
                                                            )
                                                        }
                                                        onBlur={(e) =>
                                                            onCommit?.(
                                                                row.row_index,
                                                                'adjustment',
                                                                formatDecimalCommit(stripCurrencyInput(e.target.value)),
                                                            )
                                                        }
                                                    />
                                                </TCell>
                                                <TCell className={`text-gray-700 dark:text-white/70 text-sm px-2 py-3 text-right tabular-nums ${derivedCellClass}`}>
                                                    {formatDecimalDisplay(row.net)}
                                                </TCell>
                                                <TCell className="px-2 py-3">
                                                    <Badge className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(row.status)}`}>
                                                        {toTitleCase(row.status)}
                                                    </Badge>
                                                </TCell>
                                                <TCell className="px-2 py-3">
                                                    <div className="flex items-center justify-end">
                                                        {onExclude && (
                                                            <Button
                                                                size="sm"
                                                                variant={isExcluded ? 'lightsecondary' : 'lighterror'}
                                                                className="size-8 !rounded-full flex-shrink-0"
                                                                title={isExcluded ? 'Include' : 'Exclude'}
                                                                onClick={() => onExclude(row)}
                                                            >
                                                                {isExcluded ? (
                                                                    <User className="size-4" />
                                                                ) : (
                                                                    <UserX className="size-4" />
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TCell>
                                            </TRow>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </div>

                        <div className="flex flex-col gap-4 p-4">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                        disabled={!canPrev}
                                        variant="secondary"
                                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                        disabled={!canNext}
                                        className="flex-1 sm:flex-none text-xs sm:text-sm"
                                    >
                                        Next
                                    </Button>
                                </div>

                                <div className="text-forest-black dark:text-white/90 font-medium text-xs sm:text-base whitespace-nowrap">
                                    Page {pageIndex + 1} of {pageCount}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
    );
};

