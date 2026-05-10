type ToastDetail = {
    id?: string;
    message: string;
    variant?: "info" | "error" | "success";
    durationMs?: number;
};

const TOAST_EVENT = "app:toast";

export function notifyToast(detail: ToastDetail) {
    if (typeof window === "undefined") return;
    const event = new CustomEvent<ToastDetail>(TOAST_EVENT, { detail });
    window.dispatchEvent(event);
}

export const toastEventName = TOAST_EVENT;
