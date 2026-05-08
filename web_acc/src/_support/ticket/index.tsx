import CardBox from 'src/components/shared/CardBox';
import TicketFilter from 'src/_support/ticket/TicketFilter';
import TicketListing from 'src/_support/ticket/TicketListing';
import { TicketProvider } from 'src/_support/ticket/ticket-context/index';

const TicketsApp = () => {
  return (
    <>
      <TicketProvider>
        <CardBox>
          <TicketFilter />
          <TicketListing />
        </CardBox>
      </TicketProvider>
    </>
  );
};

export default TicketsApp;
