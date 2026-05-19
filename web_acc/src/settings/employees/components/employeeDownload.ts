import type { Employee } from 'src/types/employee';

const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Type',
    'Regular Hours',
    'Hourly Rate',
    'Annual Salary',
];

export const downloadEmployeesCsv = (rows: Employee[]) => {
    if (!rows.length) return;
    const dataRows = rows.map((row) => [
        row.first_name,
        row.last_name,
        row.email,
        row.employment_type,
        row.regular_hours,
        row.hourly_rate,
        row.annual_salary,
    ]);
    const csv = [headers, ...dataRows]
        .map((line) => line.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employees.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
