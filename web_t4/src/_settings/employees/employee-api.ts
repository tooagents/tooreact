import { Employee } from 'src/types/employee';
import { apiFetch } from 'src/core/apihttp';
import type { PaginationInterface } from 'src/types/interface_pagination';
import { useClientStore } from 'src/store/client-store';

interface SearchEmployeesParams {
    first_name: string;
    last_name: string;
}

export const employeeAPI = {
    /*** Create a new employee*/
    async createEmployee(data: Omit<Employee, 'id'>): Promise<Employee> {
        const response = await apiFetch('/employee/new', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        if (!response.ok) { throw new Error(`Failed to create employee: ${response.statusText}`); }

        return response.json();
    },


    /**     * Update employee     */
    async updateEmployee(data: Employee): Promise<Employee> {
        const response = await apiFetch(`/employee/edit`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });

        if (!response.ok) { throw new Error(`Failed to update employee: ${response.statusText}`); }
        return response.json();
    },

    /*** Get employee by ID*/
    async getEmployee(employeeId: string): Promise<Employee> {
        const response = await apiFetch(`/employee/getbyid/${employeeId}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch employee: ${response.statusText}`);
        }

        return response.json();
    },


    /*** List all employees with pagination*/
    async listEmployees(params?: PaginationInterface): Promise<Employee[]> {
        // const activeBizId = useClientStore.getState().activeBE?.active_zbid;
        // if (!activeBizId) {
        //     throw new Error('No active client selected. Please select a client first.');
        // }

        const queryParams = new URLSearchParams();
        if (params?.skip !== undefined) {
            queryParams.append('skip', String(params.skip));
        }
        if (params?.limit !== undefined) {
            queryParams.append('limit', String(params.limit));
        }

        const path = queryParams.toString()
            ? `/t4/get_employee_list?${queryParams.toString()}`
            : '/t4/get_employee_list';

        const response = await apiFetch(path);

        if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(`Failed to fetch employees: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`,);
        }
        return response.json();
    },

    /**
     * Search employees by name
     */
    async searchEmployees(params: SearchEmployeesParams): Promise<Employee[]> {
        const queryParams = new URLSearchParams({
            first_name: params.first_name,
            last_name: params.last_name,
        });

        const response = await apiFetch(`/employee/search/by-name?${queryParams.toString()}`);

        if (!response.ok) {
            throw new Error(`Failed to search employees: ${response.statusText}`);
        }

        return response.json();
    },


    /**
     * Delete employee
     */
    async deleteEmployee(employee: Employee): Promise<void> {
        const response = await apiFetch(`/employee/delete`, {
            method: 'DELETE',
            body: JSON.stringify(employee),
        });

        if (!response.ok) {
            throw new Error(`Failed to delete employee: ${response.statusText}`);
        }
    },

    /**
     * Get total employee count
     */
    async getEmployeeCount(): Promise<number> {
        const response = await apiFetch('/employee/stats/count');

        if (!response.ok) {
            throw new Error(`Failed to fetch employee count: ${response.statusText}`);
        }

        const data = await response.json();
        return data.count || 0;
    },
};
