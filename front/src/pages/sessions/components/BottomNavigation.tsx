import { createPortal } from "react-dom";
import { User, Archive, Trophy, Map } from "lucide-react";
import styles from "./BottomNavigation.module.css";

interface BottomNavigationProps {
  onCabinet: () => void;
  onRating: () => void;
  onPeople: () => void;
  onArchivist: () => void;
  onMindMap: () => void;
}

const BottomNavigation = ({ 
  onCabinet, 
  onRating, 
  onPeople,
  onArchivist,
  onMindMap 
}: BottomNavigationProps) => {
  const navigation = (
    <div className={styles.bottomNav}>
      <button onClick={onRating} className={styles.navButton} title="Рейтинг">
        <span className={styles.navIconBubble}>
          <Trophy className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Рейтинг</span>
      </button>

      <button onClick={onPeople} className={styles.navButton} title="Мега-чаты">
        <span className={styles.navIconBubble}>
          <span className={styles.emojiIcon} role="img" aria-label="Мега-чаты">🫂</span>
        </span>
        <span className={styles.navLabel}>Мега-чаты</span>
      </button>

      <button onClick={onArchivist} className={`${styles.navButton} ${styles.navButtonPrimary}`} title="Архивариус">
        <span className={`${styles.navIconBubble} ${styles.navIconBubblePrimary}`}>
          <Archive className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Архивариус</span>
      </button>
      
      <button onClick={onMindMap} className={styles.navButton} title="Нейрокарта">
        <span className={styles.navIconBubble}>
          <Map className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Нейрокарта</span>
      </button>
      
      <button onClick={onCabinet} className={styles.navButton} title="Личный кабинет">
        <span className={styles.navIconBubble}>
          <User className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Личный кабинет</span>
      </button>
    </div>
  );

  if (typeof document === "undefined") {
    return navigation;
  }

  return createPortal(navigation, document.body);
};

export default BottomNavigation;
