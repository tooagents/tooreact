import { useEffect, useMemo, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {Dialog,DialogContent,DialogFooter,DialogHeader,DialogTitle,} from 'src/components/ui/dialog';
import { employeeAPI } from 'src/_settings/employees/employee-api';
import { Employee } from 'src/types/employee';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';

interface EmployeeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void | Promise<void>;
    initialData?: Employee | null;
}

type EmployeeFormState = {
    first_name: string;
    last_name: string;
    sin: string;
    date_of_birth: string;
    address: string;
    email: string;
    province: string;
    phone: string;
    position: string;
    start_date: string;
    employment_type: 'hourly' | 'salary';
    hourly_rate: string;
    annual_salary: string;
    federal_claim_amount: string;
    ontario_claim_amount: string;
    cpp_exempt: boolean;
    ei_exempt: boolean;
};

function toFormState(data?: Employee | null): EmployeeFormState {
    return {
        first_name: data?.first_name ?? '',
        last_name: data?.last_name ?? '',
        sin: data?.sin ?? '',
        date_of_birth: data?.date_of_birth ?? '',
        address: data?.address ?? '',
        email: data?.email ?? '',
        phone: data?.phone ?? '',
        position: data?.position ?? '',
        province: data?.province ?? 'ON',
        start_date: data?.start_date ?? '',
        employment_type: (data?.employment_type as 'hourly' | 'salary' | null) ?? 'hourly',
        hourly_rate: data?.hourly_rate != null ? String(data.hourly_rate) : '',
        annual_salary: data?.annual_salary != null ? String(data.annual_salary) : '',
        federal_claim_amount: data?.federal_claim_amount != null ? String(data.federal_claim_amount) : '',
        ontario_claim_amount: data?.ontario_claim_amount != null ? String(data.ontario_claim_amount) : '',
        cpp_exempt: Boolean(data?.cpp_exempt),
        ei_exempt: Boolean(data?.ei_exempt),
    };
}

function parseNullableNumber(value: string): number | null {
    if (!value.trim()) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

const EmployeeFormModal = ({ isOpen, onClose, onComplete, initialData = null }: EmployeeFormModalProps) => {
    const [form, setForm] = useState<EmployeeFormState>(toFormState(initialData));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const employeeId = useMemo(() => {
        const fallbackData = initialData as (Employee & { _id?: string; employee_id?: string }) | null;
        return initialData?.id ?? fallbackData?._id ?? fallbackData?.employee_id ?? '';
    }, [initialData]);
    const isEdit = useMemo(() => Boolean(employeeId), [employeeId]);

    useEffect(() => {
        if (isOpen) {
            setForm(toFormState(initialData));
            setError(null);
        }
    }, [isOpen, initialData]);

    const handleChange = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!form.first_name.trim() || !form.last_name.trim()) {
            setError('First Name and Last Name are required.');
            return;
        }

        if (form.sin && form.sin.length !== 9) {
            setError('SIN must be exactly 9 digits.');
            return;
        }

        if (!form.employment_type) {
            setError('Employment Type is required.');
            return;
        }

        if (form.employment_type === 'hourly' && !form.hourly_rate.trim()) {
            setError('Hourly Rate is required for hourly employees.');
            return;
        }

        if (form.employment_type === 'salary' && !form.annual_salary.trim()) {
            setError('Annual Salary is required for salary employees.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payloadBase: Omit<Employee, 'id'> = {
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                sin: form.sin.trim() || "111222333",
                date_of_birth: form.date_of_birth || null,
                address: form.address.trim() || null,
                email: form.email.trim() || null,
                phone: form.phone.trim() || null,
                position: form.position.trim() || null,
                province: form.province.trim() || null,
                start_date: form.start_date || null,
                end_date: initialData?.end_date ?? null,
                employment_type: form.employment_type,
                hourly_rate: parseNullableNumber(form.hourly_rate),
                annual_salary: parseNullableNumber(form.annual_salary),
                regular_hours: initialData?.regular_hours ?? null,
                federal_claim_amount: parseNullableNumber(form.federal_claim_amount),
                ontario_claim_amount: parseNullableNumber(form.ontario_claim_amount),
                cpp_exempt: form.cpp_exempt,
                ei_exempt: form.ei_exempt,
            };

            if (isEdit) {
                if (!employeeId) {
                    throw new Error('Employee ID is missing. Cannot update employee.');
                }
                const payload: Employee = { id: employeeId, ...payloadBase };
                await employeeAPI.updateEmployee(payload);
            } else {
                await employeeAPI.createEmployee(payloadBase);
            }

            await onComplete();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} employee`;
            setError(errorMessage);
            console.error(`Error ${isEdit ? 'updating' : 'creating'} employee:`, err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                            id="first_name"
                            value={form.first_name}
                            onChange={(e) => handleChange('first_name', e.target.value)}
                            placeholder="First Name"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                            id="last_name"
                            value={form.last_name}
                            onChange={(e) => handleChange('last_name', e.target.value)}
                            placeholder="Last Name"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="sin">SIN</Label>
                        <Input
                            id="sin"
                            value={form.sin}
                            onChange={(e) => handleChange('sin', e.target.value.replace(/\D/g, '').slice(0, 9))}
                            placeholder="9 digits"
                            maxLength={9}
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="date_of_birth">Date of Birth</Label>
                        <Input
                            id="date_of_birth"
                            type="date"
                            value={form.date_of_birth}
                            onChange={(e) => handleChange('date_of_birth', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="Email"
                        />
                    </div>


                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                            id="phone"
                            value={form.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="Phone"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="position">Position</Label>
                        <Input
                            id="position"
                            value={form.position}
                            onChange={(e) => handleChange('position', e.target.value)}
                            placeholder="Position"
                        />
                    </div>
                        


                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="province">Province</Label>
                        <Input
                            id="province"
                            value={form.province}
                            onChange={(e) => handleChange('province', e.target.value)}
                            placeholder="ON"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2 lg:col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                            id="address"
                            value={form.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder="Address"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input
                            id="start_date"
                            type="date"
                            value={form.start_date}
                            onChange={(e) => handleChange('start_date', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="employment_type">Employment Type *</Label>
                        <select
                            id="employment_type"
                            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={form.employment_type}
                            onChange={(e) => handleChange('employment_type', e.target.value as EmployeeFormState['employment_type'])}
                        >
                            <option value="hourly">Hourly</option>
                            <option value="salary">Salary</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="hourly_rate">Hourly Rate</Label>
                        <Input
                            id="hourly_rate"
                            type="number"
                            step="0.01"
                            value={form.hourly_rate}
                            onChange={(e) => handleChange('hourly_rate', e.target.value)}
                            placeholder="0.00"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="annual_salary">Annual Salary</Label>
                        <Input
                            id="annual_salary"
                            type="number"
                            step="0.01"
                            value={form.annual_salary}
                            onChange={(e) => handleChange('annual_salary', e.target.value)}
                            placeholder="0.00"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="federal_claim_amount">Federal Claim Amount</Label>
                        <Input
                            id="federal_claim_amount"
                            type="number"
                            step="0.01"
                            value={form.federal_claim_amount}
                            onChange={(e) => handleChange('federal_claim_amount', e.target.value)}
                            placeholder="0.00"
                        />
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                        <Label htmlFor="ontario_claim_amount">Ontario Claim Amount</Label>
                        <Input
                            id="ontario_claim_amount"
                            type="number"
                            step="0.01"
                            value={form.ontario_claim_amount}
                            onChange={(e) => handleChange('ontario_claim_amount', e.target.value)}
                            placeholder="0.00"
                        />
                    </div>

                    <label htmlFor="cpp_exempt" className="flex items-center gap-2 text-sm">
                        <input
                            id="cpp_exempt"
                            type="checkbox"
                            checked={form.cpp_exempt}
                            onChange={(e) => handleChange('cpp_exempt', e.target.checked)}
                        />
                        CPP Exempt
                    </label>

                    <label htmlFor="ei_exempt" className="flex items-center gap-2 text-sm">
                        <input
                            id="ei_exempt"
                            type="checkbox"
                            checked={form.ei_exempt}
                            onChange={(e) => handleChange('ei_exempt', e.target.checked)}
                        />
                        EI Exempt
                    </label>
                </div>

                {error && (
                    <div className="rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <LoadingSpinner size="md" />
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {isEdit ? 'Update Employee' : 'Create Employee'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmployeeFormModal;


