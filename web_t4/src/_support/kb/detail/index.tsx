import React, { useEffect, useContext } from 'react';

import { FaQuoteLeft } from 'react-icons/fa';
import { GoDot } from 'react-icons/go';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { uniqueId } from 'lodash';
import CardBox from 'src/components/shared/CardBox';
import BlogComment from './BlogCommnets';
import { BlogContext, BlogContextProps } from 'src/_support/kb/blog-context';
import { useLocation } from 'react-router-dom';
import { BlogType } from 'src/types/blog';
import { Badge } from 'src/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'src/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from 'src/components/ui/avatar';
import { Separator } from 'src/components/ui/separator';
import { Textarea } from 'src/components/ui/textarea';
import { Button } from 'src/components/ui/button';

const BlogDetailData = () => {
  const { posts, setLoading, addComment }: BlogContextProps = useContext(BlogContext);
  const location = useLocation();
  const pathName = location.pathname;
  const getTitle = pathName.split('/').pop();
  const post = posts.find(
    (p) =>
      p.title
        ?.toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '') === getTitle,
  );
  const [replyTxt, setReplyTxt] = React.useState('');

  const onSubmit = () => {
    if (!post?.id) return;
    const newComment: BlogType & { postId: number } = {
      id: uniqueId('#comm_'),
      profile: {
        id: uniqueId('#USER_'),
        avatar: post.author?.avatar || '',
        name: post.author?.name || '',
        time: new Date().toISOString(),
      },
      comment: replyTxt,
      replies: [],
      postId: post.id,
    };
    addComment(post.id, newComment);
    setReplyTxt('');
  };

  // skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {post ? (
        <>
          <CardBox className="p-0 overflow-hidden">
            <div className="relative ">
              <div className="overflow-hidden max-h-[440px]">
                <img
                  src={post?.coverImg}
                  alt="materialm"
                  height={440}
                  width={1500}
                  className="w-full object-cover object-center "
                />
              </div>
              <Badge variant={'gray'} className="absolute bottom-8 end-6">
                2 min Read
              </Badge>
            </div>
            <div className="flex justify-between items-center -mt-11 px-6 w-fit">
              <div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.author?.avatar} alt={post.author?.name} />
                        <AvatarFallback>{post?.author?.name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{post.author?.name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="px-6 pb-6">
              <Badge variant="gray" className="mt-3">
                {post?.category}
              </Badge>
              <h2 className="md:text-4xl text-2xl my-6">{post?.title}</h2>
              <div>
                <div className="flex gap-3">
                  <div className="flex gap-2 items-center text-muted-foreground text-[15px]">
                    <Icon icon="tabler:eye" height="18" className="text-ld" />
                    {post?.view}
                  </div>
                  <div className="flex gap-2 items-center text-muted-foreground text-[15px]">
                    <Icon icon="tabler:message-2" height="18" className="text-ld" />{' '}
                    {post?.comments?.length || 0}
                  </div>
                  <div className="ms-auto flex gap-2 items-center text-muted-foreground text-[15px]">
                    <GoDot size="16" className="text-ld" />
                    <small>
                      {post && post.createdAt ? format(new Date(post.createdAt), 'E, MMM d') : ''}
                    </small>
                  </div>
                </div>
              </div>
            </div>
            <Separator className="my-0 mb-4" />
            <div className="px-6 pb-6">
              <h2 className="md:text-3xl text-2xl pb-5">Payroll Knowledge Base Overview</h2>
              <p className="text-muted-foreground">
                This knowledge base is designed for Ontario payroll teams. Each article focuses on
                common, high-impact tasks like stat holiday pay, CPP/EI deductions, ROE preparation,
                and year-end T4 cleanup. Use it as a quick reference before processing a run or
                troubleshooting a discrepancy.
              </p>
              <br></br>
              <p className="text-muted-foreground">
                If you are reviewing a payroll issue, start by confirming the employee setup, the
                earnings codes used, and the effective dates of any changes. Most variances are
                caused by a mismatch between rate changes, overtime rules, or vacation accrual
                settings.
              </p>
              <br></br>
              <p>
                <b className="text-foreground">Tip:</b>{' '}
                <span className="text-muted-foreground">
                  Keep a short checklist for every pay cycle so exceptions are caught early.
                </span>
              </p>
              <i className="text-foreground">Consistency is the best control in payroll.</i>
              <Separator className="my-8" />
              <h3 className="text-xl mb-3">Common Review Checklist</h3>
              <ul className="list-disc pl-6 text-muted-foreground">
                <li>Confirm employee eligibility (stat holidays, overtime, benefits).</li>
                <li>Validate earnings codes and rate changes effective dates.</li>
                <li>Reconcile CPP/EI and tax calculations for exceptions.</li>
              </ul>

              <Separator className="my-8" />

              <h3 className="text-xl mb-3">When Troubleshooting</h3>
              <ol className="list-decimal pl-6 text-muted-foreground">
                <li>Check the employee profile for recent changes.</li>
                <li>Review the pay run audit or preview report.</li>
                <li>Re-run with corrected inputs and document the fix.</li>
              </ol>
              <Separator className="my-8" />
              <h3 className="text-xl mb-3">Reminder</h3>
              <div className="pt-5 pb-4 px-4 rounded-md border-s-2 border-primary bg-lightprimary flex gap-1 items-start">
                <FaQuoteLeft size={20} className="text-ld -mt-1" />
                <h2 className="text-base font-bold">
                  Accurate inputs prevent most payroll corrections.
                </h2>
              </div>
            </div>
          </CardBox>
          <CardBox className="mt-6">
            <h5 className="text-xl mb-2">Post Comments</h5>
            <Textarea
              rows={4}
              value={replyTxt}
              onChange={(e) => setReplyTxt(e.target.value)}
              placeholder="Write your comment..."
            />
            <Button variant="default" className="w-fit mt-3 rounded-md" onClick={onSubmit}>
              Post Comment
            </Button>
            <div className="mt-6">
              <div className="flex gap-3 items-center">
                <h5 className="text-xl ">Comments</h5>
                <div className="h-8 w-8 rounded-full bg-lightprimary dark:bg-lightprimary flex items-center justify-center text-primary font-bold">
                  {post?.comments?.length || 0}
                </div>
              </div>
              <div>
                {post?.comments?.map((comment: BlogType) => {
                  return <BlogComment key={comment.id} comment={comment} />;
                })}
              </div>
            </div>
          </CardBox>
        </>
      ) : (
        <p className="text-xl text-center py-6 font-bold">No Post Found</p>
      )}
    </>
  );
};
export default BlogDetailData;
