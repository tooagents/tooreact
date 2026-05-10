import { PayrollSchedule } from 'src/types/payroll';
import { apiFetch } from 'src/core/apihttp';


interface ListPayrollSchedulesParams {
    skip?: number;
    limit?: number;
    status?: string;
}

interface ListPayrollEntriesParams {
    skip?: number;
    limit?: number;
    payperiod?: string;
}

interface AddEmployeesToPayrollPayload {
    employee_ids: string[];
}

export interface PayrollEntryResponse {
    id?: string;
    employee_id?: string;
    full_name?: string;
    employment_type?: string;
    annual_salary_snapshot?: number | string | null;
    hourly_rate_snapshot?: number | string | null;
    federal_claim_snapshot?: number | string;
    ontario_claim_snapshot?: number | string;
    regular_hours?: number | string | null;
    overtime_hours?: number | string | null;
    bonus?: number | string;
    vacation?: number | string;
    cpp?: number | string;
    ei?: number | string;
    tax?: number | string;
    gross?: number | string | null;
    total_deduction?: number | string | null;
    adjustment?: number | string | null;
    net?: number | string | null;
    cpp_exempt_snapshot?: boolean;
    ei_exempt_snapshot?: boolean;
    excluded?: boolean;
    status?: string;
    employee?: {
        id?: string;
        first_name?: string;
        last_name?: string;
        name?: string;
        full_name?: string;
    } | null;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export const entryAPI = {
    /*** List payroll entries with pagination and optional pay period filter*/
    async listPayrollEntries(params?: ListPayrollEntriesParams): Promise<PayrollEntryResponse[]> {
        const queryParams = new URLSearchParams();

        if (params?.skip !== undefined) {
            queryParams.append('skip', String(params.skip));
        }
        if (params?.limit !== undefined) {
            queryParams.append('limit', String(params.limit));
        }
        if (params?.payperiod !== undefined && params.payperiod !== '') {
            queryParams.append('payperiod', params.payperiod);
        }

        const path = queryParams.toString()
            ? `/t4/get_payroll_entry_list?${queryParams.toString()}`
            : '/t4/get_payroll_entry_list';

        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch payroll entries: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },



    async finalizePayroll(): Promise<[]> {
        const response = await apiFetch('/t4/post_payroll_entry_finalize', { method: 'POST' });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to finalize payroll: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },


    async currentEntry(params?: ListPayrollEntriesParams): Promise<PayrollEntryResponse[]> {
        const queryParams = new URLSearchParams();

        if (params?.skip !== undefined) {
            queryParams.append('skip', String(params.skip));
        }
        if (params?.limit !== undefined) {
            queryParams.append('limit', String(params.limit));
        }

        const path = queryParams.toString()
            ? `/t4/get_payroll_entry_list?${queryParams.toString()}`
            : '/t4/get_payroll_entry_list';

        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch payroll entries: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },

    /*** Update payroll entry by ID */
    async updatePayrollEntry(
        payload: PayrollEntryResponse,
    ): Promise<PayrollEntryResponse> {
        const response = await apiFetch('/t4/post_payroll_entry_edit', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to update payroll entry: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },

    /*** Add employees to the current payroll run */
    async addEmployeesToPayroll(employeeIds: string[]): Promise<PayrollEntryResponse[] | unknown> {
        const payload: AddEmployeesToPayrollPayload = { employee_ids: employeeIds };
        const response = await apiFetch('/entry/add_employees', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(
                `Failed to add employees to payroll: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,
            );
        }

        return response.json();
    },


};
