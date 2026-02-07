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

  // Количество идей: шаг 3 (мысль) + варианты шага 4 (почему важно)
  const ideasCount = (() => {
    try {
      const raw = localStorage.getItem(`seee_step_dialog_state:${session.id}`);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { v?: number; answers?: Record<string, string> };
      const answers = parsed?.v === 2 ? parsed.answers || {} : {};
      const answer3 =
        answers["core:situation:3"] || answers["core:thought:3"] || "";
      const answer4 =
        answers["core:situation:4"] || answers["core:thought:4"] || "";
      const opts = (answer4 || "")
        .split(/\r?\n|;|•|\u2022|,|—|-|\*/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^\d+[\)\.\-]\s*/, "").trim())
        .filter((s) => s.length >= 2);
      const unique = Array.from(new Set(opts.map((x) => x.toLowerCase()))).length;
      return (answer3.trim() ? 1 : 0) + unique;
    } catch {
      return 0;
    }
  })();

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
          {session.title || "Новая сессия"}
        </span>
      </div>

      {/* Основная часть папки */}
      <div className={styles.folderBody}>
        <div className={styles.folderContent}>
          <div className={styles.folderInfo}>
            <h3 className={styles.folderName}>
              {session.title || "Новая сессия"}
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
