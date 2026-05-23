import React from "react";
import { useNavigate } from "react-router-dom";

import AuthLoadingOverlay from "../authforms/AuthLoadingOverlay";
import { completeAuthLogin } from "../authforms/auth-flow";
import { supabase } from "src/core/supabase";
import { notifyToast } from "src/core/toast";

const AuthCallback = () => {
    const navigate = useNavigate();

    React.useEffect(() => {
        let isMounted = true;

        const finishAuth = async () => {
            try {
                const code = new URLSearchParams(window.location.search).get("code");
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                }

                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (!data.session) {
                    notifyToast({ message: "Please sign in to continue.", variant: "error" });
                    if (isMounted) navigate("/auth/auth2/login", { replace: true });
                    return;
                }

                if (isMounted) {
                    await completeAuthLogin(navigate);
                }
            } catch (error) {
                console.error(error);
                notifyToast({ message: "Unable to finish sign in. Please try again.", variant: "error" });
                if (isMounted) navigate("/auth/auth2/login", { replace: true });
            }
        };

        void finishAuth();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    return <AuthLoadingOverlay isOpen message="Preparing your workspace..." />;
};

export default AuthCallback;
