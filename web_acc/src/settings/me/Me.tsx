import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react/dist/iconify.js"

import BreadcrumbComp from "src/_layouts/shared/breadcrumb/BreadcrumbComp";
import CardBox from "src/components/shared/CardBox";
import profileImg from "src/assets/images/profile/user-1.jpg"
import { meOrgAPI } from "src/_settings/me/me-org-api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "src/components/ui/dialog";
import { Button } from "src/components/ui/button";
import MeModal from "./MeModal";
import OrgModal from "./OrgModal";
import MeCard from "./MeCard";
import Org from "./Org";
import { getUserAvatar, supabase } from "src/core/supabase";
import { notifyToast } from "src/core/toast";
import { useUserProfileStore } from "src/store/user-profile-store";
import LoadingSpinner from "src/components/shared/LoadingSpinner";
import { useAuthStore } from "src/store/auth-store";
import { EMPTY_BE } from "src/types/type_be";
import { resizeImage } from "src/components/helper/image-utils";

import type { InterfaceBE } from "src/types/type_be";
import {
    EMPTY_ME,
    type InterfaceUser,
} from "src/types/type_me";

const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-800/70 ${className}`} />
);

const CLOUDINARY_CLOUD_NAME = "ddcgr5g8z";
const CLOUDINARY_UPLOAD_PRESET = "t4preset";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const UserProfile = () => {
    const [openModal, setOpenModal] = useState(false);
    const [modalType, setModalType] = useState<"personal" | "organization" | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const defaultProfileImg = profileImg;
    const [currentProfileImg, setCurrentProfileImg] = useState(defaultProfileImg);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const setStoreNames = useUserProfileStore((state) => state.setFBName);
    const setStoreAvatar = useUserProfileStore((state) => state.setFBAvatar);
    const authUser = useAuthStore((state) => state.user);

    const BCrumb = [{ to: "/", title: "Home", },{ title: "User Profile", },];

    const [personal, setPersonal] = useState<InterfaceUser>(EMPTY_ME);
    const [organization, setOrganization] = useState<InterfaceBE>(EMPTY_BE);

    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [tempPersonal, setTempPersonal] = useState(personal);
    const [tempOrganization, setTempOrganization] = useState(organization);

    useEffect(() => {
        const fetchUser = async () => {
            setLoadingProfile(true);
            try {
                const authAvatar = getUserAvatar(authUser);
                if (authAvatar) {setCurrentProfileImg(authAvatar);}

                const [userResult, myOrgResult] = await Promise.allSettled([
                    meOrgAPI.getMe(),
                    meOrgAPI.getMyOrg(),
                    // clientsAPI.getCurrentOrg(auth.currentUser?.uid || ""),
                ]);


                if (userResult.status === "fulfilled") {
                    const user = userResult.value;
                    setPersonal(user);
                    setStoreNames([user.first_name, user.last_name].filter(Boolean).join(' '));
                    if (user.profile_picture && !authAvatar) {
                        setCurrentProfileImg(user.profile_picture);
                        setStoreAvatar(user.profile_picture);
                    }
                } else {console.error('Failed to fetch user:', userResult.reason);}

                if (myOrgResult.status === "fulfilled") {
                    const myOrg = myOrgResult.value;
                    setOrganizationId(myOrg.id);
                    setOrganization(myOrg);
                } else {console.error('Failed to fetch organization:', myOrgResult.reason);}
            } catch (error) {
                console.error('Failed to fetch profile data:', error);
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchUser();
    }, [authUser, setStoreAvatar, setStoreNames]);

    const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;
        if (!authUser) {return;}

        if (!file.type.startsWith("image/")) {
            notifyToast({ message: "Please select an image file.", variant: "error" });
            return;
        }

        setUploadingAvatar(true);
        try {
            const processedBlob = await resizeImage(file);

            if (processedBlob.size > MAX_UPLOAD_BYTES) {
                throw new Error("Image is too large after processing. Please choose a smaller image.");
            }

            const formData = new FormData();
            formData.append("file", processedBlob, `avatar-${authUser.id}.jpg`);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            formData.append("folder", `users/${authUser.id}`);

            const uploadResponse = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: formData,
                },
            );

            if (!uploadResponse.ok) {
                const detail = await uploadResponse.text();
                throw new Error(`Cloudinary upload failed: ${detail}`);
            }

            const uploadResult = await uploadResponse.json();
            const photoUrl = uploadResult?.secure_url as string | undefined;

            if (!photoUrl) {
                throw new Error("Cloudinary did not return a secure URL.");
            }

            const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: photoUrl } });
            if (updateError) {
                throw updateError;
            }
            setCurrentProfileImg(photoUrl);
            setStoreAvatar(photoUrl);

            notifyToast({ message: "Profile image updated.", variant: "success" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to upload profile image.";
            notifyToast({ message, variant: "error" });
        } finally {
            setUploadingAvatar(false);
        }
    };

    useEffect(() => {
        if (openModal && modalType === "personal") {setTempPersonal(personal);}
        if (openModal && modalType === "organization") {setTempOrganization(organization);}
    }, [openModal, modalType, personal, organization]);

    const handleSave = async () => {
        setIsSavingProfile(true);
        try {
            if (modalType === "personal") {
                const updatedUser = await meOrgAPI.patchMe(tempPersonal);
                setPersonal(updatedUser);
                setStoreNames([updatedUser.first_name, updatedUser.last_name].filter(Boolean).join(' '));
                if (updatedUser.profile_picture) {
                    setCurrentProfileImg(updatedUser.profile_picture);
                    setStoreAvatar(updatedUser.profile_picture);
                }
            }
            if (modalType === "organization") {
                const updatedMyOrg = await meOrgAPI.patchOrg(tempOrganization);
                setOrganization(updatedMyOrg);
            }
            setOpenModal(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const socialLinks = [
        { href: personal.facebook || "#", icon: "streamline-logos:facebook-logo-2-solid" },
        { href: personal.twitter || "#", icon: "streamline-logos:x-twitter-logo-solid" },
        { href: personal.github || "#", icon: "ion:logo-github" },
        { href: personal.reddit || "#", icon: "ion:logo-reddit" },
    ];

    return (
        <>
            <BreadcrumbComp title="User Profile" items={BCrumb} />
            <div className="flex flex-col gap-6">
                {loadingProfile && (
                    <CardBox className="p-4">
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                            <LoadingSpinner size="md" />
                        </div>
                    </CardBox>
                )}
                <CardBox className="p-6 overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl relative w-full break-words">
                        <div>
                            {loadingProfile ? (
                                <Skeleton className="h-20 w-20 rounded-full" />
                            ) : (
                                <div className="relative">
                                    <img src={currentProfileImg} alt="image" width={80} height={80} className="rounded-full object-cover h-20 w-20" />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarSelect}
                                    />
                                    <button
                                        type="button"
                                        className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-60"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingAvatar}
                                        title="Change avatar"
                                    >
                                        {uploadingAvatar ? (
                                            <LoadingSpinner size="sm" variant="dots" className="text-white" />
                                        ) : (
                                            <Icon icon="ic:round-photo-camera" width="16" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-4 justify-center sm:justify-between items-center w-full">
                            <div className="flex flex-col sm:text-left text-center gap-1.5">
                                {loadingProfile ? (
                                    <Skeleton className="h-5 w-48" />
                                ) : (
                                    <h5 className="card-title">{personal.first_name || "Your"} {personal.last_name || "Name"}</h5>
                                )}
                                <div className="flex flex-wrap items-center gap-1 md:gap-3">
                                    {loadingProfile ? (
                                        <Skeleton className="h-4 w-28" />
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{personal.position || "Your position"}</p>
                                    )}
                                    <div className="hidden h-4 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                                    {loadingProfile ? (
                                        <Skeleton className="h-4 w-32" />
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{personal.country || "Your country"}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {socialLinks.map((item, index) => (
                                    loadingProfile ? (
                                        <Skeleton key={index} className="h-11 w-11 rounded-full" />
                                    ) : (
                                        <a key={index} href={item.href} target="_blank" className="flex h-11 w-11 items-center justify-center gap-2 rounded-full shadow-md border border-ld hover:bg-gray-50 dark:hover:bg-white/[0.03] dark:hover:text-gray-200">
                                            <Icon icon={item.icon} width="20" height="20" />
                                        </a>
                                    )
                                ))}
                            </div>
                        </div>
                    </div>
                </CardBox>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <MeCard
                        loadingProfile={loadingProfile}
                        personal={personal}
                        onEdit={() => { setModalType("personal"); setOpenModal(true); }}
                    />
                    <Org
                        loadingProfile={loadingProfile}
                        organization={organization}
                        onEdit={() => { setModalType("organization"); setOpenModal(true); }}
                    />
                </div>
            </div>

            {(modalType === "personal" || modalType === "organization") && (
                <Dialog open={openModal} onOpenChange={setOpenModal}>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle className="mb-4">
                                {modalType === "personal" ? "Edit Personal Information" : "Edit Organization"}
                            </DialogTitle>
                        </DialogHeader>

                        {modalType === "personal" ? (
                            <MeModal tempPersonal={tempPersonal} setTempPersonal={setTempPersonal} />
                        ) : (
                            <OrgModal tempOrganization={tempOrganization} setTempOrganization={setTempOrganization} />
                        )}

                        {isSavingProfile && (
                            <div className="mt-2 rounded-md border border-border bg-muted/40 p-3">
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <LoadingSpinner size="md" />
                                </div>
                            </div>
                        )}

                        <DialogFooter className="flex gap-2 mt-4">
                            <Button color={"primary"} className="rounded-md" onClick={handleSave} disabled={isSavingProfile}>
                                Save Changes
                            </Button>
                            <Button
                                color={"lighterror"}
                                className="rounded-md bg-lighterror dark:bg-darkerror text-error hover:bg-error hover:text-white"
                                onClick={() => setOpenModal(false)}
                                disabled={isSavingProfile}
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

export default UserProfile;
