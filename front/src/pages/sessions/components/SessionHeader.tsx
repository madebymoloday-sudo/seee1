import { observer } from "mobx-react-lite";
import { createPortal } from "react-dom";
import { MessageSquare, ChevronDown, Edit2, Pause, Save, List, Plus, Trash2, Moon, Coins } from "lucide-react";
import apiAgent from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import type { SessionResponseDto } from "@/api/schemas";
import { getAllPipelines } from "@/api/pipeline.api";
import { toast } from "sonner";
import PauseSessionModal from "./PauseSessionModal";
import { clearDraftSession } from "@/lib/sessionUtils";
import { getUserCoins } from "@/lib/gamification";
import styles from "./SessionHeader.module.css";

function getSessionUserKey(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return "anon";
    const parts = token.split(".");
    if (parts.length < 2) return "anon";
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(json);
    return String(payload?.sub ?? payload?.id ?? payload?.userId ?? "anon");
  } catch {
    return "anon";
  }
}

type DeferredTemplate = {
  id: string;
  title: string;
  category: "отложено на разбор";
  sourceSessionId?: string;
};

function saveDeferredTemplate(userKey: string, item: DeferredTemplate) {
  try {
    const key = `seee_to_explore_templates:${userKey}`;
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as any[]) : [];
    const safeArray = Array.isArray(parsed) ? parsed : [];
    const exists = safeArray.some((x) => String(x?.id ?? "") === item.id);
    if (!exists) {
      safeArray.push(item);
      localStorage.setItem(key, JSON.stringify(safeArray));
    }
  } catch {
    // ignore
  }
}

interface SessionHeaderProps {
  session: SessionResponseDto;
  isDraft?: boolean;
}

const SessionHeader = observer(({ session, isDraft = false }: SessionHeaderProps) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const isAdmin = (auth.user as { role?: string } | null)?.role === 'admin';

  const handleDownloadDocument = async () => {
    try {
      const response = await apiAgent.get<{ document: string }>(
        `/sessions/${session.id}/document`
      );

      if (response.document) {
        const blob = new Blob([response.document], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `concept_map_${session.id}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.info("Документ пока пуст. Продолжите диалог.");
      }
    } catch (error) {
      console.error("Ошибка загрузки документа:", error);
      toast.error("Ошибка загрузки документа");
    }
  };


  // Автоматическая установка дефолтной программы для не-админов (только для сохранённых сессий)
  useEffect(() => {
    if (isDraft) return;

    const setupDefaultProgram = async () => {
      if (isAdmin) return;

      try {
        // Загружаем пайплайны
        const pipelines = await getAllPipelines();

        // Получаем pipelineState для сессии
        let currentProgramName: string | undefined;
        let pipelineStateExists = false;
        try {
          const response = await apiAgent.get<{ programName?: string }>(
            `/sessions/${session.id}/pipeline-state`
          );
          currentProgramName = response?.programName;
          pipelineStateExists = true;
        } catch (error) {
          // Игнорируем ошибку, если pipelineState не существует
          pipelineStateExists = false;
        }

        // Ищем дефолтную программу
        const defaultPipeline = pipelines.find((p) => p.isDefault);
        if (defaultPipeline) {
          // Если pipelineState не существует или текущая программа не дефолтная, устанавливаем дефолтную
          if (!pipelineStateExists || currentProgramName !== defaultPipeline.name) {
            try {
              await apiAgent.patch(`/sessions/${session.id}/program`, {
                pipelineId: defaultPipeline.id,
              });
            } catch (error) {
              console.error("Ошибка установки дефолтной программы:", error);
            }
          }
        } else if (pipelines.length > 0) {
          // Если дефолтной нет, используем первую доступную
          const firstPipeline = pipelines[0];
          if (!pipelineStateExists || currentProgramName !== firstPipeline.name) {
            try {
              await apiAgent.patch(`/sessions/${session.id}/program`, {
                pipelineId: firstPipeline.id,
              });
            } catch (error) {
              console.error("Ошибка установки программы:", error);
            }
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки пайплайнов:", error);
      }
    };

    setupDefaultProgram();
  }, [session.id, isAdmin, isDraft]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeferredModalOpen, setIsDeferredModalOpen] = useState(false);
  const [deferredThought, setDeferredThought] = useState("");
  const [coinsBalance, setCoinsBalance] = useState(() => getUserCoins());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncCoins = () => setCoinsBalance(getUserCoins());
    const onCoinsUpdated = () => syncCoins();
    window.addEventListener("storage", syncCoins);
    window.addEventListener("seee:coins-updated", onCoinsUpdated as EventListener);
    return () => {
      window.removeEventListener("storage", syncCoins);
      window.removeEventListener("seee:coins-updated", onCoinsUpdated as EventListener);
    };
  }, []);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

  const handleRename = () => {
    const newTitle = prompt("Введите новое название сессии:", session.title || "Новая сессия");
    if (newTitle !== null && newTitle.trim()) {
      if (isDraft) {
        try {
          localStorage.setItem(`seee_draft_title:${getSessionUserKey()}`, newTitle.trim());
          toast.success("Название сохранено");
          window.location.reload();
        } catch {
          toast.error("Не удалось сохранить");
        }
      } else {
        toast.info("Функция переименования будет добавлена");
      }
    }
    setIsMenuOpen(false);
  };

  const handlePause = () => {
    if (isDraft) {
      navigate("/sessions");
      setIsMenuOpen(false);
    } else {
      setIsPauseModalOpen(true);
      setIsMenuOpen(false);
    }
  };

  const handleDelete = () => {
    if (isDraft) {
      clearDraftSession(getSessionUserKey());
      navigate("/sessions");
      setIsMenuOpen(false);
    } else {
      setIsDeleteConfirmOpen(true);
      setIsMenuOpen(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await apiAgent.delete(`/sessions/${session.id}`);
      toast.success("Сессия удалена");

      // Не создаём пустую сессию автоматически — отправляем в черновик.
      navigate("/sessions/new", { replace: true });
    } catch (error: any) {
      console.error("Ошибка удаления сессии:", error);
      toast.error(error.response?.data?.message || "Ошибка удаления сессии");
    } finally {
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleSave = () => {
    if (isDraft) {
      toast.info("Ответьте на первый вопрос, чтобы сохранить сессию");
      setIsMenuOpen(false);
    } else {
      handleDownloadDocument();
      setIsMenuOpen(false);
    }
  };

  const handleAllSessions = () => {
    navigate("/sessions");
    setIsMenuOpen(false);
  };

  const handleNewSession = async () => {
    try {
      if (isDraft) {
        clearDraftSession(getSessionUserKey());
      }
      navigate("/sessions/new");
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Ошибка создания сессии:", error);
      toast.error("Не удалось создать новую сессию");
      setIsMenuOpen(false);
    }
  };

  const handleThemeToggle = () => {
    toggleDarkMode();
  };

  const handleSaveDeferredThought = () => {
    const title = deferredThought.trim();
    if (!title) {
      toast.error("Введите мысль для отложенного разбора");
      return;
    }

    const userKey = getSessionUserKey();
    const id = `to_explore:deferred:${session.id}:${Date.now()}`;
    const item: DeferredTemplate = {
      id,
      title,
      category: "отложено на разбор",
    };

    saveDeferredTemplate(userKey, item);
    setDeferredThought("");
    setIsDeferredModalOpen(false);
    toast.success("Мысль записана в галерею");
  };

  return (
    <div className={styles.sessionHeader}>
      <div className={styles.headerContent}>
        <div className={styles.sessionTitleWrapper} ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className={styles.sessionTitleButton}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            title="Меню"
          >
            <MessageSquare className={styles.icon} />
            <h2 className={styles.sessionTitle}>
              {session.title || "Новая сессия"}
            </h2>
            <ChevronDown className={`${styles.chevron} ${isMenuOpen ? styles.chevronOpen : ""}`} />
          </button>

          {/* Выпадающее меню */}
          {isMenuOpen && (
            <div className={styles.dropdownMenu}>
              <button onClick={handleNewSession} className={styles.menuItem}>
                <Plus className={styles.menuIcon} />
                Новая сессия
              </button>
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
              <button onClick={handleAllSessions} className={styles.menuItem}>
                <List className={styles.menuIcon} />
                Галерея сессий
              </button>
              <button onClick={handleThemeToggle} className={`${styles.menuItem} ${styles.themeItem}`}>
                <span className={styles.themeLabel}>
                  <Moon className={styles.menuIcon} />
                  Тёмная тема
                </span>
                <span
                  className={`${styles.themeSwitch} ${isDarkMode ? styles.themeSwitchActive : ""}`}
                  aria-hidden="true"
                >
                  <span className={styles.themeSwitchKnob} />
                </span>
                <span className={styles.themeStateText}>{isDarkMode ? "Вкл" : "Выкл"}</span>
              </button>
              <button onClick={handleDelete} className={`${styles.menuItem} ${styles.deleteItem}`}>
                <Trash2 className={styles.menuIcon} />
                Удалить сессию
              </button>
            </div>
          )}
        </div>
        <div className={styles.coinsPill} title="Ваши монеты">
          <Coins className={styles.coinsIcon} />
          <span className={styles.coinsValue}>{coinsBalance}</span>
        </div>
        <button
          type="button"
          className={styles.deferThoughtButton}
          onClick={() => setIsDeferredModalOpen(true)}
        >
          записать мысль на разбор
        </button>
      </div>

      <PauseSessionModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
        sessionId={session.id}
      />

      {isDeleteConfirmOpen && (
        <div className={styles.deleteConfirmOverlay} onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className={styles.deleteConfirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.deleteConfirmTitle}>Точно удалить эту сессию?</h3>
            <div className={styles.deleteConfirmActions}>
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className={styles.deleteConfirmButton}
              >
                Нет
              </button>
              <button
                onClick={confirmDelete}
                className={`${styles.deleteConfirmButton} ${styles.deleteConfirmButtonYes}`}
              >
                Да
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeferredModalOpen &&
        createPortal(
          <div className={styles.deferOverlay} onClick={() => setIsDeferredModalOpen(false)}>
            <div className={styles.deferModal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.deferTitle}>
                напишите мысль которую вы хотели бы разобрать в будущем
              </h3>
              <textarea
                value={deferredThought}
                onChange={(e) => setDeferredThought(e.target.value)}
                className={styles.deferTextarea}
                placeholder="Введите мысль..."
                rows={4}
                autoFocus
              />
              <div className={styles.deferActions}>
                <button
                  type="button"
                  className={styles.deferCancelButton}
                  onClick={() => setIsDeferredModalOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className={styles.deferSubmitButton}
                  onClick={handleSaveDeferredThought}
                >
                  отправить в галерею
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

export default SessionHeader;
