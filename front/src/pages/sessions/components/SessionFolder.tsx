import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SessionResponseDto } from "@/api/schemas";
import styles from "./SessionFolder.module.css";

interface SessionFolderProps {
  session: SessionResponseDto;
  colorIndex: number;
}

// Цветовая палитра папок (из изображения)
const FOLDER_COLORS = [
  "#FFB6C1", // Светло-розовый
  "#FFE4B5", // Светло-желтый
  "#B0E0E6", // Светло-голубой
  "#FFDAB9", // Персиковый
  "#E6E6FA", // Лавандовый
  "#F0E68C", // Хаки
  "#DDA0DD", // Сливовый
  "#98FB98", // Бледно-зеленый
];

const SessionFolder = ({ session, colorIndex }: SessionFolderProps) => {
  const navigate = useNavigate();
  const folderColor = FOLDER_COLORS[colorIndex % FOLDER_COLORS.length];

  const handleClick = () => {
    navigate(`/sessions/${session.id}`);
  };

  // Количество идей (сообщений пользователя)
  const ideasCount = session.messageCount || 0;

  return (
    <div 
      className={styles.folder}
      style={{ 
        backgroundColor: folderColor,
        borderLeftColor: folderColor,
      }}
      onClick={handleClick}
    >
      {/* Корешок с названием */}
      <div className={styles.folderSpine}>
        <span className={styles.spineTitle}>
          {session.title || "Без названия"}
        </span>
      </div>

      {/* Основная часть папки */}
      <div className={styles.folderBody}>
        <div className={styles.folderContent}>
          <div className={styles.folderInfo}>
            <h3 className={styles.folderName}>
              {session.title || "Без названия"}
            </h3>
            <div className={styles.ideasCount}>
              {ideasCount} {ideasCount === 1 ? "идея" : ideasCount < 5 ? "идеи" : "идей"}
            </div>
          </div>
          <button 
            className={styles.folderArrow}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            <ChevronRight className={styles.arrowIcon} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionFolder;
