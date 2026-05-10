import { RevenueUpdate } from "src/_overview/components/RevenueUpdate";
import { YearlyBreakup } from "src/_overview/components/YearlyBreakup";
import { MonthlyEarning } from "src/_overview/components/MonthlyEarning";
import { RecentTransaction } from "src/_overview/components/RecentTransaction";
import { ProductPerformance } from "src/_overview/components/ProuctPerformance";
import { Footer } from "src/_overview/components/Footer";
import ProfileWelcome from "src/_overview/components/ProfileWelcome";
import { Icon } from "@iconify/react/dist/iconify.js";

const Moderndash = () => {
    return (
        <>
            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12">
                    <ProfileWelcome />
                </div>
                <div className="col-span-12">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                        <div className="flex items-start gap-2">
                            <Icon icon="tabler:info-circle" className="mt-0.5 h-4 w-4 shrink-0" />
                            <p className="text-sm">
                                Payroll analytics below are currently sample data. Your real reports will appear after at least 3 completed billing cycles.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-8 col-span-12 flex">
                    <RevenueUpdate />
                </div>
                <div className="lg:col-span-4 col-span-12 ">
                    <YearlyBreakup />
                    <MonthlyEarning />
                </div>
                <div className="lg:col-span-4 col-span-12">
                    <RecentTransaction />
                </div>
                <div className="lg:col-span-8 col-span-12 flex">
                    <ProductPerformance />
                </div>
                <div className="col-span-12">
                    <Footer />
                </div>
            </div>

        </>
    );
};

export default Moderndash;
