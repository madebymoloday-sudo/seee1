import { useState, useMemo } from "react";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { useSessions } from "@/hooks/useSessions";
import { Plus, Search, Filter } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import SessionFolder from "./components/SessionFolder";
import SessionsNavigation from "./components/SessionsNavigation";
import styles from "./SessionsPage.module.css";

type SortOption = "default" | "negative" | "positive" | "toExplore";

const SessionsPage = observer(() => {
  const navigate = useNavigate();
  const { sessions, isLoading, error } = useSessions();
  const { trigger: createSession, isMutating } = useSessionsControllerCreateSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Убираем автоматическое создание сессии - пользователь сам создаст через кнопку

  const handleCreateSession = async () => {
    try {
      const newSession = await createSession({});
      if (newSession) {
        navigate(`/sessions/${newSession.id}`);
      }
    } catch (error) {
      console.error("Ошибка создания сессии:", error);
    }
  };

  // Фильтрация и поиск сессий
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;

    // Поиск по названию, словам в сессии или убеждениям
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((session) => {
        const titleMatch = session.title?.toLowerCase().includes(query);
        // TODO: Добавить поиск по содержимому сообщений и убеждениям когда будет API
        return titleMatch;
      });
    }

    // Сортировка
    if (sortOption === "negative") {
      // TODO: Сортировка по негативным установкам (когда будет API)
      filtered = [...filtered].reverse();
    } else if (sortOption === "positive") {
      // TODO: Сортировка по позитивным установкам (когда будет API)
      filtered = [...filtered];
    } else if (sortOption === "toExplore") {
      // TODO: Сортировка "предстоит исследовать" (когда будет API)
      filtered = [...filtered];
    }

    return filtered;
  }, [sessions, searchQuery, sortOption]);

  return (
    <div className={styles.sessionsPage}>
      {/* Заголовок */}
      <div className={styles.header}>
        <h1 className={styles.title}>Моя коллекция</h1>
        <button
          onClick={handleCreateSession}
          className={styles.newSessionButton}
          disabled={isMutating}
          title="Новая сессия"
        >
          <Plus className={styles.plusIcon} />
        </button>
      </div>

      {/* Поиск и фильтр */}
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск сессии..."
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterWrapper}>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={styles.filterButton}
            title="Регулировка"
          >
            <Filter className={styles.filterIcon} />
          </button>
          {isFilterOpen && (
            <div className={styles.filterDropdown}>
              <button
                onClick={() => {
                  setSortOption("negative");
                  setIsFilterOpen(false);
                }}
                className={styles.filterOption}
              >
                Сначала Негативные установки
              </button>
              <button
                onClick={() => {
                  setSortOption("positive");
                  setIsFilterOpen(false);
                }}
                className={styles.filterOption}
              >
                Сначала Позитивные
              </button>
              <button
                onClick={() => {
                  setSortOption("toExplore");
                  setIsFilterOpen(false);
                }}
                className={styles.filterOption}
              >
                Предстоит исследовать
              </button>
              <button
                onClick={() => {
                  setSortOption("default");
                  setIsFilterOpen(false);
                }}
                className={styles.filterOption}
              >
                По умолчанию
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Список папок */}
      <div className={styles.foldersContainer}>
        {isLoading && (
          <div className={styles.loadingState}>
            <p>Загрузка сессий...</p>
          </div>
        )}

        {error !== undefined && error !== null && (
          <div className={styles.errorState}>
            <p>Ошибка загрузки сессий</p>
          </div>
        )}

        {!isLoading && !error && filteredAndSortedSessions.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              {searchQuery ? "Сессии не найдены" : "У вас пока нет сессий"}
            </p>
            <p className={styles.emptyText}>
              {searchQuery
                ? "Попробуйте изменить поисковый запрос"
                : "Создайте новую сессию, чтобы начать работу"}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredAndSortedSessions.length > 0 && (
          <div className={styles.foldersList}>
            {filteredAndSortedSessions.map((session, index) => (
              <SessionFolder
                key={session.id}
                session={session}
                colorIndex={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Нижняя панель навигации */}
      <SessionsNavigation />
    </div>
  );
});

export default SessionsPage;
