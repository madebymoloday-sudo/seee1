import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Plus, Search, StickyNote, Users } from "lucide-react";
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
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
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
      if (!quickActionsRef.current) return;
      if (!quickActionsRef.current.contains(event.target as Node)) {
        setIsQuickActionsOpen(false);
      }
    };
    if (isQuickActionsOpen) {
      document.addEventListener("mousedown", onOutside);
    }
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isQuickActionsOpen]);

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
                    <span>{selectedChat.title}</span>
                  </div>
                  <div className={styles.headerActions}>
                    <span className={styles.modeBadge}>
                      {modeState?.activeMode === "Объяснить" ? 'Режим: "Объяснить"' : "Обычный режим"}
                    </span>
                    {modeState?.canControl && modeState.activeMode === "Объяснить" ? (
                      <Button size="sm" variant="ghost" onClick={() => handleExplainControl("finish")}>
                        Закончить
                      </Button>
                    ) : null}
                  </div>
                </div>
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
                    return (
                      <div
                        key={m.id}
                        className={`${styles.bubble} ${mine ? styles.mine : ""}`}
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
        onNewSession={() => navigate("/sessions/new")}
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
    </Layout>
  );
};

export default PeoplePage;
