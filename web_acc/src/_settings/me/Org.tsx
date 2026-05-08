import { Button } from "src/components/ui/button";
import CardBox from "src/components/shared/CardBox";
import { Icon } from "@iconify/react/dist/iconify.js";
import { dateOnly, type InterfaceBE } from "src/types/type_be";

const Skeleton = ({ className = "" }: { className?: string }) => (<div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-800/70 ${className}`} />);

type OrgProps = {
    loadingProfile: boolean;
    organization: InterfaceBE;
    onEdit: () => void;
};

const Org = ({ loadingProfile, organization, onEdit }: OrgProps) => (
    <CardBox className="p-6 overflow-hidden">
        <h5 className="card-title mb-6">My Organization</h5>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32 mb-6">
            {loadingProfile ? (
                <>
                    <div><p className="text-xs text-gray-500">Legal Name</p><Skeleton className="mt-2 h-4 w-48" /></div>
                    <div><p className="text-xs text-gray-500">Business Type</p><Skeleton className="mt-2 h-4 w-40" /></div>
                    <div><p className="text-xs text-gray-500">Business Number (BN)</p><Skeleton className="mt-2 h-4 w-44" /></div>
                    <div><p className="text-xs text-gray-500">Payroll Account No.</p><Skeleton className="mt-2 h-4 w-44" /></div>
                    <div><p className="text-xs text-gray-500">Remittance Frequency</p><Skeleton className="mt-2 h-4 w-36" /></div>
                    <div><p className="text-xs text-gray-500">Tax Year End</p><Skeleton className="mt-2 h-4 w-32" /></div>
                    <div>
                        <p className="text-xs text-gray-500">Address</p>
                        <Skeleton className="mt-2 h-4 w-60" />
                    </div>
                    <div><p className="text-xs text-gray-500">Phone</p><Skeleton className="mt-2 h-4 w-36" /></div>
                    <div><p className="text-xs text-gray-500">Country</p><Skeleton className="mt-2 h-4 w-32" /></div>
                    <div><p className="text-xs text-gray-500">Employee Count</p><Skeleton className="mt-2 h-4 w-36" /></div>
                </>
            ) : (
                <>
                    <div><p className="text-xs text-gray-500">Operating Name</p><p>{organization.operating_name || "Org name"}</p></div>
                    <div><p className="text-xs text-gray-500">Business Type</p><p>{organization.business_type || "Corporation, partnership, etc."}</p></div>
                    <div><p className="text-xs text-gray-500">Business Number (BN)</p><p>{organization.be_biz_number || "123456789"}</p></div>
                    <div><p className="text-xs text-gray-500">Payroll Account No.</p><p>{organization.payroll_account_number || "123456789RP0001"}</p></div>
                    <div><p className="text-xs text-gray-500">Remittance Frequency</p><p>{organization.remittance_frequency || "Monthly"}</p></div>
                    <div><p className="text-xs text-gray-500">Tax Year End</p><p>{dateOnly(organization.tax_year_end) || "YYYY-MM-DD"}</p></div>
                    <div><p className="text-xs text-gray-500">Address</p><p>{organization.be_address || "Street address"}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{organization.be_phone || "+1 (555) 123-4567"}</p></div>
                    <div><p className="text-xs text-gray-500">Country</p><p>{organization.country || "Canada"}</p></div>
                    <div><p className="text-xs text-gray-500">Employee Count</p><p>{organization.employee_count ?? "Number of employees"}</p></div>
                </>
            )}
        </div>
        <div className="flex justify-end">
            <Button onClick={onEdit} color={"primary"} className="flex items-center gap-1.5 rounded-md" disabled={loadingProfile}>
                <Icon icon="ic:outline-edit" width="18" height="18" /> Edit
            </Button>
        </div>
    </CardBox>
);

export default Org;
