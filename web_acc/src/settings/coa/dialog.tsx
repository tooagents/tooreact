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
import { Checkbox } from 'src/components/ui/checkbox';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'src/components/ui/select';
import type { COAFormState, NormalBalance } from '../../types/type_coa';
import type { COATemplate } from '../../types/type_coa';

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
                            value={form.coa_name}
                            onChange={(event) => setForm((current) => ({ ...current, coa_name: event.target.value }))}
                            placeholder="Bank"
                        />
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
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-muted-foreground">Deleted</div>
                            <div className="text-[11px] text-muted-foreground">Archive this account</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="is_deleted"
                                checked={Boolean(form.is_deleted)}
                                onCheckedChange={(checked) => setForm((current) => ({ ...current, is_deleted: Boolean(checked) }))}
                            />
                            <Label htmlFor="is_deleted" className="text-sm font-medium text-muted-foreground">
                                Mark as deleted
                            </Label>
                        </div>
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
