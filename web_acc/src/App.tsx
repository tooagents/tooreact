import { RouterProvider } from 'react-router';
import router from './routes/Router';
import './assets/css/globals.css';
import { ThemeProvider } from './components/provider/theme-provider';
import ToastHost from './components/shared/ToastHost';
import { useEffect } from 'react';
import { supabase, getUserAvatar } from './core/supabase';
import { useUserProfileStore } from './store/user-profile-store';
import { useAuthStore } from './store/auth-store';
import { useClientStore } from './store/client-store';
import config from './config';

function App() {
    useEffect(() => {
        const setAuthUser = useAuthStore.getState().setUser;
        const setAuthReady = useAuthStore.getState().setReady;
        const setActiveBE = useClientStore.getState().setActiveBE;

        const setAvatarUrl = useUserProfileStore.getState().setFBAvatar;
        // const hydrateFromApi = useUserProfileStore.getState().hydrateFromApi;
        const setFBClientName = useUserProfileStore.getState().setFBClientName;
        const setFBName = useUserProfileStore.getState().setFBName;
        const syncActiveClientFromUser = (
            user: { user_metadata?: Record<string, unknown> } | null,
        ) => {
            const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
            const clientId =
                typeof metadata.sbu_client_id === 'string' && metadata.sbu_client_id.trim()
                    ? metadata.sbu_client_id.trim()
                    : null;
            const clientName =
                typeof metadata.sbu_client_name === 'string' && metadata.sbu_client_name.trim()
                    ? metadata.sbu_client_name.trim()
                    : clientId ?? '';

            if (clientId) {
                setActiveBE({
                    active_zbid: clientId,
                    name: clientName || clientId,
                });
                return;
            }

            setActiveBE(null);
        };

        const initializeAuth = async () => {
            const { data } = await supabase.auth.getSession();
            const user = data.session?.user ?? null;
            setAuthUser(user);
            setAuthReady(true);
            setAvatarUrl(getUserAvatar(user));
            setFBClientName(user?.user_metadata?.sbu_client_name ?? '');
            setFBName(user?.user_metadata?.sbu_name ?? '');
            syncActiveClientFromUser(user);

            // if (user) {
            //     void hydrateFromApi();
            // }
        };

        void initializeAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user ?? null;
            setAuthUser(user);
            setAuthReady(true);
            setAvatarUrl(getUserAvatar(user));
            setFBClientName(user?.user_metadata?.sbu_client_name ?? '');
            setFBName(user?.user_metadata?.sbu_name ?? '');
            syncActiveClientFromUser(user);
            // if (user) {
            //     void hydrateFromApi();
            // }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <>
            <ThemeProvider
                defaultTheme={config.ui.defaultTheme as 'light' | 'dark' | 'system'}
                storageKey="vite-ui-theme"
            >
                <RouterProvider router={router} />
                <ToastHost />
            </ThemeProvider>
        </>
    );
}

export default App;
