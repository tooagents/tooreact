

import CardBox from "../../components/shared/CardBox"
import iconConnect from "src/assets/images/svgs/icon-connect.svg"
import iconSpeechBubble from "src/assets/images/svgs/icon-speech-bubble.svg"
import iconFavorites from "src/assets/images/svgs/icon-favorites.svg"
import iconMailbox from "src/assets/images/svgs/icon-mailbox.svg"
import iconBriefcase from "src/assets/images/svgs/icon-briefcase.svg"
import iconUser from "src/assets/images/svgs/icon-user-male.svg"
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from "swiper/modules";

import 'swiper/css';
import { Link } from "react-router"

const TopCards = () => {

    const TopCardInfo = [
        {
            key: "card1",
            title: "Payroll",
            desc: "$96k",
            img: iconBriefcase,
            bgcolor: "bg-warning/10 dark:bg-warning/10",
            textclr: "text-warning dark:text-warning",
            url: "/app/acc/inbox"

        },
        // {
        //     key: "card5",
        //     title: "Notes",
        //     desc: "4+",
        //     img: iconConnect,
        //     bgcolor: "bg-info/10 dark:bg-info/10",
        //     textclr: "text-info dark:text-info",
        //     url: "/app/apps/notes"
        // },
        {
            key: "card2",
            title: "Schedules",
            desc: "+1K",
            img: iconSpeechBubble,
            bgcolor: "bg-success/10 dark:bg-success/10",
            textclr: "text-success dark:text-success",
            url: "/accounting/schedule"
        },
        // {
        //     key: "card3",
        //     title: "Reports",
        //     desc: "10+",
        //     img: iconFavorites,
        //     bgcolor: "bg-info/10 dark:bg-info/10",
        //     textclr: "text-info dark:text-info",
        //     url: "/app/apps/notes"
        // },
        {
            key: "card4",
            title: "Periods",
            desc: "8+",
            img: iconMailbox,
            bgcolor: "bg-secondary/10 dark:bg-secondary/10",
            textclr: "text-primary dark:text-primary",
            url: "/accounting/periods"
        },
        {
            key: "card7",
            title: "Employees",
            desc: "96",
            img: iconUser,
            bgcolor: "bg-primary/10 dark:bg-lightprimary",
            textclr: "text-primary dark:text-primary",
            url: "/utilities/table"
        },
    ]


    return (
        <>
            <div>
                <Swiper
                    slidesPerView={6}
                    spaceBetween={24}
                    loop={true}
                    freeMode={true}
                    grabCursor={true}
                    speed={5000}
                    autoplay={{
                        delay: 0,
                        disableOnInteraction: false,
                    }}
                    modules={[Autoplay]}
                    breakpoints={{
                        0: { slidesPerView: 1, spaceBetween: 10 },
                        640: { slidesPerView: 2, spaceBetween: 14 },
                        768: { slidesPerView: 3, spaceBetween: 18 },
                        1030: { slidesPerView: 4, spaceBetween: 18 },
                        1200: { slidesPerView: 6, spaceBetween: 24 },
                    }}
                    className="mySwiper"
                >
                    {
                        TopCardInfo.map((item) => {
                            return (
                                <SwiperSlide key={item.key} >
                                    <Link to={item.url} >
                                        <CardBox className={`shadow-none ${item.bgcolor} w-full border-none`}>
                                            <div className="text-center hover:scale-105 transition-all ease-in-out">
                                                <div className="flex justify-center">
                                                    <img src={item.img}
                                                        width="50" height="50" className="mb-3" alt="profile-image" />
                                                </div>
                                                <p className={`font-semibold ${item.textclr} mb-1`}>
                                                    {item.title}
                                                </p>
                                                <h5 className={`text-lg font-semibold ${item.textclr} mb-0`}>{item.desc}</h5>
                                            </div>
                                        </CardBox>
                                    </Link>
                                </SwiperSlide>
                            )
                        })
                    }

                </Swiper>
            </div>
        </>
    )
}
export { TopCards }
