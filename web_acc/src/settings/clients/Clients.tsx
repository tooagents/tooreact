import { useMemo, useState, useEffect } from 'react';

import { TbDotsVertical } from 'react-icons/tb';
import { Icon } from '@iconify/react';
import { ClientDB, getClientDisplayName, getClientId } from 'src/types/type_client';

import { Checkbox } from 'src/components/ui/checkbox';
import LoadingSpinner from 'src/components/shared/LoadingSpinner';
import { Button } from 'src/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from 'src/components/ui/card';
import { Table, TBody, TCell, THead, THeader, TRow, } from 'src/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from 'src/components/ui/dropdown-menu';
import { Input } from 'src/components/ui/input';

import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { useClientStore } from 'src/store/client-store';
import { useUserProfileStore } from 'src/store/user-profile-store';
import { useAuthStore } from 'src/store/auth-store';
import { supabase } from 'src/core/supabase';
import { notifyToast } from 'src/core/toast';

import { clientsAPI } from './clients-api';
import BizEntityFormModal from './BizEntityFormModal';
import { downloadClientsCsv } from './clientDownload';

const BCrumb = [
    { to: '/', title: 'Home', },
    { title: 'Clients', },
];

const pageSize = 20;

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return 'Unknown error';
    }
};

const Clients = () => {
    const [clients, setClients] = useState<ClientDB[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSwitchingActive, setIsSwitchingActive] = useState(false);
    const [query, setQuery] = useState('');
    const [pageIndex, setPageIndex] = useState(0);
    const setStoreClients = useClientStore((state) => state.setClients);
    const setFBClientName = useUserProfileStore((state) => state.setFBClientName);
    const fbClientName = useUserProfileStore((state) => state.fbClientName);
    const authUser = useAuthStore((state) => state.user);
    const activeBE = useClientStore((state) => state.activeBE);
    const setActiveBE = useClientStore((state) => state.setActiveBE);
    const activeClientId = activeBE?.active_zbid ?? null;
    const selectedClient: ClientDB | null =
        clients.find((client) => getClientId(client) === activeClientId) || null;

    const refreshClients = async () => {
        setIsLoading(true);
        try {
            const data = await clientsAPI.listClients();
            const nextClients = data.clients;
            setClients(nextClients);
            setStoreClients(
                nextClients
                    .map((client) => ({
                        id: getClientId(client),
                        name: getClientDisplayName(client),
                    }))
                    .filter((client) => client.id),
            );

            const { data: userData } = await supabase.auth.getUser();
            const latestMetadata = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
            const authMetadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
            const jwtClientId =
                (typeof latestMetadata.sbu_client_id === 'string' && latestMetadata.sbu_client_id
                    ? latestMetadata.sbu_client_id
                    : null) ??
                (typeof authMetadata.sbu_client_id === 'string' && authMetadata.sbu_client_id
                    ? authMetadata.sbu_client_id
                    : null);
            const jwtClientName =
                (typeof latestMetadata.sbu_client_name === 'string' && latestMetadata.sbu_client_name
                    ? latestMetadata.sbu_client_name
                    : null) ??
                (typeof authMetadata.sbu_client_name === 'string' && authMetadata.sbu_client_name
                    ? authMetadata.sbu_client_name
                    : null);

            const nextActiveClient =
                (jwtClientId
                    ? nextClients.find((client) => getClientId(client) === jwtClientId)
                    : null) ??
                nextClients.find((client) => getClientId(client) === data.activeClientId) ??
                null;

            if (nextActiveClient) {
                const nextClientId = getClientId(nextActiveClient);
                const nextClientName = getClientDisplayName(nextActiveClient) || nextClientId;
                setActiveBE({
                    active_zbid: nextClientId,
                    name: nextClientName,
                });
                setFBClientName(
                    jwtClientId === nextClientId && jwtClientName
                        ? jwtClientName
                        : nextClientName,
                );
                return;
            }

            setActiveBE(null);
            setFBClientName('');
        } finally {
            setIsLoading(false);
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientDB | null>(null);

    const syncUserClientMetadata = async (clientId: string, clientName: string) => {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            throw sessionError;
        }
        if (!sessionData.session) {
            throw new Error('No active auth session.');
        }

        const { error: updateError } = await supabase.auth.updateUser({
            data: {
                sbu_client_id: clientId,
                sbu_client_name: clientName,
            },
        });
        if (updateError) {
            throw updateError;
        }

        // Force a fresh JWT so RLS claims reflect the selected client.
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            throw refreshError;
        }
    };

    const handleCheckboxChange = async (clientId: string) => {
        if (isSwitchingActive || clientId === activeClientId) {
            return;
        }

        const previousActiveBE = activeBE;
        const previousClientName = fbClientName;
        const selected = clients.find((client) => getClientId(client) === clientId);
        const selectedClientName = selected ? getClientDisplayName(selected) || clientId : clientId;
        setActiveBE({
            active_zbid: clientId,
            name: selectedClientName,
        });
        setFBClientName(selectedClientName);
        setIsSwitchingActive(true);
        try {
            await syncUserClientMetadata(clientId, selectedClientName);
        } catch (err) {
            setActiveBE(previousActiveBE);
            setFBClientName(previousClientName);
            const message = getErrorMessage(err);
            notifyToast({ message: `Failed to save selected client: ${message}`, variant: 'error' });
            console.error('Failed to persist client selection metadata:', err);
        } finally {
            setIsSwitchingActive(false);
        }
    };

    const fetchClients = async () => {
        try {
            await refreshClients();
        } catch (err) {
            console.error('Failed to load clients:', err);
        }
    };

    const handleCreateClient = () => {
        setEditingClient(null);
        setIsModalOpen(true);
    };

    const handleEditClient = (client: ClientDB) => {
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleDeleteClient = async (clientId: string) => {
        try {
            await clientsAPI.softDeleteClient(clientId);
            await fetchClients();
        } catch (err) {
            console.error('Failed to delete client:', err);
        }
    };

    // load on mount
    useEffect(() => {
        void refreshClients();
    }, []);

    const filtered = useMemo(() => {
        if (!query.trim()) return clients;
        const needle = query.trim().toLowerCase();
        return clients.filter((row) =>
            Object.values(row).some((val) => String(val).toLowerCase().includes(needle)),
        );
    }, [clients, query]);

    useEffect(() => {
        setPageIndex(0);
    }, [query, clients.length]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageData = useMemo(
        () => filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        [filtered, pageIndex],
    );

    const canPrev = pageIndex > 0;
    const canNext = pageIndex + 1 < pageCount;

    const handleDownload = () => {
        downloadClientsCsv(filtered);
    };

    return (
        <>
            {isSwitchingActive && (
                <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="rounded-md bg-background border border-border px-4 py-3 shadow-lg">
                        <div className="inline-flex items-center gap-3 text-sm font-medium">
                            <LoadingSpinner size="md" />
                            <span>Switching active client...</span>
                        </div>
                    </div>
                </div>
            )}
            <BreadcrumbComp
                title="Clients"
                items={BCrumb}
                leftContent={
                    selectedClient ? (
                        <Card className="w-auto gap-1 p-3 rounded-md border-secondary/20 bg-lightsecondary/10 shadow-none">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-sm font-medium">Active Workspace</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-base font-semibold mb-1">{getClientDisplayName(selectedClient)}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="p-4">
                            <CardContent className="text-center text-muted-foreground py-2">
                                No client selected
                            </CardContent>
                        </Card>
                    )
                }
            />

            <div className="flex gap-6 flex-col">

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <div className="relative flex-1 min-w-0">
                
                    <Icon icon="solar:magnifer-linear" width="18" height="18" className="absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                        type="text"
                        className="pl-9 rounded-md border-0 bg-gray-100/80 shadow-none placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-secondary/40 focus-visible:ring-offset-0 dark:bg-slate-900/50 dark:placeholder:text-white/20"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search..."
                    />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <Button
                            onClick={handleDownload}
                            variant="lightsecondary"
                            size="icon"
                            className="h-9 w-9 rounded-md border border-secondary/20"
                            title="Download CSV"
                            disabled={filtered.length === 0}
                        >
                            <Icon icon="material-symbols:download-rounded" width="18" height="18" />
                            <span className="sr-only">Download CSV</span>
                        </Button>
                        <Button onClick={handleCreateClient} color={"primary"} className="flex items-center gap-1.5 rounded-md">
                            <Icon icon="solar:add-circle-outline" width="18" height="18" /> Add Client
                        </Button>
                    </div>
                </div>

                <div className="border rounded-md border-ld">
                    <Table>
                        <THeader>
                            <TRow>
                                <THead className="text-sm font-semibold pl-11">Client Name</THead>
                                <THead className="text-sm font-semibold">Contact</THead>
                                <THead className="text-sm font-semibold">Phone</THead>
                                <THead className="text-sm font-semibold">Email</THead>
                                <THead className="text-sm font-semibold">Status</THead>
                                <THead className="text-sm font-semibold">Actions</THead>
                            </TRow>
                        </THeader>

                        <TBody>
                            {isLoading ? (
                                <TRow><TCell colSpan={6} className="text-center py-8">
                                    <div className="inline-flex items-center gap-2 text-gray-500">
                                        <LoadingSpinner size="md" />
                                    </div>
                                </TCell></TRow>
                            ) : filtered.length === 0 ? (
                                <TRow><TCell colSpan={6} className="text-center py-8">
                                    No clients found
                                </TCell></TRow>
                            ) : (
                                pageData.map((client, index) => {
                                    const clientId = getClientId(client);
                                    const clientName = getClientDisplayName(client);
                                    return (
                                        <TRow
                                            key={clientId || `client-${index}`}
                                            className={activeClientId === clientId ? 'bg-primary/5' : ''}
                                        >
                                            <TCell className="font-semibold">
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer"
                                                    onClick={() => clientId && void handleCheckboxChange(clientId)}
                                                >
                                                    <Checkbox
                                                        checked={Boolean(clientId) && activeClientId === clientId}
                                                        onCheckedChange={() => clientId && void handleCheckboxChange(clientId)}
                                                    />
                                                    {clientName}
                                                </div>
                                            </TCell>

                                            <TCell className="text-muted-foreground text-sm">{client.client_contact_name || '-'}</TCell>
                                            <TCell className="text-muted-foreground text-sm">{client.client_mainphone ?? client.phone}</TCell>
                                            <TCell className="text-muted-foreground text-sm">{client.client_email ?? client.email}</TCell>
                                            <TCell className="text-center text-sm">{client.client_status || '-'}</TCell>
                                            <TCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                                            <TbDotsVertical size={22} />
                                                        </span>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <DropdownMenuItem className="flex gap-3 items-center cursor-pointer" onClick={() => handleEditClient(client)}>
                                                            <Icon icon={'solar:pen-new-square-broken'} height={18} /><span>Edit</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="flex gap-3 items-center cursor-pointer" onClick={() => clientId && handleDeleteClient(clientId)}>
                                                            <Icon icon={'solar:trash-bin-minimalistic-outline'} height={18} /><span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TCell>
                                        </TRow>
                                    );
                                })
                            )}
                        </TBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-4 p-2">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                                disabled={!canPrev}
                                variant="secondary"
                                className="flex-1 sm:flex-none text-xs sm:text-sm"
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                                disabled={!canNext}
                                className="flex-1 sm:flex-none text-xs sm:text-sm"
                            >
                                Next
                            </Button>
                        </div>

                        <div className="text-forest-black dark:text-white/90 font-medium text-xs sm:text-base whitespace-nowrap">
                            Page {pageIndex + 1} of {pageCount}
                        </div>
                    </div>
                </div>

                <BizEntityFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onComplete={async () => { setIsModalOpen(false); await fetchClients(); }}
                    initialData={editingClient}
                />
            </div>
        </>
    );
};

export default Clients;
