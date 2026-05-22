import { useState } from 'react';
import CardBox from '../../components/shared/CardBox';
import Chart from 'react-apexcharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';
import { type ApexAxisChartSeries, type ApexOptions } from 'apexcharts';

const RevenueUpdate = () => {
  const [selectedMonth, setSelectedMonth] = useState('Year 2025');

  // Strongly typed chart data
  interface MonthlyChartData {
    series: ApexAxisChartSeries;
    xaxis: ApexOptions['xaxis'];
  }

  const chartDataByMonth: Record<string, MonthlyChartData> = {
    'Year 2025': {
      series: [
        {
          name: 'Gross Payroll',
          data: [182, 191, 187, 194, 199, 203, 206, 201, 198, 205, 209, 214],
        },
        {
          name: 'Deductions',
          data: [-52, -54, -51, -56, -58, -59, -60, -57, -55, -58, -60, -62],
        },
      ],
      xaxis: {
        categories: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
      },
    },
    'Year 2024': {
      series: [
        {
          name: 'Gross Payroll',
          data: [161, 168, 170, 175, 179, 181, 184, 186, 188, 190, 193, 197],
        },
        {
          name: 'Deductions',
          data: [-45, -47, -46, -49, -50, -52, -52, -53, -54, -55, -56, -57],
        },
      ],
      xaxis: {
        categories: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
      },
    },
    'Year 2023': {
      series: [
        {
          name: 'Gross Payroll',
          data: [142, 148, 151, 153, 157, 161, 164, 167, 170, 173, 176, 180],
        },
        {
          name: 'Deductions',
          data: [-39, -40, -41, -42, -44, -45, -46, -47, -48, -49, -50, -52],
        },
      ],
      xaxis: {
        categories: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
      },
    },
  };

  const baseChartOptions: ApexOptions = {
    chart: {
      toolbar: { show: false },
      type: 'bar' as const,
      fontFamily: 'inherit',
      foreColor: '#7C8FAC',
      height: 310,
      stacked: true,
      width: '100%',
      offsetX: -20,
    },
    colors: ['var(--color-primary)', 'var(--color-secondary)'],
    plotOptions: {
      bar: {
        horizontal: false,
        barHeight: '60%',
        columnWidth: '20%',
        borderRadius: 6,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'all',
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: 'rgba(0,0,0,0.1)',
      strokeDashArray: 3,
    },
    yaxis: {
      min: -80,
      max: 240,
      tickAmount: 6,
      labels: {
        formatter: (val: number) => {
          return `$${val}k`;
        },
      },
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => {
          return `$${val}k`;
        },
      },
    },
  };

  const ChartData: ApexOptions = {
    ...baseChartOptions,
    xaxis: {
      ...chartDataByMonth[selectedMonth].xaxis,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
  };

  return (
    <>
      <CardBox className="pb-0 h-full w-full">
        <div className="sm:flex items-center justify-between mb-6">
          <div>
            <h5 className="card-title">Payroll Run Trend</h5>
            <p className="text-sm text-muted-foreground font-normal">
              Gross payroll vs deductions by month
            </p>
          </div>
          <div className="sm:mt-0 mt-4">
            <Select
              value={selectedMonth}
              onValueChange={(val) => setSelectedMonth(val as keyof typeof chartDataByMonth)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Year 2025">Year 2025</SelectItem>
                <SelectItem value="Year 2024">Year 2024</SelectItem>
                <SelectItem value="Year 2023">Year 2023</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Chart
          options={ChartData}
          series={chartDataByMonth[selectedMonth].series}
          type="bar"
          height="316px"
          width={'100%'}
        />
      </CardBox>
    </>
  );
};
export { RevenueUpdate };
