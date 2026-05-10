'use client';

import { Icon } from '@iconify/react';
import * as profileData from './data';
import SimpleBar from 'simplebar-react';
import { Link } from 'react-router';
import profileimg from 'src/assets/images/profile/user-1.jpg';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from 'src/components/ui/dropdown-menu';
import { Button } from 'src/components/ui/button';

import { useNavigate } from "react-router-dom";
import { supabase, getUserAvatar } from "src/core/supabase";
import { useUserProfileStore } from 'src/store/user-profile-store';
import { useTheme } from 'src/components/provider/theme-provider';
import { useAuthStore } from 'src/store/auth-store';

const Profile = () => {
    const navigate = useNavigate();
    const authUser = useAuthStore((state) => state.user);
    const avatarUrl = useUserProfileStore((state) => state.fbAvatar) || getUserAvatar(authUser) || profileimg;
    const { setTheme } = useTheme();

    const handleLogout = async () => {
        setTheme('light');
        await supabase.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        navigate("/");       // redirect
    };
    return (
        <div className="relative group/menu ps-1 sm:ps-15 shrink-0">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <span className="hover:text-primary hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
                        <img src={avatarUrl} alt="logo" height="35" width="35" className="rounded-full object-cover h-[35px] w-[35px]" />
                    </span>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    className="w-screen sm:w-[200px] pb-6 pt-4 rounded-sm"
                >
                    <SimpleBar>
                        {profileData.profileDD.map((items, index) => (
                            <DropdownMenuItem
                                key={index}
                                asChild
                                className="px-4 py-2 flex justify-between items-center bg-hover group/link w-full cursor-pointer"
                            >
                                <Link to={items.url}>
                                    <div className="w-full">
                                        <div className="ps-0 flex items-center gap-3 w-full">
                                            <Icon
                                                icon={items.icon}
                                                className="text-lg text-muted-foreground group-hover/link:text-primary"
                                            />
                                            <div className="w-3/4">
                                                <h5 className="mb-0 text-sm text-muted-foreground group-hover/link:text-primary">
                                                    {items.title}
                                                </h5>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </SimpleBar>

                    <DropdownMenuSeparator className='my-2' />

                    <div className="pt-2 px-4">
                        <Button
                            variant="outline"
                            className="w-full rounded-md"
                            onClick={handleLogout}
                        >
                            Logout
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

export default Profile;
