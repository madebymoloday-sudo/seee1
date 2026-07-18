import { createPortal } from "react-dom";
import { User, Trophy, Map } from "lucide-react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const isMapActive = location.pathname === "/" || location.pathname.startsWith("/map");
  const isRatingActive = location.pathname.startsWith("/rating");
  const isCabinetActive = location.pathname.startsWith("/cabinet");

  const navigation = (
    <nav className={styles.bottomNav} aria-label="Основная навигация">
      <button
        onClick={onRating}
        className={`${styles.navButton} ${isRatingActive ? styles.navButtonPrimary : ""}`}
        title="Рейтинг"
        aria-current={isRatingActive ? "page" : undefined}
      >
        <span className={`${styles.navIconBubble} ${isRatingActive ? styles.navIconBubblePrimary : ""}`}>
          <Trophy className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Рейтинг</span>
      </button>

      <button
        onClick={onMindMap}
        className={`${styles.navButton} ${isMapActive ? styles.navButtonPrimary : ""}`}
        title="Нейрокарта"
        aria-current={isMapActive ? "page" : undefined}
      >
        <span className={`${styles.navIconBubble} ${isMapActive ? styles.navIconBubblePrimary : ""}`}>
          <Map className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Нейрокарта</span>
      </button>
      
      <button
        onClick={onCabinet}
        className={`${styles.navButton} ${isCabinetActive ? styles.navButtonPrimary : ""}`}
        title="Личный кабинет"
        aria-current={isCabinetActive ? "page" : undefined}
      >
        <span className={`${styles.navIconBubble} ${isCabinetActive ? styles.navIconBubblePrimary : ""}`}>
          <User className={styles.navIcon} />
        </span>
        <span className={styles.navLabel}>Личный кабинет</span>
      </button>
    </nav>
  );

  if (typeof document === "undefined") {
    return navigation;
  }

  return createPortal(navigation, document.body);
};

export default BottomNavigation;
