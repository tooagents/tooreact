import { useEffect, useMemo, useState } from "react";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Label } from "src/components/ui/label";
import { Textarea } from "src/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "src/components/ui/dialog";
import { Alert, AlertDescription } from "src/components/ui/alert";
import { employeeAPI } from "src/_settings/employees/employee-api";
import { Employee } from "src/types/employee";
import LoadingSpinner from "src/components/shared/LoadingSpinner";
import { useClientStore } from "src/store/client-store";
import { usePayrollStore } from "src/store/payroll-store";
interface PayrollFormProps {
    employee: Employee;
    onClose: () => void;
    onComplete: () => void;
}
const PayrollForm = ({
    employee,
    onClose,
    onComplete,
}: PayrollFormProps) => {
    const activeBizId = useClientStore((state) => state.activeBE?.active_zbid ?? null);
    const periods = usePayrollStore((state) => state.periods);
    const activePeriodId = usePayrollStore((state) => state.activePeriodId);
    const fetchPeriods = usePayrollStore((state) => state.fetchPeriods);
    const clearPayrollState = usePayrollStore((state) => state.clear);
    const activePeriod = useMemo(
        () => periods.find((period) => period.id === activePeriodId) ?? null,
        [periods, activePeriodId],
    );
    const [regularHours, setRegularHours] = useState(80);
    const [hourlyRate, setHourlyRate] = useState(25);
    const [overtimeHours, setOvertimeHours] = useState(5);
    const [overtimeRate, setOvertimeRate] = useState(37.5);
    const [bonus, setBonus] = useState(0);
    const [vacation, setVacation] = useState(0);
    const [notes, setNotes] = useState("");
    const [reviewOpen, setReviewOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeBizId) {
            clearPayrollState();
            return;
        }
        void fetchPeriods();
    }, [activeBizId, clearPayrollState, fetchPeriods]);

    // Auto calculation
    const gross =
        regularHours * hourlyRate +
        overtimeHours * overtimeRate +
        bonus +
        vacation;

    const cpp = gross * 0.05;
    const ei = gross * 0.016;
    const tax = gross * 0.18;

    const totalDeduction = cpp + ei + tax;
    const net = gross - totalDeduction;

    const handleConfirmAndComplete = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const payrollData: Employee = {
                id: employee.id,
                first_name: employee.first_name ?? '',
                last_name: employee.last_name ?? '',
                sin: employee.sin ?? "222333111",
                date_of_birth: employee.date_of_birth ?? null,
                address: employee.address ?? null,
                email: employee.email ?? null,
                phone: employee.phone ?? null,
                position: employee.position ?? null,
                province: employee.province ?? null,
                start_date: employee.start_date ?? null,
                end_date: employee.end_date ?? null,
                employment_type: employee.employment_type ?? null,
                hourly_rate: hourlyRate,
                annual_salary: employee.annual_salary ?? null,
                regular_hours: employee.regular_hours ?? null,
                federal_claim_amount: employee.federal_claim_amount ?? null,
                ontario_claim_amount: employee.ontario_claim_amount ?? null,
                cpp_exempt: employee.cpp_exempt ?? null,
                ei_exempt: employee.ei_exempt ?? null,
            };

            await employeeAPI.updateEmployee(payrollData);

            // Close the review dialog
            setReviewOpen(false);

            // Call the onComplete callback to notify parent component
            onComplete();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to save payroll data. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto">
                <div className="space-y-8">

                    {/* Header */}
                    <div>
                        <h2 className="text-2xl font-semibold">
                            {[employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'Employee'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {activePeriod ? (
                                <>
                                    Payroll Period: {activePeriod.start_date} – {activePeriod.end_date} • Status: open
                                    {activePeriod.pay_date && <> • Pay Date: {activePeriod.pay_date}</>}
                                </>
                            ) : (
                                'No payroll period selected'
                            )}
                        </p>
                    </div>

                    {/* 3 Column Layout */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                        {/* Column 1 — Earnings */}
                        <div className="rounded-xl border p-6 space-y-2">
                            <h4 className="font-semibold text-lg">Earnings</h4>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <Label>Regular Hours</Label>
                                <Input
                                    type="number"
                                    value={regularHours}
                                    onChange={(e) => setRegularHours(Number(e.target.value))}
                                    className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <Label>Hourly Rate</Label>
                                <Input
                                    type="number"
                                    value={hourlyRate}
                                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                                    className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <Label>Overtime Hours</Label>
                                <Input
                                    type="number"
                                    value={overtimeHours}
                                    onChange={(e) => setOvertimeHours(Number(e.target.value))}
                                    className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <Label>Overtime Rate</Label>
                                <Input
                                    type="number"
                                    value={overtimeRate}
                                    onChange={(e) => setOvertimeRate(Number(e.target.value))}
                                    className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <Label>Bonus</Label>
                                <Input
                                    type="number"
                                    value={bonus}
                                    onChange={(e) => setBonus(Number(e.target.value))}
                                    className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                                />
                            </div>

                            <div className="grid grid-cols-[1fr_120px] items-center gap-4">
                                <Label>Vacation Pay</Label>
                                <Input
                                    type="number"
                                    value={vacation}
                                    onChange={(e) => setVacation(Number(e.target.value))}
                                    className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                                />
                            </div>

                            <div className="pt-4 border-t text-right font-medium">
                                Gross Earnings: ${gross.toFixed(2)}
                            </div>
                        </div>

                        {/* Column 2 — Deductions */}
                        <div className="rounded-xl border p-6 space-y-4">
                            <h4 className="font-semibold text-lg">Employee Deductions</h4>

                            <div className="flex justify-between">
                                <span>CPP (Employee)</span>
                                <span>${cpp.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span>EI (Employee)</span>
                                <span>${ei.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span>Income Tax</span>
                                <span>${tax.toFixed(2)}</span>
                            </div>

                            <div className="pt-4 border-t flex justify-between font-medium">
                                <span>Total Deductions</span>
                                <span>${totalDeduction.toFixed(2)}</span>
                            </div>

                            <div className="pt-6">
                                <h4 className="font-semibold text-lg mb-4">
                                    Employer Contributions
                                </h4>

                                <div className="flex justify-between">
                                    <span>CPP (Employer)</span>
                                    <span>${cpp.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span>EI (Employer)</span>
                                    <span>${(ei * 1.4).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 3 — Sticky Summary */}
                        <div className="rounded-xl border p-6 space-y-8 h-fit sticky top-6">
                            <h4 className="font-semibold text-lg">Payroll Summary</h4>

                            <div className="flex justify-between">
                                <span>Gross Pay</span>
                                <span>${gross.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span>Total Deductions</span>
                                <span>${totalDeduction.toFixed(2)}</span>
                            </div>

                            <div className="border-t pt-4 flex justify-between text-xl font-bold">
                                <span>Net Pay</span>
                                <span>${net.toFixed(2)}</span>
                            </div>

                            <Button
                                className="w-full mt-6"
                                onClick={() => setReviewOpen(true)}
                            >
                                Complete Payroll
                            </Button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="rounded-xl border p-6">
                        <Label>Payroll Notes</Label>
                        <Textarea
                            className="h-8 text-sm border-0 border-b border-muted rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-black"
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    {/* Review Modal */}
                    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Review Payroll</DialogTitle>
                            </DialogHeader>

                            {error && (
                                <Alert className="border-red-500 bg-red-50">
                                    <AlertDescription className="text-red-800">
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span>Gross Pay</span>
                                    <span>${gross.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total Deductions</span>
                                    <span>${totalDeduction.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between font-bold">
                                    <span>Net Pay</span>
                                    <span>${net.toFixed(2)}</span>
                                </div>
                            </div>
                            {isLoading && (
                                <div className="rounded-md border border-border bg-muted/40 p-3">
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <LoadingSpinner size="md" />
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setReviewOpen(false)}
                                    disabled={isLoading}
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleConfirmAndComplete}
                                    disabled={isLoading}
                                >
                                    Confirm & Complete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PayrollForm;
