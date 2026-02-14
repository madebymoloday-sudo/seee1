import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import apiAgent from "@/lib/api";
import styles from "./PeoplePage.module.css";

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
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [modeOpen, setModeOpen] = useState(false);
  const [modeState, setModeState] = useState<ModeState | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
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
    if (!selectedChatId && chatsData.length > 0) setSelectedChatId(chatsData[0].id);
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
    refreshChats().catch(() => toast.error("Не удалось загрузить чаты"));
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

  const handleAddFriend = async () => {
    const target = friendIdInput.trim();
    if (!target) return;
    try {
      await apiAgent.post<{ friendUserId: string }, { ok: boolean }>("/social/friends/add", {
        friendUserId: target,
      });
      setFriendIdInput("");
      await refreshChats();
      toast.success("Пользователь добавлен");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось добавить пользователя");
    }
  };

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
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось создать группу");
    }
  };

  const handleSend = async () => {
    const text = messageInput.trim();
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

  const saveNotes = () => {
    localStorage.setItem(notesKey, notesText);
    const indexKey = `${CHAT_NOTES_PREFIX}index:${myUserId}`;
    const title = selectedChat?.title || "Чат";
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
          <aside className={styles.left}>
            <div className={styles.section}>
              <h3 className={styles.title}>Добавить в друзья по ID</h3>
              <div className={styles.row}>
                <Input
                  value={friendIdInput}
                  onChange={(e) => setFriendIdInput(e.target.value)}
                  placeholder="Введите ID пользователя"
                  className={styles.input}
                />
                <Button onClick={handleAddFriend}>Добавить</Button>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.row}>
                <Button variant="outline" onClick={handleCreateGroup}>
                  Создать группу
                </Button>
                <span className={styles.chatSubtitle}>Друзей: {friends.length}</span>
              </div>
            </div>

            <div className={styles.chatsList}>
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  className={`${styles.chatItem} ${selectedChatId === chat.id ? styles.chatItemActive : ""}`}
                  onClick={() => setSelectedChatId(chat.id)}
                >
                  <div className={styles.chatTitle}>{chat.title}</div>
                  <div className={styles.chatSubtitle}>
                    {chat.lastMessage
                      ? `[${chat.lastMessage.mode}] ${chat.lastMessage.content}`
                      : chat.isGroup
                      ? "Групповой чат"
                      : "Личный чат"}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.right}>
            {selectedChat ? (
              <>
                <div className={styles.chatHeader}>
                  <span>{selectedChat.title}</span>
                  <span className={styles.modeBadge}>
                    {modeState?.activeMode === "Объяснить" ? 'Режим: "Объяснить"' : "Обычный режим"}
                  </span>
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
                          <Button size="sm" variant="ghost" onClick={() => handleExplainControl("finish")}>
                            Закончить
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
                {modeState?.canControl && modeState.activeMode === "Объяснить" ? (
                  <div className={styles.stepControls}>
                    <Button size="sm" variant="outline" onClick={() => handleExplainControl("back")}>
                      Назад
                    </Button>
                    <Button size="sm" onClick={() => handleExplainControl("next")}>
                      Далее
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleExplainControl("finish")}>
                      Закончить
                    </Button>
                  </div>
                ) : null}
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

                  {modeState?.activeMode === "Объяснить" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={styles.notesButton}
                      title="Приватные заметки"
                      onClick={() => setNotesOpen(true)}
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={
                      modeState?.activeMode === "Объяснить"
                        ? `Режим "Объяснить" · ${
                            modeState.canControl
                              ? "ответьте и нажмите Далее"
                              : "обычные сообщения доступны"
                          }`
                        : "Введите сообщение"
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button onClick={handleSend}>Отправить</Button>
                </div>
              </>
            ) : (
              <div className={styles.placeholder}>Выберите чат или добавьте друга</div>
            )}
          </section>
        </div>
      </div>
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

