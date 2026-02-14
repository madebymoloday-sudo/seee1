import { User, StickyNote, Plus } from "lucide-react";
import styles from "./BottomNavigation.module.css";

interface BottomNavigationProps {
  onCabinet: () => void;
  onNotes: () => void;
  onPeople: () => void;
  onNewSession: () => void;
}

const BottomNavigation = ({ 
  onCabinet, 
  onNotes, 
  onPeople,
  onNewSession 
}: BottomNavigationProps) => {
  return (
    <div className={styles.bottomNav}>
      <button onClick={onNotes} className={styles.navButton} title="Заметки">
        <span className={styles.navIconBubble}>
          <StickyNote className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Заметки</span>
      </button>

      <button onClick={onPeople} className={styles.navButton} title="Люди">
        <span className={styles.navIconBubble}>
          <span className={styles.emojiIcon} role="img" aria-label="Люди">🫂</span>
        </span>
        <span className={styles.navLabel}>Люди</span>
      </button>
      
      <button onClick={onNewSession} className={styles.navButton} title="Новая сессия">
        <span className={styles.navIconBubble}>
          <Plus className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Новая сессия</span>
      </button>
      
      <button onClick={onCabinet} className={styles.navButton} title="Личный кабинет">
        <span className={styles.navIconBubble}>
          <User className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Личный кабинет</span>
      </button>
    </div>
  );
};

export default BottomNavigation;
