import { useEffect, useState } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from 'src/components/ui/dialog';
import { clientsAPI } from 'src/_settings/clients/clients-api';
import type { ClientDB } from 'src/types/type_client';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    initialData?: ClientDB | null;
}

const BizEntityFormModal = ({ isOpen, onClose, onComplete, initialData }: Props) => {
    const today = new Date().toISOString().split('T')[0];
    const [type, setType] = useState('FIRM');
    const [id, setId] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState('');
    const [businessNumber, setBusinessNumber] = useState('');
    const [payrollAccountNumber, setPayrollAccountNumber] = useState('');
    const [province, setProvince] = useState('ON');
    const [streetAddress, setStreetAddress] = useState('');
    const [country, setCountry] = useState('Canada');
    const [postalCode, setPostalCode] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [wsibNumber, setWsibNumber] = useState('');
    const [ehtAccount, setEhtAccount] = useState('');
    const [remittanceFrequency, setRemittanceFrequency] = useState('monthly');
    const [taxYearEnd, setTaxYearEnd] = useState(today);
    const [legalName, setLegalName] = useState('');
    const [operatingName, setOperatingName] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [incorporationDate, setIncorporationDate] = useState(today);
    const [employeeCount, setEmployeeCount] = useState<number>(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setType(initialData.type ?? 'FIRM');
            setId(initialData.client_id ?? initialData.id ?? null);
            setCompanyName(initialData.client_company_name ?? initialData.name ?? '');
            setBusinessNumber(initialData.client_business_number ?? initialData.business_number ?? '');
            setPayrollAccountNumber(initialData.payroll_account_number ?? '');
            setProvince(initialData.province ?? 'ON');
            setStreetAddress(initialData.client_address ?? initialData.street_address ?? '');
            setCountry(initialData.country ?? 'Canada');
            setPostalCode(initialData.postal_code ?? '');
            setPhone(initialData.client_mainphone ?? initialData.phone ?? '');
            setEmail(initialData.client_email ?? initialData.email ?? '');
            setWsibNumber(initialData.wsib_number ?? '');
            setEhtAccount(initialData.eht_account ?? '');
            setRemittanceFrequency(initialData.remittance_frequency ?? 'monthly');
            setTaxYearEnd(initialData.tax_year_end?.split('T')[0] ?? today);
            setLegalName(initialData.client_contact_name ?? initialData.legal_name ?? '');
            setOperatingName(initialData.client_contact_title ?? initialData.operating_name ?? '');
            setBusinessType(initialData.business_type ?? '');
            setIncorporationDate(initialData.incorporation_date?.split('T')[0] ?? today);
            setEmployeeCount(initialData.employee_count ?? 0);
        } else {
            setType('FIRM');
            setId(null);
            setCompanyName('');
            setBusinessNumber('');
            setPayrollAccountNumber('');
            setProvince('ON');
            setStreetAddress('');
            setCountry('Canada');
            setPostalCode('');
            setPhone('');
            setEmail('');
            setWsibNumber('');
            setEhtAccount('');
            setRemittanceFrequency('monthly');
            setTaxYearEnd(today);
            setLegalName('');
            setOperatingName('');
            setBusinessType('');
            setIncorporationDate(today);
            setEmployeeCount(0);
        }
    }, [initialData, isOpen, today]);

    const handleSubmit = async () => {
        if (!companyName.trim()) {
            setError('Company name is required');
            return;
        }

        setLoading(true);
        setError(null);

        const basePayload: Partial<ClientDB> = {
            type,
            client_company_name: companyName,
            name: companyName,
            client_business_number: businessNumber,
            business_number: businessNumber,
            payroll_account_number: payrollAccountNumber,
            client_address: streetAddress,
            province,
            country,
            street_address: streetAddress,
            postal_code: postalCode,
            client_mainphone: phone,
            phone,
            client_email: email,
            email,
            wsib_number: wsibNumber,
            eht_account: ehtAccount,
            remittance_frequency: remittanceFrequency,
            tax_year_end: taxYearEnd,
            client_contact_name: legalName,
            legal_name: legalName,
            client_contact_title: operatingName,
            operating_name: operatingName,
            business_type: businessType,
            incorporation_date: incorporationDate,
            employee_count: employeeCount,
        };

        try {
            const entityId = initialData?.client_id ?? initialData?.id ?? id ?? null;
            if (entityId) {
                const updatePayload: Partial<ClientDB> = {
                    id: entityId,
                    client_id: entityId,
                    ...basePayload,
                };
                await clientsAPI.updateClient(entityId, updatePayload);
            } else {
                await clientsAPI.createClient(basePayload);
            }

            onComplete();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save entity';
            setError(message);
            console.error('Biz entity save error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Client' : 'New Client'}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                    <div className="flex items-center gap-3">
                        <Label htmlFor="name" className="w-32 text-sm">Name *</Label>
                        <Input id="name" className="flex-1" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="legalName" className="w-32 text-sm">Legal Name</Label>
                        <Input id="legalName" className="flex-1" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="phone" className="w-32 text-sm">Phone</Label>
                        <Input id="phone" className="flex-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="email" className="w-32 text-sm">Email</Label>
                        <Input id="email" className="flex-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>





                    <div className="flex items-center gap-3 lg:col-span-2">
                        <Label htmlFor="streetAddress" className="w-32 text-sm whitespace-nowrap">Address</Label>
                        <Input id="streetAddress" className="flex-1" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />                        
                    </div>


                    <div className="flex items-center gap-3">
                        <Label htmlFor="province" className="w-32 text-sm">Province/State</Label>
                        <Input id="province" className="flex-1" value={province} onChange={(e) => setProvince(e.target.value)} />
                    </div>


                    <div className="flex items-center gap-3">
                        <Label htmlFor="country" className="w-32 text-sm">Country</Label>
                        <Input id="country" className="flex-1" value={country} onChange={(e) => setCountry(e.target.value)} />
                    </div>


                    <div className="lg:col-span-2 mt-6">
                        <DialogTitle>Payroll</DialogTitle>
                    </div>







                    <div className="flex items-center gap-3">
                        <Label htmlFor="businessNumber" className="w-32 text-sm">Business Number</Label>
                        <Input id="businessNumber" className="flex-1" value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="payrollAccountNumber" className="w-32 text-sm">Payroll Account #</Label>
                        <Input id="payrollAccountNumber" className="flex-1" value={payrollAccountNumber} onChange={(e) => setPayrollAccountNumber(e.target.value)} />
                    </div>





                    <div className="flex items-center gap-3">
                        <Label htmlFor="wsibNumber" className="w-32 text-sm">WSIB Number</Label>
                        <Input id="wsibNumber" className="flex-1" value={wsibNumber} onChange={(e) => setWsibNumber(e.target.value)} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="ehtAccount" className="w-32 text-sm">EHT Account</Label>
                        <Input id="ehtAccount" className="flex-1" value={ehtAccount} onChange={(e) => setEhtAccount(e.target.value)} />
                    </div>



                    <div className="flex items-center gap-3">
                        <Label htmlFor="employeeCount" className="w-32 text-sm">Employee Count</Label>
                        <Input id="employeeCount" className="flex-1" type="number" value={String(employeeCount)} onChange={(e) => setEmployeeCount(Number(e.target.value) || 0)} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="remittanceFrequency" className="w-32 text-sm">Remittance Frequency</Label>
                        <Input id="remittanceFrequency" className="flex-1" value={remittanceFrequency} onChange={(e) => setRemittanceFrequency(e.target.value)} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Label htmlFor="incorporationDate" className="w-32 text-sm">Incorporation Date</Label>
                        <Input id="incorporationDate" className="flex-1" type="date" value={incorporationDate} onChange={(e) => setIncorporationDate(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Label htmlFor="taxYearEnd" className="w-32 text-sm">Tax Year End</Label>
                        <Input id="taxYearEnd" className="flex-1" type="date" value={taxYearEnd} onChange={(e) => setTaxYearEnd(e.target.value)} />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
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
                        {initialData ? 'Save Changes' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BizEntityFormModal;
