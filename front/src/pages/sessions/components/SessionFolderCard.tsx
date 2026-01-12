import { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Edit2, Pause, Save, List, Plus } from "lucide-react";
import type { SessionResponseDto } from "@/api/schemas";
import { toast } from "sonner";
import styles from "./SessionFolderCard.module.css";

interface SessionFolderCardProps {
  session: SessionResponseDto;
  colorIndex: number;
  onRename?: () => void;
  onPause?: () => void;
  onSave?: () => void;
  onNewSession?: () => void;
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
  onPause,
  onSave,
  onNewSession,
  ideasCount = 0 
}: SessionFolderCardProps) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);

  const folderColor = FOLDER_COLORS[colorIndex % FOLDER_COLORS.length];

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          titleRef.current && !titleRef.current.contains(event.target as Node)) {
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

  const handleTitleClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavigate = () => {
    navigate(`/sessions/${session.id}`);
  };

  const handleRename = () => {
    setIsMenuOpen(false);
    if (onRename) {
      onRename();
    } else {
      const newTitle = prompt("Введите новое название сессии:", session.title || "Без названия");
      if (newTitle !== null && newTitle.trim()) {
        toast.info("Функция переименования будет добавлена");
      }
    }
  };

  const handlePause = () => {
    setIsMenuOpen(false);
    if (onPause) {
      onPause();
    } else {
      toast.info("Функция приостановки будет добавлена");
    }
  };

  const handleSave = () => {
    setIsMenuOpen(false);
    if (onSave) {
      onSave();
    }
  };

  const handleAllSessions = () => {
    setIsMenuOpen(false);
    navigate("/sessions");
  };

  const handleNewSession = () => {
    setIsMenuOpen(false);
    if (onNewSession) {
      onNewSession();
    }
  };

  return (
    <div className={styles.folderContainer}>
      <div 
        className={styles.folderCard}
        style={{ 
          backgroundColor: folderColor,
          boxShadow: `0 4px 12px ${folderColor}40`
        }}
      >
        {/* Корешок с названием */}
        <div className={styles.folderSpine}>
          <button
            ref={titleRef}
            onClick={handleTitleClick}
            className={styles.folderTitle}
          >
            {session.title || "Без названия"}
          </button>
          
          {/* Выпадающее меню */}
          {isMenuOpen && (
            <div ref={menuRef} className={styles.dropdownMenu}>
              <button onClick={handleRename} className={styles.menuItem}>
                <Edit2 className={styles.menuIcon} />
                Переименовать
              </button>
              <button onClick={handlePause} className={styles.menuItem}>
                <Pause className={styles.menuIcon} />
                Приостановить
              </button>
              <button onClick={handleSave} className={styles.menuItem}>
                <Save className={styles.menuIcon} />
                Сохранить
              </button>
              <button onClick={handleNewSession} className={styles.menuItem}>
                <Plus className={styles.menuIcon} />
                Новая сессия
              </button>
              <button onClick={handleAllSessions} className={styles.menuItem}>
                <List className={styles.menuIcon} />
                Список сессий
              </button>
            </div>
          )}
        </div>

        {/* Основная часть папки */}
        <div className={styles.folderBody}>
          <div className={styles.folderInfo}>
            <span className={styles.ideasCount}>{ideasCount} идей</span>
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
