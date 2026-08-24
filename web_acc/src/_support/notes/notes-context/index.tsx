import { createContext, useState, useEffect, useCallback } from 'react';
import React from 'react';
import { notesType } from 'src/types/notes';
import { notesAPI } from 'src/_support/notes/notes-api';

export interface NotesContextType {
  notes: notesType[];
  loading: boolean;
  error: string | Error | null;
  selectedNoteId: string | null;
  selectNote: (id: string) => void;
  refresh: () => Promise<void>;
  createNote: (newNote: { title?: string; color?: string }) => Promise<notesType | null>;
  updateNote: (id: string, patch: { title?: string; color?: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

const initialContext: NotesContextType = {
  notes: [],
  loading: true,
  error: null,
  selectedNoteId: null,
  selectNote: () => {},
  refresh: async () => {},
  createNote: async () => null,
  updateNote: async () => {},
  deleteNote: async () => {},
};

export const NotesContext = createContext<NotesContextType>(initialContext);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<notesType[]>(initialContext.notes);
  const [loading, setLoading] = useState<boolean>(initialContext.loading);
  const [error, setError] = useState<string | Error | null>(initialContext.error);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialContext.selectedNoteId);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notesAPI.listNotes();
      setNotes(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectNote = useCallback((id: string) => {
    setSelectedNoteId(id);
  }, []);

  const createNote = useCallback(async (newNote: { title?: string; color?: string }) => {
    try {
      const created = await notesAPI.saveNote({
        title: newNote.title ?? '',
        color: newNote.color ?? 'primary',
      });
      setNotes((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Error creating note:', err);
      return null;
    }
  }, []);

  const updateNote = useCallback(async (id: string, patch: { title?: string; color?: string }) => {
    // Optimistic local update so typing feels instant.
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...patch } : note)));
    try {
      const saved = await notesAPI.saveNote({ id, ...patch });
      setNotes((prev) => prev.map((note) => (note.id === id ? saved : note)));
    } catch (err) {
      console.error('Error updating note:', err);
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const previous = notes;
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
    try {
      await notesAPI.deleteNote(id);
    } catch (err) {
      console.error('Error deleting note:', err);
      setNotes(previous);
    }
  }, [notes, selectedNoteId]);

  return (
    <NotesContext.Provider
      value={{
        notes,
        loading,
        error,
        selectedNoteId,
        selectNote,
        refresh,
        createNote,
        updateNote,
        deleteNote,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};
