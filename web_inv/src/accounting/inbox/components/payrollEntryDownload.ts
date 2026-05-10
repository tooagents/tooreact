import type { PayrollEntryRow } from './PayrollEntryTable';

const headers = [
    'Employee',
    'Type',
    'Regular Hours',
    'OT Hours',
    'Gross',
    'CPP',
    'EI',
    'Tax',
    'Total Deduction',
    'Manual Adjustment',
    'Net',
    'Status',
    'Excluded',
];

export const downloadPayrollEntriesCsv = (rows: PayrollEntryRow[]) => {
    if (!rows.length) return;
    const dataRows = rows.map((row) => [
        row.employee,
        row.employment_type,
        row.regular_hours,
        row.overtime_hours,
        row.gross,
        row.cpp,
        row.ei,
        row.tax,
        row.total_deduction,
        row.adjustment,
        row.net,
        row.status,
        row.excluded,
    ]);
    const csv = [headers, ...dataRows]
        .map((line) => line.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'payroll-entries.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
