
import NotesApp from "src/_support/notes";
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';



const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Notes",
  },
];
const Notes = () => {

  return (
    <>

      <BreadcrumbComp title="Notes app" items={BCrumb} />
      <NotesApp />
    </>
  );
};

export default Notes;
