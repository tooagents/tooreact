import type { ClientDB } from 'src/types/type_client';
import { getClientDisplayName } from 'src/types/type_client';

const headers = [
    'Client Name',
    'Contact',
    'Phone',
    'Email',
    'Status',
];

export const downloadClientsCsv = (rows: ClientDB[]) => {
    if (!rows.length) return;
    const dataRows = rows.map((row) => [
        getClientDisplayName(row),
        row.client_contact_name,
        row.client_mainphone ?? row.phone,
        row.client_email ?? row.email,
        row.client_status,
    ]);
    const csv = [headers, ...dataRows]
        .map((line) => line.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'clients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
