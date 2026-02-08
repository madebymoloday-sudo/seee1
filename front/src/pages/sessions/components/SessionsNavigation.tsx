import { Bookmark, User, StickyNote, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FeedbackModal from "./FeedbackModal";
import { useState } from "react";
import NotesModal from "./NotesModal";
import styles from "./SessionsNavigation.module.css";

const SessionsNavigation = () => {
  const navigate = useNavigate();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const handleFeedback = () => {
    setIsFeedbackOpen(true);
  };

  const handleCabinet = () => {
    navigate("/cabinet");
  };

  const handleNotes = () => {
    setIsNotesOpen(true);
  };

  const handleNewSession = async () => {
    // Не создаём сессию заранее — она появится в списке после первого ответа.
    navigate("/sessions/new");
  };

  return (
    <>
      <nav className={styles.navigation}>
        <button onClick={handleFeedback} className={styles.navButton} title="Отзыв">
          <Bookmark className={styles.navIcon} />
          <span className={styles.navLabel}>Отзыв</span>
        </button>
        <button onClick={handleCabinet} className={styles.navButton} title="Личный кабинет">
          <User className={styles.navIcon} />
          <span className={styles.navLabel}>Кабинет</span>
        </button>
        <button onClick={handleNotes} className={styles.navButton} title="Заметки">
          <StickyNote className={styles.navIcon} />
          <span className={styles.navLabel}>Заметки</span>
        </button>
        <button 
          onClick={handleNewSession} 
          className={styles.navButton} 
          title="Новая сессия"
        >
          <Plus className={styles.navIcon} />
          <span className={styles.navLabel}>Новая</span>
        </button>
      </nav>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      <NotesModal isOpen={isNotesOpen} onClose={() => setIsNotesOpen(false)} />
    </>
  );
};

export default SessionsNavigation;
