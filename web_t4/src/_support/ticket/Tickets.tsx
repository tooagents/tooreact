import TicketsApp from "src/_support/ticket";
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Tickets",
  },
];
const Tickets = () => {
  return (
    <>
      <BreadcrumbComp title="Tickets App" items={BCrumb} />
      <TicketsApp />
    </>
  );
};

export default Tickets;
