import { useState } from 'react';
import CardBox from 'src/components/shared/CardBox';
import NotesSidebar from 'src/_support/notes/NotesSidebar';
import NoteContent from 'src/_support/notes/NoteContent';
import NoteComposer from 'src/_support/notes/NoteComposer';
import { Icon } from '@iconify/react';
import { NotesProvider } from 'src/_support/notes/notes-context/index';
import { Button } from 'src/components/ui/button';
import { Sheet, SheetContent } from 'src/components/ui/sheet';

const NotesApp = () => {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = () => setIsOpen(false);

  return (
    <NotesProvider>
      <CardBox className="p-0 overflow-hidden">
        <div className="flex">
          {/* LEFT: NOTES LIST */}
          <div>
            <Sheet open={isOpen} onOpenChange={handleClose}>
              <SheetContent
                side="left"
                className="max-w-[320px] sm:max-w-[320px] w-full h-full lg:z-0 lg:hidden block p-0"
              >
                <NotesSidebar />
              </SheetContent>
            </Sheet>
            <div className="max-w-[320px] w-[320px] h-auto lg:block hidden">
              <NotesSidebar />
            </div>
          </div>

          {/* RIGHT: TOP = ENTRY, BOTTOM = DETAIL */}
          <div className="w-full flex flex-col">
            {/* mobile-only toggle to reveal the list (no header bar on desktop) */}
            <Button
              color={'lightprimary'}
              onClick={() => setIsOpen(true)}
              className="btn-circle p-0 lg:hidden! flex m-4"
            >
              <Icon icon="tabler:menu-2" height={18} />
            </Button>

            {/* right top: entry */}
            <NoteComposer />

            {/* right bottom: detail */}
            <NoteContent />
          </div>
        </div>
      </CardBox>
    </NotesProvider>
  );
};

export default NotesApp;
