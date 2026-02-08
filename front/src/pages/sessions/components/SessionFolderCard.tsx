import { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Edit2, MessageSquareText, Lightbulb, MoreVertical, Trash2 } from "lucide-react";
import type { SessionResponseDto } from "@/api/schemas";
import { toast } from "sonner";

interface SessionFolderCardProps {
  session: SessionResponseDto;
  colorIndex?: number;
  tagLabel?: string;
  palette?: "default" | "toExplore";
  onOpen?: () => void;
  showMenu?: boolean;
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

const TO_EXPLORE_COLORS = [
  "#A7C7E7", // Pastel Blue
  "#B4E4D3", // Mint
  "#CDB4DB", // Lavender
  "#FFD6A5", // Soft Orange
  "#BDE0FE", // Light Sky
  "#B8E0D2", // Soft Green
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

function mixRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * clamped);
  const g = Math.round(a.g + (b.g - a.g) * clamped);
  const b2 = Math.round(a.b + (b.b - a.b) * clamped);
  return `rgb(${r} ${g} ${b2})`;
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
  colorIndex: _colorIndex, 
  tagLabel,
  palette = "default",
  onOpen,
  showMenu = true,
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

  const colorSeed = String(session.id ?? session.createdAt ?? session.title ?? "");
  const paletteColors = palette === "toExplore" ? TO_EXPLORE_COLORS : FOLDER_COLORS;
  const colorIndex = stableModuloFromString(colorSeed, paletteColors.length);
  const folderColor = paletteColors[colorIndex];
  const folderRgb = hexToRgb(folderColor);
  const tabColor = mixRgb(folderRgb, { r: 255, g: 255, b: 255 }, 0.18);
  const spineColor = mixRgb(folderRgb, { r: 0, g: 0, b: 0 }, 0.14);
  const borderColor = mixRgb(folderRgb, { r: 0, g: 0, b: 0 }, 0.2);

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
    if (onOpen) {
      onOpen();
      return;
    }
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

  const folderClipPath = "polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)";
  const tabClipPath = "polygon(0 0, 100% 0, 100% 70%, calc(100% - 18px) 100%, 18px 100%, 0 70%)";

  return (
    <div className="w-full">
      <div 
        className="relative w-full max-w-[640px] cursor-pointer select-none transition-transform duration-200 hover:-translate-y-[1px]"
        onClick={handleNavigate}
        style={{ filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.10))" }}
      >
        {/* Верхний "язычок" папки */}
        <div
          className="absolute -top-3 left-[88px] h-9 w-[260px] px-4 flex items-center justify-between gap-3"
          style={{
            background: tabColor,
            clipPath: tabClipPath,
            boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
            border: `1px solid ${borderColor}`,
          }}
        >
          <div className="min-w-0 text-[12px] font-semibold tracking-wide text-black/70 truncate">
            {session.title || "Новая сессия"}
          </div>
          {showMenu ? (
            <button
              ref={menuButtonRef}
              type="button"
              className="h-7 w-7 rounded-full bg-black/5 hover:bg-black/10 active:bg-black/15 flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMenuOpen((p) => !p);
              }}
              title="Действия"
              aria-label="Действия"
            >
              <MoreVertical className="h-4 w-4 text-black/60" />
            </button>
          ) : null}
        </div>

        {/* Основное тело папки */}
        <div
          className="relative overflow-hidden min-h-[140px]"
          style={{
            background: folderColor,
            clipPath: folderClipPath,
            border: `1px solid ${borderColor}`,
          }}
        >
          {/* лёгкий объём/свет */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.10) 35%, rgba(0,0,0,0.04) 100%)",
            }}
          />

          {/* Корешок */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[76px] flex items-stretch"
            style={{
              background: spineColor,
              borderRight: `1px solid ${borderColor}`,
            }}
          >
            <div
              className="relative w-full px-3 py-4 text-black/80 font-semibold"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                letterSpacing: "0.02em",
              }}
              title={session.title || "Новая сессия"}
            >
              {session.title || "Новая сессия"}
            </div>
          </div>

          {/* Выпадающее меню */}
          {showMenu && isMenuOpen && (
            <div
              ref={menuRef}
              className="absolute right-4 top-6 z-20 w-[260px] rounded-xl bg-white shadow-xl ring-1 ring-black/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={handleRename} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm hover:bg-black/5">
                <Edit2 className="h-4 w-4 text-black/70" />
                Редактировать название
              </button>
              <button onClick={handleDelete} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm hover:bg-black/5 text-red-700">
                <Trash2 className="h-4 w-4 text-red-600" />
                Удалить
              </button>
              <button onClick={handleShowFeedback} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm hover:bg-black/5">
                <MessageSquareText className="h-4 w-4 text-black/70" />
                Обратная связь
              </button>
              <button onClick={handleShowIdeas} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm hover:bg-black/5">
                <Lightbulb className="h-4 w-4 text-black/70" />
                Идеи
              </button>
            </div>
          )}

          {/* Контент */}
          <div className="relative pl-[96px] pr-5 pt-7 pb-4 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[12px] font-medium text-black/70">
                  {ideasCount} {getRussianIdeaWord(ideasCount)}
                </div>
                {tagLabel ? (
                  <div className="text-[11px] font-semibold text-black/65 px-2 py-[2px] rounded-full bg-white/55 ring-1 ring-black/10">
                    {tagLabel}
                  </div>
                ) : null}
              </div>
              <div className="text-[14px] font-semibold text-black/80 leading-snug max-w-[420px] truncate">
                {session.title || "Новая сессия"}
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate();
              }}
              className="h-10 w-10 rounded-full bg-white/55 hover:bg-white/75 active:bg-white/90 transition-colors flex items-center justify-center ring-1 ring-black/10 shrink-0"
              aria-label="Перейти к сессии"
            >
              <ChevronRight className="h-5 w-5 text-black/70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SessionFolderCard;
