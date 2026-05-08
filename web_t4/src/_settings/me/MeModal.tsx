import React from "react";
import { Label } from "src/components/ui/label";
import { Input } from "src/components/ui/input";
import type { InterfaceUser } from "src/types/type_me";

type MeModalProps = {
    tempPersonal: InterfaceUser;
    setTempPersonal: React.Dispatch<React.SetStateAction<InterfaceUser>>;
};

const text = (value?: string | number | null) => (value === undefined || value === null ? "" : String(value));
const ME_LABEL_CLASS = "w-32 text-sm text-gray-600";
const ME_WIDE_LABEL_CLASS = "w-40 text-sm text-gray-600 whitespace-nowrap";

const MeModal = ({ tempPersonal, setTempPersonal }: MeModalProps) => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex items-center gap-3">
            <Label htmlFor="firstName" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="lastName" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="email" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="country" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="position" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="facebook" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="twitter" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="github" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="reddit" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="country" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="state" className={ME_LABEL_CLASS}>
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
            <Label htmlFor="zip" className={ME_WIDE_LABEL_CLASS}>
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
            <Label htmlFor="taxNo" className={ME_LABEL_CLASS}>
                Tax No.
            </Label>
            <Input
                id="taxNo"
                placeholder="Tax ID number"
                value={text(tempPersonal.tax_no)}
                onChange={(e) => setTempPersonal({ ...tempPersonal, tax_no: e.target.value })}
            />
        </div>
        <div className="flex items-center gap-3">
            <Label htmlFor="pin" className={ME_LABEL_CLASS}>
                Note
            </Label>
            <Input
                id="note"
                placeholder="Add a note"
                value={text(tempPersonal.note)}
                onChange={(e) => setTempPersonal({ ...tempPersonal, note: e.target.value })}
            />
        </div>
    </div>
);

export default MeModal;
