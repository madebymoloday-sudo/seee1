import { observer } from "mobx-react-lite";
import { MessageSquare, Edit2, Pause, Save, List, Plus, Trash2 } from "lucide-react";
import apiAgent from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { SessionResponseDto } from "@/api/schemas";
import { getAllPipelines } from "@/api/pipeline.api";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { toast } from "sonner";
import PauseSessionModal from "./PauseSessionModal";
import styles from "./SessionHeader.module.css";

interface SessionHeaderProps {
  session: SessionResponseDto;
}

const SessionHeader = observer(({ session }: SessionHeaderProps) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const isAdmin = (auth.user as { role?: string } | null)?.role === 'admin';
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();

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


  // Автоматическая установка дефолтной программы для не-админов
  useEffect(() => {
    const setupDefaultProgram = async () => {
      // Только для не-админов устанавливаем дефолтную программу автоматически
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
  }, [session.id, isAdmin]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const newTitle = prompt("Введите новое название сессии:", session.title || "Без названия");
    if (newTitle !== null && newTitle.trim()) {
      // TODO: Добавить API вызов для переименования
      toast.info("Функция переименования будет добавлена");
    }
    setIsMenuOpen(false);
  };

  const handlePause = () => {
    setIsPauseModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
    setIsMenuOpen(false);
  };

  const confirmDelete = async () => {
    try {
      await apiAgent.delete(`/sessions/${session.id}`);
      toast.success("Сессия удалена");
      
      // Создаём новую сессию
      try {
        const newSession = await createSession({});
        if (newSession) {
          navigate(`/sessions/${newSession.id}`);
        } else {
          navigate("/sessions");
        }
      } catch (error) {
        console.error("Ошибка создания новой сессии:", error);
        navigate("/sessions");
      }
    } catch (error: any) {
      console.error("Ошибка удаления сессии:", error);
      toast.error(error.response?.data?.message || "Ошибка удаления сессии");
    } finally {
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleSave = () => {
    handleDownloadDocument();
    setIsMenuOpen(false);
  };

  const handleAllSessions = () => {
    navigate("/sessions");
    setIsMenuOpen(false);
  };

  const handleNewSession = async () => {
    try {
      const newSession = await createSession({});
      if (newSession) {
        navigate(`/sessions/${newSession.id}`);
      }
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Ошибка создания сессии:", error);
      toast.error("Не удалось создать новую сессию");
      setIsMenuOpen(false);
    }
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
          >
            <MessageSquare className={styles.icon} />
            <h2 className={styles.sessionTitle}>
              {session.title || "Без названия"}
            </h2>
          </button>

          {/* Выпадающее меню */}
          {isMenuOpen && (
            <div className={styles.dropdownMenu}>
              <button onClick={handleNewSession} className={styles.menuItem} disabled={isMutating}>
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
                Список сессий
              </button>
              <button onClick={handleDelete} className={`${styles.menuItem} ${styles.deleteItem}`}>
                <Trash2 className={styles.menuIcon} />
                Удалить сессию
              </button>
            </div>
          )}
        </div>
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
    </div>
  );
});

export default SessionHeader;

