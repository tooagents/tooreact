'use client';

import { Icon } from '@iconify/react';
import { useState, useContext, useEffect } from 'react';
import { Button } from 'src/components/ui/button';
import { Input } from 'src/components/ui/input';
import { NotesContext, NotesContextType } from 'src/_support/notes/notes-context';
import { notesType } from 'src/types/notes';

const Notelist = () => {
  const { notes, selectNote, deleteNote, selectedNoteId, loading }: NotesContextType =
    useContext(NotesContext);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filterNotes = (all: notesType[], nSearch: string) => {
    const visible = all.filter((t: notesType) => !t.deleted);
    if (nSearch !== '') {
      return visible.filter((t: notesType) =>
        t.title.toLocaleLowerCase().includes(nSearch.toLocaleLowerCase()),
      );
    }
    return visible;
  };

  const filteredNotes = filterNotes(notes, searchTerm);

  // Auto-select the first note when nothing is selected yet.
  useEffect(() => {
    if (!selectedNoteId && filteredNotes.length > 0) {
      selectNote(filteredNotes[0].id);
    }
  }, [selectedNoteId, filteredNotes, selectNote]);

  return (
    <div className="p-1">
      {/* Search input */}
      <Input
        id="search"
        value={searchTerm}
        placeholder="Search Notes"
        className="form-control"
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="flex flex-col mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Icon icon="line-md:loading-twotone-loop" height={28} />
            <span className="text-sm">Loading notes…</span>
          </div>
        ) : filteredNotes && filteredNotes.length ? (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                selectedNoteId === note.id ? 'bg-lightprimary dark:bg-darkprimary' : 'hover:bg-muted'
              }`}
              onClick={() => selectNote(note.id)}
            >
              {/* Color dot */}
              <span className={`shrink-0 h-2.5 w-2.5 rounded-full bg-${note.color}`} />

              {/* Single-line title, truncated beyond the width */}
              <span className="flex-1 min-w-0 truncate text-sm text-ld">
                {note.title || 'Untitled note'}
              </span>

              {/* Delete (appears on hover) */}
              <Button
                aria-label="delete"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-ld hover:text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(note.id);
                }}
              >
                <Icon icon="tabler:trash" height={16} />
              </Button>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground text-center">
            <Icon icon="solar:notes-linear" height={28} />
            <span className="text-sm">
              {searchTerm ? 'No notes match your search.' : 'No notes yet — type above to create one.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notelist;
