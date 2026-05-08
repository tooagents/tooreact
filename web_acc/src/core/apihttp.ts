import { config } from 'src/config';
import { getAccessToken } from 'src/core/supabase';
import { notifyToast } from 'src/core/toast';
import { waitForAuthReady } from 'src/store/auth-store';

const API_BASE_URL = config.api.baseUrl;

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    let token: string | undefined;

    await waitForAuthReady();

    try {
        token = (await getAccessToken()) ?? undefined;
    } catch (error) {
        console.error('Failed to refresh access token:', error);
    }

    const headers = new Headers(options.headers || {});

    // Only set JSON content-type if body is not a FormData instance
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (token) { headers.set('Authorization', `Bearer ${token}`); }

    const prefix = path.startsWith('/') ? '' : '/';
    const res = await fetch(`${API_BASE_URL}${prefix}${path}`, {
        ...options,
        headers,
    });

    if ((res.status === 401 || res.status === 403) && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/auth/auth2/login') {
            notifyToast({
                message: 'Session expired. Please sign in again.',
                variant: 'error',
                durationMs: 2200,
            });
            window.location.href = '/auth/auth2/login';
        }
    }

    return res;
}

export async function apiGetJson<T>(path: string): Promise<T> {
    const response = await apiFetch(path);
    if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`-- Request failed: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }
    return response.json();
}
