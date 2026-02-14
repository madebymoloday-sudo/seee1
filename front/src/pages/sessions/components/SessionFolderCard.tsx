import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Edit2, MessageSquareText, Lightbulb, MoreVertical, Trash2, FolderPlus } from "lucide-react";
import type { SessionResponseDto } from "@/api/schemas";
import { toast } from "sonner";
import styles from "./SessionFolderCard.module.css";

interface SessionFolderCardProps {
  session: SessionResponseDto;
  colorIndex?: number;
  tagLabel?: string;
  categoryLabel?: string;
  recommendationLabel?: string;
  palette?: "default" | "toExplore";
  onOpen?: () => void;
  showMenu?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onMoveToExplore?: () => void;
  onShowFeedback?: () => void;
  onShowIdeas?: () => void;
  ideasCount?: number;
}

const FOLDER_COLORS = [
  "#9FC5C7", // Sea mist
  "#86B8C8", // Shallow bay blue
  "#9ABFA9", // Sea grass
  "#C4B8A7", // Beach shell
  "#7FA8B2", // Coastal slate
  "#A7C9BE", // Soft algae
  "#B7C7D6", // Cloudy lagoon
  "#A8B5A4", // Dune moss
];

const TO_EXPLORE_COLORS = [
  "#9BC3CC", // Calm reef
  "#88B7B1", // Sea foam
  "#AFC3B6", // Kelp light
  "#9AB0C9", // Gulf haze
  "#B8C8B4", // Driftwood sage
  "#A6BCC8", // Tide glass
];

function stableModuloFromString(value: string, modulo: number) {
  // FNV-1a 32-bit
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % modulo;
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "").trim();
  const full = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 160, g: 160, b: 160 };
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function getRussianIdeaWord(count: number) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "идей";
  if (n1 > 1 && n1 < 5) return "идеи";
  if (n1 === 1) return "идея";
  return "идей";
}

const SessionFolderCard = observer(({ 
  session, 
  colorIndex, 
  tagLabel,
  categoryLabel,
  recommendationLabel,
  palette = "default",
  onOpen,
  showMenu = true,
  onRename,
  onDelete,
  onMoveToExplore,
  onShowFeedback,
  onShowIdeas,
  ideasCount = 0 
}: SessionFolderCardProps) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuActionHandledRef = useRef(false);

  const paletteColors = palette === "toExplore" ? TO_EXPLORE_COLORS : FOLDER_COLORS;
  const colorSeed = String(session.id ?? session.createdAt ?? session.title ?? "");
  const resolvedColorIndex =
    typeof colorIndex === "number"
      ? ((colorIndex % paletteColors.length) + paletteColors.length) % paletteColors.length
      : stableModuloFromString(colorSeed, paletteColors.length);
  const folderColor = paletteColors[resolvedColorIndex];
  const folderRgb = hexToRgb(folderColor);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setMenuPosition(null);
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
    if (menuActionHandledRef.current) {
      menuActionHandledRef.current = false;
      return;
    }
    if (onOpen) {
      onOpen();
      return;
    }
    navigate(`/sessions/${session.id}`);
  };

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMenuOpen) {
      setIsMenuOpen(false);
      setMenuPosition(null);
    } else if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 6, right: document.documentElement.clientWidth - rect.right });
      setIsMenuOpen(true);
    }
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setMenuPosition(null);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    menuActionHandledRef.current = true;
    setTimeout(() => { menuActionHandledRef.current = false; }, 150);
    closeMenu();
    if (onRename) {
      onRename();
    } else {
      const newTitle = prompt("Введите новое название сессии:", session.title || "Новая сессия");
      if (newTitle !== null && newTitle.trim()) {
        toast.info("Функция переименования будет добавлена");
      }
    }
  };

  const handleMenuAction = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    menuActionHandledRef.current = true;
    setTimeout(() => { menuActionHandledRef.current = false; }, 150);
    closeMenu();
    fn();
  };

  const handleDelete = (e: React.MouseEvent) => {
    handleMenuAction(e, () => { if (onDelete) onDelete(); });
  };

  const handleShowFeedback = (e: React.MouseEvent) => {
    handleMenuAction(e, () => { if (onShowFeedback) onShowFeedback(); });
  };

  const handleShowIdeas = (e: React.MouseEvent) => {
    handleMenuAction(e, () => { if (onShowIdeas) onShowIdeas(); });
  };

  return (
    <div className={`${styles.folderContainer} ${isMenuOpen ? styles.folderContainerOpen : ""}`}>
      <div
        className={styles.folderCard}
        onClick={handleNavigate}
        style={{
          // CSS использует background-image + эту подложку для "текстуры"
          ["--folder-color" as any]: folderColor,
          ["--folder-color-rgb" as any]: `${folderRgb.r}, ${folderRgb.g}, ${folderRgb.b}`,
          boxShadow: `0 4px 12px ${folderColor}40`,
        }}
      >
        {/* Верхняя строка: название + меню */}
        <div className={styles.folderSpine}>
          <div className={styles.spineRow}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNavigate();
              }}
              className={styles.folderTitle}
              title="Открыть сессию"
            >
              {session.title || "Новая сессия"}
            </button>

            {showMenu ? (
              <button
                ref={menuButtonRef}
                type="button"
                className={styles.actionsButton}
                onClick={handleToggleMenu}
                title="Действия"
                aria-label="Действия"
              >
                <MoreVertical className={styles.actionsIcon} />
              </button>
            ) : null}
          </div>

          {/* Выпадающее меню — рендерится через portal поверх всех слоёв, рядом с кнопкой */}
        </div>

        {/* Основная часть */}
        <div className={styles.folderBody}>
          <div className={styles.folderInfo}>
            <div className={styles.badgesRow}>
              <span className={styles.ideasBadge}>
                {ideasCount} {getRussianIdeaWord(ideasCount)}
              </span>
              {tagLabel ? (
                <span className={styles.tagBadge}>{tagLabel}</span>
              ) : null}
              {categoryLabel ? (
                <span className={styles.tagBadge}>{categoryLabel}</span>
              ) : null}
              {recommendationLabel ? (
                <span className={styles.recommendationBadge}>{recommendationLabel}</span>
              ) : null}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNavigate();
            }}
            className={styles.navigateButton}
            aria-label="Перейти к сессии"
          >
            <ChevronRight className={styles.arrowIcon} />
          </button>
        </div>
      </div>

      {/* Portal: выпадающее меню поверх всех слоёв, выровнено по кнопке */}
      {showMenu && isMenuOpen && menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.dropdownMenu}
            style={{
              position: "fixed",
              top: menuPosition.top,
              right: menuPosition.right,
              left: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={handleRename} className={styles.menuItem}>
              <Edit2 className={styles.menuIcon} />
              Редактировать название
            </button>
            <button onClick={handleDelete} className={`${styles.menuItem} ${styles.menuDanger}`}>
              <Trash2 className={styles.menuIcon} />
              Удалить
            </button>
            {onMoveToExplore ? (
              <button onClick={(e) => handleMenuAction(e, onMoveToExplore)} className={styles.menuItem}>
                <FolderPlus className={styles.menuIcon} />
                Перенести в Предстоит изучить
              </button>
            ) : null}
            <button onClick={handleShowFeedback} className={styles.menuItem}>
              <MessageSquareText className={styles.menuIcon} />
              Обратная связь
            </button>
            <button onClick={handleShowIdeas} className={styles.menuItem}>
              <Lightbulb className={styles.menuIcon} />
              Идеи
            </button>
          </div>,
          document.body
        )}
    </div>
  );
});

export default SessionFolderCard;
