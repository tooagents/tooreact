import { apiFetch } from 'src/core/apihttp';

interface ListPayrollHistoryParams {
    skip?: number;
    limit?: number;
}

export interface PayrollHistoryResponse {
    id?: string;
    history_id?: string;
    period_key?: string;
    biz_id?: string;
    schedule_id?: string;
    employee_id?: string;
    period_start?: string;
    period_end?: string;
    pay_day?: string | null;
    total_gross?: number | string | null;
    payroll_cost?: number | string | null;
    total_net?: number | string | null;
    taxes_and_deductions?: number | string | null;
    employee_count?: number | null;
    excluded_count?: number | null;
    employment_type?: string | null;
    full_name?: string | null;
    annual_salary_snapshot?: number | string | null;
    hourly_rate_snapshot?: number | string | null;
    federal_claim_snapshot?: number | string | null;
    ontario_claim_snapshot?: number | string | null;
    regular_hours?: number | string | null;
    overtime_hours?: number | string | null;
    bonus?: number | string | null;
    vacation?: number | string | null;
    cpp?: number | string | null;
    ei?: number | string | null;
    tax?: number | string | null;
    gross?: number | string | null;
    total_deduction?: number | string | null;
    adjustment?: number | string | null;
    net?: number | string | null;
    cpp_exempt_snapshot?: boolean;
    ei_exempt_snapshot?: boolean;
    status?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export interface PayrollHistoryDetailResponse {
    summary: PayrollHistoryResponse;
    entries: PayrollHistoryResponse[];
}

export const historyAPI = {
    async listPayrollHistory(params?: ListPayrollHistoryParams): Promise<PayrollHistoryResponse[]> {
        const queryParams = new URLSearchParams();

        if (params?.skip !== undefined) queryParams.append('skip', String(params.skip));
        if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));

        const path = queryParams.toString()
            ? `/history/list?${queryParams.toString()}`
            : '/history/list';

        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch payroll history: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        const payload = await response.json();
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray((payload as { data?: unknown }).data)) {
            return (payload as { data: PayrollHistoryResponse[] }).data;
        }
        if (payload && Array.isArray((payload as { items?: unknown }).items)) {
            return (payload as { items: PayrollHistoryResponse[] }).items;
        }
        return [];
    },

    async getPayrollHistoryDetail(id: string): Promise<PayrollHistoryDetailResponse | PayrollHistoryResponse | PayrollHistoryResponse[]> {
        const path = `/t4/get_payroll_history_detail/detail?id=${encodeURIComponent(id)}`;
        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch payroll history detail: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },

    async searchPayrollHistory(query: string, topK = 5): Promise<unknown> {
        // const response = await apiFetch('/embedding/rag_answer_rerank', {
        // const response = await apiFetch('/embedding/route_answer', {
        // const response = await apiFetch('/brain/python', {
        // const response = await apiFetch('/brain/langgraph', {
        const response = await apiFetch('/brain/lgstream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, top_k: topK }),
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to search payroll history: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },

};