import { create } from 'zustand';
import { meOrgAPI } from 'src/_settings/me/me-org-api';

type UserProfileState = {
    fbName: string;
    fbClientName: string;
    fbAvatar: string | null;
    hydrated: boolean;
    hydrating: boolean;
    setFBName: (fbName: string) => void;
    setFBClientName: (fbClientName: string) => void;
    setFBAvatar: (avatarUrl: string | null) => void;
    // hydrateFromApi: () => Promise<void>;
};

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
    fbName: '',
    fbClientName:'',
    fbAvatar: null,
    hydrated: false,
    hydrating: false,

    setFBName: (fbName) => set({ fbName: fbName || '' }),
    setFBClientName: (fbClient: string) => set({ fbClientName: fbClient || '' }),
    setFBAvatar: (avatarUrl) => set({ fbAvatar: avatarUrl }),

    // hydrateFromApi: async () => {
    //     const { hydrating, hydrated } = get();
    //     if (hydrating || hydrated) return;

    //     set({ hydrating: true });
    //     try {
    //         const user = await meOrgAPI.getMe();
    //         set({
    //             fbName: user.name || '',
    //             fbAvatar: user.avatar || null,
    //             hydrated: true,
    //         });
    //     } catch {
    //         set({ hydrated: true });
    //     } finally {
    //         set({ hydrating: false });
    //     }
    // },
}));

