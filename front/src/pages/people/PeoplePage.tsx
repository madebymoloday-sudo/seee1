import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Link2,
  Mic,
  MoreVertical,
  PanelRightOpen,
  Plus,
  Search,
  Settings2,
  Share2,
  StickyNote,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import apiAgent from "@/lib/api";
import styles from "./PeoplePage.module.css";
import BottomNavigation from "@/pages/sessions/components/BottomNavigation";
import { useNavigate } from "react-router-dom";
import MessageInput from "@/pages/sessions/components/MessageInput";

type FriendDto = { id: string; username: string; userId?: string | null; avatarUrl?: string | null };
type ChatListItem = {
  id: string;
  title: string;
  isGroup: boolean;
  participants: FriendDto[];
  lastMessage: { id: string; content: string; mode: string; createdAt: string } | null;
};
type ChatMessage = {
  id: string;
  content: string;
  mode: string;
  meta?: any;
  createdAt: string;
  sender: { id: string; username: string; userId?: string | null; avatarUrl?: string | null };
};
type PendingModeRequest = {
  id: string;
  mode: string;
  initiatedById: string;
  expiresAt: string;
  approvals: Array<{ userId: string; accepted: boolean }>;
};
type ExplainSession = {
  id: string;
  initiatorId: string;
  currentStep: number;
  currentQuestion: string;
  answers: Record<string, string[]>;
};
type ModeState = {
  pendingRequest: PendingModeRequest | null;
  activeMode: string;
  explainSession: ExplainSession | null;
  currentQuestion: string | null;
  canControl: boolean;
};

const MODES = ["Объяснить", "Разобрать", "Помириться", "Узнать друг друга ближе", "Поиграть"] as const;
const CHAT_NOTES_PREFIX = "seee_people_chat_notes:";
type ChatFilter = "all" | "direct" | "group";
type TopicsLayout = "tabs" | "list";
type SlowMode = "off" | "5s" | "10s" | "30s" | "1m" | "5m" | "15m" | "1h";
type ChatSettings = {
  title: string;
  description: string;
  groupType: "public" | "private";
  historyVisible: boolean;
  topicsEnabled: boolean;
  topicsLayout: TopicsLayout;
  permissions: {
    sendMessages: boolean;
    sendMedia: boolean;
    addParticipants: boolean;
    createTopics: boolean;
    pinMessages: boolean;
    changeInfo: boolean;
  };
  starsOnly: boolean;
  slowMode: SlowMode;
  blacklistCount: number;
  exceptionsCount: number;
  inviteLink: string;
};

const CHAT_SETTINGS_PREFIX = "seee_people_chat_settings:";

const createDefaultChatSettings = (chat: ChatListItem): ChatSettings => ({
  title: chat.title,
  description: "",
  groupType: chat.isGroup ? "private" : "public",
  historyVisible: true,
  topicsEnabled: chat.isGroup,
  topicsLayout: "tabs",
  permissions: {
    sendMessages: true,
    sendMedia: true,
    addParticipants: true,
    createTopics: true,
    pinMessages: true,
    changeInfo: true,
  },
  starsOnly: false,
  slowMode: "off",
  blacklistCount: 0,
  exceptionsCount: 0,
  inviteLink: `https://seee.app/invite/${chat.id}`,
});

const decodeSub = () => {
  try {
    const raw = localStorage.getItem("accessToken");
    if (!raw) return "";
    const [, payload] = raw.split(".");
    return JSON.parse(atob(payload)).sub || "";
  } catch {
    return "";
  }
};

const PeoplePage = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [modeOpen, setModeOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [modeState, setModeState] = useState<ModeState | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [chatSettings, setChatSettings] = useState<Record<string, ChatSettings>>({});
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [activeSearchResult, setActiveSearchResult] = useState(0);
  const [isVideoMenuOpen, setIsVideoMenuOpen] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isInfoActionsMenuOpen, setIsInfoActionsMenuOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isGroupTypeModalOpen, setIsGroupTypeModalOpen] = useState(false);
  const [isHistoryVisibilityModalOpen, setIsHistoryVisibilityModalOpen] = useState(false);
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const videoMenuRef = useRef<HTMLDivElement | null>(null);
  const infoActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const searchResultRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const myUserId = useMemo(() => decodeSub(), []);
  const myUsername = useMemo(() => {
    try {
      const auth = localStorage.getItem("accessToken");
      if (!auth) return "Вы";
      const [, payload] = auth.split(".");
      const p = JSON.parse(atob(payload));
      return p.username || "Вы";
    } catch {
      return "Вы";
    }
  }, []);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) || null,
    [chats, selectedChatId]
  );
  const selectedChatSettings = useMemo(() => {
    if (!selectedChat) return null;
    return chatSettings[selectedChat.id] || createDefaultChatSettings(selectedChat);
  }, [chatSettings, selectedChat]);
  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    return chats.filter((chat) => {
      if (chatFilter === "direct" && chat.isGroup) return false;
      if (chatFilter === "group" && !chat.isGroup) return false;
      if (!q) return true;
      const title = (chat.title || "").toLowerCase();
      const preview = (chat.lastMessage?.content || "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [chatFilter, chatSearch, chats]);

  const pendingNeedsMyResponse = useMemo(() => {
    if (!modeState?.pendingRequest) return false;
    const already = modeState.pendingRequest.approvals.some((a) => a.userId === myUserId);
    return !already;
  }, [modeState?.pendingRequest, myUserId]);
  const notesKey = useMemo(
    () => `${CHAT_NOTES_PREFIX}${myUserId}:${selectedChatId || "none"}`,
    [myUserId, selectedChatId]
  );
  const messageSearchMatches = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return [];
    return messages
      .filter((message) => message.content.toLowerCase().includes(query))
      .map((message) => message.id);
  }, [messageSearch, messages]);
  const activeSearchMessageId = messageSearchMatches[activeSearchResult] || null;

  const refreshChats = async () => {
    const [friendsData, chatsData] = await Promise.all([
      apiAgent.get<FriendDto[]>("/social/friends"),
      apiAgent.get<ChatListItem[]>("/social/chats"),
    ]);
    setFriends(friendsData);
    setChats(chatsData);
    if (!selectedChatId && chatsData.length > 0) {
      setSelectedChatId(chatsData[0].id);
      setMobilePane("chat");
    }
  };

  const loadMessages = async (chatId: string) => {
    const data = await apiAgent.get<ChatMessage[]>(`/social/chats/${chatId}/messages`);
    setMessages(data);
  };
  const loadModeState = async (chatId: string) => {
    const data = await apiAgent.get<ModeState>(`/social/chats/${chatId}/mode-state`);
    setModeState(data);
  };

  useEffect(() => {
    refreshChats().catch(() => toast.error("Не удалось загрузить мега-чаты"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    Promise.all([loadMessages(selectedChatId), loadModeState(selectedChatId)]).catch(() =>
      toast.error("Не удалось загрузить данные чата")
    );
    const t = window.setInterval(() => {
      loadModeState(selectedChatId).catch(() => undefined);
      loadMessages(selectedChatId).catch(() => undefined);
      refreshChats().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(t);
  }, [selectedChatId]);

  useEffect(() => {
    const saved = localStorage.getItem(notesKey);
    setNotesText(saved || "");
  }, [notesKey]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (quickActionsRef.current && !quickActionsRef.current.contains(target)) {
        setIsQuickActionsOpen(false);
      }
      if (videoMenuRef.current && !videoMenuRef.current.contains(target)) {
        setIsVideoMenuOpen(false);
      }
      if (infoActionsMenuRef.current && !infoActionsMenuRef.current.contains(target)) {
        setIsInfoActionsMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isQuickActionsOpen || isVideoMenuOpen || isInfoActionsMenuOpen || isMoreMenuOpen) {
      document.addEventListener("mousedown", onOutside);
    }
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isInfoActionsMenuOpen, isMoreMenuOpen, isQuickActionsOpen, isVideoMenuOpen]);

  useEffect(() => {
    if (!selectedChat) return;
    const storageKey = `${CHAT_SETTINGS_PREFIX}${selectedChat.id}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setChatSettings((current) => ({
          ...current,
          [selectedChat.id]: {
            ...createDefaultChatSettings(selectedChat),
            ...(JSON.parse(raw) as Partial<ChatSettings>),
          },
        }));
        return;
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    setChatSettings((current) => ({
      ...current,
      [selectedChat.id]: current[selectedChat.id] || createDefaultChatSettings(selectedChat),
    }));
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedChat || !selectedChatSettings) return;
    localStorage.setItem(
      `${CHAT_SETTINGS_PREFIX}${selectedChat.id}`,
      JSON.stringify(selectedChatSettings)
    );
  }, [selectedChat, selectedChatSettings]);

  useEffect(() => {
    setActiveSearchResult(0);
  }, [messageSearch]);

  useEffect(() => {
    if (!activeSearchMessageId) return;
    searchResultRefs.current[activeSearchMessageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSearchMessageId]);

  useEffect(() => {
    setIsChatSearchOpen(false);
    setMessageSearch("");
    setActiveSearchResult(0);
    setIsVideoMenuOpen(false);
    setIsInfoPanelOpen(false);
    setIsMoreMenuOpen(false);
    setIsInfoActionsMenuOpen(false);
  }, [selectedChatId]);

  const handleCreateGroup = async () => {
    const name = window.prompt("Название группы:", "Новая группа");
    if (!name || name.trim().length < 2) return;
    const idsRaw = window.prompt("Публичные ID участников через запятую:", "");
    const memberUserIds = (idsRaw || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      const group = await apiAgent.post<
        { name: string; memberUserIds: string[] },
        { id: string }
      >("/social/chats/group", { name: name.trim(), memberUserIds });
      await refreshChats();
      setSelectedChatId(group.id);
      setMobilePane("chat");
      setIsQuickActionsOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось создать группу");
    }
  };

  const handleCreateSelfChat = async () => {
    try {
      const chat = await apiAgent.post<undefined, { id: string }>("/social/chats/self");
      await refreshChats();
      setSelectedChatId(chat.id);
      setMobilePane("chat");
      setIsQuickActionsOpen(false);
      toast.success("Личный чат открыт");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось открыть чат с собой");
    }
  };

  const handleSend = async (rawText?: string) => {
    const text = (rawText ?? messageInput).trim();
    if (!selectedChatId || !text) return;
    try {
      if (modeState?.activeMode === "Объяснить" && modeState.explainSession?.initiatorId === myUserId) {
        await apiAgent.post<{ text: string }, any>(
          `/social/chats/${selectedChatId}/explain/answer`,
          { text }
        );
      } else {
        await apiAgent.post<{ content: string; mode: string }, ChatMessage>(
          `/social/chats/${selectedChatId}/messages`,
          { content: text, mode: "Обычный" }
        );
      }
      setMessageInput("");
      await Promise.all([loadMessages(selectedChatId), loadModeState(selectedChatId)]);
      await refreshChats();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось отправить сообщение");
    }
  };

  const handleStartModeRequest = async (item: (typeof MODES)[number]) => {
    if (!selectedChatId) return;
    try {
      await apiAgent.post<{ mode: string }, ModeState>(`/social/chats/${selectedChatId}/mode-requests`, {
        mode: item,
      });
      setModeOpen(false);
      await Promise.all([loadModeState(selectedChatId), loadMessages(selectedChatId), refreshChats()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось запустить режим");
    }
  };

  const handleRespondModeRequest = async (accepted: boolean) => {
    if (!selectedChatId || !modeState?.pendingRequest) return;
    try {
      await apiAgent.post<{ accepted: boolean }, ModeState>(
        `/social/chats/${selectedChatId}/mode-requests/${modeState.pendingRequest.id}/respond`,
        { accepted }
      );
      await Promise.all([loadModeState(selectedChatId), loadMessages(selectedChatId), refreshChats()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось отправить ответ");
    }
  };

  const handleExplainControl = async (action: "next" | "back" | "finish") => {
    if (!selectedChatId) return;
    try {
      await apiAgent.post<{ action: "next" | "back" | "finish" }, any>(
        `/social/chats/${selectedChatId}/explain/control`,
        { action }
      );
      await Promise.all([loadModeState(selectedChatId), loadMessages(selectedChatId), refreshChats()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось изменить этап");
    }
  };

  const handleEditExplainAnswer = async (step: number, index: number, initial: string) => {
    if (!selectedChatId) return;
    const next = window.prompt("Редактировать ответ", initial);
    if (!next || !next.trim()) return;
    try {
      await apiAgent.post<{ step: number; answerIndex: number; text: string }, any>(
        `/social/chats/${selectedChatId}/explain/edit`,
        {
          step,
          answerIndex: index,
          text: next.trim(),
        }
      );
      await Promise.all([loadModeState(selectedChatId), loadMessages(selectedChatId)]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось отредактировать ответ");
    }
  };

  const openAddFriendPrompt = async () => {
    const value = window.prompt("Введите публичный ID пользователя", friendIdInput || "");
    if (value === null) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setFriendIdInput(trimmed);
    try {
      await apiAgent.post<{ friendUserId: string }, { ok: boolean }>("/social/friends/add", {
        friendUserId: trimmed,
      });
      setFriendIdInput("");
      await refreshChats();
      setIsQuickActionsOpen(false);
      toast.success("Пользователь добавлен");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось добавить пользователя");
    }
  };

  const formatPreviewTime = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const saveNotes = () => {
    localStorage.setItem(notesKey, notesText);
    const indexKey = `${CHAT_NOTES_PREFIX}index:${myUserId}`;
    const title = selectedChat?.title || "Мега-чат";
    const payload = {
      chatId: selectedChatId,
      chatTitle: title,
      text: notesText,
      updatedAt: new Date().toISOString(),
    };
    const mapRaw = localStorage.getItem(indexKey);
    const map = mapRaw ? (JSON.parse(mapRaw) as Record<string, any>) : {};
    if (selectedChatId) {
      map[selectedChatId] = payload;
      localStorage.setItem(indexKey, JSON.stringify(map));
    }
    setNotesOpen(false);
    toast.success("Заметка сохранена");
  };

  const patchChatSettings = (patch: Partial<ChatSettings>) => {
    if (!selectedChat) return;
    setChatSettings((current) => ({
      ...current,
      [selectedChat.id]: {
        ...(current[selectedChat.id] || createDefaultChatSettings(selectedChat)),
        ...patch,
      },
    }));
  };

  const patchChatPermissions = (key: keyof ChatSettings["permissions"], value: boolean) => {
    if (!selectedChatSettings) return;
    patchChatSettings({
      permissions: {
        ...selectedChatSettings.permissions,
        [key]: value,
      },
    });
  };

  const handleCopyInviteLink = async () => {
    if (!selectedChatSettings) return;
    try {
      await navigator.clipboard.writeText(selectedChatSettings.inviteLink);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const handleExportHistory = async () => {
    if (!selectedChat) return;
    const lines = messages.map(
      (message) =>
        `[${new Date(message.createdAt).toLocaleString()}] ${message.sender.username}: ${message.content}`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedChat.title || "chat-history"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("История чата экспортирована");
    setIsMoreMenuOpen(false);
  };

  const handleClearHistory = () => {
    setMessages([]);
    toast.success("История очищена локально");
    setIsMoreMenuOpen(false);
  };

  const handleLeaveGroup = () => {
    toast.info("Кнопка выхода добавлена как интерфейс. Логику выхода подключим отдельно.");
    setIsMoreMenuOpen(false);
    setIsInfoActionsMenuOpen(false);
  };

  const goToPrevSearchResult = () => {
    if (!messageSearchMatches.length) return;
    setActiveSearchResult((current) =>
      current === 0 ? messageSearchMatches.length - 1 : current - 1
    );
  };

  const goToNextSearchResult = () => {
    if (!messageSearchMatches.length) return;
    setActiveSearchResult((current) => (current + 1) % messageSearchMatches.length);
  };

  const mediaStats = [
    { icon: <FileText className={styles.infoStatIcon} />, label: "Фотографий", value: "13" },
    { icon: <Video className={styles.infoStatIcon} />, label: "Видео", value: "1" },
    { icon: <FileText className={styles.infoStatIcon} />, label: "Файлов", value: "6" },
    { icon: <Link2 className={styles.infoStatIcon} />, label: "Ссылок", value: "40" },
    { icon: <BarChart3 className={styles.infoStatIcon} />, label: "Опросов", value: "3" },
    { icon: <Mic className={styles.infoStatIcon} />, label: "Голосовых сообщений", value: "6" },
  ];

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.shell}>
          <aside className={`${styles.left} ${mobilePane === "chat" ? styles.leftHiddenOnMobile : ""}`}>
            <div className={styles.sidebarTop}>
              <div className={styles.sidebarHeader}>
                <div className={styles.sidebarTitleWrap}>
                  <Users className={styles.sidebarTitleIcon} />
                  <h2 className={styles.sidebarTitle}>Мега-чаты</h2>
                </div>
                <div className={styles.quickActionsWrap} ref={quickActionsRef}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={styles.quickAddBtn}
                    onClick={() => setIsQuickActionsOpen((v) => !v)}
                    title="Действия"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {isQuickActionsOpen && (
                    <div className={styles.quickActionsMenu}>
                      <button type="button" className={styles.quickMenuItem} onClick={openAddFriendPrompt}>
                        Добавить по ID
                      </button>
                      <button type="button" className={styles.quickMenuItem} onClick={handleCreateGroup}>
                        Создать группу
                      </button>
                      <button type="button" className={styles.quickMenuItem} onClick={handleCreateSelfChat}>
                        Мега-чат с собой
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.searchWrap}>
                <Search className={styles.searchListIcon} />
                <Input
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Поиск"
                  className={styles.chatSearchInput}
                />
              </div>
              <div className={styles.filterRow}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${chatFilter === "all" ? styles.filterChipActive : ""}`}
                  onClick={() => setChatFilter("all")}
                >
                  Все
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${chatFilter === "direct" ? styles.filterChipActive : ""}`}
                  onClick={() => setChatFilter("direct")}
                >
                  Личные
                </button>
                <button
                  type="button"
                  className={`${styles.filterChip} ${chatFilter === "group" ? styles.filterChipActive : ""}`}
                  onClick={() => setChatFilter("group")}
                >
                  Группы
                </button>
                <span className={styles.friendCount}>Друзей: {friends.length}</span>
              </div>
            </div>

            <div className={styles.chatsList}>
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  className={`${styles.chatItem} ${selectedChatId === chat.id ? styles.chatItemActive : ""}`}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    setMobilePane("chat");
                  }}
                >
                  <div className={styles.chatAvatar}>
                    {(chat.title || "Ч").slice(0, 1).toUpperCase()}
                  </div>
                  <div className={styles.chatMain}>
                    <div className={styles.chatMainTop}>
                      <div className={styles.chatTitle}>{chat.title}</div>
                      <div className={styles.chatTime}>
                        {formatPreviewTime(chat.lastMessage?.createdAt)}
                      </div>
                    </div>
                    <div className={styles.chatSubtitle}>
                      {chat.lastMessage
                        ? `[${chat.lastMessage.mode}] ${chat.lastMessage.content}`
                        : chat.isGroup
                        ? "Групповой чат"
                        : "Личный чат"}
                    </div>
                  </div>
