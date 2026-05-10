import React from "react";

import { Link, useNavigate } from "react-router-dom";
import { Button } from 'src/components/ui/button';
import { Checkbox } from 'src/components/ui/checkbox';
import { Input } from 'src/components/ui/input';
import { Label } from 'src/components/ui/label';

import { supabase } from "src/core/supabase";
import { notifyToast } from "src/core/toast";
import AuthLoadingOverlay from "./AuthLoadingOverlay";
import { useClientStore } from "src/store/client-store";
// import { completeAuthLogin } from "./auth-flow";

const STATUS_MESSAGES = [
    "Verifying your credentials...",
    "Checking access permissions...",
    "Loading your workspace...",
    "Restoring your last session...",
    "Refreshing account context...",
    "Syncing workspace data...",
    "Finishing sign in...",
    "Almost there. Opening your dashboard...",
];

function mapLoginError(error: unknown): { inline: boolean; message: string } {
    const message =
        typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: unknown }).message)
            : "";

    if (message.toLowerCase().includes("invalid") && message.toLowerCase().includes("email")) {
        return { inline: true, message: "Please enter a valid email address." };
    }
    if (message.toLowerCase().includes("password")) {
        return { inline: true, message: "Incorrect password. Please try again." };
    }
    if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("no user")) {
        return { inline: true, message: "No account found for this email." };
    }
    return { inline: false, message: "Sign in failed. Please try again." };
}

const AuthLogin = () => {
    const navigate = useNavigate();
    const setClients = useClientStore((state) => state.setClients);
    const setActiveBE = useClientStore((state) => state.setActiveBE);

    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [isSigningIn, setIsSigningIn] = React.useState(false);
    const [statusIndex, setStatusIndex] = React.useState(0);
    const [formError, setFormError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!isSigningIn) {
            setStatusIndex(0);
            return;
        }

        const intervalId = window.setInterval(() => {
            setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
        }, 1400);

        return () => window.clearInterval(intervalId);
    }, [isSigningIn]);


    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSigningIn) return;
        setFormError(null);
        setIsSigningIn(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (error) {throw error;}

            
            // await completeAuthLogin(navigate, setClients, setActiveBE);
        } catch (error: any) {
            console.error(error);
            const mapped = mapLoginError(error);
            if (mapped.inline) {
                setFormError(mapped.message);
            } else {
                notifyToast({ message: mapped.message, variant: "error" });
            }
        } finally {
            setIsSigningIn(false);
        }
    };


    return (
        <>
            <AuthLoadingOverlay isOpen={isSigningIn} message={STATUS_MESSAGES[statusIndex]} />
            <form className="mt-6" onSubmit={handleLogin}>
                <div className="mb-4">
                    <div className="mb-2 block">
                        <Label htmlFor="Username">Username</Label>
                    </div>
                    <Input
                        id="username"
                        type="email"
                        value={email}
                        disabled={isSigningIn}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setFormError(null);
                        }}
                    />
                </div>

                <div className="mb-4">
                    <div className="mb-2 block">
                        <Label htmlFor="userpwd">Password</Label>
                    </div>
                    <Input
                        id="userpwd"
                        type="password"
                        value={password}
                        disabled={isSigningIn}
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

                <div className="flex justify-between my-5">
                    <div className="flex items-center gap-2">
                        <Checkbox id="accept" className="checkbox" disabled={isSigningIn} />
                        <Label
                            htmlFor="accept"
                            className="opacity-90 font-normal cursor-pointer"
                        >
                            Trust this Device
                        </Label>
                    </div>
                    <Link to={"/"} className="text-primary text-sm font-medium">
                        Forgot Password ?
                    </Link>
                </div>

                <Button type="submit" className="w-full" disabled={isSigningIn}>
                    {isSigningIn ? "Please wait..." : "Sign in"}
                </Button>
            </form>
        </>
    );
};

export default AuthLogin;
