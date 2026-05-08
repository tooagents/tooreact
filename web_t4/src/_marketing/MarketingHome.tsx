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
                        sbu_user_type: "T4USER",
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

            {/* Navigation */}
            <nav
                className="fixed flex justify-between py-6 w-full lg:px-48 md:px-12 px-4 content-center z-10"
                style={{ backgroundColor: '#fcf9f5' }}
            >
                <div className="flex items-center">
                    <img src="/T4BianPublic.png" alt="Logo" className="h-16" />
                </div>
                <ul className="font-montserrat items-center hidden md:flex">
                    <li className="mx-3 ">
                        <a className="growing-underline" href="#howitworks" style={{ color: '#1c1c19' }}>
                            How it works
                        </a>
                    </li>
                    <li className="growing-underline mx-3">
                        <a href="#features" style={{ color: '#1c1c19' }}>Features</a>
                    </li>
                    <li className="growing-underline mx-3">
                        <a href="#pricing" style={{ color: '#1c1c19' }}>Pricing</a>
                    </li>
                </ul>
                <div className="font-montserrat hidden md:block">
                    <a
                        className="mr-6"
                        href="/auth/auth2/login"
                        style={{ color: '#564335' }}
                        onClick={(event) => {
                            event.preventDefault();
                            setAuthMode('signin');
                            setAuthPanelOpen(true);
                        }}
                    >
                        Login
                    </a>
                    <a
                        className="py-2 px-4 text-white rounded-md"
                        style={{
                            background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)',
                            borderRadius: '0.375rem'
                        }}
                        href="/auth/auth2/register"
                        onClick={(event) => {
                            event.preventDefault();
                            setAuthMode('signup');
                            setAuthPanelOpen(true);
                        }}
                    >
                        Signup
                    </a>
                </div>
                <button
                    id="showMenu"
                    className="md:hidden"
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                >
                    <img src="/landing/assets/logos/Menu.svg" alt="Menu icon" />
                </button>
            </nav>
            <div
                id="mobileNav"
                className={`px-4 py-6 fixed top-0 left-0 h-full w-full z-20 animate-fade-in-down ${mobileOpen ? '' : 'hidden'
                    }`}
                style={{ backgroundColor: '#fcf9f5' }}
            >
                <div id="hideMenu" className="flex justify-end">
                    <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                        <img src="/landing/assets/logos/Cross.svg" alt="" className="h-16 w-16" />
                    </button>
                </div>
                <ul className="font-montserrat flex flex-col mx-8 my-24 items-center text-3xl">
                    <li className="my-6">
                        <a href="#howitworks" onClick={() => setMobileOpen(false)} style={{ color: '#1c1c19' }}>
                            How it works
                        </a>
                    </li>
                    <li className="my-6">
                        <a href="#features" onClick={() => setMobileOpen(false)} style={{ color: '#1c1c19' }}>
                            Features
                        </a>
                    </li>
                    <li className="my-6">
                        <a href="#pricing" onClick={() => setMobileOpen(false)} style={{ color: '#1c1c19' }}>
                            Pricing
                        </a>
                    </li>
                </ul>
                <div className="flex flex-col items-center gap-4">
                    <a
                        className="text-2xl"
                        href="/auth/auth2/login"
                        style={{ color: '#564335' }}
                        onClick={(event) => {
                            event.preventDefault();
                            setAuthMode('signin');
                            setAuthPanelOpen(true);
                            setMobileOpen(false);
                        }}
                    >
                        Login
                    </a>
                    <a
                        className="py-3 px-6 text-white rounded-md text-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)',
                            borderRadius: '0.375rem',
                        }}
                        href="/auth/auth2/register"
                        onClick={(event) => {
                            event.preventDefault();
                            setAuthMode('signup');
                            setAuthPanelOpen(true);
                            setMobileOpen(false);
                        }}
                    >
                        Signup
                    </a>
                </div>
            </div>

            <div className={`${authPanelOpen ? 'blur-sm' : ''} transition-all`}>
                {/* Hero */}
                <section
                    className="pt-24 md:mt-0 md:h-screen flex flex-col justify-center text-center md:text-left md:flex-row md:justify-between md:items-center lg:px-48 md:px-12 px-4"
                    id="top"
                    style={{ backgroundColor: '#fcf9f5' }}
                >
                    <div className="md:flex-1 md:mr-10">
                        <h1 className="font-pt-serif text-5xl font-bold mb-7" style={{ color: '#1c1c19' }}>
                            <span className="block">Team of One</span>
                            <span className="block mt-6 text-right">AI Payroll Agents</span>
                        </h1>
                        <p className="font-pt-serif font-normal mb-7" style={{ color: '#564335' }}>
                            Run payroll in minutes, keep taxes on track, and give your team clear pay stubs without the late nights.
                        </p>
                        <div className="font-montserrat">
                            <a
                                className="inline-block px-6 py-4 rounded-md text-white mr-2 mb-2"
                                style={{
                                    background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)',
                                    borderRadius: '0.375rem'
                                }}
                                href="/auth/auth2/register"
                                onClick={(event) => {
                                    event.preventDefault();
                                    setAuthMode('signup');
                                    setAuthPanelOpen(true);
                                }}
                            >
                                Start free setup
                            </a>
                            <a
                                className="inline-block px-6 py-4 rounded-md"
                                style={{
                                    border: '1px solid rgba(220, 193, 174, 0.2)',
                                    borderRadius: '0.375rem',
                                    color: '#904d00'
                                }}
                                href="/auth/auth2/login"
                                onClick={(event) => {
                                    event.preventDefault();
                                    setAuthMode('signin');
                                    setAuthPanelOpen(true);
                                }}
                            >
                                See a sample run
                            </a>
                        </div>
                    </div>
                    <div className="flex justify-around md:block mt-8 md:mt-0 md:flex-1">
                        <div className="relative">
                            <img src="/landing/assets/Highlight1.svg" alt="" className="absolute -top-16 -left-10" />
                        </div>
                        <img src="/landing/assets/MacBook Pro.png" alt="Macbook" />
                        <div className="relative">
                            <img src="/landing/assets/Highlight2.svg" alt="" className="absolute -bottom-10 -right-6" />
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section className="sectionSize" id="howitworks" style={{ backgroundColor: '#f6f3ef' }}>
                    <div>
                        <h2 className="secondaryTitle bg-underline3 bg-100%" style={{ color: '#1c1c19' }}>How it works</h2>
                    </div>
                    <div className="flex flex-col md:flex-row">
                        <div className="flex-1 mx-8 flex flex-col items-center my-4">
                            <div
                                className="border-2 rounded-full h-12 w-12 flex justify-center items-center mb-3"
                                style={{
                                    backgroundColor: '#fcf9f5',
                                    borderColor: '#f28500',
                                    color: '#904d00'
                                }}
                            >
                                1
                            </div>
                            <h3 className="font-montserrat font-medium text-xl mb-2" style={{ color: '#1c1c19' }}>Set up once</h3>
                            <p className="text-center font-montserrat" style={{ color: '#564335' }}>
                                Add employees, pay schedules, and deductions in minutes.
                            </p>
                        </div>
                        <div className="flex-1 mx-8 flex flex-col items-center my-4">
                            <div
                                className="border-2 rounded-full h-12 w-12 flex justify-center items-center mb-3"
                                style={{
                                    backgroundColor: '#fcf9f5',
                                    borderColor: '#f28500',
                                    color: '#904d00'
                                }}
                            >
                                2
                            </div>
                            <h3 className="font-montserrat font-medium text-xl mb-2" style={{ color: '#1c1c19' }}>Run payroll</h3>
                            <p className="text-center font-montserrat" style={{ color: '#564335' }}>
                                Review hours, approvals, and totals before you click run.
                            </p>
                        </div>
                        <div className="flex-1 mx-8 flex flex-col items-center my-4">
                            <div
                                className="border-2 rounded-full h-12 w-12 flex justify-center items-center mb-3"
                                style={{
                                    backgroundColor: '#fcf9f5',
                                    borderColor: '#f28500',
                                    color: '#904d00'
                                }}
                            >
                                3
                            </div>
                            <h3 className="font-montserrat font-medium text-xl mb-2" style={{ color: '#1c1c19' }}>Pay and share</h3>
                            <p className="text-center font-montserrat" style={{ color: '#564335' }}>
                                Pay employees and share stubs with clean, exportable records.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="sectionSize" id="features" style={{ backgroundColor: '#fcf9f5' }}>
                    <div>
                        <h2 className="secondaryTitle bg-underline3 bg-100%" style={{ color: '#1c1c19' }}>Features</h2>
                    </div>
                    <div className="md:grid md:grid-cols-2 md:grid-rows-2">
                        <div className="flex items-start font-montserrat my-6 mr-10">
                            <img src="/landing/assets/logos/Heart.svg" alt="" className="h-7 mr-4" style={{ filter: 'brightness(0) saturate(100%) invert(30%) sepia(100%) saturate(1000%) hue-rotate(350deg)' }} />
                            <div>
                                <h3 className="font-semibold text-2xl" style={{ color: '#1c1c19' }}>Auto-calculate taxes</h3>
                                <p style={{ color: '#564335' }}>
                                    Keep federal, state, and local calculations organized so payroll totals line up every run.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start font-montserrat my-6 mr-10">
                            <img src="/landing/assets/logos/Heart.svg" alt="" className="h-7 mr-4" style={{ filter: 'brightness(0) saturate(100%) invert(30%) sepia(100%) saturate(1000%) hue-rotate(350deg)' }} />
                            <div>
                                <h3 className="font-semibold text-2xl" style={{ color: '#1c1c19' }}>Flexible pay types</h3>
                                <p style={{ color: '#564335' }}>
                                    Handle hourly, salary, bonuses, reimbursements, and deductions in one clean flow.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start font-montserrat my-6 mr-10">
                            <img src="/landing/assets/logos/Heart.svg" alt="" className="h-7 mr-4" style={{ filter: 'brightness(0) saturate(100%) invert(30%) sepia(100%) saturate(1000%) hue-rotate(350deg)' }} />
                            <div>
                                <h3 className="font-semibold text-2xl" style={{ color: '#1c1c19' }}>Employee self-service</h3>
                                <p style={{ color: '#564335' }}>
                                    Give your team access to pay stubs and year-end forms without the back-and-forth.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start font-montserrat my-6 mr-10">
                            <img src="/landing/assets/logos/Heart.svg" alt="" className="h-7 mr-4" style={{ filter: 'brightness(0) saturate(100%) invert(30%) sepia(100%) saturate(1000%) hue-rotate(350deg)' }} />
                            <div>
                                <h3 className="font-semibold text-2xl" style={{ color: '#1c1c19' }}>Multi-location ready</h3>
                                <p style={{ color: '#564335' }}>
                                    Track multiple teams or locations with clear audit trails and exports.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing */}
                <section className="sectionSize py-0" id="pricing" style={{ backgroundColor: '#fcf9f5' }}>
                    <div>
                        <h2 className="secondaryTitle bg-underline4 mb-0 bg-100%" style={{ color: '#1c1c19' }}>Pricing</h2>
                    </div>
                    <div className="flex w-full flex-col md:flex-row">
                        <div className="flex-1 flex flex-col mx-6 shadow-2xl relative rounded-2xl py-5 px-8 my-8 md:top-24" style={{ backgroundColor: '#ffffff' }}>
                            <h3 className="font-pt-serif font-normal text-2xl mb-4" style={{ color: '#1c1c19' }}>Team of One</h3>
                            <div className="font-montserrat font-bold text-2xl mb-4" style={{ color: '#904d00' }}>
                                $1
                                <span className="font-normal text-base" style={{ color: '#564335' }}> / month</span>
                            </div>

                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>1 employee</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Unlimited pay runs</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>All payroll features</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Email support</p>
                            </div>

                            <button
                                className="rounded-md text-lg py-3 mt-4"
                                style={{
                                    border: '1px solid rgba(220, 193, 174, 0.2)',
                                    borderRadius: '0.375rem',
                                    color: '#904d00',
                                    backgroundColor: 'transparent'
                                }}
                            >
                                Choose plan
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col mx-6 shadow-2xl relative rounded-2xl py-5 px-8 my-8 md:top-12" style={{ backgroundColor: '#ffffff' }}>
                            <h3 className="font-pt-serif font-normal text-2xl mb-4" style={{ color: '#1c1c19' }}>Team of Ten</h3>
                            <div className="font-montserrat font-bold text-2xl mb-4" style={{ color: '#904d00' }}>
                                $11
                                <span className="font-normal text-base" style={{ color: '#564335' }}> / month</span>
                            </div>

                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Up to 10 employees</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Unlimited pay runs</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>All payroll features</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Priority support</p>
                            </div>

                            <button
                                className="rounded-md text-lg py-3 mt-4"
                                style={{
                                    border: '1px solid rgba(220, 193, 174, 0.2)',
                                    borderRadius: '0.375rem',
                                    color: '#904d00',
                                    backgroundColor: 'transparent'
                                }}
                            >
                                Choose plan
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col mx-6 shadow-2xl relative rounded-2xl py-5 px-8 my-8 md:top-24" style={{ backgroundColor: '#ffffff' }}>
                            <h3 className="font-pt-serif font-normal text-2xl mb-4" style={{ color: '#1c1c19' }}>Team of Hundred</h3>
                            <div className="font-montserrat font-bold text-2xl mb-4" style={{ color: '#904d00' }}>
                                $111
                                <span className="font-normal text-base" style={{ color: '#564335' }}> / month</span>
                            </div>

                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Unlimited employees</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Unlimited pay runs</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>All payroll features</p>
                            </div>
                            <div className="flex">
                                <img src="/landing/assets/logos/CheckedBox.svg" alt="" className="mr-1" />
                                <p style={{ color: '#564335' }}>Custom solutions available</p>
                            </div>

                            <button
                                className="rounded-md text-lg py-3 mt-4"
                                style={{
                                    border: '1px solid rgba(220, 193, 174, 0.2)',
                                    borderRadius: '0.375rem',
                                    color: '#904d00',
                                    backgroundColor: 'transparent'
                                }}
                            >
                                Choose plan
                            </button>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="sectionSize items-start pt-8 md:pt-36" id="faq" style={{ backgroundColor: '#f6f3ef' }}>
                    <div>
                        <h2 className="secondaryTitle bg-highlight3 p-10 mb-0 bg-center bg-100%" style={{ color: '#1c1c19' }}>FAQ</h2>
                    </div>

                    <div className="w-full py-4" role="button" tabIndex={0} onClick={() => toggleFaq(0)}>
                        <div className="flex justify-between items-center">
                            <div className="font-montserrat font-medium mr-auto" style={{ color: '#1c1c19' }}>Does this work for modern small businesses?</div>
                            <img
                                src="/landing/assets/logos/CaretRight.svg"
                                alt=""
                                className="transition-transform"
                                style={{ transform: openFaq === 0 ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                        </div>
                        <div className={`font-montserrat text-sm font-extralight pb-8 ${openFaq === 0 ? '' : 'hidden'}`} style={{ color: '#564335' }}>
                            Yes. T4Agents is built for small teams that want fast, reliable payroll without extra overhead.
                        </div>
                    </div>
                    <hr className="w-full" style={{ backgroundColor: '#dcc1ae', opacity: 0.15 }} />

                    <div className="w-full py-4" role="button" tabIndex={0} onClick={() => toggleFaq(1)}>
                        <div className="flex justify-between items-center">
                            <div className="font-montserrat font-medium mr-auto" style={{ color: '#1c1c19' }}>Can I run payroll more than once per month?</div>
                            <img
                                src="/landing/assets/logos/CaretRight.svg"
                                alt=""
                                className="transition-transform"
                                style={{ transform: openFaq === 1 ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                        </div>
                        <div className={`font-montserrat text-sm font-extralight pb-8 ${openFaq === 1 ? '' : 'hidden'}`} style={{ color: '#564335' }}>
                            Absolutely. Run payroll as often as you need, including off-cycle runs.
                        </div>
                    </div>
                    <hr className="w-full" style={{ backgroundColor: '#dcc1ae', opacity: 0.15 }} />

                    <div className="w-full py-4" role="button" tabIndex={0} onClick={() => toggleFaq(2)}>
                        <div className="flex justify-between items-center">
                            <div className="font-montserrat font-medium mr-auto" style={{ color: '#1c1c19' }}>Do employees get pay stubs?</div>
                            <img
                                src="/landing/assets/logos/CaretRight.svg"
                                alt=""
                                className="transition-transform"
                                style={{ transform: openFaq === 2 ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                        </div>
                        <div className={`font-montserrat text-sm font-extralight pb-8 ${openFaq === 2 ? '' : 'hidden'}`} style={{ color: '#564335' }}>
                            Yes. Every run creates shareable pay stubs and clean records.
                        </div>
                    </div>
                    <hr className="w-full" style={{ backgroundColor: '#dcc1ae', opacity: 0.15 }} />
                </section>

                {/* Footer */}
                <section className="sectionSize" style={{ backgroundColor: '#f6f3ef' }}>
                    <div className="mb-4">
                        <img src="/T4BianPublic.png" alt="Logo" className="h-10" />
                    </div>
                    <div className="flex mb-8">
                        <a href="#top">
                            <img src="/landing/assets/logos/Facebook.svg" alt="Facebook logo" className="mx-4" />
                        </a>
                        <a href="#top">
                            <img src="/landing/assets/logos/Youtube.svg" alt="Youtube logo" className="mx-4" />
                        </a>
                        <a href="#top">
                            <img src="/landing/assets/logos/Instagram.svg" alt="Instagram logo" className="mx-4" />
                        </a>
                        <a href="#top">
                            <img src="/landing/assets/logos/Twitter.svg" alt="Twitter logo" className="mx-4" />
                        </a>
                    </div>
                    <div className="font-montserrat text-sm" style={{ color: '#564335' }}>© 2026 T4Agents. All rights reserved</div>
                </section>
            </div>

            {/* Auth slide-in panel (placeholder UI) */}
            <aside
                className={`marketing-auth-panel fixed right-0 top-0 z-40 h-full bg-white shadow-2xl transition-transform duration-300 ease-out ${authPanelOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                style={{ backgroundColor: '#ffffff' }}
                aria-hidden={!authPanelOpen}
            >
                <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(220, 193, 174, 0.15)' }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="h-9 w-9 rounded-full flex items-center justify-center font-pt-serif text-lg"
                            >
                                <img
                                    src="/t4logo-1024-trans.png"
                                    alt="logo"
                                    className="h-full w-full object-contain"
                                />
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#564335', opacity: 0.5 }}>Welcome</p>
                                <p className="text-lg font-semibold" style={{ color: '#1c1c19' }}>Let's get you set up</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="h-10 w-10 rounded-full"
                            style={{ border: '1px solid rgba(220, 193, 174, 0.15)', color: '#564335' }}
                            onClick={() => setAuthPanelOpen(false)}
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="px-6 py-6 flex-1 overflow-y-auto">
                        <div className="mb-6">
                            <div className="inline-flex rounded-full p-1" style={{ border: '1px solid rgba(220, 193, 174, 0.15)', backgroundColor: 'rgba(28, 28, 25, 0.05)' }}>
                                <button
                                    type="button"
                                    className={`px-5 py-2 rounded-full text-sm font-semibold transition ${authMode === 'signup' ? 'text-white' : ''
                                        }`}
                                    style={authMode === 'signup' ? { background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)' } : { color: '#564335', opacity: 0.6 }}
                                    onClick={() => setAuthMode('signup')}
                                >
                                    Sign up
                                </button>
                                <button
                                    type="button"
                                    className={`px-5 py-2 rounded-full text-sm font-semibold transition ${authMode === 'signin' ? 'text-white' : ''
                                        }`}
                                    style={authMode === 'signin' ? { background: 'linear-gradient(135deg, #904d00 0%, #f28500 100%)' } : { color: '#564335', opacity: 0.6 }}
                                    onClick={() => setAuthMode('signin')}
                                >
                                    Sign in
                                </button>
                            </div>
                            <p className="mt-4 text-sm" style={{ color: '#564335', opacity: 0.6 }}>
                                {authMode === 'signup'
                                    ? 'Start your free setup. No credit card required.'
                                    : 'Welcome back. Pick up where you left off.'}
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
                                        if (authMode === 'signup') {
                                            setSignupEmail(value);
                                        } else {
                                            setSigninEmail(value);
                                        }
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
                                        if (authMode === 'signup') {
                                            setSignupPassword(value);
                                        } else {
                                            setSigninPassword(value);
                                        }
                                    }}
                                    placeholder="••••••••••••"
                                    disabled={isAuthBusy}
                                />
                            </div>

                            {authMode === 'signup' && (
                                <div className="grid gap-2">
                                    <label className="text-xs uppercase tracking-wide" style={{ color: '#564335', opacity: 0.5 }}>Employees</label>
                                    <input
                                        className="rounded-xl px-4 py-3 text-sm"
                                        style={{ backgroundColor: '#e5e2de', color: '#1c1c19', border: '1px solid transparent', outline: 'none' }}
                                        type="text"
                                        value={signupEmployees}
                                        onChange={(event) => setSignupEmployees(event.target.value)}
                                        placeholder="1–10 teammates"
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


                        <div
                            className="mt-6 rounded-2xl p-4 text-sm"
                            style={{ border: '1px solid rgba(220, 193, 174, 0.15)', backgroundColor: 'rgba(28, 28, 25, 0.05)' }}
                        >
                            <p className="font-semibold" style={{ color: '#1c1c19', opacity: 0.8 }}>What you'll get</p>
                            <ul className="mt-2 space-y-2" style={{ color: '#564335' }}>
                                <li>Automated payroll runs in minutes...</li>
                                <li>Clean pay stubs and export-ready reports...</li>
                                <li>Built-in tax reminders and alerts...</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default MarketingHome;
