import { FC } from 'react';
import { Outlet, useLocation } from 'react-router';
import Sidebar from './sidebar/Sidebar';
import Header from './header/Header';

const FullLayout: FC = () => {
  const { pathname } = useLocation();
  // Notes uses a full-width body so its left edge lines up with the header
  // "Ask AI" box (px-6), instead of the centered container used elsewhere.
  const isFluid = pathname.startsWith('/app/apps/notes');

  return (
    <>
      <div className="flex w-full min-h-screen">
        <div className="page-wrapper flex w-full ">
          {/* Header/sidebar */}
          <div className="xl:block hidden">
            <Sidebar />
          </div>
          <div className="body-wrapper w-full bg-white dark:bg-dark">
            {/* Top Header  */}
            <Header />

            {/* Body Content  */}
            <div className={`${isFluid ? 'w-full' : 'container mx-auto'} px-6 py-30`}>
              <main className="grow font-ledger">
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FullLayout;
