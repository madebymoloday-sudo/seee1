import { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Edit2, MessageSquareText, Lightbulb, MoreVertical, Trash2 } from "lucide-react";
import type { SessionResponseDto } from "@/api/schemas";
import { toast } from "sonner";
import styles from "./SessionFolderCard.module.css";

interface SessionFolderCardProps {
  session: SessionResponseDto;
  colorIndex: number;
  onRename?: () => void;
  onDelete?: () => void;
  onShowFeedback?: () => void;
  onShowIdeas?: () => void;
  ideasCount?: number;
}

const FOLDER_COLORS = [
  "#FFB6C1", // Pink
  "#FFD700", // Yellow
  "#87CEEB", // Light Blue
  "#FFA07A", // Light Salmon
  "#DDA0DD", // Plum
  "#98FB98", // Pale Green
  "#F0E68C", // Khaki
  "#FFE4B5", // Moccasin
];

const SessionFolderCard = observer(({ 
  session, 
  colorIndex, 
  onRename,
  onDelete,
  onShowFeedback,
  onShowIdeas,
  ideasCount = 0 
}: SessionFolderCardProps) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const folderColor = FOLDER_COLORS[colorIndex % FOLDER_COLORS.length];

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleNavigate = () => {
    navigate(`/sessions/${session.id}`);
  };

  const handleRename = () => {
    setIsMenuOpen(false);
    if (onRename) {
      onRename();
    } else {
      const newTitle = prompt("Введите новое название сессии:", session.title || "Новая сессия");
      if (newTitle !== null && newTitle.trim()) {
        toast.info("Функция переименования будет добавлена");
      }
    }
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    if (onDelete) onDelete();
  };

  const handleShowFeedback = () => {
    setIsMenuOpen(false);
    if (onShowFeedback) onShowFeedback();
  };

  const handleShowIdeas = () => {
    setIsMenuOpen(false);
    if (onShowIdeas) onShowIdeas();
  };

  return (
    <div
      className={`${styles.folderContainer} ${isMenuOpen ? styles.folderContainerOpen : ""}`}
    >
      <div 
        className={styles.folderCard}
        style={{ 
          backgroundColor: folderColor,
          boxShadow: `0 4px 12px ${folderColor}40`
        }}
      >
        {/* Корешок с названием */}
        <div className={styles.folderSpine}>
          <div className={styles.spineRow}>
            <button
              onClick={handleNavigate}
              className={styles.folderTitle}
              title="Открыть сессию"
            >
              {session.title || "Новая сессия"}
            </button>

            <button
              ref={menuButtonRef}
              type="button"
              className={styles.actionsButton}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMenuOpen((p) => !p);
              }}
              title="Действия"
              aria-label="Действия"
            >
              <MoreVertical className={styles.actionsIcon} />
            </button>
          </div>
          
          {/* Выпадающее меню */}
          {isMenuOpen && (
            <div ref={menuRef} className={styles.dropdownMenu}>
              <button onClick={handleRename} className={styles.menuItem}>
                <Edit2 className={styles.menuIcon} />
                Редактировать название
              </button>
              <button onClick={handleDelete} className={`${styles.menuItem} ${styles.menuDanger}`}>
                <Trash2 className={styles.menuIcon} />
                Удалить
              </button>
              <button onClick={handleShowFeedback} className={styles.menuItem}>
                <MessageSquareText className={styles.menuIcon} />
                Обратная связь
              </button>
              <button onClick={handleShowIdeas} className={styles.menuItem}>
                <Lightbulb className={styles.menuIcon} />
                Идеи
              </button>
            </div>
          )}
        </div>

        {/* Основная часть папки */}
        <div className={styles.folderBody}>
          <div className={styles.folderInfo}>
            <span className={styles.ideasBadge}>
              {ideasCount} идей
            </span>
          </div>
          
          {/* Кнопка перехода */}
          <button 
            onClick={handleNavigate}
            className={styles.navigateButton}
            aria-label="Перейти к сессии"
          >
            <ChevronRight className={styles.arrowIcon} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default SessionFolderCard;
