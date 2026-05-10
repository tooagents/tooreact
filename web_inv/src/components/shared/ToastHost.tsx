import { useEffect, useState } from "react";
import { toastEventName } from "src/core/toast";

type ToastItem = {
    id: string;
    message: string;
    variant: "info" | "error" | "success";
};

const variantStyles: Record<ToastItem["variant"], string> = {
    info: "bg-slate-900/90 text-white border-slate-700",
    error: "bg-red-600/90 text-white border-red-500",
    success: "bg-emerald-600/90 text-white border-emerald-500",
};

const ToastHost = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{
                id?: string;
                message: string;
                variant?: ToastItem["variant"];
                durationMs?: number;
            }>;
            const id = custom.detail.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const variant = custom.detail.variant ?? "info";
            const message = custom.detail.message;
            const durationMs = custom.detail.durationMs ?? 2500;

            setToasts((prev) => [...prev, { id, message, variant }]);

            window.setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, durationMs);
        };

        window.addEventListener(toastEventName, handler);
        return () => window.removeEventListener(toastEventName, handler);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed right-4 top-4 z-[1000] flex w-[320px] flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`rounded-md border px-3 py-2 text-sm shadow-lg ${variantStyles[toast.variant]}`}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
};

export default ToastHost;
