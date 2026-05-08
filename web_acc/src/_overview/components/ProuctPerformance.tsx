
import CardBox from "src/components/shared/CardBox"
import { Badge } from "src/components/ui/badge"
import { Table, TBody, TCell, THead, THeader, TRow } from "src/components/ui/table"

export const ProductPerformance = () => {
  const PerformersData = [
    {
      key: "performerData1",
      username: "Emma Carter",
      designation: "Operations",
      project: "Overtime Review",
      priority: "High",
      bgcolor: "bg-error text-white",
      budget: "$1,280"
    },
    {
      key: "performerData2",
      username: "Noah Singh",
      designation: "Warehouse",
      project: "Missing SIN Validation",
      priority: "Critical",
      bgcolor: "bg-warning text-white",
      budget: "$0"
    },
    {
      key: "performerData3",
      username: "Liam Zhang",
      designation: "Engineering",
      project: "Bonus Pending Approval",
      priority: "Medium",
      bgcolor: "bg-secondary text-white",
      budget: "$2,450"
    },
    {
      key: "performerData4",
      username: "Sophia Kim",
      designation: "Finance",
      project: "Vacation Payout",
      priority: "Low",
      bgcolor: "bg-primary text-white",
      budget: "$840"
    },
    {
      key: "performerData5",
      username: "Ethan Miller",
      designation: "Support",
      project: "New Hire Setup",
      priority: "Low",
      bgcolor: "bg-success text-white",
      budget: "$3,900"
    },
  ]
  return (
    <CardBox>
      <div id="product" className="mb-6">
        <div>
          <h5 className="card-title">Payroll Action Queue</h5>
          <p className="text-sm text-muted-foreground font-normal">Items to resolve before next payroll run</p>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="overflow-x-auto">
              <Table>
                <THeader>
                  <TRow>
                    <THead className="text-sm font-semibold">#</THead>
                    <THead className="text-sm font-semibold">Employee</THead>
                    <THead className="text-sm font-semibold">Task</THead>
                    <THead className="text-sm font-semibold">Priority</THead>
                    <THead className="text-sm font-semibold">Impact</THead>
                  </TRow>
                </THeader>

                <TBody>
                  {PerformersData.map((item, index) => (
                    <TRow key={item.key} className="border-b border-border">
                      <TCell>
                        <p className="text-muted-foreground font-medium text-sm">{index + 1}</p>
                      </TCell>

                      <TCell className="ps-0 min-w-[200px]">
                        <div>
                          <h6 className="text-sm font-semibold mb-1">{item.username}</h6>
                          <p className="text-xs font-medium text-muted-foreground">{item.designation}</p>
                        </div>
                      </TCell>

                      <TCell>
                        <p className="font-medium text-sm text-muted-foreground">
                          {item.project}
                        </p>
                      </TCell>

                      <TCell>
                        <Badge
                          className={`text-[13px] px-3 rounded-full justify-center py-0.5 ${item.bgcolor}`}
                        >
                          {item.priority}
                        </Badge>
                      </TCell>

                      <TCell>
                        <p className="text-[15px] font-medium text-muted-foreground">
                          {item.budget}
                        </p>
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

  )
}
