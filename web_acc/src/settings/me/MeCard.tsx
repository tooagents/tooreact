import { Button } from "src/components/ui/button";
import CardBox from "src/components/shared/CardBox";
import { Icon } from "@iconify/react/dist/iconify.js";

import type { InterfaceUser } from "src/types/type_me";

const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-800/70 ${className}`} />
);

type MeProps = {
    loadingProfile: boolean;
    personal: InterfaceUser;
    onEdit: () => void;
};

const Me = ({ loadingProfile, personal, onEdit }: MeProps) => (
    <CardBox className="p-6 overflow-hidden">
        <h5 className="card-title mb-6">Personal Information</h5>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-7 2xl:gap-x-32 mb-6">
            {loadingProfile ? (
                <>
                    <div><p className="text-xs text-gray-500">First Name</p><Skeleton className="mt-2 h-4 w-40" /></div>
                    <div><p className="text-xs text-gray-500">Last Name</p><Skeleton className="mt-2 h-4 w-40" /></div>
                    <div><p className="text-xs text-gray-500">Email</p><Skeleton className="mt-2 h-4 w-48" /></div>
                    <div><p className="text-xs text-gray-500">Phone</p><Skeleton className="mt-2 h-4 w-36" /></div>
                    <div><p className="text-xs text-gray-500">Position</p><Skeleton className="mt-2 h-4 w-40" /></div>
                    <div><p className="text-xs text-gray-500">country</p><Skeleton className="mt-2 h-4 w-40" /></div>
                    <div><p className="text-xs text-gray-500">Province / State</p><Skeleton className="mt-2 h-4 w-40" /></div>
                    <div><p className="text-xs text-gray-500">PIN Code</p><Skeleton className="mt-2 h-4 w-32" /></div>
                    <div><p className="text-xs text-gray-500">Postal Code / ZIP</p><Skeleton className="mt-2 h-4 w-44" /></div>
                    <div><p className="text-xs text-gray-500">Tax No.</p><Skeleton className="mt-2 h-4 w-40" /></div>
                </>
            ) : (
                <>
                    <div><p className="text-xs text-gray-500">First Name</p><p>{personal.first_name || "Your first name"}</p></div>
                    <div><p className="text-xs text-gray-500">Last Name</p><p>{personal.last_name || "Your last name"}</p></div>
                    <div><p className="text-xs text-gray-500">Email</p><p>{personal.email || "you@example.com"}</p></div>
                    <div><p className="text-xs text-gray-500">Phone</p><p>{personal.phone || "+1 (555) 123-4567"}</p></div>
                    <div><p className="text-xs text-gray-500">Position</p><p>{personal.position || "Your position"}</p></div>
                    <div><p className="text-xs text-gray-500">country</p><p>{personal.country || "Country"}</p></div>
                    <div><p className="text-xs text-gray-500">Province / State</p><p>{personal.state || "Province or State"}</p></div>
                    <div><p className="text-xs text-gray-500">Postal Code / ZIP</p><p>{personal.zip || "A1A 1A1 or 12345"}</p></div>
                    <div><p className="text-xs text-gray-500">Tax ID No.</p><p>{personal.tax_no || "Tax ID number"}</p></div>
                    <div><p className="text-xs text-gray-500">Note</p><p>{personal.note || "Add a note"}</p></div>
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

export default Me;
