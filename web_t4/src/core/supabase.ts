import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

export type SupabaseUser = User;

export const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
};

export const getUserAvatar = (user: User | null): string | null => {
    const metadata = user?.user_metadata ?? {};
    const avatar =
        (metadata as { avatar_url?: string }).avatar_url ??
        (metadata as { picture?: string }).picture ??
        null;
    return avatar || null;
};

export const getUserDisplayName = (user: User | null): string | null => {
    const metadata = user?.user_metadata ?? {};
    const name =
        (metadata as { full_name?: string }).full_name ??
        (metadata as { name?: string }).name ??
        (metadata as { user_name?: string }).user_name ??
        null;
    return name || null;
};
