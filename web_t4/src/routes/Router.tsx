// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lazy } from 'react';
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import Loadable from '../_layouts/shared/loadable/Loadable';
import { useAuthStore } from 'src/store/auth-store';

/* =========================Auth Pages========================= */
const Login2 = Loadable(lazy(() => import('src/_authentication/auth2/Login')));
const Register2 = Loadable(lazy(() => import('src/_authentication/auth2/Register')));
const Maintainance = Loadable(lazy(() => import('src/_authentication/Maintainance')));
const Error = Loadable(lazy(() => import('src/_authentication/Error')));

/* =========================Route Guards========================= */
const ProtectedRoute = () => {
    const { user, ready } = useAuthStore();
    if (!ready) return null;
    return user ? <Outlet /> : <Navigate to="/auth/auth2/login" replace />;
};
const PublicRoute = () => {
    const { user, ready } = useAuthStore();
    if (!ready) return null;
    return !user ? <Outlet /> : <Navigate to="/app" replace />;
};

/* =========================Layouts========================= */
const FullLayout = Loadable(lazy(() => import('../_layouts/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../_layouts/BlankLayout')));

/* =========================Marketing========================= */
const MarketingHome = Loadable(lazy(() => import('src/_marketing/MarketingHome')));

/* =========================Dashboard========================= */
const Modern = Loadable(lazy(() => import('src/_overview/Modern')));

/* =========================Pages========================= */
const UserProfile = Loadable(lazy(() => import('src/_settings/me/Me')));
const Clients = Loadable(lazy(() => import('src/_settings/clients/Clients')));
const BillingSubscription = Loadable(lazy(() => import('src/_settings/billing/BillingSubscription')));
const BillingSuccess = Loadable(lazy(() => import('src/_settings/billing/BillingSuccess')));
const BillingCancel = Loadable(lazy(() => import('src/_settings/billing/BillingCancel')));

/* =========================Biz========================= */
const Employee = Loadable(lazy(() => import('src/_settings/employees/Employee')));
const PayrollScheduleEntrance = Loadable(lazy(() => import('src/_payroll/schedule/PayrollSchedule')));
const PayrollHistoryList = Loadable(lazy(() => import('src/_payroll/history/PayrollHistoryList')));
const PayrollHistoryDetail = Loadable(lazy(() => import('src/_payroll/history/PayrollHistoryDetail')));

const Notes = Loadable(lazy(() => import('src/_support/notes/Notes')));
const Form = Loadable(lazy(() => import('src/components/form/Form')));
const TableDefault = Loadable(lazy(() => import('src/components/table/Table_Default')));
const Payroll = Loadable(lazy(() => import('src/_payroll/entry/PayrollEntry')));
const Tickets = Loadable(lazy(() => import('src/_support/ticket/Tickets')));
const CreateTickets = Loadable(lazy(() => import('src/_support/ticket/CreateTickets')));
const KB = Loadable(lazy(() => import('src/_support/kb/KB')));
const BlogDetail = Loadable(lazy(() => import('src/_support/kb/BlogDetail')));
const Integration = Loadable(lazy(() => import('src/_support/integration/Integration')));
const SolarIcon = Loadable(lazy(() => import('src/_layouts/shared/icons/SolarIcon')));

/* =========================Router Config========================= */
const router = createBrowserRouter([
    // PUBLIC MARKETING
    {
        path: '/',
        element: <MarketingHome />,
    },

    // PROTECTED APP ROUTES
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/app',
                element: <FullLayout />,
                children: [
                    { index: true, element: <Modern /> },

                    { path: 'settings/employee', element: <Employee /> },

                    { path: 'payroll/entry', element: <Payroll /> },
                    { path: 'payroll/history', element: <PayrollHistoryList /> },
                    { path: 'payroll/history/:id', element: <PayrollHistoryDetail /> },
                    { path: 'payroll/schedule', element: <PayrollScheduleEntrance /> },

                    { path: 'utilities/form', element: <Form /> },

                    { path: 'apps/notes', element: <Notes /> },
                    { path: 'utilities/form', element: <Form /> },
                    { path: 'utilities/table', element: <TableDefault /> },
                    { path: 'apps/tickets', element: <Tickets /> },
                    { path: 'apps/tickets/create', element: <CreateTickets /> },
                    { path: 'support/kb', element: <KB /> },
                    { path: 'support/integration', element: <Integration /> },
                    { path: 'apps/blog/detail/:id', element: <BlogDetail /> },
                    { path: 'user-profile', element: <UserProfile /> },
                    { path: 'clients', element: <Clients /> },
                    { path: 'settings/billing', element: <BillingSubscription /> },
                    { path: 'billing/success', element: <BillingSuccess /> },
                    { path: 'billing/cancel', element: <BillingCancel /> },
                    { path: 'icons/iconify', element: <SolarIcon /> },
                ],
            },
        ],
    },

    // PUBLIC AUTH ROUTES
    {
        element: <PublicRoute />,
        children: [
            {
                path: '/',
                element: <BlankLayout />,
                children: [
                    { path: 'auth/auth2/login', element: <Login2 /> },
                    { path: 'auth/auth2/register', element: <Register2 /> },
                ],
            },
        ],
    },

    // SYSTEM ROUTES (NO GUARD)
    {
        path: '/auth/maintenance',
        element: <BlankLayout />,
        children: [{ index: true, element: <Maintainance /> }],
    },
    {
        path: '/auth/404',
        element: <BlankLayout />,
        children: [{ index: true, element: <Error /> }],
    },
    {
        path: '/billing/success',
        element: <Navigate to="/app/billing/success" replace />,
    },
    {
        path: '/billing/cancel',
        element: <Navigate to="/app/billing/cancel" replace />,
    },

    // FALLBACK
    {
        path: '*',
        element: <Navigate to="/auth/404" replace />,
    },
]);

export default router;
