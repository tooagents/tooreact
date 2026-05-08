
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';
import BlogPost from "src/_support/kb/BlogPost";

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Blog app",
  },
];

const Blog = () => {
  return (
    <>
      <BreadcrumbComp title="Blog app" items={BCrumb} />
      <BlogPost />
    </>
  );
};
export default Blog;
