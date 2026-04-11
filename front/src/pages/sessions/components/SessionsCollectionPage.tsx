import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSessions } from "@/hooks/useSessions";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SessionFolderCard from "./SessionFolderCard";
import BottomNavigation from "./BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import styles from "./SessionsCollectionPage.module.css";
import { toast } from "sonner";
import apiAgent from "@/lib/api";
import useSwr from "swr";
import { Textarea } from "@/components/ui/textarea";
import type { SessionResponseDto } from "@/api/schemas";
import { parseImportantOptions, clearDraftSession } from "@/lib/sessionUtils";
import {
  buildArchivistSuggestedTemplateId,
  buildFallbackResumeMessage,
  buildFallbackWrapUpMessage,
  loadArchivistGalleryContext,
  saveArchivistGalleryContext,
  type ArchivistGalleryContext,
  type ArchivistSuggestedCard,
} from "@/lib/archivist";
import { getSessionCoinsEarned, saveDraftSessionReward } from "@/lib/gamification";

type SortOption = "my_sessions" | "to_explore" | "freedom" | "happiness" | "deferred" | "recommended";

type ToExploreCategory = "Освобождение" | "Улучшение +1" | "отложено на разбор";

const FREEDOM_AND_STABILITY_TITLES = [
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

const NEW_FREEDOM_AND_STABILITY_TITLES = [
  "Мои чувства никому не важны",
  "Если я злюсь — значит, я плохой человек",
  "Показывать грусть — это слабость",
  "Я не имею права бояться",
  "Если мне больно, значит, со мной что-то не так",
  "Я должен(на) всегда держать себя в руках",
  "Если я тревожусь, значит, я не справляюсь",
  "Меня отвергнут, если увидят мои настоящие эмоции",
  "Лучше молчать о чувствах, чтобы не быть обузой",
  "Мои эмоции мешают другим",
  "Если я расстроен(а), я непродуктивен(на) и бесполезен(на)",
  "Сначала результат — потом чувства",
  "Чтобы меня любили, нужно быть удобным(ой)",
  "Если я ошибся(лась), я недостоин(на) уважения",
  "Мне нельзя быть уязвимым(ой)",
  "Я должен(на) справляться со всем в одиночку",
  "Если я не контролирую всё, случится катастрофа",
  "Мир небезопасен, расслабляться нельзя",
  "Если я радуюсь, потом обязательно будет плохо",
  "Со мной что-то не так в самой основе",
] as const;

const GROWTH_AND_HAPPINESS_TITLES = [
  "Базовое принятие себя",
  "Самоценность",
  "Доверие к себе",
  "Достоинство",
  "Быть собой",
  "Признание чувств",
  "Экологичное выражение эмоций",
  "Самоподдержка",
  "Принятие в развитии",
  "Рост через опыт",
  "Внутренняя устойчивость",
  "Осознанное действие",
  "Жизнестойкость",
  "Ресурсность",
  "Поступательный рост",
  "Разрешение на успех",
  "Финансовая уверенность",
  "Открытость возможностям",
  "Созвучное окружение",
  "Поддерживающая среда",
  "Здоровые границы",
  "Право на отказ",
  "Право на отдых",
  "Баланс жизни",
  "Благодарность",
  "Признание достижений",
  "Фокус на решениях",
  "Отпускание лишнего",
  "Авторство своей жизни",
  "Внутренняя опора",
] as const;

const NEW_GROWTH_AND_HAPPINESS_TITLES = [
  "Мои чувства важны и заслуживают внимания",
  "Я могу быть собой и оставаться в безопасности",
  "Мне можно радоваться без чувства вины",
  "Я имею право на удовольствие и легкость",
  "Моя уязвимость — это сила, а не слабость",
  "Я могу проживать эмоции бережно и экологично",
  "Я достоин(на) любви просто потому, что я есть",
  "Со мной все в порядке",
  "Я доверяю себе и своим внутренним ощущениям",
  "Мне можно просить поддержку",
  "Я не обязан(а) быть идеальным(ой), чтобы быть ценным(ой)",
  "Я выбираю относиться к себе с теплом и уважением",
  "Я могу отпускать лишнее и чувствовать облегчение",
  "Я разрешаю себе отдыхать и восстанавливаться",
  "Я замечаю хорошее в своей жизни",
  "Я благодарен(на) за то, что у меня уже есть",
  "Я могу быть спокойным(ой), даже когда не все под контролем",
  "Я способен(на) справляться с трудностями шаг за шагом",
  "Я открыт(а) радости, близости и новым возможностям",
  "Я создаю жизнь, в которой есть место счастью",
] as const;

type ToExploreTemplate = { id: string; title: string; category: ToExploreCategory };
type ToExploreTemplateWithSession = ToExploreTemplate & { sourceSessionId?: string };
const SESSION_NOTES_PREFIX = "seee_session_notes:";

type ArchivistOption = {
  id: string;
  label: string;
  sessionId?: string;
  action:
    | "set_daily_5"
    | "set_daily_10"
    | "set_daily_15"
    | "intro"
    | "telegram"
    | "open_archive"
    | "new_session"
    | "open_people"
    | "custom_input"
    | "open_bot"
    | "telegram_done"
    | "continue_last_session"
    | "open_suggested_cards";
};

function describeDailyPracticeGoal(minutes: 5 | 10 | 15): string {
  if (minutes === 5) {
    return "Тогда твоя ежедневная задача — закрыть одну линию разбора: от формулировки мысли до развилки «разобраться глубже» или «решить ситуацию».";
  }
  if (minutes === 10) {
    return "Тогда твоя ежедневная задача — закрыть две линии разбора за день. После первой линии ты увидишь прогресс 50%, после второй задача закроется полностью.";
  }
  return "Тогда твоя ежедневная задача — закрыть три линии разбора за день. После первой линии будет 33%, после второй 66%, после третьей дневная цель закроется.";
}

type ArchivistInsightRequest = {
  sessionId?: string;
  sessionTitle: string;
  coinsEarned: number;
  answers?: Record<string, string>;
  thoughtScopes?: Record<string, Record<string, string>>;
  notes?: string;
};

type ArchivistInsightResponse = {
  wrapUpMessage: string;
  resumeMessage: string;
  suggestedCards: ArchivistSuggestedCard[];
};

const ARCHIVIST_WRAP_UP_WINDOW_MS = 60 * 60 * 1000;

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

function buildDefaultToExploreTemplates(): ToExploreTemplate[] {
  const freedomBase: ToExploreTemplate[] = FREEDOM_AND_STABILITY_TITLES.map((title) => ({
    // оставляем прежний формат id для обратной совместимости
    id: `to_explore:${slugify(title)}`,
    title,
    category: "Освобождение",
  }));
  const freedomNew: ToExploreTemplate[] = NEW_FREEDOM_AND_STABILITY_TITLES.map((title) => ({
    id: `to_explore:freedom:${slugify(title)}`,
    title,
    category: "Освобождение",
  }));
  const growth: ToExploreTemplate[] = GROWTH_AND_HAPPINESS_TITLES.map((title) => ({
    id: `to_explore:growth:${slugify(title)}`,
    title,
    category: "Улучшение +1",
  }));
  const growthNew: ToExploreTemplate[] = NEW_GROWTH_AND_HAPPINESS_TITLES.map((title) => ({
    id: `to_explore:growth:new:${slugify(title)}`,
    title,
    category: "Улучшение +1",
  }));
  return [...freedomBase, ...freedomNew, ...growth, ...growthNew];
}

function loadToExploreTemplates(userKey: string): ToExploreTemplateWithSession[] {
  try {
    const raw = localStorage.getItem(`seee_to_explore_templates:${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => {
        const category =
          String(x?.category ?? "").trim() === "Рост и счастье" ||
          String(x?.category ?? "").trim() === "Счастье" ||
          String(x?.category ?? "").trim() === "Улучшение +1"
            ? "Улучшение +1"
            : String(x?.category ?? "").trim().toLowerCase() === "отложено на разбор"
              ? "отложено на разбор"
            : "Освобождение";
        return {
          id: String(x?.id ?? ""),
          title: String(x?.title ?? ""),
          category,
          sourceSessionId: x?.sourceSessionId ? String(x.sourceSessionId) : undefined,
        } as ToExploreTemplateWithSession;
      })
      .filter((x) => x.id && x.title);
  } catch {
    return [];
  }
}

function saveToExploreTemplates(userKey: string, items: ToExploreTemplateWithSession[]) {
  try {
    localStorage.setItem(`seee_to_explore_templates:${userKey}`, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function loadMovedSessionIds(userKey: string): string[] {
  try {
    const raw = localStorage.getItem(`seee_moved_to_explore_sessions:${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

function saveMovedSessionIds(userKey: string, ids: string[]) {
  try {
    localStorage.setItem(`seee_moved_to_explore_sessions:${userKey}`, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

const STOP_WORDS = new Set([
  "и", "в", "во", "на", "не", "но", "а", "я", "мы", "вы", "он", "она", "они", "это", "как",
  "что", "чтобы", "когда", "если", "ли", "же", "бы", "у", "о", "об", "от", "до", "за", "по",
  "из", "под", "для", "с", "со", "над", "при", "или", "то", "так", "там", "тут", "уже", "еще",
  "ещё", "мой", "моя", "мое", "моё", "мои", "твой", "твоя", "его", "ее", "её", "их"
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateLabel(value: string, maxLength = 34): string {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";
  if (safeValue.length <= maxLength) return safeValue;
  return `${safeValue.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatCoinsBadgeLabel(amount: number): string {
  const safeAmount = Math.max(0, Math.floor(amount));
  return `+${safeAmount} 🪙`;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 3 && !STOP_WORDS.has(x));
}

function mergeArchivistSuggestedTemplates(
  existing: ToExploreTemplateWithSession[],
  sessionId: string,
  suggestedCards: ArchivistSuggestedCard[],
): { items: ToExploreTemplateWithSession[]; changed: boolean } {
  if (!sessionId || suggestedCards.length === 0) {
    return { items: existing, changed: false };
  }

  const titleKeys = new Set(existing.map((item) => normalizeText(item.title)));
  const items = [...existing];
  let changed = false;

  for (const card of suggestedCards) {
    const title = String(card.title || "").trim();
    if (!title) continue;

    const titleKey = normalizeText(title);
    if (!titleKey || titleKeys.has(titleKey)) continue;

    titleKeys.add(titleKey);
    items.unshift({
      id: buildArchivistSuggestedTemplateId(sessionId, title),
      title,
      category: card.category,
    });
    changed = true;
  }

  return { items, changed };
}

function readSessionAnalysisText(session: SessionResponseDto): string {
  const parts: string[] = [];
  if ((session.title ?? "").trim()) parts.push(session.title!.trim());

  try {
    const rawState = localStorage.getItem(`seee_step_dialog_state:${session.id}`);
    if (rawState) {
      const parsed = JSON.parse(rawState) as { answers?: Record<string, string> };
      const answers = parsed?.answers || {};
      for (const value of Object.values(answers)) {
        if ((value || "").trim()) parts.push(value.trim());
      }
    }
  } catch {
    // ignore malformed local state
  }

  try {
    const notes = localStorage.getItem(`${SESSION_NOTES_PREFIX}${session.id}`);
    if ((notes || "").trim()) parts.push((notes || "").trim());
  } catch {
    // ignore
  }

  return parts.join(" ");
}

function buildRecommendedTemplateIds(
  templates: ToExploreTemplateWithSession[],
  sessions: SessionResponseDto[]
): Set<string> {
  if (templates.length === 0 || sessions.length === 0) return new Set();

  const recentSessions = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 12);

  const corpusText = normalizeText(
    recentSessions.map((s) => readSessionAnalysisText(s)).join(" ")
  );
  if (corpusText.length < 20) return new Set();

  const corpusTokens = tokenize(corpusText);
  if (corpusTokens.length === 0) return new Set();

  const tokenFreq = new Map<string, number>();
  for (const t of corpusTokens) tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1);

  const distressMarkers = ["трев", "страх", "стыд", "боль", "вина", "зл", "контрол", "один", "отверг"];
  const growthMarkers = ["рост", "радост", "поддерж", "успех", "баланс", "довер", "ресурс", "опор"];
  const distressSignal = distressMarkers.some((m) => corpusText.includes(m));
  const growthSignal = growthMarkers.some((m) => corpusText.includes(m));

  const scored = templates.map((template) => {
    const titleTokens = tokenize(template.title);
    let score = 0;

    for (const token of titleTokens) {
      const exact = tokenFreq.get(token);
      if (exact) {
        score += 2 + Math.min(2, exact - 1);
        continue;
      }

      const stem = token.slice(0, 5);
      if (stem.length < 4) continue;
      const hasStem = corpusTokens.some(
        (ct) => ct.startsWith(stem) || stem.startsWith(ct.slice(0, 4))
      );
      if (hasStem) score += 1;
    }

    if (template.category === "Освобождение" && distressSignal) score += 1;
    if (template.category === "Улучшение +1" && growthSignal) score += 1;

    return { id: template.id, score };
  });

  const filtered = scored
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return new Set(filtered.map((x) => x.id));
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
  const [isArchivistWelcomeVisible, setIsArchivistWelcomeVisible] = useState(true);
  const [archivistMessage, setArchivistMessage] = useState(
    "Привет, меня зовут Архивариус. Я помогу тебе разобраться с приложением, напомню о важных шагах и подскажу, что у тебя уже сохранено в архиве."
  );
  const [archivistOptions, setArchivistOptions] = useState<ArchivistOption[]>([]);
  const [isArchivistCustomInputVisible, setIsArchivistCustomInputVisible] = useState(false);
  const [archivistDraft, setArchivistDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("my_sessions");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [sortMenuPosition, setSortMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const userKey = useMemo(() => getUserKey(), []);
  const [toExplore, setToExplore] = useState<ToExploreTemplateWithSession[]>(() => loadToExploreTemplates(userKey));
  const [movedSessionIds, setMovedSessionIds] = useState<string[]>(() => loadMovedSessionIds(userKey));
  const [archivistContext, setArchivistContext] = useState<ArchivistGalleryContext | null>(
    () => loadArchivistGalleryContext(userKey),
  );
  const [archivistMode, setArchivistMode] = useState<"auto" | "conversation">("auto");
  const [isArchivistInsightLoading, setIsArchivistInsightLoading] = useState(false);

  const [feedbackInfoSessionId, setFeedbackInfoSessionId] = useState<string | null>(null);
  const [ideasInfoSessionId, setIdeasInfoSessionId] = useState<string | null>(null);

  const { user } = useAuth();
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);

  useEffect(() => {
    setArchivistContext(loadArchivistGalleryContext(userKey));
  }, [userKey]);

  useEffect(() => {
    if (!user) return;
    if (!user.subscriptionActive) return;
    if (user.telegramId) return;
    try {
      const dismissed = localStorage.getItem(`seee_telegram_prompt_dismissed:${user.id}`);
      if (dismissed === "1") {
        setShowTelegramPrompt(false);
      } else {
        setShowTelegramPrompt(true);
      }
    } catch {
      setShowTelegramPrompt(true);
    }
  }, [user]);

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

  // Seed/migration "Предстоит изучить": старые карточки = "Свобода и устойчивость",
  // добавляем карточки "Рост и счастье".
  useEffect(() => {
    const existing = loadToExploreTemplates(userKey);
    if (existing.length === 0) {
      const seeded = buildDefaultToExploreTemplates();
      saveToExploreTemplates(userKey, seeded);
      setToExplore(seeded);
      return;
    }

    // Для существующих пользователей:
    // - добавляем "Рост и счастье";
    // - добавляем только новые карточки "Свобода и устойчивость" из отдельного списка;
    // - не возвращаем удалённые старые карточки из исходного набора.
    const withGrowth = [...existing];
    const existingIds = new Set(existing.map((x) => x.id));
    const additions = buildDefaultToExploreTemplates().filter(
      (x) =>
        x.category === "Улучшение +1" ||
        (x.category === "Освобождение" && x.id.startsWith("to_explore:freedom:"))
    );
    for (const item of additions) {
      if (!existingIds.has(item.id)) withGrowth.push(item);
    }
    saveToExploreTemplates(userKey, withGrowth);
    setToExplore(withGrowth);
  }, [userKey]);

  // Фильтрация и поиск сессий
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions.filter((session) => !movedSessionIds.includes(session.id));

    // Поиск по названию, содержанию или убеждениям
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((session) => {
        const titleMatch = session.title?.toLowerCase().includes(query);
        // TODO: Добавить поиск по содержанию и убеждениям, когда будет доступно
        return titleMatch;
      });
    }

    return [...filtered].sort((a, b) => {
      const left = Date.parse(b.updatedAt || b.createdAt || "");
      const right = Date.parse(a.updatedAt || a.createdAt || "");
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
        return left - right;
      }

      const createdLeft = Date.parse(b.createdAt || "");
      const createdRight = Date.parse(a.createdAt || "");
      if (
        Number.isFinite(createdLeft) &&
        Number.isFinite(createdRight) &&
        createdLeft !== createdRight
      ) {
        return createdLeft - createdRight;
      }

      return a.id.localeCompare(b.id);
    });
  }, [sessions, searchQuery, movedSessionIds]);

  const handleCreateSession = async () => {
    try {
      // Очищаем черновик, чтобы новая сессия начиналась с чистого листа
      clearDraftSession(getUserKey());
      navigate("/sessions/new");
    } catch (error) {
      console.error("Ошибка создания сессии:", error);
      toast.error("Не удалось создать сессию");
    }
  };

  const handleOpenArchiveGallery = () => {
    setIsArchivistWelcomeVisible(false);
  };

  const closeSortMenu = () => {
    setIsSortMenuOpen(false);
    setSortMenuPosition(null);
  };

  const updateSortMenuPosition = () => {
    const button = sortButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setSortMenuPosition({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  const toggleSortMenu = () => {
    if (isSortMenuOpen) {
      closeSortMenu();
      return;
    }
    updateSortMenuPosition();
    setIsSortMenuOpen(true);
  };

  useEffect(() => {
    if (!isSortMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (sortMenuRef.current?.contains(target)) return;
      if (sortButtonRef.current?.contains(target)) return;
      closeSortMenu();
    };
    const onLayoutChange = () => updateSortMenuPosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [isSortMenuOpen]);

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
        const nextMoved = movedSessionIds.filter((id) => id !== sessionId);
        setMovedSessionIds(nextMoved);
        saveMovedSessionIds(userKey, nextMoved);
        toast.success("Сессия удалена");
        await refetch();
      } catch (e: any) {
        toast.error(e?.response?.data?.message || "Не удалось удалить сессию");
      }
    })();
  };

  const handleMoveToExplore = (session: SessionResponseDto) => {
    const movedId = session.id;
    const templateId = `to_explore:moved:${movedId}`;
    const movedTemplate: ToExploreTemplateWithSession = {
      id: templateId,
      title: (session.title || "Новая сессия").trim() || "Новая сессия",
      category: "Освобождение",
      sourceSessionId: movedId,
    };

    const nextTemplates = toExplore.some((x) => x.id === templateId)
      ? toExplore
      : [...toExplore, movedTemplate];
    setToExplore(nextTemplates);
    saveToExploreTemplates(userKey, nextTemplates);

    const nextMoved = movedSessionIds.includes(movedId)
      ? movedSessionIds
      : [...movedSessionIds, movedId];
    setMovedSessionIds(nextMoved);
    saveMovedSessionIds(userKey, nextMoved);

    toast.success("Карточка перенесена в «Предстоит изучить»");
  };

  const recommendedTemplateIds = useMemo(
    () => buildRecommendedTemplateIds(toExplore, sessions),
    [toExplore, sessions]
  );

  const shuffledToExplore = useMemo(() => {
    const hash = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    return [...toExplore].sort(
      (a, b) => hash(`${userKey}:${a.id}`) - hash(`${userKey}:${b.id}`)
    );
  }, [toExplore, userKey]);

  const filteredToExplore = useMemo(() => {
    let list = shuffledToExplore;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      );
    }

    if (sortOption === "freedom") {
      const selected = list.filter((t) => t.category === "Освобождение");
      const rest = list.filter((t) => t.category !== "Освобождение");
      return [...selected, ...rest];
    }
    if (sortOption === "happiness") {
      const selected = list.filter((t) => t.category === "Улучшение +1");
      const rest = list.filter((t) => t.category !== "Улучшение +1");
      return [...selected, ...rest];
    }
    if (sortOption === "deferred") {
      const selected = list.filter((t) => t.category === "отложено на разбор");
      const rest = list.filter((t) => t.category !== "отложено на разбор");
      return [...selected, ...rest];
    }
    if (sortOption === "recommended") return list.filter((t) => recommendedTemplateIds.has(t.id));
    return list;
  }, [shuffledToExplore, searchQuery, sortOption, recommendedTemplateIds]);

  const openToExploreTemplate = (
    template: ToExploreTemplateWithSession,
    options?: { rewardCoins?: number },
  ) => {
    if (template.sourceSessionId) {
      navigate(`/sessions/${template.sourceSessionId}`);
      return;
    }
    try {
      localStorage.setItem(`seee_draft_title:${userKey}`, template.title);
      localStorage.setItem(`seee_draft_to_explore_template:${userKey}`, template.id);
      localStorage.setItem(`seee_draft_to_explore_category:${userKey}`, template.category);
      saveDraftSessionReward(
        options?.rewardCoins && options.rewardCoins > 0
          ? {
              id: `recommended:first-pass:${template.id}`,
              amount: options.rewardCoins,
              templateId: template.id,
              reason: "recommended_first_pass",
            }
          : null,
        userKey,
      );
    } catch {
      // ignore
    }
    navigate("/sessions/new");
  };

  type GalleryCardItem =
    | { kind: "session"; session: SessionResponseDto }
    | { kind: "template"; template: ToExploreTemplateWithSession };

  const combinedCards = useMemo<GalleryCardItem[]>(() => {
    const sessionItems: GalleryCardItem[] = filteredAndSortedSessions.map((session) => ({
      kind: "session",
      session,
    }));
    const templateItems: GalleryCardItem[] = filteredToExplore.map((template) => ({
      kind: "template",
      template,
    }));

    // Всегда один длинный список всех карточек.
    // Сортировка лишь определяет приоритет блока.
    if (
      sortOption === "to_explore" ||
      sortOption === "freedom" ||
      sortOption === "happiness" ||
      sortOption === "deferred" ||
      sortOption === "recommended"
    ) {
      return [...templateItems, ...sessionItems];
    }
    return [...sessionItems, ...templateItems];
  }, [filteredAndSortedSessions, filteredToExplore, sortOption]);

  const buildArchivistRootOptions = (): ArchivistOption[] => {
    const options: ArchivistOption[] = [
      {
        id: "intro",
        label: "Разобраться, как работает приложение",
        action: "intro",
      },
    ];

    if (user && !user.telegramId) {
      options.push({
        id: "telegram",
        label: "Привязать Telegram",
        action: "telegram",
      });
    } else {
      options.push({
        id: "archive",
        label: "Открыть архив сессий",
        action: "open_archive",
      });
    }

    options.push({
      id: "custom",
      label: "Написать ответ самостоятельно",
      action: "custom_input",
    });

    return options;
  };

  const buildArchivistContextOptions = (
    context: ArchivistGalleryContext,
  ): ArchivistOption[] => {
    const options: ArchivistOption[] = [];

    if (context.sessionId) {
      options.push({
        id: "continue_last_session",
        label: `Продолжить «${truncateLabel(context.sessionTitle || "последнюю сессию", 30)}»`,
        action: "continue_last_session",
        sessionId: context.sessionId,
      });
    }

    if (context.suggestedCards.length > 0) {
      options.push({
        id: "open_suggested_cards",
        label: `Посмотреть новые карточки (${context.suggestedCards.length})`,
        action: "open_suggested_cards",
      });
    } else {
      options.push({
        id: "archive_from_context",
        label: "Открыть архив сессий",
        action: "open_archive",
      });
    }

    options.push({
      id: "custom_from_context",
      label: "Написать ответ самостоятельно",
      action: "custom_input",
    });

    return options;
  };

  const buildAutoArchivistState = (
    overrideContext?: ArchivistGalleryContext | null,
  ): { message: string; options: ArchivistOption[]; consumeContext?: ArchivistGalleryContext } => {
    if (!user?.dailyPracticeMinutes) {
      return {
        message:
          "Сначала скажи, сколько минут в день ты хочешь тратить на приложение. От этого будет зависеть твоя ежедневная задача и счётчик прогресса.",
        options: [
          { id: "daily_5", label: "5 минут в день", action: "set_daily_5" },
          { id: "daily_10", label: "10 минут в день", action: "set_daily_10" },
          { id: "daily_15", label: "15 минут в день", action: "set_daily_15" },
        ],
      };
    }

    const effectiveContext =
      overrideContext ?? archivistContext ?? loadArchivistGalleryContext(userKey);

    if (effectiveContext) {
      const ageMs = Date.now() - new Date(effectiveContext.lastSessionAt).getTime();
      const shouldShowWrapUp =
        effectiveContext.pendingWrapUp && ageMs <= ARCHIVIST_WRAP_UP_WINDOW_MS;

      if (effectiveContext.status === "pending" || isArchivistInsightLoading) {
        return {
          message:
            "Секунду, я собираю для тебя короткий итог последней сессии и подбираю новые карточки, которые могут пригодиться дальше.",
          options: buildArchivistContextOptions(effectiveContext),
        };
      }

      return {
        message: shouldShowWrapUp
          ? effectiveContext.wrapUpMessage?.trim() ||
            buildFallbackWrapUpMessage(effectiveContext)
          : effectiveContext.resumeMessage?.trim() ||
            buildFallbackResumeMessage(effectiveContext),
        options: buildArchivistContextOptions(effectiveContext),
        consumeContext: effectiveContext.pendingWrapUp
          ? effectiveContext
          : undefined,
      };
    }

    const latestSession = sessions[0];
    if (latestSession) {
      const latestTitle = (latestSession.title || "последняя сессия").trim();
      return {
        message:
          toExplore.length > 0
            ? `Привет. Последнее, что ты разбирал(а), это «${latestTitle}». У тебя ещё есть ${toExplore.length} карточ${toExplore.length === 1 ? "ка" : toExplore.length > 1 && toExplore.length < 5 ? "ки" : "ек"} на продолжение, так что я бы рекомендовал либо вернуться к этой сессии, либо открыть архив и взять следующую тему.`
            : `Привет. Последнее, что ты разбирал(а), это «${latestTitle}». Я бы рекомендовал вернуться к этой сессии и продолжить разбор, если хочешь.`,
        options: [
          {
            id: "continue_latest_session",
            label: `Продолжить «${truncateLabel(latestTitle, 30)}»`,
            action: "continue_last_session",
            sessionId: latestSession.id,
          },
          {
            id: "open_archive_latest",
            label: "Открыть архив сессий",
            action: "open_archive",
          },
          {
            id: "custom_latest",
            label: "Написать ответ самостоятельно",
            action: "custom_input",
          },
        ],
      };
    }

    return {
      message:
        "Привет, меня зовут Архивариус. Я помогу тебе разобраться с приложением, напомню о важных шагах и подскажу, что у тебя уже сохранено в архиве.",
      options: buildArchivistRootOptions(),
    };
  };

  const applyAutoArchivistState = (overrideContext?: ArchivistGalleryContext | null) => {
    const nextState = buildAutoArchivistState(overrideContext);
    setArchivistMessage(nextState.message);
    setArchivistOptions(nextState.options);
    setArchivistDraft("");
    setIsArchivistCustomInputVisible(false);

    if (nextState.consumeContext) {
      saveArchivistGalleryContext(
        {
          ...nextState.consumeContext,
          pendingWrapUp: false,
        },
        userKey,
      );
    }
  };

  const resetArchivistConversation = () => {
    setArchivistMode("auto");
    const latestContext = loadArchivistGalleryContext(userKey);
    if (latestContext) {
      setArchivistContext(latestContext);
      applyAutoArchivistState(latestContext);
      return;
    }
    applyAutoArchivistState(null);
  };

  useEffect(() => {
    if (archivistMode === "auto") {
      applyAutoArchivistState();
    }
  }, [archivistContext, archivistMode, sessions, toExplore, user?.telegramId, user?.dailyPracticeMinutes, isArchivistInsightLoading]);

  useEffect(() => {
    if (!archivistContext || archivistContext.status !== "pending" || !archivistContext.snapshot) {
      return;
    }

    let cancelled = false;

    const hydrateArchivistInsight = async () => {
      setIsArchivistInsightLoading(true);

      try {
        const payload: ArchivistInsightRequest = {
          sessionId: archivistContext.sessionId,
          sessionTitle: archivistContext.sessionTitle,
          coinsEarned: archivistContext.coinsEarned,
          answers: archivistContext.snapshot?.answers,
          thoughtScopes: archivistContext.snapshot?.thoughtScopes,
          notes: archivistContext.snapshot?.notes,
        };

        const response = await apiAgent.post<
          ArchivistInsightRequest,
          ArchivistInsightResponse
        >("/psychologist/archivist-insight", payload);

        if (cancelled) return;

        const nextContext: ArchivistGalleryContext = {
          ...archivistContext,
          status: "ready",
          wrapUpMessage: String(response.wrapUpMessage || "").trim(),
          resumeMessage: String(response.resumeMessage || "").trim(),
          suggestedCards: Array.isArray(response.suggestedCards)
            ? response.suggestedCards
            : [],
        };

        saveArchivistGalleryContext(nextContext, userKey);
        setArchivistContext(nextContext);
      } catch (error) {
        if (cancelled) return;

        const fallbackContext: ArchivistGalleryContext = {
          ...archivistContext,
          status: "ready",
          wrapUpMessage: buildFallbackWrapUpMessage(archivistContext),
          resumeMessage: buildFallbackResumeMessage(archivistContext),
          suggestedCards: [],
        };

        saveArchivistGalleryContext(fallbackContext, userKey);
        setArchivistContext(fallbackContext);
      } finally {
        if (!cancelled) {
          setIsArchivistInsightLoading(false);
        }
      }
    };

    hydrateArchivistInsight();

    return () => {
      cancelled = true;
    };
  }, [archivistContext, userKey]);

  useEffect(() => {
    if (!archivistContext || archivistContext.suggestedCards.length === 0) return;

    const merged = mergeArchivistSuggestedTemplates(
      toExplore,
      archivistContext.sessionId,
      archivistContext.suggestedCards,
    );

    if (!merged.changed) return;

    setToExplore(merged.items);
    saveToExploreTemplates(userKey, merged.items);
  }, [archivistContext, toExplore, userKey]);

  const handleArchivistOption = (option: ArchivistOption) => {
    setArchivistMode("conversation");
    setIsArchivistCustomInputVisible(false);

    if (
      option.action === "set_daily_5" ||
      option.action === "set_daily_10" ||
      option.action === "set_daily_15"
    ) {
      const minutes = option.action === "set_daily_5" ? 5 : option.action === "set_daily_10" ? 10 : 15;
      (async () => {
        try {
          await apiAgent.patch("/auth/me", { dailyPracticeMinutes: minutes });
          if (user) {
            user.dailyPracticeMinutes = minutes;
          }
          setArchivistMessage(
            `${describeDailyPracticeGoal(minutes)} Я буду показывать прогресс дня, когда ты доведёшь линию до развилки, а потом подскажу, что делать дальше в приложении.`
          );
          setArchivistOptions([
            { id: "intro_after_daily", label: "Понял, показать как всё работает", action: "intro" },
            { id: "archive_after_daily", label: "Открыть архив сессий", action: "open_archive" },
            { id: "new_after_daily", label: "Создать новую сессию", action: "new_session" },
          ]);
        } catch (error: any) {
          toast.error(error?.response?.data?.message || "Не удалось сохранить ежедневную цель");
        }
      })();
      return;
    }

    if (option.action === "intro") {
      const sessionsCount = sessions.length;
      const exploreCount = toExplore.length;
      setArchivistMessage(
        `${user?.dailyPracticeMinutes ? `${describeDailyPracticeGoal(user.dailyPracticeMinutes)} ` : ""}Сейчас у тебя ${sessionsCount} ${
          sessionsCount === 1 ? "сессия" : sessionsCount < 5 && sessionsCount > 1 ? "сессии" : "сессий"
        } в архиве и ${exploreCount} карточ${
          exploreCount === 1 ? "ка" : exploreCount < 5 && exploreCount > 1 ? "ки" : "ек"
        } для разбора. Можем открыть архив, создать новую сессию или ты можешь спросить меня о приложении своим текстом.`
      );
      setArchivistOptions([
        { id: "new_session", label: "Создать новую сессию", action: "new_session" },
        { id: "open_archive_after_intro", label: "Открыть архив сессий", action: "open_archive" },
        { id: "custom_after_intro", label: "Написать ответ самостоятельно", action: "custom_input" },
      ]);
      return;
    }

    if (option.action === "telegram") {
      setArchivistMessage(
        "Telegram нужен, чтобы быстрее восстановить доступ к аккаунту и получать важные напоминания. Я могу открыть Seee-бота прямо сейчас, а после привязки мы вернёмся сюда."
      );
      setArchivistOptions([
        { id: "open_bot", label: "Открыть Seee бота", action: "open_bot" },
        { id: "telegram_done", label: "Уже привязал Telegram", action: "telegram_done" },
        { id: "custom_after_tg", label: "Написать ответ самостоятельно", action: "custom_input" },
      ]);
      return;
    }

    if (option.action === "open_bot") {
      window.open("https://t.me/SeeeAppBot", "_blank", "noopener,noreferrer");
      setArchivistMessage(
        "Открыл Seee-бота. Когда закончишь с привязкой, нажми «Уже привязал Telegram», и я продолжу помогать тебе здесь."
      );
      return;
    }

    if (option.action === "telegram_done") {
      setArchivistMessage(
        "Отлично. Тогда давай двигаться дальше: можешь открыть архив сессий, создать новую сессию или написать мне вопрос своими словами."
      );
      setArchivistOptions([
        { id: "archive_after_tg", label: "Открыть архив сессий", action: "open_archive" },
        { id: "new_after_tg", label: "Создать новую сессию", action: "new_session" },
        { id: "custom_after_tg_done", label: "Написать ответ самостоятельно", action: "custom_input" },
      ]);
      return;
    }

    if (option.action === "continue_last_session" && option.sessionId) {
      navigate(`/sessions/${option.sessionId}`);
      return;
    }

    if (option.action === "open_suggested_cards") {
      setSearchQuery("");
      setSortOption("to_explore");
      handleOpenArchiveGallery();
      return;
    }

    if (option.action === "open_archive") {
      handleOpenArchiveGallery();
      return;
    }

    if (option.action === "new_session") {
      handleCreateSession();
      return;
    }

    if (option.action === "open_people") {
      navigate("/people");
      return;
    }

    if (option.action === "custom_input") {
      setIsArchivistCustomInputVisible(true);
      setArchivistMessage(
        "Напиши мне, что именно ты хочешь сделать прямо сейчас. Например: открыть архив, создать новую сессию, привязать Telegram или разобраться, как всё устроено."
      );
      return;
    }
  };

  const handleArchivistCustomSubmit = () => {
    const text = archivistDraft.trim();
    if (!text) return;

    const normalized = text.toLowerCase();
    setArchivistMode("conversation");
    setArchivistDraft("");
    setIsArchivistCustomInputVisible(false);

    if (normalized.includes("телеграм")) {
      handleArchivistOption({ id: "from_text_telegram", label: "", action: "telegram" });
      return;
    }

    if (normalized.includes("архив") || normalized.includes("сесс")) {
      setArchivistMessage("Открываю архив сессий. Там ты увидишь все папки, отложенные карточки и рекомендованные разборы.");
      setArchivistOptions([{ id: "go_archive_from_text", label: "Перейти в архив сессий", action: "open_archive" }]);
      return;
    }

    if (normalized.includes("нов") || normalized.includes("созда")) {
      setArchivistMessage("Могу сразу открыть создание новой сессии. Если хочешь, начнём с чистого листа.");
      setArchivistOptions([{ id: "go_new_from_text", label: "Создать новую сессию", action: "new_session" }]);
      return;
    }

    if (normalized.includes("чат") || normalized.includes("люд") || normalized.includes("людьми")) {
      setArchivistMessage("Если тебе нужны другие люди и диалоги, я могу сразу перевести тебя в раздел мега-чатов.");
      setArchivistOptions([{ id: "go_people_from_text", label: "Открыть мега-чаты", action: "open_people" }]);
      return;
    }

    setArchivistMessage(
      "Я понял запрос. Прямо сейчас лучше всего помочь тебе через архив сессий, новую сессию или Telegram-привязку. Выбери ближайший вариант, и я продолжу."
    );
    setArchivistOptions(buildArchivistRootOptions());
  };

  return (
    <div className={`${styles.collectionPage} ${isArchivistWelcomeVisible ? styles.collectionPageWelcomeMode : ""}`}>
      {isArchivistWelcomeVisible ? (
        <div className={styles.archivistWelcome}>
          <div className={styles.archivistWelcomeLogoWrap}>
            <img src="/seee-logo-128.png" alt="Seee" className={styles.archivistWelcomeLogo} />
          </div>

          <div className={styles.archivistWelcomeCard}>
            <h2 className={styles.archivistWelcomeTitle}>Привет!</h2>
            <p className={styles.archivistWelcomeText}>
              {archivistMessage}
            </p>
          </div>

          <div className={styles.archivistWelcomeScene}>
            <img src="/archivist-wave.png" alt="Архивариус" className={styles.archivistCharacter} />

            <div className={styles.archivistControls}>
              <div className={styles.archivistChoiceBar}>
                {archivistOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.archivistChoiceButton}
                    onClick={() => handleArchivistOption(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {isArchivistCustomInputVisible && (
                <div className={styles.archivistComposer}>
                  <textarea
                    value={archivistDraft}
                    onChange={(e) => setArchivistDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleArchivistCustomSubmit();
                      }
                    }}
                    className={styles.archivistComposerInput}
                    rows={3}
                    placeholder="Напиши Архивариусу, что ты хочешь сделать..."
                  />
                  <button
                    type="button"
                    className={styles.archivistComposerButton}
                    onClick={handleArchivistCustomSubmit}
                  >
                    Отправить
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.archivistArchiveButton}
              onClick={handleOpenArchiveGallery}
              aria-label="Открыть архив сессий"
            >
              <img src="/archivist-source-drawer-only.png" alt="Архив сессий" className={styles.archivistDrawer} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Заголовок */}
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <div className={styles.titleRow}>
                <img src="/seee-logo-128.png" alt="Seee" className={styles.logo} />
                <h1 className={styles.title}>Галерея сессий</h1>
              </div>
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
                  ref={sortButtonRef}
                  onClick={toggleSortMenu}
                  className={styles.sortButton}
                  size="icon"
                  variant="outline"
                >
                  <SlidersHorizontal className={styles.sortIcon} />
                </Button>

                {isSortMenuOpen && sortMenuPosition &&
                  createPortal(
                    <div
                      ref={sortMenuRef}
                      className={styles.sortMenu}
                      style={{ top: sortMenuPosition.top, right: sortMenuPosition.right }}
                    >
                      <button
                        onClick={() => {
                          setSortOption("freedom");
                          closeSortMenu();
                        }}
                        className={`${styles.sortMenuItem} ${sortOption === "freedom" ? styles.sortMenuItemActive : ""}`}
                      >
                        Освобождение
                      </button>
                      <button
                        onClick={() => {
                          setSortOption("happiness");
                          closeSortMenu();
                        }}
                        className={`${styles.sortMenuItem} ${sortOption === "happiness" ? styles.sortMenuItemActive : ""}`}
                      >
                        Улучшение +1
                      </button>
                      <button
                        onClick={() => {
                          setSortOption("my_sessions");
                          closeSortMenu();
                        }}
                        className={`${styles.sortMenuItem} ${sortOption === "my_sessions" ? styles.sortMenuItemActive : ""}`}
                      >
                        Мои сессии
                      </button>
                      <button
                        onClick={() => {
                          setSortOption("to_explore");
                          closeSortMenu();
                        }}
                        className={`${styles.sortMenuItem} ${sortOption === "to_explore" ? styles.sortMenuItemActive : ""}`}
                      >
                        Предстоит изучить
                      </button>
                      <button
                        onClick={() => {
                          setSortOption("deferred");
                          closeSortMenu();
                        }}
                        className={`${styles.sortMenuItem} ${sortOption === "deferred" ? styles.sortMenuItemActive : ""}`}
                      >
                        Отложено на разбор
                      </button>
                      <button
                        onClick={() => {
                          setSortOption("recommended");
                          closeSortMenu();
                        }}
                        className={`${styles.sortMenuItem} ${sortOption === "recommended" ? styles.sortMenuItemActive : ""}`}
                      >
                        Рекомендовано мне
                      </button>
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          </div>

          {showTelegramPrompt && user && !user.telegramId && (
            <div className={styles.telegramPrompt}>
              <div className={styles.telegramPromptText}>
                <strong>Привяжите Telegram,</strong> чтобы мы могли быстро восстановить доступ к аккаунту,
                если вы забудете пароль.
              </div>
              <div className={styles.telegramPromptActions}>
                <button
                  type="button"
                  className={styles.telegramPromptButtonPrimary}
                  onClick={() => {
                    setShowTelegramPrompt(false);
                    try {
                      localStorage.setItem(
                        `seee_telegram_prompt_dismissed:${user.id}`,
                        "1",
                      );
                    } catch {
                      // ignore
                    }
                    window.open("https://t.me/SeeeAppBot", "_blank", "noopener,noreferrer");
                  }}
                >
                  Открыть Seee бота
                </button>
                <button
                  type="button"
                  className={styles.telegramPromptButtonSecondary}
                  onClick={() => {
                    setShowTelegramPrompt(false);
                    try {
                      localStorage.setItem(
                        `seee_telegram_prompt_dismissed:${user.id}`,
                        "1",
                      );
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Уже сделал(а)
                </button>
              </div>
            </div>
          )}

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

            {!isLoading && (error === undefined || error === null) && combinedCards.length === 0 && (
              <div className={styles.emptyState}>
                <p>Карточки не найдены</p>
                {searchQuery && (
                  <p className={styles.emptyHint}>Попробуйте изменить поисковый запрос</p>
                )}
              </div>
            )}

            {!isLoading && (error === undefined || error === null) && combinedCards.length > 0 && (
              <div className={styles.foldersList}>
                {combinedCards.map((item, index) => {
                  if (item.kind === "session") {
                    const session = item.session;
                    return (
                      <SessionFolderCard
                        key={session.id}
                        session={session}
                        colorIndex={index}
                        onRename={() => handleRename(session.id)}
                        onDelete={() => handleDelete(session.id)}
                        onMoveToExplore={() => handleMoveToExplore(session)}
                        onShowFeedback={() => setFeedbackInfoSessionId(session.id)}
                        onShowIdeas={() => setIdeasInfoSessionId(session.id)}
                        coinsLabel={formatCoinsBadgeLabel(getSessionCoinsEarned(session.id))}
                      />
                    );
                  }

                  const t = item.template;
                  const isRecommendedTemplate =
                    t.id.startsWith("to_explore:archivist:") ||
                    recommendedTemplateIds.has(t.id);
                  const hasRecommendedStartReward =
                    isRecommendedTemplate && !t.sourceSessionId;
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
                      colorIndex={index}
                      tagLabel="Предстоит изучить"
                      categoryLabel={t.category}
                      coinsLabel={
                        hasRecommendedStartReward
                          ? formatCoinsBadgeLabel(25)
                          : undefined
                      }
                      recommendationLabel={
                        t.id.startsWith("to_explore:archivist:")
                          ? "Рекомендация Архивариуса"
                          : recommendedTemplateIds.has(t.id)
                            ? "Рекомендация для вас"
                            : undefined
                      }
                      palette="toExplore"
                      showMenu={false}
                      onOpen={() =>
                        openToExploreTemplate(t, {
                          rewardCoins: hasRecommendedStartReward ? 25 : 0,
                        })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Нижняя панель навигации */}
      <BottomNavigation
        onArchivist={() => {
          resetArchivistConversation();
          setIsArchivistWelcomeVisible(true);
        }}
        onCabinet={() => navigate("/cabinet")}
        onRating={() => navigate("/rating")}
        onPeople={() => navigate("/people")}
        onNewSession={handleCreateSession}
      />

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
                const session = sessions?.find((s) => s.id === ideasInfoSessionId);
                const { coreThought, importantIdeas } = getIdeasFromLocalState(ideasInfoSessionId);
                const hasTitle = (session?.title ?? "").trim().length > 0;
                const displayThought = coreThought || (hasTitle ? (session?.title ?? "").trim() : undefined);
                if (!displayThought && importantIdeas.length === 0) {
                  return (
                    <p className={styles.infoEmpty}>
                      Для этой сессии пока нет сохранённых идей.
                    </p>
                  );
                }
                return (
                  <div className={styles.infoList}>
                    {displayThought && (
                      <div className={styles.infoItem}>
                        <div className={styles.infoItemTitle}>Мысль (шаг 3)</div>
                        <div className={styles.ideaChip}>{displayThought}</div>
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
