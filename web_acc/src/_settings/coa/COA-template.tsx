import type { COATemplate } from './COA-schema';

export const coaTemplates: COATemplate[] = [
    {
        key: 'minimal-ca',
        name: 'Minimal Canada',
        label: 'Basic',
        description: 'Small starter chart for common accounts.',
    },
    {
        key: 'regular-sme-ca',
        name: 'Regular SME Canada',
        label: 'SME',
        description: 'Broader chart for operating businesses.',
    },
    {
        key: 'cra-reporting-ca',
        name: 'CRA Reporting Canada',
        label: 'CRA',
        description: 'Accounts aligned to Canadian reporting categories.',
    },
];
