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
import { socketService } from "@/lib/socket";
import { registerBrowserPushNotifications } from "@/lib/pushNotifications";
import styles from "./PeoplePage.module.css";
import BottomNavigation from "@/pages/sessions/components/BottomNavigation";
import { useNavigate, useSearchParams } from "react-router-dom";
import MessageInput from "@/pages/sessions/components/MessageInput";

type FriendDto = { id: string; username: string; userId?: string | null; avatarUrl?: string | null };
type ChatListItem = {
  id: string;
  title: string;
  isGroup: boolean;
  participants: FriendDto[];
  lastMessage: { id: string; content: string; mode: string; createdAt: string } | null;
  unreadCount: number;
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const previousChatIdRef = useRef<string | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
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
    const requestedChatId = searchParams.get("chatId");
    const requestedChat = requestedChatId ? chatsData.find((chat) => chat.id === requestedChatId) : null;

    if (requestedChat) {
      setSelectedChatId(requestedChat.id);
      setMobilePane("chat");
      return;
    }

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
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    socketService.connect(token);
    registerBrowserPushNotifications().catch(() => undefined);

    const handleRealtimeMessage = (payload: {
      chatId: string;
      chatTitle?: string | null;
      message: ChatMessage;
    }) => {
      const incomingMessage = payload.message;

      setChats((current) => {
        const next = current.map((chat) =>
          chat.id === payload.chatId
            ? {
                ...chat,
                title: payload.chatTitle || chat.title,
                lastMessage: {
                  id: incomingMessage.id,
                  content: incomingMessage.content,
                  mode: incomingMessage.mode,
                  createdAt: incomingMessage.createdAt,
                },
              }
            : chat,
        );

        return [...next].sort((a, b) => {
          const aTime = a.lastMessage?.createdAt || "";
          const bTime = b.lastMessage?.createdAt || "";
          return aTime < bTime ? 1 : -1;
        });
      });

      if (payload.chatId === selectedChatIdRef.current) {
        setMessages((current) =>
          current.some((message) => message.id === incomingMessage.id)
            ? current
            : [...current, incomingMessage],
        );

        if (incomingMessage.sender.id !== myUserId) {
          void apiAgent.post<{ lastMessageId: string }, { ok: boolean }>(
            `/social/chats/${payload.chatId}/read`,
            { lastMessageId: incomingMessage.id },
          );
        }
        return;
      }

      if (incomingMessage.sender.id === myUserId) {
        return;
      }

      toast.message(`Новое сообщение в ${payload.chatTitle || "мега-чате"}`, {
        description: `${incomingMessage.sender.username}: ${incomingMessage.content}`,
      });

      if (document.visibilityState !== "visible" && Notification.permission === "granted") {
        new Notification(payload.chatTitle || "Seee", {
          body: `${incomingMessage.sender.username}: ${incomingMessage.content}`,
        });
      }
    };

    const handleUnreadUpdate = (payload: { chatId: string; unreadCount: number }) => {
      setChats((current) =>
        current.map((chat) =>
          chat.id === payload.chatId ? { ...chat, unreadCount: payload.unreadCount } : chat,
        ),
      );
    };

    const handleRefresh = () => {
      refreshChats().catch(() => undefined);
    };

    const handleConnect = () => {
      const chatId = previousChatIdRef.current || selectedChatIdRef.current;
      if (chatId) {
        socketService.emit("join_chat", { chatId });
      }
    };

    socketService.on("social:message", handleRealtimeMessage);
    socketService.on("social:unread", handleUnreadUpdate);
    socketService.on("social:chat_refresh", handleRefresh);
    socketService.on("connect", handleConnect);

    return () => {
      socketService.off("social:message", handleRealtimeMessage);
      socketService.off("social:unread", handleUnreadUpdate);
      socketService.off("social:chat_refresh", handleRefresh);
      socketService.off("connect", handleConnect);
      socketService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);

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
    if (!selectedChatId) return;

    const previousChatId = previousChatIdRef.current;
    if (previousChatId && previousChatId !== selectedChatId) {
      socketService.emit("leave_chat", { chatId: previousChatId });
    }

    previousChatIdRef.current = selectedChatId;
    socketService.emit("join_chat", { chatId: selectedChatId });
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("chatId", selectedChatId);
      return next;
    });
  }, [selectedChatId, setSearchParams]);

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
                      <div className={styles.chatMeta}>
                        <div className={styles.chatTime}>
                          {formatPreviewTime(chat.lastMessage?.createdAt)}
                        </div>
                        {chat.unreadCount > 0 ? (
                          <div className={styles.unreadBadge}>{chat.unreadCount}</div>
                        ) : null}
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
                </button>
              ))}
            </div>
          </aside>

          <section className={`${styles.right} ${mobilePane === "list" ? styles.rightHiddenOnMobile : ""}`}>
            {selectedChat ? (
              <>
                <div className={styles.chatHeader}>
                  <div className={styles.chatHeaderMain}>
                    <button
                      type="button"
                      className={styles.backToListButton}
                      onClick={() => setMobilePane("list")}
                      aria-label="Назад к мега-чатам"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className={styles.chatHeaderIdentity}>
                      <span>{selectedChatSettings?.title || selectedChat.title}</span>
                      <small>
                        {selectedChat.isGroup
                          ? `${selectedChat.participants.length + 1} участников`
                          : "Личный чат"}
                      </small>
                    </div>
                  </div>
                  <div className={styles.headerActions}>
                    <span className={styles.modeBadge}>
                      {modeState?.activeMode === "Объяснить" ? 'Режим: "Объяснить"' : "Обычный режим"}
                    </span>
                    <button
                      type="button"
                      className={styles.headerIconButton}
                      onClick={() => setIsChatSearchOpen((prev) => !prev)}
                      aria-label="Поиск по чату"
                    >
                      <Search className="h-4 w-4" />
                      <span className={styles.headerActionLabel}>Поиск</span>
                    </button>
                    <div className={styles.headerMenuWrap} ref={videoMenuRef}>
                      <button
                        type="button"
                        className={styles.headerIconButton}
                        onClick={() => setIsVideoMenuOpen((prev) => !prev)}
                        aria-label="Видеочаты"
                      >
                        <Video className="h-4 w-4" />
                        <span className={styles.headerActionLabel}>Звонок</span>
                      </button>
                      {isVideoMenuOpen ? (
                        <div className={styles.headerDropdownMenu}>
                          <button type="button" className={styles.headerDropdownItem}>
                            Начать видеочат
                          </button>
                          <button type="button" className={styles.headerDropdownItem}>
                            Анонсировать видеочат
                          </button>
                          <button type="button" className={styles.headerDropdownItem}>
                            Трансляция с помощью...
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={`${styles.headerIconButton} ${isInfoPanelOpen ? styles.headerIconButtonActive : ""}`}
                      onClick={() => setIsInfoPanelOpen((prev) => !prev)}
                      aria-label="Панель информации о чате"
                    >
                      <PanelRightOpen className="h-4 w-4" />
                      <span className={styles.headerActionLabel}>Инфо</span>
                    </button>
                    <div className={styles.headerMenuWrap} ref={moreMenuRef}>
                      <button
                        type="button"
                        className={styles.headerIconButton}
                        onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                        aria-label="Меню чата"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className={styles.headerActionLabel}>Ещё</span>
                      </button>
                      {isMoreMenuOpen ? (
                        <div className={`${styles.headerDropdownMenu} ${styles.headerDropdownMenuWide}`}>
                          <button type="button" className={styles.headerDropdownItem}>
                            Создать тему
                          </button>
                          <button
                            type="button"
                            className={styles.headerDropdownItem}
                            onClick={() => {
                              setIsManageModalOpen(true);
                              setIsMoreMenuOpen(false);
                            }}
                          >
                            Управление группой
                          </button>
                          <button type="button" className={styles.headerDropdownItem}>
                            Архив историй
                          </button>
                          <button type="button" className={styles.headerDropdownItem}>
                            Проголосовать
                          </button>
                          <button
                            type="button"
                            className={styles.headerDropdownItem}
                            onClick={() => void handleExportHistory()}
                          >
                            Экспорт истории чата
                          </button>
                          <button
                            type="button"
                            className={styles.headerDropdownItem}
                            onClick={handleClearHistory}
                          >
                            Очистить историю
                          </button>
                          <button
                            type="button"
                            className={`${styles.headerDropdownItem} ${styles.headerDropdownDanger}`}
                            onClick={handleLeaveGroup}
                          >
                            Покинуть группу
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {modeState?.canControl && modeState.activeMode === "Объяснить" ? (
                      <Button size="sm" variant="ghost" onClick={() => handleExplainControl("finish")}>
                        Закончить
                      </Button>
                    ) : null}
                  </div>
                </div>
                {isChatSearchOpen ? (
                  <div className={styles.inlineSearchBar}>
                    <Search className={styles.inlineSearchIcon} />
                    <input
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                      placeholder="Поиск по ключевым словам внутри чата"
                      className={styles.inlineSearchInput}
                    />
                    <div className={styles.inlineSearchMeta}>
                      <span>
                        {messageSearchMatches.length
                          ? `${activeSearchResult + 1}/${messageSearchMatches.length}`
                          : "0/0"}
                      </span>
                      <button type="button" className={styles.inlineSearchNav} onClick={goToPrevSearchResult}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" className={styles.inlineSearchNav} onClick={goToNextSearchResult}>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={styles.inlineSearchClose}
                        onClick={() => {
                          setIsChatSearchOpen(false);
                          setMessageSearch("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
                {modeState?.pendingRequest && (
                  <div className={styles.pendingCard}>
                    <p className={styles.pendingText}>
                      Пользователь хочет запустить режим "{modeState.pendingRequest.mode}", согласны?
                    </p>
                    {pendingNeedsMyResponse ? (
                      <div className={styles.pendingActions}>
                        <Button size="sm" onClick={() => handleRespondModeRequest(true)}>
                          Запустить
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRespondModeRequest(false)}>
                          Отклонить
                        </Button>
                      </div>
                    ) : (
                      <div className={styles.chatSubtitle}>Ожидание ответов участников...</div>
                    )}
                  </div>
                )}
                <div className={styles.chatWorkspace}>
                  <div className={styles.chatBody}>
                    <div className={styles.messages}>
                      {modeState?.activeMode === "Объяснить" && modeState.currentQuestion ? (
                        <div className={styles.questionCard}>
                          <p className={styles.questionTitle}>Вопрос этапа</p>
                          <p className={styles.questionText}>{modeState.currentQuestion}</p>
                          {modeState.canControl ? (
                            <div className={styles.modeActions}>
                              <Button size="sm" variant="outline" onClick={() => handleExplainControl("back")}>
                                Назад
                              </Button>
                              <Button size="sm" onClick={() => handleExplainControl("next")}>
                                Далее
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {messages.map((m) => {
                        const mine = m.sender.id === myUserId;
                        const isExplainAnswer = m.meta?.type === "explain-answer";
                        const isSearchMatch = messageSearchMatches.includes(m.id);
                        const isActiveSearchMatch = activeSearchMessageId === m.id;
                        return (
                          <div
                            key={m.id}
                            ref={(node) => {
                              searchResultRefs.current[m.id] = node;
                            }}
                            className={`${styles.bubble} ${mine ? styles.mine : ""} ${
                              isSearchMatch ? styles.bubbleSearchMatch : ""
                            } ${isActiveSearchMatch ? styles.bubbleSearchMatchActive : ""}`}
                            onClick={() => {
                              if (!isExplainAnswer || !modeState?.canControl) return;
                              handleEditExplainAnswer(
                                Number(m.meta?.step || 1),
                                Number(m.meta?.answerIndex || 0),
                                m.content
                              );
                            }}
                          >
                            <div className={styles.meta}>
                              {m.sender.username} · {m.mode}
                            </div>
                            <div>{m.content}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.composer}>
                      <div className={styles.modeWrap}>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setModeOpen((v) => !v)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        {modeOpen && (
                          <div className={styles.modeList}>
                            {modeState?.activeMode === "Объяснить" && modeState?.canControl ? (
                              <button
                                type="button"
                                className={styles.modeBtn}
                                onClick={() => {
                                  setModeOpen(false);
                                  setNotesOpen(true);
                                }}
                              >
                                <span className={styles.modeBtnIcon}>
                                  <StickyNote className="h-4 w-4" />
                                </span>
                                Заметка
                              </button>
                            ) : null}
                            {modeState?.activeMode === "Объяснить" && modeState?.canControl ? (
                              <div className={styles.modeDivider} />
                            ) : null}
                            {MODES.map((item) => (
                              <button
                                key={item}
                                type="button"
                                className={styles.modeBtn}
                                onClick={() => handleStartModeRequest(item)}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.chatInputArea}>
                        <MessageInput
                          onSend={(value) => {
                            void handleSend(value);
                          }}
                          value={messageInput}
                          onValueChange={setMessageInput}
                          placeholder="Введите сообщение"
                        />
                      </div>
                    </div>
                  </div>
                  {isInfoPanelOpen ? (
                    <aside className={styles.infoPanel}>
                      <div className={styles.infoPanelHeader}>
                        <div className={styles.infoPanelAvatar}>
                          {(selectedChatSettings?.title || selectedChat.title).slice(0, 1).toUpperCase()}
                        </div>
                        <button
                          type="button"
                          className={styles.infoPanelClose}
                          onClick={() => setIsInfoPanelOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className={styles.infoPanelIdentity}>
                        <h3>{selectedChatSettings?.title || selectedChat.title}</h3>
                        <span>{selectedChat.participants.length + 1} участников</span>
                      </div>
                      <div className={styles.infoActionGrid}>
                        <button type="button" className={styles.infoActionCard}>
                          <Bell className="h-4 w-4" />
                          Звук
                        </button>
                        <button
                          type="button"
                          className={styles.infoActionCard}
                          onClick={() => setIsManageModalOpen(true)}
                        >
                          <Settings2 className="h-4 w-4" />
                          Управление
                        </button>
                        <button type="button" className={styles.infoActionCard} onClick={handleLeaveGroup}>
                          <ChevronRight className="h-4 w-4" />
                          Покинуть
                        </button>
                        <div className={styles.infoActionMenuWrap} ref={infoActionsMenuRef}>
                          <button
                            type="button"
                            className={styles.infoActionCard}
                            onClick={() => setIsInfoActionsMenuOpen((prev) => !prev)}
                          >
                            <MoreVertical className="h-4 w-4" />
                            Ещё
                          </button>
                          {isInfoActionsMenuOpen ? (
                            <div className={`${styles.headerDropdownMenu} ${styles.infoActionsMenu}`}>
                              <button type="button" className={styles.headerDropdownItem}>
                                Автоудаление
                              </button>
                              <button type="button" className={styles.headerDropdownItem}>
                                Добавить участников
                              </button>
                              <button type="button" className={styles.headerDropdownItem}>
                                Голоса
                              </button>
                              <button type="button" className={styles.headerDropdownItem}>
                                Архив историй
                              </button>
                              <button
                                type="button"
                                className={styles.headerDropdownItem}
                                onClick={() => {
                                  setIsManageModalOpen(true);
                                  setIsInfoActionsMenuOpen(false);
                                }}
                              >
                                Управление группой
                              </button>
                              <button
                                type="button"
                                className={styles.headerDropdownItem}
                                onClick={() => void handleExportHistory()}
                              >
                                Экспорт истории чата
                              </button>
                              <button type="button" className={styles.headerDropdownItem}>
                                Добавить в папку
                              </button>
                              <button
                                type="button"
                                className={`${styles.headerDropdownItem} ${styles.headerDropdownDanger}`}
                                onClick={handleLeaveGroup}
                              >
                                Покинуть группу
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.infoSectionTitle}>Показать список тем</div>
                      <div className={styles.infoStatsList}>
                        {mediaStats.map((stat) => (
                          <div key={stat.label} className={styles.infoStatRow}>
                            {stat.icon}
                            <span>{stat.value}</span>
                            <strong>{stat.label}</strong>
                          </div>
                        ))}
                      </div>
                      <div className={styles.infoMembersHeader}>
                        <span>{selectedChat.participants.length + 1} участников</span>
                        <button type="button" className={styles.infoMembersAddButton}>
                          <UserPlus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className={styles.membersList}>
                        <div className={styles.memberRow}>
                          <div className={styles.memberAvatar}>П</div>
                          <div className={styles.memberMeta}>
                            <strong>{myUsername}</strong>
                            <span>в сети</span>
                          </div>
                          <div className={styles.memberTag}>владелец</div>
                        </div>
                        {selectedChat.participants.map((participant) => (
                          <div key={participant.id} className={styles.memberRow}>
                            <div className={styles.memberAvatar}>
                              {(participant.username || "У").slice(0, 1).toUpperCase()}
                            </div>
                            <div className={styles.memberMeta}>
                              <strong>{participant.username}</strong>
                              <span>был(а) недавно</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.placeholder}>Выберите чат</div>
            )}
          </section>
        </div>
      </div>
      <BottomNavigation
        onRating={() => navigate("/rating")}
        onPeople={() => navigate("/people")}
        onArchivist={() => navigate("/sessions/list")}
        onMindMap={() => navigate("/map")}
        onCabinet={() => navigate("/cabinet")}
      />
      {notesOpen ? (
        <div className={styles.notesOverlay} onClick={() => setNotesOpen(false)}>
          <div className={styles.notesModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.notesTitle}>Приватная заметка</h3>
            <textarea
              className={styles.notesTextarea}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder={`${myUsername}, запишите мысли...`}
            />
            <div className={styles.notesFooter}>
              <Button variant="outline" onClick={() => setNotesOpen(false)}>
                Отмена
              </Button>
              <Button onClick={saveNotes}>Сохранить</Button>
            </div>
          </div>
        </div>
      ) : null}
      {isManageModalOpen && selectedChatSettings ? (
        <div className={styles.notesOverlay} onClick={() => setIsManageModalOpen(false)}>
          <div className={styles.telegramModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.telegramModalHeader}>
              <div>
                <h3 className={styles.telegramModalTitle}>Настройки группы</h3>
                <p className={styles.telegramModalSubtitle}>Базовые параметры чата без платных функций.</p>
              </div>
              <button type="button" className={styles.telegramModalClose} onClick={() => setIsManageModalOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className={styles.manageGroupHero}>
              <div className={styles.manageGroupAvatar}>
                {selectedChatSettings.title.slice(0, 1).toUpperCase()}
              </div>
              <div className={styles.manageGroupFields}>
                <label className={styles.telegramField}>
                  <span>Название группы</span>
                  <input
                    value={selectedChatSettings.title}
                    onChange={(event) => patchChatSettings({ title: event.target.value })}
                  />
                </label>
                <label className={styles.telegramField}>
                  <span>Описание</span>
                  <input
                    value={selectedChatSettings.description}
                    onChange={(event) => patchChatSettings({ description: event.target.value })}
                    placeholder="Описание (необязательно)"
                  />
                </label>
              </div>
            </div>
            <div className={styles.settingsList}>
              <button type="button" className={styles.settingsRow} onClick={() => setIsGroupTypeModalOpen(true)}>
                <span>Тип группы</span>
                <strong>{selectedChatSettings.groupType === "public" ? "Публичная" : "Частная"}</strong>
              </button>
              <button
                type="button"
                className={styles.settingsRow}
                onClick={() => setIsHistoryVisibilityModalOpen(true)}
              >
                <span>История чата для новых участников</span>
                <strong>{selectedChatSettings.historyVisible ? "Видна" : "Скрыта"}</strong>
              </button>
              <button type="button" className={styles.settingsRow} onClick={() => setIsTopicsModalOpen(true)}>
                <span>Темы</span>
                <strong>{selectedChatSettings.topicsEnabled ? "Включены" : "Выключены"}</strong>
              </button>
              <button type="button" className={styles.settingsRow}>
                <span>Оформление</span>
                <strong>Стандарт</strong>
              </button>
              <button type="button" className={styles.settingsRow} onClick={() => setIsPermissionsModalOpen(true)}>
                <span>Разрешения</span>
                <strong>
                  {Object.values(selectedChatSettings.permissions).filter(Boolean).length}/6
                </strong>
              </button>
              <button type="button" className={styles.settingsRow}>
                <span>Пригласительные ссылки</span>
                <strong>1</strong>
              </button>
              <button type="button" className={styles.settingsRow}>
                <span>Администраторы</span>
                <strong>1</strong>
              </button>
              <button type="button" className={styles.settingsRow}>
                <span>Участники</span>
                <strong>{(selectedChat?.participants.length || 0) + 1}</strong>
              </button>
              <button type="button" className={styles.settingsRow}>
                <span>Недавние действия</span>
                <strong>Журнал</strong>
              </button>
            </div>
            <div className={styles.telegramModalFooter}>
              <button type="button" className={styles.telegramGhostButton} onClick={() => setIsManageModalOpen(false)}>
                Отмена
              </button>
              <button type="button" className={styles.telegramPrimaryButton} onClick={() => setIsManageModalOpen(false)}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isGroupTypeModalOpen && selectedChatSettings ? (
        <div className={styles.notesOverlay} onClick={() => setIsGroupTypeModalOpen(false)}>
          <div className={styles.telegramDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.telegramDialogTitle}>Тип группы</h3>
            <button
              type="button"
              className={styles.radioRow}
              onClick={() => patchChatSettings({ groupType: "public" })}
            >
              <span className={`${styles.radioDot} ${selectedChatSettings.groupType === "public" ? styles.radioDotActive : ""}`} />
              <div>
                <strong>Публичная группа</strong>
                <p>Группу можно найти через поиск и присоединиться по ссылке.</p>
              </div>
            </button>
            <button
              type="button"
              className={styles.radioRow}
              onClick={() => patchChatSettings({ groupType: "private" })}
            >
              <span className={`${styles.radioDot} ${selectedChatSettings.groupType === "private" ? styles.radioDotActive : ""}`} />
              <div>
                <strong>Частная группа</strong>
                <p>Вход только по приглашению или ссылке.</p>
              </div>
            </button>
            <div className={styles.inviteLinkBlock}>
              <span>Постоянная ссылка</span>
              <div className={styles.inviteLinkValue}>{selectedChatSettings.inviteLink}</div>
              <div className={styles.inviteLinkActions}>
                <button type="button" className={styles.telegramPrimaryButton} onClick={() => void handleCopyInviteLink()}>
                  <Copy className="h-4 w-4" />
                  Копировать
                </button>
                <button type="button" className={styles.telegramPrimaryButton}>
                  <Share2 className="h-4 w-4" />
                  Поделиться
                </button>
              </div>
            </div>
            <div className={styles.telegramModalFooter}>
              <button type="button" className={styles.telegramGhostButton} onClick={() => setIsGroupTypeModalOpen(false)}>
                Отмена
              </button>
              <button type="button" className={styles.telegramPrimaryButton} onClick={() => setIsGroupTypeModalOpen(false)}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isHistoryVisibilityModalOpen && selectedChatSettings ? (
        <div className={styles.notesOverlay} onClick={() => setIsHistoryVisibilityModalOpen(false)}>
          <div className={styles.telegramDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.telegramDialogTitle}>История чата для новых участников</h3>
            <button
              type="button"
              className={styles.radioRow}
              onClick={() => patchChatSettings({ historyVisible: true })}
            >
              <span className={`${styles.radioDot} ${selectedChatSettings.historyVisible ? styles.radioDotActive : ""}`} />
              <div>
                <strong>Видна</strong>
                <p>Новые участники увидят полную историю сообщений.</p>
              </div>
            </button>
            <button
              type="button"
              className={styles.radioRow}
              onClick={() => patchChatSettings({ historyVisible: false })}
            >
              <span className={`${styles.radioDot} ${!selectedChatSettings.historyVisible ? styles.radioDotActive : ""}`} />
              <div>
                <strong>Скрыта</strong>
                <p>Новые участники не будут видеть более ранние сообщения.</p>
              </div>
            </button>
            <div className={styles.telegramModalFooter}>
              <button type="button" className={styles.telegramGhostButton} onClick={() => setIsHistoryVisibilityModalOpen(false)}>
                Отмена
              </button>
              <button type="button" className={styles.telegramPrimaryButton} onClick={() => setIsHistoryVisibilityModalOpen(false)}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isTopicsModalOpen && selectedChatSettings ? (
        <div className={styles.notesOverlay} onClick={() => setIsTopicsModalOpen(false)}>
          <div className={styles.telegramDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.telegramDialogTitle}>Темы</h3>
            <div className={styles.toggleRow}>
              <span>Включить темы</span>
              <button
                type="button"
                className={`${styles.toggleSwitch} ${selectedChatSettings.topicsEnabled ? styles.toggleSwitchActive : ""}`}
                onClick={() => patchChatSettings({ topicsEnabled: !selectedChatSettings.topicsEnabled })}
              >
                <span />
              </button>
            </div>
            <div className={styles.topicLayoutGrid}>
              <button
                type="button"
                className={`${styles.topicLayoutCard} ${
                  selectedChatSettings.topicsLayout === "tabs" ? styles.topicLayoutCardActive : ""
                }`}
                onClick={() => patchChatSettings({ topicsLayout: "tabs" })}
              >
                Вкладки
              </button>
              <button
                type="button"
                className={`${styles.topicLayoutCard} ${
                  selectedChatSettings.topicsLayout === "list" ? styles.topicLayoutCardActive : ""
                }`}
                onClick={() => patchChatSettings({ topicsLayout: "list" })}
              >
                Список
              </button>
            </div>
            <div className={styles.telegramModalFooter}>
              <button type="button" className={styles.telegramGhostButton} onClick={() => setIsTopicsModalOpen(false)}>
                Отмена
              </button>
              <button type="button" className={styles.telegramPrimaryButton} onClick={() => setIsTopicsModalOpen(false)}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isPermissionsModalOpen && selectedChatSettings ? (
        <div className={styles.notesOverlay} onClick={() => setIsPermissionsModalOpen(false)}>
          <div className={styles.telegramModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.telegramModalHeader}>
              <div>
                <h3 className={styles.telegramModalTitle}>Разрешения</h3>
                <p className={styles.telegramModalSubtitle}>Возможности участников</p>
              </div>
            </div>
            <div className={styles.permissionsList}>
              {[
                ["sendMessages", "Отправка сообщений"],
                ["sendMedia", "Отправка медиафайлов"],
                ["addParticipants", "Добавление участников"],
                ["createTopics", "Создание тем"],
                ["pinMessages", "Закрепление сообщений"],
                ["changeInfo", "Изменение профиля группы"],
              ].map(([key, label]) => (
                <div key={key} className={styles.permissionRow}>
                  <span>{label}</span>
                  <button
                    type="button"
                    className={`${styles.permissionToggle} ${
                      selectedChatSettings.permissions[key as keyof ChatSettings["permissions"]]
                        ? styles.permissionToggleActive
                        : ""
                    }`}
                    onClick={() =>
                      patchChatPermissions(
                        key as keyof ChatSettings["permissions"],
                        !selectedChatSettings.permissions[key as keyof ChatSettings["permissions"]]
                      )
                    }
                  >
                    {selectedChatSettings.permissions[key as keyof ChatSettings["permissions"]] ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.toggleRow}>
              <span>Сообщения за звёзды</span>
              <button
                type="button"
                className={`${styles.toggleSwitch} ${selectedChatSettings.starsOnly ? styles.toggleSwitchActive : ""}`}
                onClick={() => patchChatSettings({ starsOnly: !selectedChatSettings.starsOnly })}
              >
                <span />
              </button>
            </div>
            <div className={styles.slowModeBlock}>
              <p className={styles.slowModeTitle}>Медленный режим</p>
              <div className={styles.slowModeOptions}>
                {(["off", "5s", "10s", "30s", "1m", "5m", "15m", "1h"] as SlowMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`${styles.slowModeChip} ${
                      selectedChatSettings.slowMode === item ? styles.slowModeChipActive : ""
                    }`}
                    onClick={() => patchChatSettings({ slowMode: item })}
                  >
                    {item === "off" ? "Нет" : item}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.settingsList}>
              <div className={styles.settingsRowStatic}>
                <span>Исключения</span>
                <strong>{selectedChatSettings.exceptionsCount}</strong>
              </div>
              <div className={styles.settingsRowStatic}>
                <span>Чёрный список</span>
                <strong>{selectedChatSettings.blacklistCount}</strong>
              </div>
            </div>
            <div className={styles.telegramModalFooter}>
              <button type="button" className={styles.telegramGhostButton} onClick={() => setIsPermissionsModalOpen(false)}>
                Отмена
              </button>
              <button type="button" className={styles.telegramPrimaryButton} onClick={() => setIsPermissionsModalOpen(false)}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
};

export default PeoplePage;
