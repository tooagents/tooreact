import { useState } from 'react';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { EmployeeDataTable } from 'src/_settings/employees/components/EmployeeTable';
import EmployeeFormModal from './components/EmployeeModal';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { useEmployees } from 'src/_settings/employees/useEmployees';
import { employeeAPI } from 'src/_settings/employees/employee-api';
import { Employee } from 'src/types/employee';

const BCrumb = [
    {
        to: '/',
        title: 'Home',
    },
    {
        title: 'Employees',
    },
];

const Notes = () => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const { employees, isLoading, error, refreshEmployees } = useEmployees();
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const employeeToDeleteName = [employeeToDelete?.first_name, employeeToDelete?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

    const handleAddNew = () => {
        setEditingEmployee(null);
        setIsFormOpen(true);
    };

    const handleFormComplete = async () => {
        await refreshEmployees();
        setIsFormOpen(false);
        setEditingEmployee(null);
    };


    const handleEditEmployee = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsFormOpen(true);
    };

    const requestDeleteEmployee = (employeeId: string) => {
        if (!employeeId) return;
        const target = employees.find((employee) => employee.id === employeeId) ?? null;
        setEmployeeToDelete(target);
    };

    const handleDeleteEmployee = async () => {
        if (!employeeToDelete?.id) return;
        employeeToDelete.is_deleted = true; // Mark as deleted before sending to API
        
        try {
            setIsDeleting(true);
            await employeeAPI.updateEmployee({ ...employeeToDelete, is_deleted: true });
            await refreshEmployees();
            setEmployeeToDelete(null);
        } catch (err) {
            console.error('Failed to delete employee:', err);
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <>
            <BreadcrumbComp title="Employees" items={BCrumb} />
            <div className="flex gap-6 flex-col ">
                {error && (
                    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                        Error: {error}
                    </div>
                )}
                {isLoading ? (
                    <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                        <LoadingSpinner size="md" />
                    </div>
                ) : (
                    <EmployeeDataTable 
                        data={employees}
                        onAddNew={handleAddNew}
                        onEdit={handleEditEmployee}
                        onDelete={requestDeleteEmployee}
                    />
                )}
            </div>

            {isFormOpen && (
                <EmployeeFormModal
                    isOpen={isFormOpen}
                    onClose={() => {
                        setIsFormOpen(false);
                        setEditingEmployee(null);
                    }}
                    onComplete={handleFormComplete}
                    initialData={editingEmployee}
                />
            )}

            <Dialog open={Boolean(employeeToDelete)} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete employee?</DialogTitle>
                        <DialogDescription>
                            This will permanently remove {employeeToDeleteName || 'this employee'}.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => setEmployeeToDelete(null)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteEmployee} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Notes;
