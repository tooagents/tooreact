import { apiFetch } from 'src/core/apihttp';
import { notesType } from 'src/types/notes';

function normalizeNote(value: unknown): notesType | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<notesType> & { datef?: string };
  if (!raw.id) {
    return null;
  }
  return {
    id: String(raw.id),
    title: raw.title ?? '',
    color: raw.color ?? 'primary',
    datef: raw.datef ?? new Date().toISOString(),
    deleted: Boolean(raw.deleted),
  };
}

function normalizeNoteList(data: unknown): notesType[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map(normalizeNote)
    .filter((note): note is notesType => note !== null);
}

export const notesAPI = {
  async listNotes(): Promise<notesType[]> {
    const response = await apiFetch('/too/get_note_list');
    if (!response.ok) {
      throw new Error(`Failed to fetch notes: ${response.statusText}`);
    }
    return normalizeNoteList(await response.json());
  },

  // Create (no id) or update (with id). Backend maps title/color to note columns.
  async saveNote(data: { id?: string; title?: string; color?: string }): Promise<notesType> {
    const response = await apiFetch('/too/post_note', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to save note: ${response.status} ${text}`);
    }
    const note = normalizeNote(await response.json());
    if (!note) {
      throw new Error('Save note returned an invalid payload');
    }
    return note;
  },

  // Soft delete (backend sets is_deleted = true).
  async deleteNote(id: string): Promise<void> {
    const response = await apiFetch(`/too/delete_note/${id}`, {
      method: 'POST',
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to delete note: ${response.status} ${text}`);
    }
  },
};

export default notesAPI;
