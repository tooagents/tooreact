import CreateTicketForm from 'src/_support/ticket/CreateTicketForm';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import { TicketProvider } from 'src/_support/ticket/ticket-context/index';

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Tickets',
  },
];
const CreateTickets = () => {
  return (
    <>
      <BreadcrumbComp title="Tickets App" items={BCrumb} />
      <TicketProvider>
        <CreateTicketForm />
      </TicketProvider>
    </>
  );
};

export default CreateTickets;
