import { MessageSquare, User, StickyNote, Plus } from "lucide-react";
import styles from "./BottomNavigation.module.css";

interface BottomNavigationProps {
  onFeedback: () => void;
  onCabinet: () => void;
  onNotes: () => void;
  onNewSession: () => void;
}

const BottomNavigation = ({ 
  onFeedback, 
  onCabinet, 
  onNotes, 
  onNewSession 
}: BottomNavigationProps) => {
  return (
    <div className={styles.bottomNav}>
      <button onClick={onFeedback} className={styles.navButton} title="Отзыв">
        <MessageSquare className={styles.navIcon} />
        <span className={styles.navLabel}>Отзыв</span>
      </button>
      
      <button onClick={onNotes} className={styles.navButton} title="Заметки">
        <StickyNote className={styles.navIcon} />
        <span className={styles.navLabel}>Заметки</span>
      </button>
      
      <button onClick={onNewSession} className={styles.navButton} title="Новая сессия">
        <Plus className={styles.navIcon} />
        <span className={styles.navLabel}>Новая сессия</span>
      </button>
      
      <button onClick={onCabinet} className={styles.navButton} title="Личный кабинет">
        <User className={styles.navIcon} />
        <span className={styles.navLabel}>Личный кабинет</span>
      </button>
    </div>
  );
};

export default BottomNavigation;
