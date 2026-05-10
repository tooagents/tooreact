
import React from "react";
import Google from "/src/assets/images/svgs/google-icon.svg";
import FB from "/src/assets//images/svgs/icon-facebook.png";

import { supabase } from "src/core/supabase";
import { notifyToast } from "src/core/toast";
import AuthLoadingOverlay from "./AuthLoadingOverlay";


interface MyAppProps {
    title?: string;
}

const SocialButtons: React.FC<MyAppProps> = ({ title }) => {
    const [isSigningIn, setIsSigningIn] = React.useState(false);
    const [statusIndex, setStatusIndex] = React.useState(0);

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

    const handleOAuth = async (provider: "google" | "facebook") => {
        if (isSigningIn) return;
        setIsSigningIn(true);

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/auth2/login`,
                },
            });
            if (error) {
                throw error;
            }
            if (data?.url) {
                window.location.assign(data.url);
            }
        } catch (error: unknown) {
            const message =
                typeof error === "object" && error !== null && "message" in error
                    ? String((error as { message?: unknown }).message)
                    : "";
            if (message.toLowerCase().includes("popup")) {
                notifyToast({ message: "Popup blocked. Please allow popups and try again.", variant: "error" });
                return;
            }
            notifyToast({ message: "Social sign-in failed. Please try again.", variant: "error" });
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <>
            <AuthLoadingOverlay isOpen={isSigningIn} message={STATUS_MESSAGES[statusIndex]} />
            <div className="flex justify-between gap-8 my-6 ">
                <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    disabled={isSigningIn}
                    className="px-4 py-2.5 border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld text-primary-ld disabled:opacity-60"
                >
                    <img src={Google} alt="google" height={18} width={18} /> Google
                </button>
                <button
                    type="button"
                    onClick={() => handleOAuth("facebook")}
                    disabled={isSigningIn}
                    className="px-4 py-2.5 border border-ld flex gap-2 items-enter w-full rounded-md text-center justify-center text-ld text-primary-ld disabled:opacity-60"
                >
                    <img src={FB} alt="google" height={18} width={18} />
                    Facebook
                </button>
            </div>
            {/* Divider */}
            <div className="flex items-center justify-center gap-2">
                <hr className="grow border-ld" />
                <p className="text-base text-ld font-medium">{title}</p>
                <hr className="grow border-ld" />
            </div>
        </>
    );
};

export default SocialButtons;

const STATUS_MESSAGES = [
    "Connecting to your provider...",
    "Fetching account details...",
    "Validating permissions...",
    "Preparing your workspace...",
    "Syncing your account...",
    "Finishing sign in...",
    "Almost there. Opening your dashboard...",
];
