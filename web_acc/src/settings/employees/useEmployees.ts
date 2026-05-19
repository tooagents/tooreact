import { useCallback, useEffect, useState } from 'react';
import { employeeAPI } from 'src/_settings/employees/employee-api';
import { useClientStore } from 'src/store/client-store';
import { Employee } from 'src/types/employee';

const NO_ACTIVE_CLIENT_ERROR =
    'No active client selected. Please choose a client in the top bar or Clients page.';

export function useEmployees() {
    const activeBizId = useClientStore((state) => state.activeBE?.active_zbid ?? null);
    const bizLoading = false;
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshEmployees = useCallback(async () => {
        if (bizLoading) {
            return;
        }

        if (!activeBizId) {
            setEmployees([]);
            setIsLoading(false);
            setError(NO_ACTIVE_CLIENT_ERROR);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const data = await employeeAPI.listEmployees({ skip: 0, limit: 100 });
            const activeEmployees = data.filter((employee) => !employee.is_deleted);
            setEmployees(activeEmployees);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch employees';
            setError(errorMessage);
            console.error('Error fetching employees:', err);
        } finally {
            setIsLoading(false);
        }
    }, [activeBizId, bizLoading]);

    useEffect(() => {
        void refreshEmployees();
    }, [refreshEmployees]);

    return {
        employees,
        isLoading,
        error,
        refreshEmployees,
        setEmployees,
    };
}

