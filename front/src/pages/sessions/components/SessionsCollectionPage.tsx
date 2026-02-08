import { useState, useMemo, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
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
import type { SessionResponseDto } from "@/api/schemas";

type SortOption = "default" | "negative" | "positive" | "to_explore";

const TO_EXPLORE_TITLES = [
  "Со мной что-то не так",
  "Ревность",
  "Порядок",
  "Со мной всё в порядке",
  "Проблемы с алкоголем",
  "Постоянно смотрю сериалы",
  "Хочу бросить курить",
  "Проблемы со сном",
  "Отношения с родителями",
  "Неуверенность в себе",
] as const;

type ToExploreTemplate = { id: string; title: string };

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserKey(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const payload = decodeJwtPayload(token);
      const sub = payload?.sub ?? payload?.id ?? payload?.userId;
      if (sub) return String(sub);
    }
  } catch {
    // ignore
  }
  return "anon";
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function loadToExploreTemplates(userKey: string): ToExploreTemplate[] {
  try {
    const raw = localStorage.getItem(`seee_to_explore_templates:${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({ id: String(x?.id ?? ""), title: String(x?.title ?? "") }))
      .filter((x) => x.id && x.title);
  } catch {
    return [];
  }
}

function saveToExploreTemplates(userKey: string, items: ToExploreTemplate[]) {
  try {
    localStorage.setItem(`seee_to_explore_templates:${userKey}`, JSON.stringify(items));
  } catch {
    // ignore
  }
}

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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const userKey = useMemo(() => getUserKey(), []);
  const [toExplore, setToExplore] = useState<ToExploreTemplate[]>(() => loadToExploreTemplates(userKey));

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

  // Seed "Предстоит исследовать" один раз на пользователя.
  useEffect(() => {
    const existing = loadToExploreTemplates(userKey);
    if (existing.length > 0) {
      setToExplore(existing);
      return;
    }
    const seeded: ToExploreTemplate[] = TO_EXPLORE_TITLES.map((title) => ({
      id: `to_explore:${slugify(title)}`,
      title,
    }));
    saveToExploreTemplates(userKey, seeded);
    setToExplore(seeded);
  }, [userKey]);

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
      // В режиме "предстоит исследовать" скрываем основной список
      filtered = [];
    }

    return filtered;
  }, [sessions, searchQuery, sortOption]);

  const handleCreateSession = async () => {
    try {
      // Не создаём пустую сессию на сервере заранее.
      navigate("/sessions/new");
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

  const getIdeasCountForSession = (session: SessionResponseDto) => {
    const fromLocal = getIdeasCountFromLocalState(session.id);
    const base = typeof session.messageCount === "number" ? session.messageCount : 0;
    const total = Math.max(fromLocal, base);
    // Если у сессии есть название — считаем, что 1 идея/концепция есть всегда.
    if ((session.title ?? "").trim().length > 0) return Math.max(1, total);
    return total;
  };

  const filteredToExplore = useMemo(() => {
    if (!searchQuery.trim()) return toExplore;
    const q = searchQuery.toLowerCase();
    return toExplore.filter((t) => t.title.toLowerCase().includes(q));
  }, [toExplore, searchQuery]);

  const openToExploreTemplate = (template: ToExploreTemplate) => {
    try {
      localStorage.setItem(`seee_draft_title:${userKey}`, template.title);
      localStorage.setItem(`seee_draft_to_explore_template:${userKey}`, template.id);
    } catch {
      // ignore
    }
    navigate("/sessions/new");
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
        {/* Предстоит исследовать */}
        {filteredToExplore.length > 0 && (
          <div className="mb-6">
            <div className="px-1 pb-3 text-sm font-semibold text-white/80">
              Предстоит исследовать
            </div>
            <div className={styles.foldersList}>
              {filteredToExplore.map((t) => {
                const fakeSession = {
                  id: t.id,
                  title: t.title,
                  createdAt: new Date().toISOString(),
                  messageCount: 0,
                } as unknown as SessionResponseDto;

                return (
                  <SessionFolderCard
                    key={t.id}
                    session={fakeSession}
                    ideasCount={1}
                    tagLabel="Предстоит исследовать"
                    palette="toExplore"
                    showMenu={false}
                    onOpen={() => openToExploreTemplate(t)}
                  />
                );
              })}
            </div>
          </div>
        )}

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
                ideasCount={getIdeasCountForSession(session)}
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
