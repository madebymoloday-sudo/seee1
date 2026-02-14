import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
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
  createdAt: string;
  sender: { id: string; username: string; userId?: string | null; avatarUrl?: string | null };
};

const MODES = ["Объяснить", "Разобрать", "Помириться", "Узнать друг друга ближе", "Поиграть"] as const;

const PeoplePage = () => {
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friendIdInput, setFriendIdInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [modeOpen, setModeOpen] = useState(false);
  const [mode, setMode] = useState<(typeof MODES)[number]>("Объяснить");
  const myUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem("accessToken");
      if (!raw) return "";
      const [, payload] = raw.split(".");
      if (!payload) return "";
      return JSON.parse(atob(payload)).sub || "";
    } catch {
      return "";
    }
  }, []);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) || null,
    [chats, selectedChatId]
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

  useEffect(() => {
    refreshChats().catch(() => toast.error("Не удалось загрузить чаты"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    loadMessages(selectedChatId).catch(() => toast.error("Не удалось загрузить сообщения"));
  }, [selectedChatId]);

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
      await apiAgent.post<{ content: string; mode: string }, ChatMessage>(
        `/social/chats/${selectedChatId}/messages`,
        { content: text, mode }
      );
      setMessageInput("");
      await loadMessages(selectedChatId);
      await refreshChats();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось отправить сообщение");
    }
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
                <div className={styles.chatHeader}>{selectedChat.title}</div>
                <div className={styles.messages}>
                  {messages.map((m) => {
                    const mine = m.sender.id === myUserId;
                    return (
                      <div key={m.id} className={`${styles.bubble} ${mine ? styles.mine : ""}`}>
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
                        {MODES.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={styles.modeBtn}
                            onClick={() => {
                              setMode(item);
                              setModeOpen(false);
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Режим: ${mode}`}
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
    </Layout>
  );
};

export default PeoplePage;

