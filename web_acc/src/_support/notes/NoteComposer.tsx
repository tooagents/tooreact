'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { TbCheck } from 'react-icons/tb';
import { Button } from 'src/components/ui/button';
import { Textarea } from 'src/components/ui/textarea';
import { NotesContext, NotesContextType } from 'src/_support/notes/notes-context';

const COLOR_PALETTE = ['warning', 'primary', 'error', 'success', 'secondary'];

const AUTOSAVE_DELAY = 600;

const NoteComposer = () => {
  const { createNote, updateNote, selectNote }: NotesContextType = useContext(NotesContext);

  const [draft, setDraft] = useState('');
  const [color, setColor] = useState('primary');
  const draftIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = useRef(false);
  const genRef = useRef(0);
  const colorRef = useRef(color);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Persist the current draft: create the note on first content, then keep it updated.
  const save = async (text: string) => {
    const gen = genRef.current;
    if (draftIdRef.current) {
      await updateNote(draftIdRef.current, { title: text });
      return;
    }
    if (!text.trim() || creatingRef.current) {
      return;
    }
    creatingRef.current = true;
    const created = await createNote({ title: text, color: colorRef.current });
    creatingRef.current = false;
    // Only attach to the current draft if the user hasn't started a new note meanwhile.
    if (created && genRef.current === gen) {
      draftIdRef.current = created.id;
      selectNote(created.id);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => save(value), AUTOSAVE_DELAY);
  };

  const handleColor = (next: string) => {
    setColor(next);
    // If the draft already exists, recolor it live.
    if (draftIdRef.current) {
      void updateNote(draftIdRef.current, { color: next });
    }
  };

  // Finalize the current draft and start a fresh, empty note.
  const handleNew = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (draft.trim()) {
      // Fire-and-forget the last edit so nothing typed is lost.
      void save(draft);
    }
    // Invalidate any in-flight create so it won't re-attach to this fresh draft.
    genRef.current += 1;
    draftIdRef.current = null;
    setDraft('');
  };

  return (
    <div className="p-6 border-b border-ld">
      <Textarea
        value={draft}
        onChange={handleChange}
        rows={4}
        placeholder="Type a note… it saves automatically. Press Enter for a new line."
        className="w-full form-control-textarea"
      />
      <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
        {/* Keep color: pick the color for the note being written */}
        <div className="flex gap-2 items-center">
          {COLOR_PALETTE.map((c) => (
            <div
              key={c}
              className={`h-7 w-7 flex justify-center items-center rounded-full cursor-pointer bg-${c}`}
              onClick={() => handleColor(c)}
            >
              {color === c ? <TbCheck size={18} className="text-white" /> : null}
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="lightprimary"
          onClick={handleNew}
          disabled={!draft.trim()}
          className="rounded-md flex items-center gap-1"
        >
          <Icon icon="tabler:plus" height={16} />
          New
        </Button>
      </div>
    </div>
  );
};

export default NoteComposer;
