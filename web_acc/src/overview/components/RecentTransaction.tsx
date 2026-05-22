import CardBox from 'src/components/shared/CardBox';

export const RecentTransaction = () => {
  const timelineData = [
    {
      key: 'timeline1',
      time: '08:30 am',
      desc: 'Bi-weekly payroll approved for 46 employees',
      isSale: false,
      borderColor: 'border-primary',
      isLastItem: false,
    },
    {
      key: 'timeline2',
      time: '09:15 am',
      desc: '2 timesheets flagged for missing overtime rates',
      isSale: false,
      borderColor: 'border-info',
      isLastItem: false,
    },
    {
      key: 'timeline3',
      time: '10:40 am',
      desc: 'Direct deposit file generated: $214,000',
      isSale: false,
      borderColor: 'border-success',
      isLastItem: false,
    },
    {
      key: 'timeline4',
      time: '11:10 am',
      desc: 'CRA remittance prepared for this period',
      isSale: false,
      borderColor: 'border-warning',
      isLastItem: false,
    },
    {
      key: 'timeline5',
      time: '12:20 pm',
      desc: '1 new employee added to next payroll cycle',
      isSale: false,
      borderColor: 'border-error',
      isLastItem: false,
    },
    {
      key: 'timeline6',
      time: '01:00 pm',
      desc: 'Payroll audit export downloaded',
      isSale: false,
      borderColor: 'border-success',
      isLastItem: true,
    },
  ];
  return (
    <CardBox className="h-full w-full ">
      <div>
        <h5 className="card-title">Payroll Activity</h5>
        <p className="text-sm text-muted-foreground font-normal">
          Latest processing events and checks
        </p>
      </div>

      <div className="mt-6">
        {timelineData.map((item) => {
          return (
            <div key={item.key} className="flex gap-x-3">
              <div className="w-1/4 text-end">
                <span className="font-medium text-foreground dark:text-muted-foreground">{item.time}</span>
              </div>
              <div
                className={`relative ${
                  item.isLastItem ? 'after:hidden' : null
                } after:absolute after:top-7 after:bottom-0 after:start-3.5 after:w-px after:-translate-x-[0.5px] after:bg-border`}
              >
                <div className="relative z-1 w-7 h-7 flex justify-center items-center">
                  <div
                    className={`h-3 w-3 rounded-full bg-transparent border-2 ${item.borderColor}`}
                  ></div>
                </div>
              </div>
              <div className="w-1/4 grow pt-0.5 pb-6">
                <p className="font-medium text-foreground dark:text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </CardBox>
  );
};
