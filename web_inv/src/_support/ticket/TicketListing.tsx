'use client';

import { useContext } from 'react';
import { format } from 'date-fns';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { TicketContext, TicketContextType } from 'src/_support/ticket/ticket-context';
import { TicketType } from 'src/types/ticket';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import {
  Table,
  TBody,
  TCell,
  THead,
  THeader,
  TRow,
} from 'src/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from 'src/components/ui/avatar';
import { Badge } from 'src/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'src/components/ui/tooltip';

const TicketListing = () => {
  const { tickets, deleteTicket, searchTickets, ticketSearch, filter }: TicketContextType =
    useContext(TicketContext);

  const navigate = useNavigate();

  const getVisibleTickets = (tickets: TicketType[], filter: string, ticketSearch: string) => {
    switch (filter) {
      case 'total_tickets':
        return tickets.filter(
          (c) => !c.deleted && c.ticketTitle.toLocaleLowerCase().includes(ticketSearch),
        );
      case 'Pending':
        return tickets.filter(
          (c) =>
            !c.deleted &&
            c.Status === 'Pending' &&
            c.ticketTitle.toLocaleLowerCase().includes(ticketSearch),
        );
      case 'Closed':
        return tickets.filter(
          (c) =>
            !c.deleted &&
            c.Status === 'Closed' &&
            c.ticketTitle.toLocaleLowerCase().includes(ticketSearch),
        );
      case 'Open':
        return tickets.filter(
          (c) =>
            !c.deleted &&
            c.Status === 'Open' &&
            c.ticketTitle.toLocaleLowerCase().includes(ticketSearch),
        );
      default:
        throw new Error(`Unknown filter: ${filter}`);
    }
  };

  const visibleTickets = getVisibleTickets(tickets, filter, ticketSearch.toLowerCase());

  const ticketBadge = (ticket: TicketType) => {
    return ticket.Status === 'Open'
      ? 'bg-lightsuccess text-success dark:bg-lightsuccess dark:text-success'
      : ticket.Status === 'Closed'
      ? 'bg-lighterror text-error dark:bg-lighterror dark:text-error'
      : ticket.Status === 'Pending'
      ? 'bg-lightwarning text-warning dark:bg-lightwarning dark:text-warning'
      : ticket.Status === 'Moderate'
      ? 'bg-lightprimary text-primary dark:bg-lightprimary dark:text-primary'
      : 'bg-lightprimary text-primary dark:bg-lightprimary dark:text-primary';
  };

  return (
    <div className="my-6">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-4 gap-4">
        <Button
          onClick={() => navigate('/app/apps/tickets/create')}
          className="rounded-md whitespace-nowrap"
        >
          Create Ticket
        </Button>

        <div className="relative sm:max-w-60 w-full">
          <Icon
            icon="tabler:search"
            height={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            className="pl-10"
            onChange={(e) => searchTickets(e.target.value)}
            placeholder="Search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <THeader>
            <TRow>
              <THead className="text-base font-semibold py-3 whitespace-nowrap">Id</THead>
              <THead className="text-base font-semibold py-3 whitespace-nowrap">
                Ticket
              </THead>
              <THead className="text-base font-semibold py-3 whitespace-nowrap">
                Assigned To
              </THead>
              <THead className="text-base font-semibold py-3 whitespace-nowrap">
                Status
              </THead>
              <THead className="text-base font-semibold py-3 whitespace-nowrap">Date</THead>
              <THead className="text-base font-semibold py-3 text-end">Action</THead>
            </TRow>
          </THeader>

          <TBody>
            {visibleTickets.map((ticket) => (
              <TRow key={ticket.Id}>
                <TCell className="whitespace-nowrap">{ticket.Id}</TCell>
                <TCell className="max-w-md">
                  <h6 className="text-base truncate line-clamp-1 ">{ticket.ticketTitle}</h6>
                  <p className="text-sm text-muted-foreground truncate line-clamp-1 text-wrap sm:max-w-56">
                    {ticket.ticketDescription}
                  </p>
                </TCell>
                <TCell className="whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={ticket.thumb} alt={ticket.AgentName} />
                      <AvatarFallback>{ticket.AgentName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h6 className="text-base">{ticket.AgentName}</h6>
                  </div>
                </TCell>
                <TCell className="whitespace-nowrap">
                  <Badge className={`${ticketBadge(ticket)} rounded-md`}>{ticket.Status}</Badge>
                </TCell>
                <TCell className="whitespace-nowrap">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(ticket.Date), 'E, MMM d')}
                  </p>
                </TCell>
                <TCell className="text-end">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="btn-circle ms-auto"
                          onClick={() => deleteTicket(ticket.Id)}
                        >
                          <Icon icon="tabler:trash" height="18" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Ticket</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
};

export default TicketListing;

