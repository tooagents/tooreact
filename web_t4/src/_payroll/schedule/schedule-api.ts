import { PayrollSchedule } from 'src/types/payroll';
import { apiFetch } from 'src/core/apihttp';

interface ListPayrollSchedulesParams {
    skip?: number;
    limit?: number;
    status?: string;
}

export interface PayrollEntryResponse {
    id?: string;
    payperiod_id?: string;
    employee_id?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export const scheduleAPI = {

    /*** Create a new payroll schedule*/
    async createPayrollSchedule(data: Partial<PayrollSchedule>): Promise<PayrollSchedule> {
        const response = await apiFetch('/schedule/new', {method: 'POST',body: JSON.stringify(data),});
        if (!response.ok) {throw new Error(`Failed to create payroll schedule: ${response.statusText}`);}
        return response.json();
    },


    /*** Get payroll schedule by ID*/
    async getPayrollSchedule(scheduleId: string): Promise<PayrollSchedule> {
        const response = await apiFetch(`/schedule/getbyid/${scheduleId}`);
        if (!response.ok) { throw new Error(`Failed to fetch payroll schedule: ${response.statusText}`); }
        return response.json();
    },



    /**     * List all payroll schedules with pagination and filtering     */
    async listPayrollSchedules(params?: ListPayrollSchedulesParams): Promise<PayrollSchedule[]> {
        const queryParams = new URLSearchParams();
        if (params?.skip !== undefined) {queryParams.append('skip', String(params.skip));}
        if (params?.limit !== undefined) {queryParams.append('limit', String(params.limit));}
        if (params?.status !== undefined) {queryParams.append('status', params.status);}

        const path = queryParams.toString()
            ? `/t4/get_payroll_schedule_list?${queryParams.toString()}`
            : '/t4/get_payroll_schedule_list';

        const response = await apiFetch(path);

        if (!response.ok) {throw new Error(`Failed to fetch payroll schedules: ${response.statusText}`);}
        return response.json();
    },



    /*** edit payroll schedule*/
    async editSchedule(payload: PayrollSchedule): Promise<PayrollSchedule> {
        const response = await apiFetch(`/t4/post_payroll_schedule`, {method: 'POST', body: JSON.stringify(payload),});
        if (!response.ok) { throw new Error(`Failed to update payroll schedule: ${response.statusText}`); }
        return response.json();
    },

};