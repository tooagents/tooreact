import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clientsAPI } from 'src/_settings/clients/clients-api';
import { userAPI } from 'src/api/user';

export interface BizClient {
    id: string;
    name: string;
    city?: string;
    province?: string;
    phone?: string;
    email?: string;
    employee_count?: number;
    is_delete?: boolean;
    is_deleted?: boolean;
}

interface BizContextType {
    clients: BizClient[];
    loading: boolean;
    activeBizId: string | null;
    activeClient: BizClient | null;
    refreshClients: () => Promise<void>;
    setActiveBizId: (bizId: string | null) => void;
}

const BizContext = createContext<BizContextType | undefined>(undefined);


function saveActiveBizId(bizId: string | null) {
    STORAGE_KEYS.forEach((key) => {
        if (bizId) {
            localStorage.setItem(key, bizId);
        } else {
            localStorage.removeItem(key);
        }
    });
}

function readStoredBizId(): string | null {
    for (const key of STORAGE_KEYS) {
        const value = localStorage.getItem(key);
        if (value) return value;
    }
    return null;
}

async function resolveUserBizId(): Promise<string | null> {
    let tokenUserId: string | null = null;
    let tokenBizId: string | null = null;
    let tokenTenId: string | null = null;

    try {
        const token = localStorage.getItem('access_token');
        if (token) {
            const payloadBase64 = token.split('.')[1];
            if (payloadBase64) {
                const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
                const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
                const payload = JSON.parse(atob(padded));
                tokenUserId = payload?.user_id || payload?.uid || payload?.sub || null;
                tokenBizId = payload?.current_biz_id || payload?.biz_id || payload?.
                tokenTenId = payload?.ten_id || payload?.tenant_id || null;

                if (tokenUserId) localStorage.setItem('user_id', tokenUserId);
                if (tokenTenId) {
                    localStorage.setItem('ten_id', tokenTenId);
                    localStorage.setItem('tenant_id', tokenTenId);
                }
                if (tokenBizId) return tokenBizId;
            }
        }
    } catch {
        // Ignore token parsing failures and fallback to /user/me.
    }

    try {
        const user = (await userAPI.getCurrentUser()) as any;
        const userId = user?.id || user?.user_id || tokenUserId || null;
        const tenId = user?.ten_id || user?.tenant_id || tokenTenId || null;
        if (userId) localStorage.setItem('user_id', userId);
        if (tenId) {
            localStorage.setItem('ten_id', tenId);
            localStorage.setItem('tenant_id', tenId);
        }

        return (
            user?.current_biz_id ||
            user?.biz_id ||
            null
        );
    } catch {
        return tokenBizId;
    }
}

export const BizProvider = ({ children }: { children: React.ReactNode }) => {
    const [clients, setClients] = useState<BizClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeBizId, setActiveBizIdState] = useState<string | null>(readStoredBizId());
    const didBootstrapFromUser = useRef(false);

    const setActiveBizId = (bizId: string | null) => {
        if (activeBizId === bizId) {
            return;
        }

        setActiveBizIdState(bizId);
        saveActiveBizId(bizId);

        if (bizId) {
            void clientsAPI.patchZbid(bizId).catch((error) => {
                console.warn('Failed to persist current biz id:', error);
            });
        }
    };

    const refreshClients = async () => {
        setLoading(true);
        try {
            const data = await clientsAPI.listClients();
            const filtered = Array.isArray(data)
                ? data.filter((item: BizClient) => !item.is_delete && !item.is_deleted)
                : [];

            setClients(filtered);

            const stateBizId = activeBizId;
            const storedBizId = readStoredBizId();
            const shouldBootstrapFromUser = !stateBizId && !storedBizId && !didBootstrapFromUser.current;
            const userBizId = shouldBootstrapFromUser ? await resolveUserBizId() : null;

            if (shouldBootstrapFromUser) {
                didBootstrapFromUser.current = true;
            }

            const preferredBizId = stateBizId || storedBizId || userBizId;
            const preferredExists = !!preferredBizId && filtered.some((c) => c.id === preferredBizId);

            if (preferredExists) {
                setActiveBizId(preferredBizId!);
            } else if (filtered.length > 0) {
                setActiveBizId(filtered[0].id);
            } else {
                setActiveBizId(null);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshClients();
    }, []);

    const activeClient = useMemo(
        () => clients.find((client) => client.id === activeBizId) || null,
        [clients, activeBizId],
    );

    return (
        <BizContext.Provider
            value={{
                clients,
                loading,
                activeBizId,
                activeClient,
                refreshClients,
                setActiveBizId,
            }}
        >
            {children}
        </BizContext.Provider>
    );
};

export const useBiz = () => {
    const context = useContext(BizContext);
    if (!context) {
        throw new Error('useBiz must be used within BizProvider');
    }
    return context;
};
