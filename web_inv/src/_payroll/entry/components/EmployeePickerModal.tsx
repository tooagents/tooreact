import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from 'src/components/ui/dialog';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Table, TBody, TCell, THead, THeader, TRow } from 'src/components/ui/table';
import { Checkbox } from 'src/components/ui/checkbox';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { useEmployees } from 'src/_settings/employees/useEmployees';
import { Employee } from 'src/types/employee';

type EmployeePickerModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (employees: Employee[]) => void;
    isSubmitting?: boolean;
};

const getFullName = (employee: Employee) =>
    [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || '-';

const matchesQuery = (employee: Employee, query: string) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    const haystack = [
        employee.first_name,
        employee.last_name,
        employee.email,
        employee.employment_type,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(needle);
};

const EmployeePickerModal = ({ isOpen, onClose, onAdd, isSubmitting = false }: EmployeePickerModalProps) => {
    const { employees, isLoading, error, refreshEmployees } = useEmployees();
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIds(new Set());
            void refreshEmployees();
        }
    }, [isOpen, refreshEmployees]);

    const filteredEmployees = useMemo(
        () => employees.filter((employee) => matchesQuery(employee, query)),
        [employees, query],
    );

    const selectedEmployees = useMemo(
        () => employees.filter((employee) => selectedIds.has(employee.id)),
        [employees, selectedIds],
    );

    const toggleEmployee = (employeeId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(employeeId)) {
                next.delete(employeeId);
            } else {
                next.add(employeeId);
            }
            return next;
        });
    };

    const handleAdd = () => {
        if (!selectedEmployees.length) return;
        onAdd(selectedEmployees);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Select employees to add</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by name, email, or type..."
                        />
                        <Button
                            variant="lightsecondary"
                            className="sm:w-auto"
                            onClick={() => void refreshEmployees()}
                            disabled={isLoading || isSubmitting}
                        >
                            Refresh
                        </Button>
                    </div>

                    {error && (
                        <div className="rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                            <LoadingSpinner size="md" />
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No employees found.</div>
                    ) : (
                        <div className="overflow-x-auto border rounded-md border-ld">
                            <Table>
                                <THeader>
                                    <TRow>
                                        <THead className="w-10 px-3" />
                                        <THead className="min-w-40 px-3">Name</THead>
                                        <THead className="min-w-32 px-3">Email</THead>
                                        <THead className="min-w-28 px-3">Type</THead>
                                        <THead className="min-w-24 px-3">Hourly</THead>
                                        <THead className="min-w-24 px-3">Salary</THead>
                                    </TRow>
                                </THeader>
                                <TBody>
                                    {filteredEmployees.map((employee) => {
                                        const checked = selectedIds.has(employee.id);
                                        return (
                                            <TRow key={employee.id}>
                                                <TCell className="px-3">
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(_checked) => toggleEmployee(employee.id)}
                                                    />
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-3 py-3">
                                                    {getFullName(employee)}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-3 py-3">
                                                    {employee.email || '-'}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-3 py-3">
                                                    {employee.employment_type || '-'}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-3 py-3">
                                                    {employee.hourly_rate ?? '-'}
                                                </TCell>
                                                <TCell className="text-gray-700 dark:text-white/70 text-sm px-3 py-3">
                                                    {employee.annual_salary ?? '-'}
                                                </TCell>
                                            </TRow>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Selected: {selectedEmployees.length}. You can add the same employee more than once by reopening this dialog.
                    </p>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleAdd} disabled={!selectedEmployees.length || isSubmitting}>
                        {isSubmitting ? <LoadingSpinner size="sm" /> : 'Add Selected'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeePickerModal;

