export interface ChildItem {
    id?: number | string;
    name?: string;
    icon?: string;
    children?: ChildItem[];
    item?: unknown;
    url?: string;
    color?: string;
    disabled?: boolean;
    subtitle?: string;
    badge?: boolean;
    badgeType?: string;
    isPro?: boolean;
}

export interface MenuItem {
    heading?: string;
    name?: string;
    icon?: string;
    id?: number;
    to?: string;
    items?: MenuItem[];
    children?: ChildItem[];
    url?: string;
    disabled?: boolean;
    subtitle?: string;
    badgeType?: string;
    badge?: boolean;
    isPro?: boolean;
}

import { uniqueId } from 'lodash';

const SidebarContent: MenuItem[] = [
    // ==================== NON-PRO SECTIONS ====================
    {
        heading: 'Home',
        children: [
            {
                name: 'Overview',
                icon: 'solar:widget-2-linear',
                id: uniqueId(),
                url: '/app',
                isPro: false,
            },
        ],
    },



    {
        heading: 'payroll',
        children: [
            {
                name: 'Run Payroll',
                icon: 'solar:play-circle-linear',
                id: uniqueId(),
                url: '/app/payroll/entry',
            },

            {
                name: 'Payroll History',
                icon: 'solar:history-linear',
                id: uniqueId(),
                url: '/app/payroll/history',
            },

            {
                name: 'Schedules',
                icon: 'solar:calendar-linear',
                id: uniqueId(),
                url: '/app/payroll/schedule',
            },

        ],
    },
    {
        heading: 'settings',
        children: [
            {
                id: uniqueId(),
                name: 'Me',
                icon: 'solar:user-circle-linear',
                url: '/app/user-profile',
                isPro: false,
            },
            {
                id: uniqueId(),
                name: 'Clients',
                icon: 'solar:buildings-2-linear',
                url: '/app/clients',
                isPro: false,
            },
            {
                name: 'Employees',
                icon: 'solar:users-group-rounded-linear',
                id: uniqueId(),
                url: '/app/settings/employee',
            },
            {
                name: 'Billing & Subscription',
                icon: 'solar:card-2-linear',
                id: uniqueId(),
                url: '/app/settings/billing',
            },
        ],
    },
    {
        heading: 'Support',
        children: [
            {
                id: uniqueId(),
                name: 'Notes',
                icon: 'solar:notes-linear',
                url: '/app/apps/notes',
                isPro: false,
            },
            {
                id: uniqueId(),
                name: 'Tickets',
                icon: 'solar:ticker-star-linear',
                url: '/app/apps/tickets',
                isPro: false,
            },
            {
                name: 'Knowledge Base',
                id: uniqueId(),
                icon: 'solar:sort-by-alphabet-linear',
                url: '/app/support/kb',
                isPro: false,
            },
            {
                name: 'Integration',
                id: uniqueId(),
                icon: 'solar:link-circle-linear',
                url: '/app/support/integration',
                isPro: false,
            },
        ],
    },
];

export default SidebarContent;

