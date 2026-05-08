import { create } from 'zustand';

export type ClientOption = {
    id: string;
    name?: string;
};

export type ActiveBE = {
    active_zbid: string;
    name: string;
};

type ClientStoreState = {
    clients: ClientOption[];
    activeBE: ActiveBE | null;
    setClients: (clients: ClientOption[]) => void;
    setActiveBE: (activeBE: ActiveBE | null) => void;
    clearClients: () => void;
};

export const useClientStore = create<ClientStoreState>((set) => ({
    clients: [],
    activeBE: null,
    setClients: (clients) => set({ clients }),
    setActiveBE: (activeBE) => set({ activeBE }),
    clearClients: () => set({ clients: [], activeBE: null }),
}));
