'use client';

import { Icon } from '@iconify/react/dist/iconify.js';
import { TbDotsVertical } from 'react-icons/tb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from 'src/components/ui/dropdown-menu';
import { Button } from 'src/components/ui/button';
import { Table, TBody, TCell, THead, THeader, TRow, } from 'src/components/ui/table';
import { Employee } from 'src/types/employee';
import { Input } from 'src/components/ui/input';
import { useEffect, useMemo, useState } from 'react';
import { downloadEmployeesCsv } from './employeeDownload';

interface EmployeeDataTableProps {
    data?: Employee[];
    onAddNew?: () => void;
    onEdit?: (employee: Employee) => void;
    onDelete?: (employeeId: string) => void;
}

const pageSize = 20;

export const EmployeeDataTable = ({ data = [], onAddNew, onEdit, onDelete }: EmployeeDataTableProps) => {
    const [query, setQuery] = useState('');
    const [pageIndex, setPageIndex] = useState(0);

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
        downloadEmployeesCsv(filtered);
    };

    return (
        <div className="p-4 pt-0 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="relative flex-1 min-w-0">
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
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search..."
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <Button
                        onClick={handleDownload}
                        variant="lightsecondary"
                        size="icon"
                        className="h-9 w-9 rounded-md border border-secondary/20"
                        title="Download CSV"
                        disabled={filtered.length === 0}
                    >
                        <Icon icon="material-symbols:download-rounded" width={18} height={18} />
                        <span className="sr-only">Download CSV</span>
                    </Button>
                    {onAddNew && (
                        <Button
                            onClick={onAddNew}
                            className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start"
                            size="sm"
                        >
                            <Icon icon="mdi:plus" className="w-4 h-4" />
                            <span className="hidden sm:inline">Add New Employee</span>
                            <span className="sm:hidden">Add Employee</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto border rounded-md border-ld">
                <Table>
                    <THeader>
                        <TRow>
                            <THead className="font-semibold">First Name</THead>
                            <THead className="font-semibold">Last Name</THead>
                            <THead className="font-semibold">Email</THead>
                            <THead className="font-semibold">Type</THead>
                            <THead className="font-semibold">Regular Hours</THead>
                            <THead className="font-semibold">Hourly Rate</THead>
                            <THead className="font-semibold">Annual Salary</THead>
                            <THead className="font-semibold">Action</THead>
                        </TRow>
                    </THeader>

                    <TBody>
                        {filtered.length > 0 ? (
                            pageData.map((employee, index) => (
                                <TRow key={employee.id ?? `${employee.email ?? 'employee'}-${index}`}>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.first_name || '-'}
                                    </TCell>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.last_name || '-'}
                                    </TCell>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.email || '-'}
                                    </TCell>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.employment_type || '-'}
                                    </TCell>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.regular_hours || '-'}
                                    </TCell>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.hourly_rate || '-'}
                                    </TCell>
                                    <TCell className="text-gray-700 dark:text-white/70">
                                        {employee.annual_salary || '-'}
                                    </TCell>

                                    <TCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                                    <TbDotsVertical size={22} />
                                                </span>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem className="flex gap-3 items-center cursor-pointer" onClick={() => onEdit?.(employee)}>
                                                    <Icon icon={'solar:pen-new-square-broken'} height={18} />
                                                    <span>Edit</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="flex gap-3 items-center cursor-pointer" onClick={() => employee.id && onDelete?.(employee.id)}>
                                                    <Icon icon={'solar:trash-bin-minimalistic-outline'} height={18} />
                                                    <span>Delete</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TCell>
                                </TRow>
                            ))
                        ) : (
                            <TRow>
                                <TCell colSpan={8} className="text-center p-6 text-gray-500 dark:text-white/70 font-medium">
                                    No data available.
                                </TCell>
                            </TRow>
                        )}
                    </TBody>
                </Table>
            </div>

            <div className="flex flex-col gap-4 p-2">
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
        </div>
    );
};
