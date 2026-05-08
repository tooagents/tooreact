
import Form from "src/components/form";
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Form",
  },
];
const Notes = () => {

  return (
    <>

      <BreadcrumbComp title="Form Elements" items={BCrumb} />
      <Form />
    </>
  );
};

export default Notes;
