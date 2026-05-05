import { createPortal } from "react-dom";
import { User, Trophy, Map } from "lucide-react";
import styles from "./BottomNavigation.module.css";

interface BottomNavigationProps {
  onCabinet: () => void;
  onRating: () => void;
  onMindMap: () => void;
}

const BottomNavigation = ({ 
  onCabinet, 
  onRating, 
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

      <button onClick={onMindMap} className={`${styles.navButton} ${styles.navButtonPrimary}`} title="Нейрокарта">
        <span className={`${styles.navIconBubble} ${styles.navIconBubblePrimary}`}>
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
