import CardBox from "src/components/shared/CardBox";
import { Button } from "src/components/ui/button";

const BillingSuccess = () => {
    return (
        <div className="flex min-h-[70vh] items-center justify-center px-4">
            <CardBox className="w-full max-w-xl border border-ld">
                <div className="text-center">
                    <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        Payment Confirmed
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">Subscription Activated</h2>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Thanks for subscribing. Your plan is now active and ready to use.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <Button asChild>
                            <a href="/app/settings/billing">Back to Billing</a>
                        </Button>
                    </div>
                </div>
            </CardBox>
        </div>
    );
};

export default BillingSuccess;

