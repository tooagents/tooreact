import { apiFetchGZ } from 'src/core/apihttp';

interface InvoicePaymentsCsvParams {
    startDate: string;
    endDate: string;
}

const collectEmails = (value: unknown): string[] => {
    const emails = new Set<string>();
    const visit = (node: unknown) => {
        if (!node) return;
        if (typeof node === 'string') {
            const trimmed = node.trim();
            if (trimmed.includes('@')) emails.add(trimmed);
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (typeof node === 'object') {
            Object.values(node as Record<string, unknown>).forEach(visit);
        }
    };
    visit(value);
    return Array.from(emails);
};

const parseErrorDetail = async (response: Response): Promise<string> => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        const jsonBody = await response.json().catch(() => null);
        const emailsFromList = collectEmails(jsonBody);
        console.log('[invoice_payments_csv][integration-api][error-json]', {
            emailsFromList,
            body: jsonBody,
        });
        if (typeof jsonBody?.detail === 'string') {
            return jsonBody.detail;
        }
        return JSON.stringify(jsonBody ?? {});
    }
    return response.text().catch(() => '');
};

export const integrationAPI = {
    async downloadInvoicePaymentsCsv(params: InvoicePaymentsCsvParams): Promise<Blob> {
        const queryParams = new URLSearchParams({
            start_date: params.startDate,
            end_date: params.endDate,
        });

        const response = await apiFetchGZ(`/invoice_payments_csv?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                Accept: 'text/csv,application/json',
            },
        });
        console.log('[invoice_payments_csv][integration-api][download-call]', {
            startDate: params.startDate,
            endDate: params.endDate,
        });

        if (!response.ok) {
            const errorDetail = (await parseErrorDetail(response)).trim();
            const message = errorDetail
                ? `Download failed with status ${response.status}: ${errorDetail}`
                : `Download failed with status ${response.status}`;
            throw new Error(message);
        }

        console.log('[invoice_payments_csv][integration-api][success]', {
            status: response.status,
            contentType: response.headers.get('content-type'),
        });
        return response.blob();
    },
};
