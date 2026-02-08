import { useState, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { useSessions } from "@/hooks/useSessions";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SessionFolderCard from "./SessionFolderCard";
import BottomNavigation from "./BottomNavigation";
import NotesModal from "./NotesModal";
import FeedbackModal from "./FeedbackModal";
import styles from "./SessionsCollectionPage.module.css";
import { toast } from "sonner";
import apiAgent from "@/lib/api";
import useSwr from "swr";
import { Textarea } from "@/components/ui/textarea";

type SortOption = "default" | "negative" | "positive" | "to_explore";

function parseImportantOptions(text: string): string[] {
  const raw = (text || "")
    .split(/\r?\n|;|•|\u2022|,|—|-|\*/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^\d+[\)\.\-]\s*/, "").trim())
    .filter((s) => s.length >= 2);

  const unique: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (!unique.some((x) => x.toLowerCase() === key)) unique.push(item);
    if (unique.length >= 16) break;
  }
  return unique;
}

function getIdeasCountFromLocalState(sessionId: string): number {
  try {
    const raw = localStorage.getItem(`seee_step_dialog_state:${sessionId}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { v?: number; answers?: Record<string, string> };
    const answers = parsed?.v === 2 ? parsed.answers || {} : {};

    const answer3 =
      answers["core:situation:3"] || answers["core:thought:3"] || "";
    const answer4 =
      answers["core:situation:4"] || answers["core:thought:4"] || "";

    let count = 0;
    if (answer3.trim()) count += 1;
    count += parseImportantOptions(answer4).length;
    return count;
  } catch {
    return 0;
  }
}

function getIdeasFromLocalState(sessionId: string): { coreThought?: string; importantIdeas: string[] } {
  try {
    const raw = localStorage.getItem(`seee_step_dialog_state:${sessionId}`);
    if (!raw) return { importantIdeas: [] };
    const parsed = JSON.parse(raw) as { v?: number; answers?: Record<string, string> };
    const answers = parsed?.v === 2 ? parsed.answers || {} : {};

    const coreThought =
      (answers["core:situation:3"] || answers["core:thought:3"] || "").trim() || undefined;
    const answer4 =
      answers["core:situation:4"] || answers["core:thought:4"] || "";
    const importantIdeas = parseImportantOptions(answer4);
    return { coreThought, importantIdeas };
  } catch {
    return { importantIdeas: [] };
  }
}

const SessionsCollectionPage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading, error, refetch } = useSessions();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const [feedbackInfoSessionId, setFeedbackInfoSessionId] = useState<string | null>(null);
  const [ideasInfoSessionId, setIdeasInfoSessionId] = useState<string | null>(null);

  type FeedbackItem = {
    id: string;
    sessionId?: string | null;
    title?: string | null;
    description: string;
    createdAt: string;
    updatedAt: string;
  };

  const fetchMyFeedback = (url: string) => apiAgent.get<FeedbackItem[]>(url);
  const { data: myFeedback } = useSwr<FeedbackItem[]>(
    "/feedback/my?sessionOnly=1",
    fetchMyFeedback
  );

  // Фильтрация и поиск сессий
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;

    // Поиск по названию, содержанию или убеждениям
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter((session) => {
        const titleMatch = session.title?.toLowerCase().includes(query);
        // TODO: Добавить поиск по содержанию и убеждениям, когда будет доступно
        return titleMatch;
      });
    }

    // Сортировка
    if (sortOption === "negative") {
      // TODO: Сортировка по негативным установкам (когда будет доступно)
      filtered = [...filtered];
    } else if (sortOption === "positive") {
      // TODO: Сортировка по позитивным установкам (когда будет доступно)
      filtered = [...filtered];
    } else if (sortOption === "to_explore") {
      // TODO: Сортировка "предстоит исследовать" (когда будет доступно)
      filtered = [...filtered];
    }

    return filtered;
  }, [sessions, searchQuery, sortOption]);

  const handleCreateSession = async () => {
    try {
      const newSession = await createSession({});
      if (newSession) {
        navigate(`/sessions/${newSession.id}`);
      }
    } catch (error) {
      console.error("Ошибка создания сессии:", error);
      toast.error("Не удалось создать сессию");
    }
  };

  const handleRename = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const newTitle = prompt("Введите новое название сессии:", session.title || "Новая сессия");
      if (newTitle !== null && newTitle.trim()) {
        (async () => {
          try {
            await apiAgent.patch(`/sessions/${sessionId}`, { title: newTitle.trim() });
            toast.success("Название сессии обновлено");
            await refetch();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Не удалось переименовать сессию");
          }
        })();
      }
    }
  };

  const handleDelete = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const title = session?.title || "Новая сессия";
    if (!window.confirm(`Удалить сессию "${title}"?`)) return;
    (async () => {
      try {
        await apiAgent.delete(`/sessions/${sessionId}`);
        toast.success("Сессия удалена");
        await refetch();
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Не удалось удалить сессию");
      }
    })();
  };

  const getIdeasCount = (sessionId?: string) => {
    if (!sessionId) return 0;
    return getIdeasCountFromLocalState(sessionId);
  };

  return (
    <div className={styles.collectionPage}>
      {/* Заголовок */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1 className={styles.title}>Сессии</h1>
          <Button
            onClick={handleCreateSession}
            className={styles.plusButton}
            size="icon"
            disabled={isMutating}
            title="Новая сессия"
          >
            <Plus className={styles.plusIcon} />
          </Button>
        </div>

        {/* Поиск и сортировка */}
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <Input
              type="text"
              placeholder="Поиск сессии"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
          <div className={styles.sortWrapper}>
            <Button
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className={styles.sortButton}
              size="icon"
              variant="outline"
            >
              <SlidersHorizontal className={styles.sortIcon} />
            </Button>
            
            {isSortMenuOpen && (
              <div className={styles.sortMenu}>
                <button
                  onClick={() => {
                    setSortOption("negative");
                    setIsSortMenuOpen(false);
                  }}
                  className={`${styles.sortMenuItem} ${sortOption === "negative" ? styles.sortMenuItemActive : ""}`}
                >
                  Сначала Негативные установки
                </button>
                <button
                  onClick={() => {
                    setSortOption("positive");
                    setIsSortMenuOpen(false);
                  }}
                  className={`${styles.sortMenuItem} ${sortOption === "positive" ? styles.sortMenuItemActive : ""}`}
                >
                  Сначала Позитивные
                </button>
                <button
                  onClick={() => {
                    setSortOption("to_explore");
                    setIsSortMenuOpen(false);
                  }}
                  className={`${styles.sortMenuItem} ${sortOption === "to_explore" ? styles.sortMenuItemActive : ""}`}
                >
                  Предстоит исследовать
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Список папок */}
      <div className={styles.foldersContainer}>
        {isLoading && (
          <div className={styles.loadingState}>
            <p>Загрузка сессий...</p>
          </div>
        )}
        
        {error !== undefined && error !== null ? (
          <div className={styles.errorState}>
            <p>Ошибка загрузки сессий</p>
          </div>
        ) : null}
        
        {!isLoading && (error === undefined || error === null) && filteredAndSortedSessions.length === 0 && (
          <div className={styles.emptyState}>
            <p>Сессии не найдены</p>
            {searchQuery && (
              <p className={styles.emptyHint}>Попробуйте изменить поисковый запрос</p>
            )}
          </div>
        )}
        
        {!isLoading && (error === undefined || error === null) && filteredAndSortedSessions.length > 0 && (
          <div className={styles.foldersList}>
            {filteredAndSortedSessions.map((session, index) => (
              <SessionFolderCard
                key={session.id}
                session={session}
                colorIndex={index}
                onRename={() => handleRename(session.id)}
                onDelete={() => handleDelete(session.id)}
                onShowFeedback={() => setFeedbackInfoSessionId(session.id)}
                onShowIdeas={() => setIdeasInfoSessionId(session.id)}
                ideasCount={getIdeasCount(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Нижняя панель навигации */}
      <BottomNavigation
        onFeedback={() => setIsFeedbackOpen(true)}
        onCabinet={() => navigate("/cabinet")}
        onNotes={() => setIsNotesOpen(true)}
        onNewSession={handleCreateSession}
      />

      {/* Модальные окна */}
      <NotesModal isOpen={isNotesOpen} onClose={() => setIsNotesOpen(false)} />
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      {/* Инфо по обратной связи конкретной сессии */}
      {feedbackInfoSessionId && (
        <div
          className={styles.infoModalOverlay}
          onClick={() => setFeedbackInfoSessionId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoModalHeader}>
              <h3 className={styles.infoModalTitle}>Обратная связь по сессии</h3>
              <Button variant="outline" onClick={() => setFeedbackInfoSessionId(null)}>
                Закрыть
              </Button>
            </div>
            <div className={styles.infoModalBody}>
              {(() => {
                const list = (myFeedback || []).filter(
                  (f) => f.sessionId === feedbackInfoSessionId
                );
                if (list.length === 0) {
                  return (
                    <p className={styles.infoEmpty}>
                      Для этой сессии обратная связь отсутствует.
                    </p>
                  );
                }
                return (
                  <div className={styles.infoList}>
                    {list.map((f) => (
                      <div key={f.id} className={styles.infoItem}>
                        <div className={styles.infoItemTitle}>
                          {f.title?.trim() || "Отзыв"}
                        </div>
                        <Textarea value={f.description} readOnly rows={6} />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Инфо по идеям конкретной сессии */}
      {ideasInfoSessionId && (
        <div
          className={styles.infoModalOverlay}
          onClick={() => setIdeasInfoSessionId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoModalHeader}>
              <h3 className={styles.infoModalTitle}>Идеи из сессии</h3>
              <Button variant="outline" onClick={() => setIdeasInfoSessionId(null)}>
                Закрыть
              </Button>
            </div>
            <div className={styles.infoModalBody}>
              {(() => {
                const { coreThought, importantIdeas } = getIdeasFromLocalState(ideasInfoSessionId);
                if (!coreThought && importantIdeas.length === 0) {
                  return (
                    <p className={styles.infoEmpty}>
                      Для этой сессии пока нет сохранённых идей.
                    </p>
                  );
                }
                return (
                  <div className={styles.infoList}>
                    {coreThought && (
                      <div className={styles.infoItem}>
                        <div className={styles.infoItemTitle}>Мысль (шаг 3)</div>
                        <div className={styles.ideaChip}>{coreThought}</div>
                      </div>
                    )}
                    {importantIdeas.length > 0 && (
                      <div className={styles.infoItem}>
                        <div className={styles.infoItemTitle}>
                          Почему это важно (идеи)
                        </div>
                        <div className={styles.ideaGrid}>
                          {importantIdeas.map((x) => (
                            <div key={x} className={styles.ideaChip}>
                              {x}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SessionsCollectionPage;
