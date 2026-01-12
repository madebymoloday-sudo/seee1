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
      const newTitle = prompt("Введите новое название сессии:", session.title || "Без названия");
      if (newTitle !== null && newTitle.trim()) {
        // TODO: Добавить API вызов для переименования
        toast.info("Функция переименования будет добавлена");
      }
    }
  };

  const handleSave = async (sessionId: string) => {
    try {
      // TODO: Реализовать сохранение сессии
      toast.success("Сессия сохранена");
    } catch (error) {
      toast.error("Ошибка сохранения сессии");
    }
  };

  // Подсчёт количества идей (пока заглушка)
  const getIdeasCount = (sessionId: string) => {
    // TODO: Получить реальное количество идей из API
    return Math.floor(Math.random() * 100);
  };

  return (
    <div className={styles.collectionPage}>
      {/* Заголовок */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1 className={styles.title}>Моя коллекция</h1>
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
        
        {error && (
          <div className={styles.errorState}>
            <p>Ошибка загрузки сессий</p>
          </div>
        )}
        
        {!isLoading && !error && filteredAndSortedSessions.length === 0 && (
          <div className={styles.emptyState}>
            <p>Сессии не найдены</p>
            {searchQuery && (
              <p className={styles.emptyHint}>Попробуйте изменить поисковый запрос</p>
            )}
          </div>
        )}
        
        {!isLoading && !error && filteredAndSortedSessions.length > 0 && (
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
