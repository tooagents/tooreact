import { Employee } from 'src/types/employee';
import { employeeAPI } from 'src/_settings/employees/employee-api';

/**
 * DEPRECATED: This file previously contained hardcoded employee data.
 * 
 * Employee data is now fetched from the FastAPI backend.
 * Use the employeeAPI module from 'src/_settings/employees/employee-api' to fetch employee data.
 * 
 * Example usage in components:
 * ```tsx
 * import { employeeAPI } from 'src/_settings/employees/employee-api';
 * 
 * const employees = await employeeAPI.listEmployees();
 * ```
 */

// This export is kept for backward compatibility
// In new code, use employeeAPI.listEmployees() instead
export const EmployeesData: Employee[] = [];

// Re-export the API for convenience
export { employeeAPI };
