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

const SessionsCollectionPage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading, error } = useSessions();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

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
        // TODO: Добавить API вызов для переименования
        toast.info("Функция переименования будет добавлена");
      }
    }
  };

  const handleSave = async (_sessionId?: string) => {
    try {
      // TODO: Реализовать сохранение сессии
      toast.success("Сессия сохранена");
    } catch (error) {
      toast.error("Ошибка сохранения сессии");
    }
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
                onSave={() => handleSave(session.id)}
                onNewSession={handleCreateSession}
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
    </div>
  );
});

export default SessionsCollectionPage;
