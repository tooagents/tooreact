import s1 from 'src/assets/images/blog/blog-img1.jpg';
import s2 from 'src/assets/images/blog/blog-img2.jpg';
import s3 from 'src/assets/images/blog/blog-img3.jpg';
import s4 from 'src/assets/images/blog/blog-img4.jpg';
import s5 from 'src/assets/images/blog/blog-img5.jpg';
import s6 from 'src/assets/images/blog/blog-img6.jpg';
import s7 from 'src/assets/images/blog/blog-img11.jpg';
import s8 from 'src/assets/images/blog/blog-img8.jpg';
import s9 from 'src/assets/images/blog/blog-img9.jpg';
import s10 from 'src/assets/images/blog/blog-img10.jpg';

import user1 from 'src/assets/images/profile/user-1.jpg';
import user2 from 'src/assets/images/profile/user-2.jpg';
import user3 from 'src/assets/images/profile/user-3.jpg';
import user4 from 'src/assets/images/profile/user-4.jpg';
import user5 from 'src/assets/images/profile/user-5.jpg';
import { BlogType, BlogPostType } from 'src/types/blog';

export const BlogComment: BlogType[] = [
  {
    id: 'comm_001',
    profile: {
      id: 101,
      avatar: user2,
      name: 'Mina Patel',
    },
    time: new Date('2026-03-10T10:20:00.000Z'),
    comment:
      'Great checklist. We also added a reminder to verify TD1ON updates when employees move cities.',
    replies: [],
  },
  {
    id: 'comm_002',
    profile: {
      id: 102,
      avatar: user3,
      name: 'Jordan Lee',
    },
    time: new Date('2026-03-09T15:05:00.000Z'),
    comment:
      'The section on retro pay helped us resolve a rate change issue. Thanks for the clear steps.',
    replies: [
      {
        id: 'comm_002_reply_1',
        profile: {
          id: 201,
          avatar: user4,
          name: 'Payroll Team',
        },
        time: new Date('2026-03-09T17:30:00.000Z'),
        comment: 'Glad it helped. We are adding an example walkthrough next.',
      },
    ],
  },
  {
    id: 'comm_003',
    profile: {
      id: 103,
      avatar: user5,
      name: 'Chris Wong',
    },
    time: new Date('2026-03-08T13:45:00.000Z'),
    comment:
      'Would love a sample layout for ROE notes and reason codes in the next update.',
    replies: [],
  },
];

export const BlogPost: BlogPostType[] = [
  {
    id: 1001,
    title: 'Ontario Stat Holiday Pay: What to Review Before Processing',
    content:
      'Before running a stat holiday payroll, confirm eligibility rules, average daily pay method, and how premium pay or lieu days are handled in your policy.',
    coverImg: s1,
    createdAt: new Date('2026-03-12T09:10:00.000Z'),
    view: 1820,
    share: 210,
    category: 'Compliance',
    featured: true,
    author: {
      id: 501,
      avatar: user1,
      name: 'Priya Nair',
    },
    comments: BlogComment,
  },
  {
    id: 1002,
    title: 'CPP and EI at a Glance for Payroll Teams',
    content:
      'Use this overview to validate earnings that should be pensionable or insurable and to spot exceptions for special payments.',
    coverImg: s2,
    createdAt: new Date('2026-03-08T14:30:00.000Z'),
    view: 1465,
    share: 175,
    category: 'Payroll Ops',
    featured: false,
    author: {
      id: 502,
      avatar: user2,
      name: 'Amir Hassan',
    },
    comments: BlogComment,
  },
  {
    id: 1003,
    title: 'Retro Pay Adjustments: A Practical Checklist',
    content:
      'A step-by-step review for rate changes, retro earnings codes, and recalculating statutory deductions before issuing a correction.',
    coverImg: s3,
    createdAt: new Date('2026-03-07T11:00:00.000Z'),
    view: 1320,
    share: 140,
    category: 'Payroll Ops',
    featured: false,
    author: {
      id: 503,
      avatar: user3,
      name: 'Samantha Green',
    },
    comments: BlogComment,
  },
  {
    id: 1004,
    title: 'ROE Basics for Ontario Employers',
    content:
      'Learn what information to gather, how to validate insurable hours and earnings, and when to issue an ROE after separation.',
    coverImg: s4,
    createdAt: new Date('2026-03-05T09:45:00.000Z'),
    view: 1212,
    share: 118,
    category: 'Reporting',
    featured: false,
    author: {
      id: 504,
      avatar: user4,
      name: 'Luca Moretti',
    },
    comments: BlogComment,
  },
  {
    id: 1005,
    title: 'Vacation Pay Accruals and Payouts: Common Pitfalls',
    content:
      'Avoid mismatches by aligning accrual rates, carryover rules, and payout timing with your payroll codes.',
    coverImg: s5,
    createdAt: new Date('2026-03-03T13:20:00.000Z'),
    view: 1088,
    share: 95,
    category: 'HR',
    featured: false,
    author: {
      id: 505,
      avatar: user5,
      name: 'Elena Chen',
    },
    comments: BlogComment,
  },
  {
    id: 1006,
    title: 'WSIB Premiums: What Payroll Needs to Track',
    content:
      'Confirm account class setup, rates by job category, and how to reconcile premiums with payroll reports.',
    coverImg: s6,
    createdAt: new Date('2026-03-02T10:05:00.000Z'),
    view: 980,
    share: 82,
    category: 'Compliance',
    featured: false,
    author: {
      id: 506,
      avatar: user1,
      name: 'Priya Nair',
    },
    comments: BlogComment,
  },
  {
    id: 1007,
    title: 'T4 Year-End Prep: Clean Data Before Filing',
    content:
      'Validate employee profiles, earnings mappings, and year-to-date totals to reduce year-end corrections.',
    coverImg: s7,
    createdAt: new Date('2026-02-26T16:40:00.000Z'),
    view: 1644,
    share: 230,
    category: 'Reporting',
    featured: true,
    author: {
      id: 507,
      avatar: user2,
      name: 'Amir Hassan',
    },
    comments: BlogComment,
  },
  {
    id: 1008,
    title: 'Direct Deposit Troubleshooting Guide',
    content:
      'Steps to verify bank details, confirm prenote settings, and re-issue payments safely.',
    coverImg: s8,
    createdAt: new Date('2026-02-24T08:15:00.000Z'),
    view: 905,
    share: 67,
    category: 'Payroll Ops',
    featured: false,
    author: {
      id: 508,
      avatar: user3,
      name: 'Samantha Green',
    },
    comments: BlogComment,
  },
  {
    id: 1009,
    title: 'Timesheet Corrections: Audit Trail Best Practices',
    content:
      'Document the change reason, approvals, and effective dates so adjustments are transparent and defensible.',
    coverImg: s9,
    createdAt: new Date('2026-02-21T12:55:00.000Z'),
    view: 840,
    share: 51,
    category: 'Operations',
    featured: false,
    author: {
      id: 509,
      avatar: user4,
      name: 'Luca Moretti',
    },
    comments: BlogComment,
  },
  {
    id: 1010,
    title: 'Onboarding Checklist for Ontario Payroll',
    content:
      'Collect TD1/TD1ON forms, direct deposit details, and confirm employment agreements before first payroll.',
    coverImg: s10,
    createdAt: new Date('2026-02-18T09:30:00.000Z'),
    view: 990,
    share: 104,
    category: 'HR',
    featured: false,
    author: {
      id: 510,
      avatar: user5,
      name: 'Elena Chen',
    },
    comments: BlogComment,
  },
];
