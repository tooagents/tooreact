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
                name: 'AI Agent Workspace',
                icon: 'solar:widget-2-linear',
                id: uniqueId(),
                url: '/app',
                isPro: false,
            },
        ],
    },



    {
        heading: 'AI Accounting',
        children: [
            {
                name: 'Inbox',
                icon: 'solar:ufo-linear',
                id: uniqueId(),
                url: '/app/acc/inbox',
            },

            {
                name: 'Entries',
                icon: 'solar:inbox-linear',
                id: uniqueId(),
                url: '/app/acc/je',
            },

            {
                name: 'Ledger',
                icon: 'solar:layers-linear',
                id: uniqueId(),
                url: '/app/acc/ledger',
            },

            {
                name: 'Reports',
                icon: 'solar:chart-square-linear',
                id: uniqueId(),
                url: '/app/acc/reports',
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
                name: 'COA',
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
            {
                name: 'MCP',
                id: uniqueId(),
                icon: 'solar:code-square-linear',
                url: '/app/support/mcp',
                isPro: false,
            },
        ],
    },
];

export default SidebarContent;

