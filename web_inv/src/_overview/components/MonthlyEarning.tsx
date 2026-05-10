

import CardBox from "../../components/shared/CardBox"

import { Icon } from "@iconify/react/dist/iconify.js";
import Chart from 'react-apexcharts'
import { ApexOptions } from "apexcharts";

const MonthlyEarning = () => {
    const ChartData: ApexOptions = {
        series: [
            {
                name: 'monthly payroll',
                color: "var(--color-secondary)",
                data: [182, 191, 187, 194, 199, 203, 206],
            },
        ],
        chart: {
            id: "weekly-stats2",
            type: "area",
            height: 60,
            sparkline: {
                enabled: true,
            },
            group: 'sparklines',
            fontFamily: "inherit",
            foreColor: "#adb0bb",
        },
        stroke: {
            curve: "smooth",
            width: 2,
        },
        fill: {
            type: "gradient",
            gradient: {
                shadeIntensity: 0,
                inverseColors: false,
                opacityFrom: 0.1,
                opacityTo: 0,
                stops: [20, 180],
            },
        },

        markers: {
            size: 0,
        },
        tooltip: {
            theme: "dark",
            fixed: {
                enabled: true,
                position: "right",
            },
            x: {
                show: false,
            },
            y: {
                formatter: function (value: number) {
                    return `$${value.toLocaleString()}k`;
                }
            }
        },
    };
    return (
        <>
            <CardBox className="p-0 mt-6" >
                <div className="p-30 pb-0">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="lg:col-span-8 md:col-span-8  col-span-8">
                            <h5 className="card-title mb-4">Next Payroll Snapshot</h5>
                            <h4 className="text-xl mb-3">$214,000</h4>
                            <div className="flex items-center mb-3 gap-2">
                                <span className="rounded-full p-1 bg-lightsuccess dark:bg-darksuccess flex items-center justify-center ">
                                    <Icon icon='tabler:arrow-up-right' className="text-success" />
                                </span>
                                <p className="text-muted-foreground mb-0">+2.8%</p>
                                <p className="text-muted-foreground mb-0 ">from last run</p>
                            </div>
                        </div>
                        <div className="lg:col-span-4 md:col-span-4 col-span-4">
                            <div className="flex justify-end">
                                <div className="text-white bg-secondary rounded-full h-11 w-11 flex items-center justify-center">
                                    <Icon icon='tabler:currency-dollar' className="text-xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <Chart
                    options={ChartData}
                    series={ChartData.series}
                    type="area"
                    height={60}
                    width={"100%"}
                />
            </CardBox>
        </>
    )
}
export { MonthlyEarning }
