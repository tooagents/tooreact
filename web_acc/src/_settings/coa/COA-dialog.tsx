import type { Dispatch, FormEvent, SetStateAction } from 'react';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from 'src/components/ui/dialog';
import { Input } from 'src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import type { COAFormState, COAGroupLevel1, NormalBalance } from './COA-schema';
import type { COATemplate } from './COA-schema';

export const groupOptions: COAGroupLevel1[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
const normalBalanceOptions: NormalBalance[] = ['Debit', 'Credit'];

type ApplyTemplateDialogProps = {
    pendingTemplate: COATemplate | null;
    applyingTemplate: string | null;
    onCancel: () => void;
    onApply: () => void;
};

export const ApplyTemplateDialog = ({
    pendingTemplate,
    applyingTemplate,
    onCancel,
    onApply,
}: ApplyTemplateDialogProps) => (
    <Dialog
        open={Boolean(pendingTemplate)}
        onOpenChange={(open) => {
            if (!open && !applyingTemplate) onCancel();
        }}
    >
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Apply {pendingTemplate?.label} template?</DialogTitle>
                <DialogDescription>
                    This may overwrite or replace parts of your current chart of accounts. Please think again before continuing.
                    This action cannot be recovered from this page.
                </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Template: {pendingTemplate?.name}
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={Boolean(applyingTemplate)}>
                    Cancel
                </Button>
                <Button type="button" className="bg-red-600 text-white hover:bg-red-700" onClick={onApply} disabled={Boolean(applyingTemplate)}>
                    {applyingTemplate ? <LoadingSpinner size="sm" variant="dots" /> : null}
                    Apply template
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

type AccountFormDialogProps = {
    open: boolean;
    form: COAFormState;
    isEditing: boolean;
    savingAccount: boolean;
    setForm: Dispatch<SetStateAction<COAFormState>>;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const AccountFormDialog = ({
    open,
    form,
    isEditing,
    savingAccount,
    setForm,
    onOpenChange,
    onSubmit,
}: AccountFormDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
            <form onSubmit={onSubmit} className="space-y-4">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit account' : 'Add account'}</DialogTitle>
                    <DialogDescription>Customize the chart of accounts for this business.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">Code</div>
                        <Input
                            required
                            value={form.coa_code}
                            onChange={(event) => setForm((current) => ({ ...current, coa_code: event.target.value }))}
                            placeholder="1000"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">Name</div>
                        <Input
                            required
                            value={form.coa_posting_name}
                            onChange={(event) => setForm((current) => ({ ...current, coa_posting_name: event.target.value }))}
                            placeholder="Bank"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">Type</div>
                        <Select
                            value={form.coa_group_level1}
                            onValueChange={(value) => setForm((current) => ({ ...current, coa_group_level1: value as COAGroupLevel1 }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {groupOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">Normal balance</div>
                        <Select
                            value={form.normal_balance}
                            onValueChange={(value) => setForm((current) => ({ ...current, normal_balance: value as NormalBalance }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {normalBalanceOptions.map((option) => (
                                    <SelectItem key={option} value={option} className="capitalize">
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">Group</div>
                        <Input
                            value={form.coa_group_level2}
                            onChange={(event) => setForm((current) => ({ ...current, coa_group_level2: event.target.value }))}
                            placeholder="current_asset"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="text-xs font-medium text-muted-foreground">Subgroup</div>
                        <Input
                            value={form.coa_group_level3}
                            onChange={(event) => setForm((current) => ({ ...current, coa_group_level3: event.target.value }))}
                            placeholder="cash_and_bank"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={savingAccount}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={savingAccount}>
                        {savingAccount ? <LoadingSpinner size="sm" variant="dots" /> : null}
                        Save
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
);
