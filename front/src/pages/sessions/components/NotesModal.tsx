import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import styles from "./NotesModal.module.css";

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotesModal = ({ isOpen, onClose }: NotesModalProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");

  // Загружаем заметки из localStorage
  useEffect(() => {
    if (isOpen) {
      const savedNotes = localStorage.getItem("userNotes");
      if (savedNotes) {
        try {
          setNotes(JSON.parse(savedNotes));
        } catch (error) {
          console.error("Ошибка загрузки заметок:", error);
        }
      }
    }
  }, [isOpen]);

  // Сохраняем заметки в localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    localStorage.setItem("userNotes", JSON.stringify(updatedNotes));
    setNotes(updatedNotes);
  };

  const handleCreateNote = () => {
    if (!newNoteContent.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      content: newNoteContent.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedNotes = [newNote, ...notes];
    saveNotes(updatedNotes);
    setNewNoteContent("");
    toast.success("Заметка создана");
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNewNoteContent(note.content);
  };

  const handleUpdateNote = () => {
    if (!editingNote || !newNoteContent.trim()) return;

    const updatedNotes = notes.map((note) =>
      note.id === editingNote.id
        ? { ...note, content: newNoteContent.trim() }
        : note
    );

    saveNotes(updatedNotes);
    setEditingNote(null);
    setNewNoteContent("");
    toast.success("Заметка обновлена");
  };

  const handleDeleteNote = (id: string) => {
    if (confirm("Удалить эту заметку?")) {
      const updatedNotes = notes.filter((note) => note.id !== id);
      saveNotes(updatedNotes);
      toast.success("Заметка удалена");
    }
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setNewNoteContent("");
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Заметки</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Форма создания/редактирования заметки */}
          <div className={styles.noteForm}>
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder={editingNote ? "Редактировать заметку..." : "Новая заметка..."}
              className={styles.textarea}
              rows={4}
            />
            <div className={styles.formActions}>
              {editingNote ? (
                <>
                  <button onClick={handleCancelEdit} className={styles.cancelButton}>
                    Отмена
                  </button>
                  <button onClick={handleUpdateNote} className={styles.saveButton}>
                    Сохранить
                  </button>
                </>
              ) : (
                <button onClick={handleCreateNote} className={styles.createButton}>
                  <Plus className={styles.buttonIcon} />
                  Создать
                </button>
              )}
            </div>
          </div>

          {/* Список заметок */}
          <div className={styles.notesList}>
            {notes.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Нет заметок</p>
                <p className={styles.emptyHint}>Создайте первую заметку выше</p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className={styles.noteItem}>
                  <div className={styles.noteContent}>
                    <p>{note.content}</p>
                    <span className={styles.noteDate}>
                      {new Date(note.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className={styles.noteActions}>
                    <button
                      onClick={() => handleEditNote(note)}
                      className={styles.editButton}
                      title="Редактировать"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className={styles.deleteButton}
                      title="Удалить"
                    >
                      <Trash2 className={styles.deleteIcon} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
