import {
  Table,
  TBody,
  TCell,
  THead,
  THeader,
  TRow,
} from 'src/components/ui/table';
import { Badge } from 'src/components/ui/badge';
import { TablePerformersData } from './table-data';
import CardBox from 'src/components/shared/CardBox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'src/components/ui/dropdown-menu';
import { TbDotsVertical } from 'react-icons/tb';
import { Icon } from '@iconify/react';

function StripedRowTable() {
  const tableActionData = [
    {
      icon: 'solar:add-circle-outline',
      listtitle: 'Add',
    },
    {
      icon: 'solar:pen-new-square-broken',
      listtitle: 'Edit',
    },
    {
      icon: 'solar:trash-bin-minimalistic-outline',
      listtitle: 'Delete',
    },
  ];

  return (
    <CardBox>
      <h3 className="text-xl font-semibold mb-2">Striped-Row Table</h3>
      <div className="flex flex-col border rounded-md border-ld ">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="overflow-x-auto">
              <Table>
                <THeader>
                  <TRow>
                    <THead className="text-sm font-semibold ">Assigned</THead>
                    <THead className="text-sm font-semibold">Project</THead>
                    <THead className="text-sm font-semibold">Priority</THead>
                    <THead className="text-sm font-semibold">Actions</THead>
                  </TRow>
                </THeader>

                <TBody>
                  {TablePerformersData.map((item, index) => (
                    <TRow
                      key={index}
                      className="group/row bg-transparentodd:bg-transparent even:bg-lightprimary dark:even:bg-lightprimary"
                    >
                      {/* Assigned */}
                      <TCell className="ps-3 min-w-[200px]">
                        <div className="flex gap-3 items-center">
                          <img
                            src={item.profileImg}
                            alt="profile"
                            className="h-10 w-10 rounded-full"
                          />
                          <div>
                            <h6 className="text-sm font-semibold mb-1">{item.username}</h6>
                            <p className="text-xs text-muted-foreground font-medium">{item.designation}</p>
                          </div>
                        </div>
                      </TCell>

                      {/* Project */}
                      <TCell>
                        <p className="text-muted-foreground text-sm font-medium">{item.project}</p>
                      </TCell>

                      {/* Priority */}
                      <TCell>
                        <Badge
                          className={`text-sm rounded-full py-1 px-3 justify-center ${item.bgcolor}`}
                        >
                          {item.priority}
                        </Badge>
                      </TCell>

                      {/* Actions Dropdown */}
                      <TCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                              <TbDotsVertical size={22} />
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {tableActionData.map((action, idx) => (
                              <DropdownMenuItem key={idx} className="flex gap-3 items-center">
                                <Icon icon={action.icon} height={18} />
                                <span>{action.listtitle}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TCell>
                    </TRow>
                  ))}
                </TBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </CardBox>
  );
}

export default StripedRowTable;
