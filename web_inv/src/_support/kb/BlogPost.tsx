import BlogListing from 'src/_support/kb/BlogListing';
import { BlogProvider } from 'src/_support/kb/blog-context/index';

const BlogPost = () => {
  return (
    <>
      <BlogProvider>
        <BlogListing />
      </BlogProvider>
    </>
  );
};

export default BlogPost;
