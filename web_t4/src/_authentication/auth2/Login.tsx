import { Link } from "react-router";
import CardBox from "src/components/shared/CardBox";

import AuthLogin from "../authforms/AuthLogin";
import SocialButtons from "../authforms/SocialButtons";

import FullLogo from "src/_layouts/shared/logo/FullLogo";


const Login = () => {
    return (
        <>
            <div className="relative min-h-screen overflow-auto bg-lightprimary dark:bg-darkprimary">
                <div className="flex min-h-screen justify-center items-center px-4 py-6">
                    <CardBox className="md:w-[450px] w-full border-none">
                        <div className="mx-auto mb-6">
                            <FullLogo />
                        </div>
                        <SocialButtons title="or sign in with" />
                        <AuthLogin />
                        <div className="flex gap-2 text-base text-ld font-medium mt-6 items-center justify-center">
                            <p>New to T4Agents?</p>
                            <Link
                                to={"/auth/auth2/register"}
                                className="text-primary text-sm font-medium"
                            >
                                Create an account
                            </Link>
                        </div>
                    </CardBox>
                </div>
            </div>
        </>
    );
};

export default Login;
