import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Briefcase,
  Calendar,
  CheckSquare,
  FileText,
  Folder,
  LogOut,
  Mic,
  MessageCircle,
  Send,
  Sitemap,
  User,
  UsersRound,
} from "lucide-react";
import styles from "./TeamLoginPage.module.css";

type FolderItem = {
  id: string;
  label: string;
  icon: typeof Folder;
};

const folders: FolderItem[] = [
  { id: "workspace", label: "Рабочая папка", icon: Briefcase },
  { id: "personal", label: "Личные вопросы", icon: MessageCircle },
  { id: "tasks", label: "Задачи", icon: CheckSquare },
  { id: "meetings", label: "Запись встречи", icon: Calendar },
  { id: "docs", label: "Документы", icon: FileText },
];

const initialMessages = [
  {
    id: "m1",
    author: "Seee Team",
    text:
      "Я готов помочь с рабочими задачами: личные вопросы, документы, встречи, задачи и рабочие папки команды.",
  },
  {
    id: "m2",
    author: "Павел Гуло",
    text:
      "Открой папку с текущей работой и помоги структурировать следующий шаг.",
  },
];

export default function TeamLoginPage() {
  const navigate = useNavigate();
  const [activeFolder, setActiveFolder] = useState("workspace");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);

  const activeFolderLabel =
    folders.find((folder) => folder.id === activeFolder)?.label ?? "Рабочая папка";

  const sendMessage = () => {
    const cleanMessage = message.trim();

    if (!cleanMessage) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        author: "Павел Гуло",
        text: cleanMessage,
      },
    ]);
    setMessage("");
  };

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.logoCircle}>S</div>
          <div>
            <p className={styles.brandName}>Seee Team</p>
            <p className={styles.brandCaption}>Командный вход</p>
          </div>
        </div>

        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>П</div>
          <div>
            <p className={styles.profileName}>Павел Гуло</p>
            <p className={styles.profileRole}>Командный доступ</p>
          </div>
        </div>

        <nav className={styles.topNav} aria-label="Разделы команды">
          <button className={styles.navButton} type="button">
            <Sitemap size={16} />
            Оргсхема
          </button>
          <button className={styles.navButton} type="button">
            <User size={16} />
            Личный кабинет
          </button>
          <button className={styles.navButton} type="button" onClick={() => navigate("/login")}>
            <LogOut size={16} />
            Выйти
          </button>
        </nav>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Папки</span>
            <button type="button">Добавить</button>
          </div>
          <div className={styles.folderList}>
            {folders.map((folder) => {
              const Icon = folder.icon;
              const isActive = folder.id === activeFolder;

              return (
                <button
                  key={folder.id}
                  type="button"
                  className={`${styles.folderButton} ${isActive ? styles.folderButtonActive : ""}`}
                  onClick={() => setActiveFolder(folder.id)}
                >
                  <Icon size={16} />
                  <span>{folder.label}</span>
                  <small>ИИ</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Чаты</span>
            <button type="button">Новый чат</button>
          </div>
          <button className={styles.chatPreview} type="button">
            <span>22.04, 21:45</span>
            <small>{activeFolderLabel}</small>
          </button>
        </section>
      </aside>

      <section className={styles.chatArea}>
        <header className={styles.chatHeader}>
          <div>
            <p className={styles.chatKicker}>Папка сейчас</p>
            <h1>{activeFolderLabel}</h1>
            <span>ИИ-помощник команды работает внутри выбранной папки.</span>
          </div>
          <button type="button" className={styles.renameButton}>
            Переименовать чат
          </button>
        </header>

        <div className={styles.messageList}>
          {messages.map((item, index) => (
            <article
              key={item.id}
              className={`${styles.messageBubble} ${
                index % 2 === 0 ? styles.assistantBubble : styles.userBubble
              }`}
            >
              <div className={styles.messageAuthor}>
                {index % 2 === 0 ? <Bot size={14} /> : <UsersRound size={14} />}
                {item.author}
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>

        <footer className={styles.composer}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Сообщение в "${activeFolderLabel}"`}
            rows={2}
          />
          <div className={styles.composerActions}>
            <button type="button" className={styles.voiceButton}>
              <Mic size={16} />
              микрофон
            </button>
            <button type="button" className={styles.sendButton} onClick={sendMessage}>
              <Send size={16} />
              Отправить
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
