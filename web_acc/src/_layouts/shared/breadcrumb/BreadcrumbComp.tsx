import { JSX } from 'react';
import CardBox from '../../../components/shared/CardBox';
import breadcrumbBg from 'src/assets/images/dashboard/customer-support-img.png';
import { Link } from 'react-router';

interface BreadcrumbItem {
  title: string;
  to?: string;
}

interface BreadCrumbType {
  subtitle?: string;
  items?: BreadcrumbItem[];
  title: string;
  children?: JSX.Element;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

const BreadcrumbComp = ({ title, items = [], leftContent, rightContent }: BreadCrumbType) => {
  return (
    <CardBox
      className="mb-6 py-4 overflow-hidden rounded-md border-none shadow-none! dark:shadow-none! relative bg-[radial-gradient(circle_at_top_left,rgba(242,133,0,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(242,133,0,0.16),transparent_48%)]"
    >
      <div className="grid grid-cols-12 gap-6 items-center">
        <div className="col-span-8 flex items-center gap-4">
          <div>
            <h4 className="font-semibold text-xl mb-3">
              {title}
            </h4>

            <ol className="flex items-center whitespace-nowrap" aria-label="Breadcrumb">
              {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                  <li key={index} className="flex items-center">
                    {item.to && !isLast ? (
                      <Link
                        to={item.to}
                        className="opacity-80 text-sm text-muted-foreground leading-none hover:underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <span
                        className="text-sm text-muted-foreground leading-none"
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {item.title}
                      </span>
                    )}

                    {!isLast && (
                      <span className="mx-2.5 p-0.5 rounded-full bg-muted-foreground" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex-shrink-0">
            {leftContent}
          </div>
          {rightContent && (
            <div className="flex-shrink-0">
              {rightContent}
            </div>
          )}
        </div>

        <div className="col-span-4 flex justify-center -mb-7 max-h-[120px] max-w-[140px]">
          <div className="hidden sm:block absolute right-7 bottom-0">
            <img src={breadcrumbBg} alt="support-img" width={145} height={95} />
          </div>
        </div>
      </div>
    </CardBox>
  );
};

export default BreadcrumbComp;
