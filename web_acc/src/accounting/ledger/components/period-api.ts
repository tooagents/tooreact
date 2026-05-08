import { apiFetch } from "src/core/apihttp";
import type { PayrollPeriod } from "src/types/payroll";

type ListPayrollPeriodsParams = {
    skip?: number;
    limit?: number;
    status?: string;
};

export const periodAPI = {
    async listPayrollPeriods(params?: ListPayrollPeriodsParams): Promise<PayrollPeriod[]> {
        const queryParams = new URLSearchParams();
        if (params?.skip !== undefined) queryParams.append("skip", String(params.skip));
        if (params?.limit !== undefined) queryParams.append("limit", String(params.limit));
        if (params?.status !== undefined) queryParams.append("status", params.status);

        const path = queryParams.toString()
            ? `/period/list?${queryParams.toString()}`
            : "/period/list";

        const response = await apiFetch(path);
        if (!response.ok) {
            const details = await response.text().catch(() => "");
            throw new Error(
                `Failed to fetch payroll periods: ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`,
            );
        }

        return response.json();
    },

    async createPayrollPeriod(data: Partial<PayrollPeriod>): Promise<PayrollPeriod> {
        const response = await apiFetch("/period/new", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const details = await response.text().catch(() => "");
            throw new Error(
                `Failed to create payroll period: ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`,
            );
        }
        return response.json();
    },
};
