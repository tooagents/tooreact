import user1 from 'src/assets/images/profile/user-1.jpg';
import user2 from 'src/assets/images/profile/user-2.jpg';
import user3 from 'src/assets/images/profile/user-3.jpg';
import user4 from 'src/assets/images/profile/user-4.jpg';
import user5 from 'src/assets/images/profile/user-5.jpg';
import { TicketType } from 'src/types/ticket';

export const TicketData: TicketType[] = [
  {
    Id: 1,
    ticketTitle: 'Ontario ESA overtime rule clarification',
    ticketDescription:
      'Employee worked 52 hours across two locations. Confirm how weekly overtime is calculated and apply the correct rate.',
    Status: 'Open',
    Label: 'warning',
    thumb: user1,
    AgentName: 'Ava',
    Date: new Date('2026-03-11T14:10:00.000Z'),
    deleted: false,
  },
  {
    Id: 2,
    ticketTitle: 'Retro pay adjustment not reflected on pay stub',
    ticketDescription:
      'Pay rate increase effective Feb 15. Retro calculated but not showing on Mar 1 stub. Review earnings codes mapping.',
    Status: 'Pending',
    Label: 'error',
    thumb: user2,
    AgentName: 'Mason',
    Date: new Date('2026-03-07T09:40:00.000Z'),
    deleted: false,
  },
  {
    Id: 3,
    ticketTitle: 'ROE needed for terminated employee',
    ticketDescription:
      'Termination on Mar 5. Generate ROE, confirm insurable hours, and ensure vacation payout is included.',
    Status: 'Open',
    Label: 'success',
    thumb: user3,
    AgentName: 'Noah',
    Date: new Date('2026-03-08T16:25:00.000Z'),
    deleted: false,
  },
  {
    Id: 4,
    ticketTitle: 'Missing WSIB rate on payroll summary',
    ticketDescription:
      'WSIB premium is not appearing for the construction division. Verify account class and rate setup.',
    Status: 'Pending',
    Label: 'warning',
    thumb: user4,
    AgentName: 'Sofia',
    Date: new Date('2026-03-10T12:05:00.000Z'),
    deleted: false,
  },
  {
    Id: 5,
    ticketTitle: 'T4 preview totals differ from payroll liability',
    ticketDescription:
      'T4 preview shows higher CPP/EI than GL. Reconcile YTD earnings and confirm excluded earnings codes.',
    Status: 'Open',
    Label: 'error',
    thumb: user5,
    AgentName: 'Liam',
    Date: new Date('2026-03-12T08:55:00.000Z'),
    deleted: false,
  },
  {
    Id: 6,
    ticketTitle: 'Stat holiday premium for shift workers',
    ticketDescription:
      'Shift worked on Family Day. Confirm premium pay and lieu day setup in the payroll calendar.',
    Status: 'Closed',
    Label: 'success',
    thumb: user1,
    AgentName: 'Olivia',
    Date: new Date('2026-03-04T19:15:00.000Z'),
    deleted: false,
  },
  {
    Id: 7,
    ticketTitle: 'Vacation pay accrual not updating',
    ticketDescription:
      'New hire with 4% vacation accrual. Accrual balance is stuck after two pay runs.',
    Status: 'Open',
    Label: 'warning',
    thumb: user2,
    AgentName: 'Ethan',
    Date: new Date('2026-03-13T15:30:00.000Z'),
    deleted: false,
  },
  {
    Id: 8,
    ticketTitle: 'Direct deposit rejected by bank',
    ticketDescription:
      'Deposit rejected for employee ID 1842. Verify banking details and re-issue with trace number.',
    Status: 'Closed',
    Label: 'success',
    thumb: user3,
    AgentName: 'Chloe',
    Date: new Date('2026-03-02T11:20:00.000Z'),
    deleted: false,
  },
];
