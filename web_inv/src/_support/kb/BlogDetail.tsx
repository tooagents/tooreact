import BlogDetailData from 'src/_support/kb/detail';

import { BlogProvider } from 'src/_support/kb/blog-context';
import BreadcrumbComp from 'src/_layouts/shared/breadcrumb/BreadcrumbComp';

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Blog Detail',
  },
];
const BlogDetail = () => {
  return (
    <>
      <BlogProvider>
        <BreadcrumbComp title="Blog Detail" items={BCrumb} />
        <BlogDetailData />
      </BlogProvider>
    </>
  );
};

export default BlogDetail;
