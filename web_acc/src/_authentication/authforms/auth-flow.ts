import type { NavigateFunction } from "react-router-dom";

import type { InterfaceBE } from "src/settings/clients/clients-api";
import { apiFetch } from "src/core/apihttp";
import { supabase } from "src/core/supabase";

type ActiveBE = { active_zbid: string; name: string } | null;

export type SetClients = (clients: InterfaceBE[]) => void;
export type SetActiveBE = (active: ActiveBE) => void;

function hasProvisioningMetadata(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null): boolean {
    const tenantId = user?.app_metadata?.sba_ten_id;
    const clientId = user?.user_metadata?.sbu_client_id;
    return typeof tenantId === "string" && tenantId.trim().length > 0
        && typeof clientId === "string" && clientId.trim().length > 0;
}

export async function completeAuthLogin(
    navigate: NavigateFunction,
    // setClients: SetClients,
    // setActiveBE: SetActiveBE
): Promise<void> {
    // let clients: InterfaceBE[] = [];
    // let activeClientId: string | null = null;

    // try {
    //     const payload = await clientsAPI.listClients();
    //     clients = payload.clients;
    //     activeClientId = payload.activeClientId;
    // } catch (error) {
    //     console.error('Failed to load clients after sign-in:', error);
    // }

    // // setClients(clients);

    // const firstClient = clients.find((client) => client.id === activeClientId) ?? null;
    // const activeBE =
    //     firstClient?.id && firstClient?.name
    //         ? {
    //             active_zbid: firstClient.id,
    //             name: firstClient.name,
    //         }
    //         : null;

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;

    if (!hasProvisioningMetadata(user)) {
        await runNewUserProvisioning();

        // Supabase user/app metadata is written by the backend. Refresh so the
        // next API calls carry sba_ten_id and sbu_client_id in the JWT.
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            console.warn("Session refresh warning:", refreshError);
        }
    }

    // setActiveBE(activeBE);
    navigate("/app");
}

type NewUserProfile = {
    displayName?: string | null;
    photoURL?: string | null;
};

export async function runNewUserProvisioning(): Promise<void> {
    const response = await apiFetch('/too/new_user_provision_seed', { method: 'POST' });

    if (!response.ok) throw new Error(await response.text());
}

    
// export async function runNewUserProvisioning(profile?: NewUserProfile): Promise<void> {
//     if (profile?.displayName || profile?.photoURL) {
//         const { error } = await supabase.auth.updateUser({
//             data: {
//                 full_name: profile?.displayName ?? undefined,
//                 avatar_url: profile?.photoURL ?? undefined,
//             },
//         });
//         if (error) {
//             throw error;
//         }
//     }

//     const token = await getAccessToken();
//     if (!token) {
//         throw new Error("Missing Supabase session token.");
//     }
//     const res = await fetch(`${config.api.baseUrl}/newuseronly/new_user`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//     });

//     if (!res.ok) {
//         const errText = await res.text();
//         throw new Error(errText);
//     }

//     localStorage.setItem("access_token", "place holder only for register");
// }

export async function registerNewUserIfNeeded(
    isNewUser: boolean,
    profile?: NewUserProfile
): Promise<void> {
    if (!isNewUser) return;

    await runNewUserProvisioning();
}

