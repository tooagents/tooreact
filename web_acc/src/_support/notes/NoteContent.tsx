import { useContext } from 'react';
import { NotesContext, NotesContextType } from 'src/_support/notes/notes-context';
import { notesType } from 'src/types/notes';

// Right pane: read-only detail of the currently selected note.
const NoteContent = () => {
  const { notes, selectedNoteId }: NotesContextType = useContext(NotesContext);
  const noteDetails = notes.find((note: notesType) => note.id === selectedNoteId);

  if (!noteDetails) {
    return (
      <div className="flex grow p-6">
        <div className="text-center w-full py-6 text-2xl text-muted-foreground">Select a Note</div>
      </div>
    );
  }

  return (
    <div className="flex grow p-6">
      <div className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <span className={`h-3 w-3 rounded-full bg-${noteDetails.color}`} />
          <p className="text-xs text-ld">
            {new Date(noteDetails.datef).toLocaleString()}
          </p>
        </div>

        {/* Read-only note body; preserves the paragraph breaks entered with Enter. */}
        <p className="text-base text-ld whitespace-pre-wrap break-words">
          {noteDetails.title || 'Untitled note'}
        </p>
      </div>
    </div>
  );
};

export default NoteContent;
