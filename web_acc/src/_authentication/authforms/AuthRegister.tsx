import React from "react";

import { useNavigate } from "react-router-dom";

import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Label } from "src/components/ui/label";

import { supabase } from "src/core/supabase";
import { notifyToast } from "src/core/toast";
import AuthLoadingOverlay from "./AuthLoadingOverlay";
import { runNewUserProvisioning } from "./auth-flow";
import { apiGetJson } from "src/core/apihttp";

const STATUS_MESSAGES = [
    "Setting up your account...",
    "Sending for authorization...",
    "Applying business rules...",
    "Finalizing registration...",
    "Provisioning your workspace...",
    "Creating default settings...",
    "Syncing account preferences...",
    "Almost done. Preparing your dashboard...",
];

function mapRegisterError(error: unknown): { inline: boolean; message: string } {
    const message =
        typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : "";

    if (message.toLowerCase().includes("already") && message.toLowerCase().includes("registered")) {
        return { inline: true, message: "This email is already in use. Try signing in instead." };
    }
    if (message.toLowerCase().includes("email")) {
        return { inline: true, message: "Please enter a valid email address." };
    }
    if (message.toLowerCase().includes("password")) {
        return { inline: true, message: "Password is too weak. Use at least 6 characters." };
    }
    return { inline: false, message: "Sign up failed. Please try again." };
}

const AuthRegister = () => {
    const navigate = useNavigate();

    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [isRegistering, setIsRegistering] = React.useState(false);
    const [statusIndex, setStatusIndex] = React.useState(0);
    const [formError, setFormError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!isRegistering) {
            setStatusIndex(0);
            return;
        }

        const intervalId = window.setInterval(() => {
            setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
        }, 1400);

        return () => window.clearInterval(intervalId);
    }, [isRegistering]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isRegistering) return;
        const trimmedName = name.trim();
        setFormError(null);
        if (!trimmedName) {
            setFormError("Name is required.");
            return;
        }
        setIsRegistering(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        sbu_name: trimmedName,
                        sbu_avatar: `https://raw.githubusercontent.com/t4agents/t4agents/refs/heads/main/t4favicon.png`,
                        sbu_client_name: trimmedName,
                        sbu_client_id: `client-${Date.now()}`,
                        sbu_user_type: "T4USER",
                    },
                },
            });

            if (error) {throw error;}

            const uid = data.user?.id;
            if (!uid) throw new Error("No user id");

            // persist uid into auth metadata as sbu_client_id
            const { error: updateError } = await supabase.auth.updateUser({
                data: {sbu_client_id: uid,},
            });

            if (updateError) throw updateError;

            await runNewUserProvisioning();
            // await runNewUserProvisioning({
            //     displayName: trimmedName,
            //     photoURL: `https://raw.githubusercontent.com/t4agents/t4agents/refs/heads/main/t4favicon.png`,
            // });
            
            // Refresh session to get JWT with updated app_metadata (sba_ten_id)
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) console.warn('Session refresh warning:', refreshError);
            
            navigate("/app");

        } catch (error: any) {
            console.error(error);
            const mapped = mapRegisterError(error);
            if (mapped.inline) {
                setFormError(mapped.message);
            } else {
                notifyToast({ message: mapped.message, variant: "error" });
            }
        } finally {
            setIsRegistering(false);
        }
    };


    return (
        <>
            <AuthLoadingOverlay isOpen={isRegistering} message={STATUS_MESSAGES[statusIndex]} />
            <form className="mt-6" onSubmit={handleRegister}>
                <div className="mb-4">
                    <div className="mb-2 block">
                        <Label htmlFor="name" className="font-semibold">
                            Name
                        </Label>
                    </div>
                    <Input
                        id="name"
                        type="text"
                        value={name}
                        disabled={isRegistering}
                        required
                        onChange={(e) => {
                            setName(e.target.value);
                            setFormError(null);
                        }}
                    />
                </div>

                <div className="mb-4">
                    <div className="mb-2 block">
                        <Label htmlFor="emadd" className="font-semibold">
                            Email Address
                        </Label>
                    </div>
                    <Input
                        id="emadd"
                        type="email"
                        value={email}
                        disabled={isRegistering}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setFormError(null);
                        }}
                    />
                </div>

                <div className="mb-6">
                    <div className="mb-2 block">
                        <Label htmlFor="userpwd" className="font-semibold">
                            Password
                        </Label>
                    </div>
                    <Input
                        id="userpwd"
                        type="password"
                        value={password}
                        disabled={isRegistering}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setFormError(null);
                        }}
                    />
                </div>

                {formError && (
                    <div className="mb-4 rounded-md border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700" role="alert">
                        {formError}
                    </div>
                )}

                <Button type="submit" className="w-full" disabled={isRegistering}>
                    {isRegistering ? "Please wait..." : "Sign Up"}
                </Button>
            </form>
        </>
    );
};

export default AuthRegister;

