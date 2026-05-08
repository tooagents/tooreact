import React from "react";
import { Icon } from "@iconify/react";

import BreadcrumbComp from "src/_layouts/shared/breadcrumb/BreadcrumbComp";
import CardBox from "src/components/shared/CardBox";
import { Button } from "src/components/ui/button";
import { apiFetch } from "src/core/apihttp";
import { notifyToast } from "src/core/toast";

const BCrumb = [
    { to: "/", title: "Home" },
    { title: "Billing & Subscription" },
];

const plans = [
    {
        name: "Basic",
        price: "$29",
        period: "/ month",
        description: "For small teams getting started.",
        features: ["Up to 10 employees", "Payroll reports"],
        highlight: false,
    },
    {
        name: "Pro",
        price: "$49",
        period: "/ month",
        description: "Best for growing teams.",
        features: ["Up to 100 employees", "Advanced analytics", "Priority support"],
        highlight: true,
        badge: "Recommended",
    },
    {
        name: "Enterprise",
        price: "$99",
        period: "/ month",
        description: "For larger organizations at scale.",
        features: ["Unlimited employees", "API access", "Dedicated support"],
        highlight: false,
    },
];

type PlanKey = "basic" | "pro" | "enterprise";

const BillingSubscription = () => {
    const [activePlan, setActivePlan] = React.useState<PlanKey | null>(null);

    const handleSelectPlan = async (planKey: PlanKey) => {
        if (activePlan) return;
        setActivePlan(planKey);

        try {
            const res = await apiFetch("/stripe/checkout-session", {
                method: "POST",
                body: JSON.stringify({ plan_key: planKey, interval: "month" }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Failed to start checkout.");
            }

            const data = (await res.json()) as { checkout_url?: string };
            if (!data.checkout_url) {
                throw new Error("Stripe checkout URL missing.");
            }

            window.location.href = data.checkout_url;
        } catch (error) {
            console.error(error);
            notifyToast({
                message: "Unable to start checkout. Please try again.",
                variant: "error",
            });
        } finally {
            setActivePlan(null);
        }
    };

    return (
        <>
            <BreadcrumbComp title="Billing & Subscription" items={BCrumb} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {plans.map((plan) => {
                    const planKey = plan.name.toLowerCase() as PlanKey;
                    return (
                        <CardBox
                            key={plan.name}
                            className={[
                                "relative overflow-hidden border",
                                plan.highlight
                                    ? "border-primary/60 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 shadow-xl"
                                    : "border-ld bg-white/80 dark:bg-background",
                            ].join(" ")}
                        >
                            {plan.badge ? (
                                <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                                    {plan.badge}
                                </span>
                            ) : null}

                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                                        {plan.name}
                                    </p>
                                    <div className="mt-3 flex items-end gap-2">
                                        <span className="text-4xl font-semibold text-foreground">
                                            {plan.price}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {plan.period}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        {plan.description}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex items-center gap-2 text-sm">
                                        <Icon
                                            icon="solar:check-circle-linear"
                                            className="text-primary"
                                            width={18}
                                            height={18}
                                        />
                                        <span className="text-foreground">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                type="button"
                                className={[
                                    "mt-7 w-full rounded-md",
                                    plan.highlight ? "" : "bg-foreground text-background hover:bg-foreground/90",
                                ].join(" ")}
                                onClick={() => handleSelectPlan(planKey)}
                                disabled={activePlan !== null}
                            >
                                {activePlan === planKey ? "Redirecting..." : "Select Plan"}
                            </Button>
                        </CardBox>
                    );
                })}
            </div>
        </>
    );
};

export default BillingSubscription;
