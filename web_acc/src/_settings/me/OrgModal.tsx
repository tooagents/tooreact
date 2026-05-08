import React from "react";
import { Label } from "src/components/ui/label";
import { Input } from "src/components/ui/input";
import { dateOnly, type InterfaceBE } from "src/types/type_be";

type OrgModalProps = {
    tempOrganization: InterfaceBE;
    setTempOrganization: React.Dispatch<React.SetStateAction<InterfaceBE>>;
};

const text = (value?: string | number | null) => (value === undefined || value === null ? "" : String(value));
const LABEL = "w-44 text-sm text-gray-600 whitespace-nowrap";

const OrgModal = ({ tempOrganization, setTempOrganization }: OrgModalProps) => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex items-center gap-3">
            <Label htmlFor="orgName" className={LABEL}>Operating Name</Label>
            <Input id="orgName" className="flex-1" placeholder="Your organization name"                
                value={text(tempOrganization.operating_name)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, operating_name: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgLegalName" className={LABEL}>Legal Name</Label>
            <Input id="orgLegalName" placeholder="Legal registered name" className="flex-1"
                value={text(tempOrganization.legal_name)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, legal_name: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgType" className={LABEL}>Business Type</Label>
            <Input id="orgType" placeholder="Corporation, partnership, etc." className="flex-1"
                value={text(tempOrganization.business_type)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, business_type: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgBN" className={LABEL}>Business Number (BN)</Label>
            <Input id="orgBN" placeholder="123456789" className="flex-1"
                value={text(tempOrganization.be_biz_number)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, be_biz_number: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgPayroll" className={LABEL}>
                Payroll Account No.
            </Label>
            <Input
                id="orgPayroll"
                placeholder="123456789RP0001"
                className="flex-1"
                value={text(tempOrganization.payroll_account_number)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, payroll_account_number: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgRemit" className={LABEL}>
                Remittance Frequency
            </Label>
            <Input
                id="orgRemit"
                placeholder="Monthly or quarterly"
                className="flex-1"
                value={text(tempOrganization.remittance_frequency)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, remittance_frequency: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3"><Label htmlFor="orgincorporatedate" className={LABEL}>Incorporation Date</Label>
            <Input id="orgincorporatedate" type="date" className="flex-1"
                value={dateOnly(tempOrganization.incorporation_date)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, incorporation_date: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgTaxYearEnd" className={LABEL}>
                Tax Year End
            </Label>
            <Input
                id="orgTaxYearEnd"
                type="date"
                className="flex-1"
                value={dateOnly(tempOrganization.tax_year_end)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, tax_year_end: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3"><Label htmlFor="orgWSIB" className={LABEL}>WSIB Number</Label>
            <Input id="orgWSIB" placeholder="WSIB account number" className="flex-1"
                value={text(tempOrganization.wsib_number)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, wsib_number: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgEHT" className={LABEL}>EHT Account</Label>
            <Input id="orgEHT" placeholder="Employer Health Tax account" className="flex-1"
                value={text(tempOrganization.eht_account)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, eht_account: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3 lg:col-span-2">
            <Label htmlFor="orgAddress" className={LABEL}>Address</Label>
            <Input id="orgAddress" placeholder="Street address" className="flex-1"
                value={text(tempOrganization.be_address)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, be_address: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgCity" className={LABEL}>
                City
            </Label>
            <Input
                id="orgCity"
                placeholder="City"
                className="flex-1"
                value={text(tempOrganization.city)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, city: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgProvince" className={LABEL}>
                Province/State
            </Label>
            <Input
                id="orgProvince"
                placeholder="Province or State"
                className="flex-1"
                value={text(tempOrganization.province)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, province: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgPostal" className={LABEL}>
                Postal Code / ZIP
            </Label>
            <Input
                id="orgPostal"
                placeholder="A1A 1A1 or 12345"
                className="flex-1"
                value={text(tempOrganization.postal_code)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, postal_code: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgCountry" className={LABEL}>
                Country
            </Label>
            <Input
                id="orgCountry"
                placeholder="Country"
                className="flex-1"
                value={text(tempOrganization.country)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, country: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgPhone" className={LABEL}>Phone</Label>
            <Input id="orgPhone" placeholder="+1 (555) 123-4567" className="flex-1"
                value={text(tempOrganization.be_phone)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, be_phone: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3"><Label htmlFor="orgEmail" className={LABEL}>Email</Label>
            <Input                id="orgEmail"                placeholder="contact@company.com"                className="flex-1"
                value={text(tempOrganization.be_email)}
                onChange={(e) => setTempOrganization({ ...tempOrganization, be_email: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="orgEmployees" className={LABEL}>
                Employee Count
            </Label>
            <Input
                id="orgEmployees"
                type="number"
                min="0"
                placeholder="Number of employees"
                className="flex-1"
                value={text(tempOrganization.employee_count)}
                onChange={(e) => setTempOrganization({
                    ...tempOrganization,
                    employee_count: e.target.value === "" ? undefined : Number(e.target.value),
                })}
            />
        </div>
    </div>
);

export default OrgModal;
