import TableComp from 'src/components/table';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import StripedRowTable from 'src/components/table/StripedRowTable';
import HoverTable from 'src/components/table/HoverTable';
import CheckboxTable from 'src/components/table/CheckboxTable';
import { EmployeeDataTable } from 'src/_settings/employees/components/EmployeeTable';
import { EmployeesData } from 'src/components/table/data_default';
const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Table',
  },
];
const Notes = () => {
  return (
    <>
      <BreadcrumbComp title="Table" items={BCrumb} />
      <div className="flex gap-6 flex-col ">
        <EmployeeDataTable data={EmployeesData as any} />
        <TableComp />
        <StripedRowTable />
        <HoverTable />
        <CheckboxTable />
      </div>
    </>
  );
};

export default Notes;
