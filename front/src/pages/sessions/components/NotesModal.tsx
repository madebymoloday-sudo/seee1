import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import styles from "./NotesModal.module.css";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotesModal = ({ isOpen, onClose }: NotesModalProps) => {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem("notes");
    return saved ? JSON.parse(saved).map((n: any) => ({
      ...n,
      createdAt: new Date(n.createdAt),
      updatedAt: new Date(n.updatedAt),
    })) : [];
  });
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Сохранение заметок в localStorage
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem("notes", JSON.stringify(notes));
    }
  }, [notes]);

  const handleCreateNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Новая заметка",
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
    setIsEditing(true);
    setEditTitle(newNote.title);
    setEditContent(newNote.content);
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setIsEditing(false);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleEdit = () => {
    if (selectedNote) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (selectedNote) {
      const updatedNote: Note = {
        ...selectedNote,
        title: editTitle.trim() || "Без названия",
        content: editContent,
        updatedAt: new Date(),
      };
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setSelectedNote(updatedNote);
      setIsEditing(false);
      toast.success("Заметка сохранена");
    }
  };

  const handleDelete = () => {
    if (selectedNote && confirm("Удалить эту заметку?")) {
      setNotes(notes.filter(n => n.id !== selectedNote.id));
      setSelectedNote(null);
      setIsEditing(false);
      toast.success("Заметка удалена");
    }
  };

  const handleCancel = () => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
      setIsEditing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Заметки</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* Список заметок */}
          <div className={styles.notesList}>
            <button onClick={handleCreateNote} className={styles.newNoteButton}>
              <Plus className={styles.plusIcon} />
              <span>Новая заметка</span>
            </button>
            
            {notes.map((note) => (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`${styles.noteItem} ${selectedNote?.id === note.id ? styles.noteItemActive : ""}`}
              >
                <div className={styles.noteItemTitle}>{note.title}</div>
                <div className={styles.noteItemPreview}>
                  {note.content.substring(0, 50) || "Пустая заметка"}
                  {note.content.length > 50 && "..."}
                </div>
                <div className={styles.noteItemDate}>
                  {note.updatedAt.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Редактор заметки */}
          <div className={styles.noteEditor}>
            {selectedNote ? (
              <>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={styles.titleInput}
                      placeholder="Название заметки"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className={styles.contentTextarea}
                      placeholder="Начните писать..."
                      rows={15}
                    />
                    <div className={styles.editorActions}>
                      <button onClick={handleCancel} className={styles.cancelButton}>
                        Отмена
                      </button>
                      <button onClick={handleSave} className={styles.saveButton}>
                        Сохранить
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.noteViewHeader}>
                      <h3 className={styles.noteViewTitle}>{selectedNote.title}</h3>
                      <div className={styles.noteViewActions}>
                        <button onClick={handleEdit} className={styles.editButton}>
                          Редактировать
                        </button>
                        <button onClick={handleDelete} className={styles.deleteButton}>
                          <Trash2 className={styles.deleteIcon} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.noteViewContent}>
                      {selectedNote.content || (
                        <p className={styles.emptyNote}>Заметка пуста</p>
                      )}
                    </div>
                    <div className={styles.noteViewDate}>
                      Изменено: {selectedNote.updatedAt.toLocaleString("ru-RU")}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={styles.emptyEditor}>
                <p>Выберите заметку или создайте новую</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesModal;
