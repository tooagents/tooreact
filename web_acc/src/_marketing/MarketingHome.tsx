import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import landingCssUrl from '../assets/css/landing.css?url';
import { supabase } from 'src/core/supabase';
import { notifyToast } from 'src/core/toast';
import { useClientStore } from 'src/store/client-store';
import { completeAuthLogin, runNewUserProvisioning } from '../_authentication/authforms/auth-flow';

const MarketingHome = () => {
    const navigate = useNavigate();
    const setClients = useClientStore((state) => state.setClients);
    const setActiveBE = useClientStore((state) => state.setActiveBE);

    const [mobileOpen, setMobileOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [authPanelOpen, setAuthPanelOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
    const [isAuthBusy, setIsAuthBusy] = useState(false);
    const [signinEmail, setSigninEmail] = useState('');
    const [signinPassword, setSigninPassword] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupCompany, setSignupCompany] = useState('');
    const [signupEmployees, setSignupEmployees] = useState('');

    useEffect(() => {
        let link = document.querySelector('link[data-marketing-css="landing"]') as HTMLLinkElement | null;
        let added = false;

        if (!link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = landingCssUrl;
            link.dataset.marketingCss = 'landing';
            document.head.appendChild(link);
            added = true;
        }

        return () => {
            if (added && link?.parentNode) {
                link.parentNode.removeChild(link);
            }
        };
    }, []);

    const toggleFaq = (index: number) => {
        setOpenFaq((current) => (current === index ? null : index));
    };

    const openSignup = () => {
        setAuthMode('signup');
        setAuthPanelOpen(true);
    };

    const openSignin = () => {
        setAuthMode('signin');
        setAuthPanelOpen(true);
    };

    const handleSignin = async (event: FormEvent) => {
        event.preventDefault();
        if (isAuthBusy) return;
        setIsAuthBusy(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: signinEmail.trim(),
                password: signinPassword,
            });
            if (error) {
                throw error;
            }
            await completeAuthLogin(navigate);
        } catch (error: unknown) {
            const rawMessage =
                typeof error === 'object' && error !== null && 'message' in error
                    ? String((error as { message?: unknown }).message)
                    : '';
            const message = (() => {
                if (rawMessage.toLowerCase().includes('invalid') && rawMessage.toLowerCase().includes('email')) {
                    return 'Please enter a valid email address.';
                }
                if (rawMessage.toLowerCase().includes('password')) {
                    return 'Incorrect password. Please try again.';
                }
                if (rawMessage.toLowerCase().includes('not found') || rawMessage.toLowerCase().includes('no user')) {
                    return 'No account found for this email.';
                }
                return 'Sign in failed. Please try again.';
            })();
            notifyToast({ message, variant: 'error' });
        } finally {
            setIsAuthBusy(false);
        }
    };

    const handleSignup = async (event: FormEvent) => {
        event.preventDefault();
        if (isAuthBusy) return;
        const trimmedCompany = signupCompany.trim();
        if (!trimmedCompany) {
            notifyToast({ message: 'Company name is required.', variant: 'error' });
            return;
        }

        setIsAuthBusy(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: signupEmail.trim(),
                password: signupPassword,
                options: {
                    data: {
                        sbu_name: trimmedCompany,
                        sbu_avatar: `https://raw.githubusercontent.com/t4agents/t4agents/refs/heads/main/t4favicon.png`,
                        sbu_client_name: trimmedCompany,
                        sbu_client_id: `client-${Date.now()}`,
                        sbu_user_type: 'T4USER',
                    },
                },
            });
            if (error) {
                throw error;
            }
            if (!data.session) {
                notifyToast({ message: 'Check your email to confirm your account, then sign in.', variant: 'info' });
                return;
            }
            await runNewUserProvisioning();
            navigate('/app');
        } catch (error: unknown) {
            const rawMessage =
                typeof error === 'object' && error !== null && 'message' in error
                    ? String((error as { message?: unknown }).message)
                    : '';
            const message = (() => {
                if (rawMessage.toLowerCase().includes('already') && rawMessage.toLowerCase().includes('registered')) {
                    return 'This email is already in use. Try signing in instead.';
                }
                if (rawMessage.toLowerCase().includes('email')) {
                    return 'Please enter a valid email address.';
                }
                if (rawMessage.toLowerCase().includes('password')) {
                    return 'Password is too weak. Use at least 6 characters.';
                }
                return 'Sign up failed. Please try again.';
            })();
            notifyToast({ message, variant: 'error' });
        } finally {
            setIsAuthBusy(false);
        }
    };

    const handleGoogleAuth = async () => {
        if (isAuthBusy) return;
        setIsAuthBusy(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
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
            notifyToast({ message: 'Google sign-in failed. Please try again.', variant: 'error' });
        } finally {
            setIsAuthBusy(false);
        }
    };

    return (
        <div className="relative" style={{ backgroundColor: '#fcf9f5' }}>
            {authPanelOpen && (
                <div
                    className="fixed inset-0 z-30 backdrop-blur-[1px] transition-opacity"
                    style={{ backgroundColor: 'rgba(28, 28, 25, 0)' }}
                    onClick={() => setAuthPanelOpen(false)}
                    aria-hidden="true"
                />
            )}

            <nav
                className="fixed flex justify-between py-6 w-full lg:px-48 md:px-12 px-4 content-center z-10"
                style={{ backgroundColor: '#fcf9f5' }}
            >
                <div className="flex items-center">
                    <img src="/T4BianPublic.png" alt="Logo" className="h-16" />
                </div>
                <ul className="font-montserrat items-center hidden md:flex">
                    <li className="mx-3"><a className="growing-underline" href="#agent-flow" style={{ color: '#1c1c19' }}>Agent Flow</a></li>
                    <li className="mx-3"><a className="growing-underline" href="#features" style={{ color: '#1c1c19' }}>Features</a></li>
                    <li className="mx-3"><a className="growing-underline" href="#faq" style={{ color: '#1c1c19' }}>FAQ</a></li>
                </ul>
                <div className="font-montserrat hidden md:block">
                    <button className="mr-6" style={{ color: '#564335' }} onClick={openSignin}>Login</button>
                    <button
                        className="py-2 px-4 text-white rounded-md"
                        style={{ background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)', borderRadius: '0.375rem' }}
                        onClick={openSignup}
                    >
                        Start Free
                    </button>
                </div>
                <button className="md:hidden" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                    <img src="/landing/assets/logos/Menu.svg" alt="Menu icon" />
                </button>
            </nav>

            <div
                className={`px-4 py-6 fixed top-0 left-0 h-full w-full z-20 animate-fade-in-down ${mobileOpen ? '' : 'hidden'}`}
                style={{ backgroundColor: '#fcf9f5' }}
            >
                <div className="flex justify-end">
                    <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                        <img src="/landing/assets/logos/Cross.svg" alt="" className="h-16 w-16" />
                    </button>
                </div>
                <ul className="font-montserrat flex flex-col mx-8 my-24 items-center text-3xl">
                    <li className="my-6"><a href="#agent-flow" onClick={() => setMobileOpen(false)} style={{ color: '#1c1c19' }}>Agent Flow</a></li>
                    <li className="my-6"><a href="#features" onClick={() => setMobileOpen(false)} style={{ color: '#1c1c19' }}>Features</a></li>
                    <li className="my-6"><a href="#faq" onClick={() => setMobileOpen(false)} style={{ color: '#1c1c19' }}>FAQ</a></li>
                </ul>
                <div className="flex flex-col items-center gap-4">
                    <button className="text-2xl" style={{ color: '#564335' }} onClick={() => { openSignin(); setMobileOpen(false); }}>Login</button>
                    <button
                        className="py-3 px-6 text-white rounded-md text-2xl"
                        style={{ background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)', borderRadius: '0.375rem' }}
                        onClick={() => { openSignup(); setMobileOpen(false); }}
                    >
                        Start Free
                    </button>
                </div>
            </div>

            <div className={`${authPanelOpen ? 'blur-sm' : ''} transition-all`}>
                <section
                    className="pt-24 md:mt-0 md:h-screen flex flex-col justify-center text-center md:text-left md:flex-row md:justify-between md:items-center lg:px-48 md:px-12 px-4"
                    id="top"
                    style={{ backgroundColor: '#fcf9f5' }}
                >
                    <div className="md:flex-1 md:mr-10">
                        <h1 className="font-pt-serif text-5xl font-bold mb-7" style={{ color: '#1c1c19' }}>
                            <span className="block">Team of One.</span>
                            <span className="block mt-4">AI Accounting Agents.</span>
                        </h1>
                        <p className="font-pt-serif font-normal mb-7" style={{ color: '#564335' }}>
                            Run full bookkeeping ops with an agent crew: ingest transactions, draft journal entries, post to ledger,
                            generate reports, and close periods without growing your back office headcount.
                        </p>
                        <div className="font-montserrat">
                            <button
                                className="inline-block px-6 py-4 rounded-md text-white mr-2 mb-2"
                                style={{ background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)', borderRadius: '0.375rem' }}
                                onClick={openSignup}
                            >
                                Launch Your Agent Team
                            </button>
                            <button
                                className="inline-block px-6 py-4 rounded-md"
                                style={{ border: '1px solid rgba(220, 193, 174, 0.2)', borderRadius: '0.375rem', color: '#904d00' }}
                                onClick={openSignin}
                            >
                                Sign In
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-around md:block mt-8 md:mt-0 md:flex-1">
                        <img src="/landing/assets/MacBook Pro.png" alt="Accounting agents workspace" />
                    </div>
                </section>

                <section className="sectionSize" id="agent-flow" style={{ backgroundColor: '#f6f3ef' }}>
                    <div>
                        <h2 className="secondaryTitle" style={{ color: '#1c1c19' }}>How the agent flow works</h2>
                    </div>
                    <div className="flex flex-col md:flex-row">
                        <div className="flex-1 mx-8 flex flex-col items-center my-4">
                            <div className="border-2 rounded-full h-12 w-12 flex justify-center items-center mb-3" style={{ backgroundColor: '#fcf9f5', borderColor: '#f28500', color: '#904d00' }}>1</div>
                            <h3 className="font-montserrat font-medium text-xl mb-2" style={{ color: '#1c1c19' }}>Ingest</h3>
                            <p className="text-center font-montserrat" style={{ color: '#564335' }}>Upload bank CSVs. Agents normalize and de-duplicate transactions.</p>
                        </div>
                        <div className="flex-1 mx-8 flex flex-col items-center my-4">
                            <div className="border-2 rounded-full h-12 w-12 flex justify-center items-center mb-3" style={{ backgroundColor: '#fcf9f5', borderColor: '#f28500', color: '#904d00' }}>2</div>
                            <h3 className="font-montserrat font-medium text-xl mb-2" style={{ color: '#1c1c19' }}>Draft</h3>
                            <p className="text-center font-montserrat" style={{ color: '#564335' }}>Agents propose journal entries with rationale and confidence.</p>
                        </div>
                        <div className="flex-1 mx-8 flex flex-col items-center my-4">
                            <div className="border-2 rounded-full h-12 w-12 flex justify-center items-center mb-3" style={{ backgroundColor: '#fcf9f5', borderColor: '#f28500', color: '#904d00' }}>3</div>
                            <h3 className="font-montserrat font-medium text-xl mb-2" style={{ color: '#1c1c19' }}>Close</h3>
                            <p className="text-center font-montserrat" style={{ color: '#564335' }}>Post entries, publish statements, and close periods with control.</p>
                        </div>
                    </div>
                </section>

                <section className="sectionSize" id="features" style={{ backgroundColor: '#fcf9f5' }}>
                    <div>
                        <h2 className="secondaryTitle" style={{ color: '#1c1c19' }}>Built for accounting operators</h2>
                    </div>
                    <div className="flex flex-col md:flex-row gap-6 w-full">
                        <div className="flex-1 shadow-2xl rounded-2xl py-6 px-7" style={{ backgroundColor: '#ffffff' }}>
                            <h3 className="font-pt-serif text-2xl mb-3" style={{ color: '#1c1c19' }}>Inbox to Ledger</h3>
                            <p style={{ color: '#564335' }}>Move from raw transactions to posted entries in one continuous workflow.</p>
                        </div>
                        <div className="flex-1 shadow-2xl rounded-2xl py-6 px-7" style={{ backgroundColor: '#ffffff' }}>
                            <h3 className="font-pt-serif text-2xl mb-3" style={{ color: '#1c1c19' }}>Trial Balance and Statements</h3>
                            <p style={{ color: '#564335' }}>Generate trial balance, balance sheet, and income statement on demand.</p>
                        </div>
                        <div className="flex-1 shadow-2xl rounded-2xl py-6 px-7" style={{ backgroundColor: '#ffffff' }}>
                            <h3 className="font-pt-serif text-2xl mb-3" style={{ color: '#1c1c19' }}>Tax Package Export</h3>
                            <p style={{ color: '#564335' }}>Export period package files for year-end and advisor handoff.</p>
                        </div>
                    </div>
                </section>

                <section className="sectionSize" id="faq" style={{ backgroundColor: '#f6f3ef' }}>
                    <div>
                        <h2 className="secondaryTitle" style={{ color: '#1c1c19' }}>FAQ</h2>
                    </div>

                    <div className="w-full py-4" role="button" tabIndex={0} onClick={() => toggleFaq(0)}>
                        <div className="flex justify-between items-center">
                            <div className="font-montserrat font-medium mr-auto" style={{ color: '#1c1c19' }}>Is this accounting app replacing payroll?</div>
                            <img src="/landing/assets/logos/CaretRight.svg" alt="" className="transition-transform" style={{ transform: openFaq === 0 ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        </div>
                        <div className={`font-montserrat text-sm font-extralight pb-8 ${openFaq === 0 ? '' : 'hidden'}`} style={{ color: '#564335' }}>
                            Yes. This workspace is positioned for accounting operations: ledger, reports, and period close.
                        </div>
                    </div>
                    <hr className="w-full" style={{ backgroundColor: '#dcc1ae', opacity: 0.15 }} />

                    <div className="w-full py-4" role="button" tabIndex={0} onClick={() => toggleFaq(1)}>
                        <div className="flex justify-between items-center">
                            <div className="font-montserrat font-medium mr-auto" style={{ color: '#1c1c19' }}>Can one person run this end to end?</div>
                            <img src="/landing/assets/logos/CaretRight.svg" alt="" className="transition-transform" style={{ transform: openFaq === 1 ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        </div>
                        <div className={`font-montserrat text-sm font-extralight pb-8 ${openFaq === 1 ? '' : 'hidden'}`} style={{ color: '#564335' }}>
                            That is the core promise. A single operator can drive daily bookkeeping with AI agent support.
                        </div>
                    </div>
                    <hr className="w-full" style={{ backgroundColor: '#dcc1ae', opacity: 0.15 }} />

                    <div className="w-full py-4" role="button" tabIndex={0} onClick={() => toggleFaq(2)}>
                        <div className="flex justify-between items-center">
                            <div className="font-montserrat font-medium mr-auto" style={{ color: '#1c1c19' }}>Do I still control final posting?</div>
                            <img src="/landing/assets/logos/CaretRight.svg" alt="" className="transition-transform" style={{ transform: openFaq === 2 ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        </div>
                        <div className={`font-montserrat text-sm font-extralight pb-8 ${openFaq === 2 ? '' : 'hidden'}`} style={{ color: '#564335' }}>
                            Yes. Agents draft and suggest. You choose what gets posted and when periods close.
                        </div>
                    </div>
                    <hr className="w-full" style={{ backgroundColor: '#dcc1ae', opacity: 0.15 }} />
                </section>

                <section className="sectionSize" style={{ backgroundColor: '#f6f3ef' }}>
                    <div className="mb-4">
                        <img src="/T4BianPublic.png" alt="Logo" className="h-10" />
                    </div>
                    <div className="font-montserrat text-sm" style={{ color: '#564335' }}>© 2026 T4Agents. Team of One AI Accounting.</div>
                </section>
            </div>

            <aside
                className={`marketing-auth-panel fixed right-0 top-0 z-40 h-full bg-white shadow-2xl transition-transform duration-300 ease-out ${authPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ backgroundColor: '#ffffff' }}
                aria-hidden={!authPanelOpen}
            >
                <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(220, 193, 174, 0.15)' }}>
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full flex items-center justify-center font-pt-serif text-lg">
                                <img src="/t4logo-1024-trans.png" alt="logo" className="h-full w-full object-contain" />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#564335', opacity: 0.5 }}>Welcome</p>
                                <p className="text-lg font-semibold" style={{ color: '#1c1c19' }}>Start your accounting workspace</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="h-10 w-10 rounded-full"
                            style={{ border: '1px solid rgba(220, 193, 174, 0.15)', color: '#564335' }}
                            onClick={() => setAuthPanelOpen(false)}
                            aria-label="Close"
                        >
                            X
                        </button>
                    </div>

                    <div className="px-6 py-6 flex-1 overflow-y-auto">
                        <div className="mb-6">
                            <div className="inline-flex rounded-full p-1" style={{ border: '1px solid rgba(220, 193, 174, 0.15)', backgroundColor: 'rgba(28, 28, 25, 0.05)' }}>
                                <button
                                    type="button"
                                    className={`px-5 py-2 rounded-full text-sm font-semibold transition ${authMode === 'signup' ? 'text-white' : ''}`}
                                    style={authMode === 'signup' ? { background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)' } : { color: '#564335', opacity: 0.6 }}
                                    onClick={() => setAuthMode('signup')}
                                >
                                    Sign up
                                </button>
                                <button
                                    type="button"
                                    className={`px-5 py-2 rounded-full text-sm font-semibold transition ${authMode === 'signin' ? 'text-white' : ''}`}
                                    style={authMode === 'signin' ? { background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)' } : { color: '#564335', opacity: 0.6 }}
                                    onClick={() => setAuthMode('signin')}
                                >
                                    Sign in
                                </button>
                            </div>
                            <p className="mt-4 text-sm" style={{ color: '#564335', opacity: 0.6 }}>
                                {authMode === 'signup' ? 'Create your Team of One accounting workspace.' : 'Welcome back. Continue your accounting flow.'}
                            </p>
                        </div>

                        <form className="grid gap-4" onSubmit={authMode === 'signup' ? handleSignup : handleSignin}>
                            <div className="grid gap-2">
                                <label className="text-xs uppercase tracking-wide" style={{ color: '#564335', opacity: 0.5 }}>Work email</label>
                                <input
                                    className="rounded-xl px-4 py-3 text-sm"
                                    style={{ backgroundColor: '#e5e2de', color: '#1c1c19', border: '1px solid transparent', outline: 'none' }}
                                    type="email"
                                    value={authMode === 'signup' ? signupEmail : signinEmail}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        if (authMode === 'signup') setSignupEmail(value);
                                        else setSigninEmail(value);
                                    }}
                                    placeholder="name@company.com"
                                    disabled={isAuthBusy}
                                />
                            </div>

                            {authMode === 'signup' && (
                                <div className="grid gap-2">
                                    <label className="text-xs uppercase tracking-wide" style={{ color: '#564335', opacity: 0.5 }}>Company name</label>
                                    <input
                                        className="rounded-xl px-4 py-3 text-sm"
                                        style={{ backgroundColor: '#e5e2de', color: '#1c1c19', border: '1px solid transparent', outline: 'none' }}
                                        type="text"
                                        value={signupCompany}
                                        onChange={(event) => setSignupCompany(event.target.value)}
                                        placeholder="Sunrise Coffee"
                                        disabled={isAuthBusy}
                                    />
                                </div>
                            )}

                            <div className="grid gap-2">
                                <label className="text-xs uppercase tracking-wide" style={{ color: '#564335', opacity: 0.5 }}>Password</label>
                                <input
                                    className="rounded-xl px-4 py-3 text-sm"
                                    style={{ backgroundColor: '#e5e2de', color: '#1c1c19', border: '1px solid transparent', outline: 'none' }}
                                    type="password"
                                    value={authMode === 'signup' ? signupPassword : signinPassword}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        if (authMode === 'signup') setSignupPassword(value);
                                        else setSigninPassword(value);
                                    }}
                                    placeholder="............"
                                    disabled={isAuthBusy}
                                />
                            </div>

                            {authMode === 'signup' && (
                                <div className="grid gap-2">
                                    <label className="text-xs uppercase tracking-wide" style={{ color: '#564335', opacity: 0.5 }}>Team size</label>
                                    <input
                                        className="rounded-xl px-4 py-3 text-sm"
                                        style={{ backgroundColor: '#e5e2de', color: '#1c1c19', border: '1px solid transparent', outline: 'none' }}
                                        type="text"
                                        value={signupEmployees}
                                        onChange={(event) => setSignupEmployees(event.target.value)}
                                        placeholder="1-10 operators"
                                        disabled={isAuthBusy}
                                    />
                                </div>
                            )}

                            <div className="mt-6 grid gap-3">
                                <button
                                    className="w-full rounded-xl py-3 text-white font-semibold"
                                    style={{ background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)' }}
                                    type="submit"
                                    disabled={isAuthBusy}
                                >
                                    {authMode === 'signup' ? 'Create account' : 'Continue'}
                                </button>
                                <button
                                    className="w-full rounded-xl py-3 font-semibold"
                                    style={{ border: '1px solid rgba(220, 193, 174, 0.2)', color: '#564335' }}
                                    type="button"
                                    onClick={handleGoogleAuth}
                                    disabled={isAuthBusy}
                                >
                                    Continue with Google
                                </button>
                            </div>
                        </form>

                        <div className="mt-6 rounded-2xl p-4 text-sm" style={{ border: '1px solid rgba(220, 193, 174, 0.15)', backgroundColor: 'rgba(28, 28, 25, 0.05)' }}>
                            <p className="font-semibold" style={{ color: '#1c1c19', opacity: 0.8 }}>What you get</p>
                            <ul className="mt-2 space-y-2" style={{ color: '#564335' }}>
                                <li>Transaction inbox and dedupe flow</li>
                                <li>AI-drafted journal entries with rationale</li>
                                <li>Ledger, statements, and period close</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default MarketingHome;
