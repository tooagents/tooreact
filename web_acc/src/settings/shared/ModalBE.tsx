import React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "src/components/ui/dialog";
import { Label } from "src/components/ui/label";
import { Input } from "src/components/ui/input";
import { Button } from "src/components/ui/button";
import LoadingSpinner from "src/components/shared/LoadingSpinner";
import { dateOnly, type InterfaceBE } from "src/types/type_be";
import type { InterfaceUser } from "src/types/type_me";



type UserProfileModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    modalType: "personal" | "organization" | null;
    tempPersonal: InterfaceUser;
    setTempPersonal: React.Dispatch<React.SetStateAction<InterfaceUser>>;
    tempOrganization: InterfaceBE;
    setTempOrganization: React.Dispatch<React.SetStateAction<InterfaceBE>>;
    onSave: () => void | Promise<void>;
    isSaving?: boolean;
};

const UserProfileModal = ({
    open,
    onOpenChange,
    modalType,
    tempPersonal,
    setTempPersonal,
    tempOrganization,
    setTempOrganization,
    onSave,
    isSaving = false,
}: UserProfileModalProps) => {
    const text = (value?: string | number | null) => (value === undefined || value === null ? "" : String(value));

    if (modalType !== "personal" && modalType !== "organization") {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="mb-4">
                        {modalType === "personal" ? "Edit Personal Information" : "Edit Organization"}
                    </DialogTitle>
                </DialogHeader>

                {modalType === "personal" ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="flex items-center gap-3">
                            <Label htmlFor="firstName" className="w-32 text-sm text-gray-600">
                                First Name
                            </Label>
                            <Input
                                id="firstName"
                                placeholder="Your first name"
                                value={text(tempPersonal.first_name)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, first_name: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="lastName" className="w-32 text-sm text-gray-600">
                                Last Name
                            </Label>
                            <Input
                                id="lastName"
                                placeholder="Your last name"
                                value={text(tempPersonal.last_name)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, last_name: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="email" className="w-32 text-sm text-gray-600">
                                Email
                            </Label>
                            <Input
                                id="email"
                                placeholder="you@example.com"
                                value={text(tempPersonal.email)}
                                readOnly
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="country" className="w-32 text-sm text-gray-600">
                                Country
                            </Label>
                            <Input
                                id="country"
                                placeholder="Your country"
                                value={text(tempPersonal.country)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, country: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="position" className="w-32 text-sm text-gray-600">
                                Position
                            </Label>
                            <Input
                                id="position"
                                placeholder="Your position"
                                value={text(tempPersonal.position)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, position: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="facebook" className="w-32 text-sm text-gray-600">
                                Facebook
                            </Label>
                            <Input
                                id="facebook"
                                placeholder="facebook.com/username"
                                value={text(tempPersonal.facebook)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, facebook: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="twitter" className="w-32 text-sm text-gray-600">
                                Twitter
                            </Label>
                            <Input
                                id="twitter"
                                placeholder="x.com/username"
                                value={text(tempPersonal.twitter)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, twitter: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="github" className="w-32 text-sm text-gray-600">
                                GitHub
                            </Label>
                            <Input
                                id="github"
                                placeholder="github.com/username"
                                value={text(tempPersonal.github)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, github: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="reddit" className="w-32 text-sm text-gray-600">
                                reddit
                            </Label>
                            <Input
                                id="reddit"
                                placeholder="reddit.com/username"
                                value={text(tempPersonal.reddit)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, reddit: e.target.value })}
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <h6 className="font-semibold text-sm mt-4 mb-2">Address Information</h6>
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="country" className="w-32 text-sm text-gray-600">
                                Country
                            </Label>
                            <Input
                                id="country"
                                placeholder="Country"
                                value={text(tempPersonal.country)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, country: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="state" className="w-32 text-sm text-gray-600">
                                Province/State
                            </Label>
                            <Input
                                id="state"
                                placeholder="Province or State"
                                value={text(tempPersonal.state)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, state: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="pin" className="w-32 text-sm text-gray-600">
                                Referral Code 
                            </Label>
                            <Input
                                id="pin"
                                placeholder="Referral code"
                                value={text(tempPersonal.pin)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, pin: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="zip" className="w-40 text-sm text-gray-600 whitespace-nowrap">
                                Postal Code / ZIP
                            </Label>
                            <Input
                                id="zip"
                                placeholder="A1A 1A1 or 12345"
                                value={text(tempPersonal.zip)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, zip: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="taxNo" className="w-32 text-sm text-gray-600">
                                Tax No.
                            </Label>
                            <Input
                                id="taxNo"
                                placeholder="Tax ID number"
                                value={text(tempPersonal.tax_no)}
                                onChange={(e) => setTempPersonal({ ...tempPersonal, tax_no: e.target.value })}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgName" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Organization Name
                            </Label>
                            <Input
                                id="orgName"
                                placeholder="Your organization name"
                                className="flex-1"
                                value={text(tempOrganization.name)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, name: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgLegalName" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Legal Name
                            </Label>
                            <Input
                                id="orgLegalName"
                                placeholder="Legal registered name"
                                className="flex-1"
                                value={text(tempOrganization.legal_name)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, legal_name: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgOperatingName" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Operating Name
                            </Label>
                            <Input
                                id="orgOperatingName"
                                placeholder="Operating/trading name"
                                className="flex-1"
                                value={text(tempOrganization.operating_name)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, operating_name: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgType" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Business Type
                            </Label>
                            <Input
                                id="orgType"
                                placeholder="Corporation, partnership, etc."
                                className="flex-1"
                                value={text(tempOrganization.business_type)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, business_type: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgBN" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Business Number (BN)
                            </Label>
                            <Input
                                id="orgBN"
                                placeholder="123456789"
                                className="flex-1"
                                value={text(tempOrganization.business_number)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, business_number: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgPayroll" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                            <Label htmlFor="orgRemit" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgTaxYearEnd" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgWSIB" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                WSIB Number
                            </Label>
                            <Input
                                id="orgWSIB"
                                placeholder="WSIB account number"
                                className="flex-1"
                                value={text(tempOrganization.wsib_number)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, wsib_number: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgEHT" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                EHT Account
                            </Label>
                            <Input
                                id="orgEHT"
                                placeholder="Employer Health Tax account"
                                className="flex-1"
                                value={text(tempOrganization.eht_account)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, eht_account: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3 lg:col-span-2">
                            <Label htmlFor="orgAddress" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Street Address
                            </Label>
                            <Input
                                id="orgAddress"
                                placeholder="Street address"
                                className="flex-1"
                                value={text(tempOrganization.street_address)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, street_address: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgCity" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                            <Label htmlFor="orgProvince" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                            <Label htmlFor="orgPostal" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                            <Label htmlFor="orgProvince" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                            <Label htmlFor="orgPhone" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Phone
                            </Label>
                            <Input
                                id="orgPhone"
                                placeholder="+1 (555) 123-4567"
                                className="flex-1"
                                value={text(tempOrganization.phone)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, phone: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgEmail" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Email
                            </Label>
                            <Input
                                id="orgEmail"
                                placeholder="contact@company.com"
                                className="flex-1"
                                value={text(tempOrganization.email)}
                                readOnly
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgIncorp" className="w-44 text-sm text-gray-600 whitespace-nowrap">
                                Incorporation Date
                            </Label>
                            <Input
                                id="orgIncorp"
                                type="date"
                                className="flex-1"
                                value={dateOnly(tempOrganization.incorporation_date)}
                                onChange={(e) => setTempOrganization({ ...tempOrganization, incorporation_date: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Label htmlFor="orgEmployees" className="w-44 text-sm text-gray-600 whitespace-nowrap">
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
                )}

                {isSaving && (
                    <div className="mt-2 rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <LoadingSpinner size="md" />
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2 mt-4">
                    <Button color={"primary"} className="rounded-md" onClick={onSave} disabled={isSaving}>
                        Save Changes
                    </Button>
                    <Button
                        color={"lighterror"}
                        className="rounded-md bg-lighterror dark:bg-darkerror text-error hover:bg-error hover:text-white"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UserProfileModal;
