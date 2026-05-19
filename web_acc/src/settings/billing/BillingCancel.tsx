import CardBox from "src/components/shared/CardBox";
import { Button } from "src/components/ui/button";

const BillingCancel = () => {
    return (
        <div className="flex min-h-[70vh] items-center justify-center px-4">
            <CardBox className="w-full max-w-xl border border-ld">
                <div className="text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        Payment Canceled
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">No Charges Were Made</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Your subscription was not completed. You can select a plan again anytime.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <Button asChild variant="outline">
                            <a href="/app/settings/billing">Return to Billing</a>
                        </Button>
                    </div>
                </div>
            </CardBox>
        </div>
    );
};

export default BillingCancel;

