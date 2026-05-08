import LoadingSpinner from "src/components/shared/LoadingSpinner";

type AuthLoadingOverlayProps = {
    isOpen: boolean;
    message: string;
};

const AuthLoadingOverlay = ({ isOpen, message }: AuthLoadingOverlayProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <div className="w-[min(92vw,360px)] rounded-xl border border-white/20 bg-slate-900/95 px-5 py-4 text-white shadow-2xl">
                <div className="flex items-center gap-3">
                    <LoadingSpinner size="sm" className="text-white" />
                </div>
                <p className="mt-3 text-sm text-slate-200" aria-live="polite">
                    {message}
                </p>
            </div>
        </div>
    );
};

export default AuthLoadingOverlay;
