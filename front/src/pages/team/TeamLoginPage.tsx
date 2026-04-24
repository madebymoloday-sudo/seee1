import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronRight,
  FileText,
  Folder,
  GitBranch,
  LogOut,
  Mic,
  MessageCircle,
  Send,
  ShieldCheck,
  User,
  UsersRound,
} from "lucide-react";
import styles from "./TeamLoginPage.module.css";
import {
  flattenOrgNodes,
  getOrgRoleProfile,
  teamOrgRoot,
  type TeamOrgNode,
} from "./teamOrgData";

type FolderItem = {
  id: string;
  label: string;
  icon: typeof Folder;
};

type TeamAccount = {
  id: string;
  fullName: string;
  login: string;
  password: string;
  phone: string;
  branch: string;
  role: string;
};

type WorkspaceSection = "assistant" | "org" | "cabinet";
type AuthMode = "login" | "register";

const TEAM_ACCOUNTS_STORAGE_KEY = "seee-team-accounts";
const TEAM_SESSION_STORAGE_KEY = "seee-team-session";

const defaultAccounts: TeamAccount[] = [
  {
    id: "team-pavel",
    fullName: "Павел Гуло",
    login: "pavel_gulo",
    password: "seee-team",
    phone: "",
    branch: "Сеть",
    role: "Исполнительный директор",
  },
];

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
      "Командный контур открыт. Здесь можно вести задачи, встречи, документы и рабочие папки внутри одного пространства.",
  },
  {
    id: "m2",
    author: "Павел Гуло",
    text: "Покажи следующую рабочую задачу и напомни ключевые приоритеты по команде.",
  },
];

function ensureDefaultAccounts(accounts: TeamAccount[]) {
  const known = new Map(accounts.map((account) => [account.id, account]));

  for (const account of defaultAccounts) {
    if (!known.has(account.id)) {
      known.set(account.id, account);
    }
  }

  return Array.from(known.values());
}

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function findNodeById(node: TeamOrgNode, targetId: string): TeamOrgNode | null {
  if (node.id === targetId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findNodeById(child, targetId);

    if (found) {
      return found;
    }
  }

  return null;
}

function OrgBranch({
  node,
  selectedNodeId,
  onSelect,
}: {
  node: TeamOrgNode;
  selectedNodeId: string;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <article className={styles.orgBranch}>
      <button
        type="button"
        className={`${styles.orgRoleCard} ${selectedNodeId === node.id ? styles.orgRoleCardActive : ""}`}
        onClick={() => onSelect(node.id)}
      >
        <div>
          <p className={styles.orgRoleType}>роль</p>
          <h3>{node.title}</h3>
        </div>
        <span className={styles.orgRoleAssignee}>{node.assigneeName ?? "Не назначено"}</span>
      </button>

      {node.children?.length ? (
        <div className={styles.orgDepartmentList}>
          {node.children.map((child) => (
            <div key={child.id} className={styles.orgDepartmentCard}>
              <button
                type="button"
                className={`${styles.orgDepartmentHeader} ${
                  selectedNodeId === child.id ? styles.orgDepartmentHeaderActive : ""
                }`}
                onClick={() => onSelect(child.id)}
              >
                <span>{child.title}</span>
                <small>{child.children?.length ?? 0} отдела</small>
              </button>

              {child.children?.length ? (
                <div className={styles.orgSectionList}>
                  {child.children.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`${styles.orgSectionChip} ${
                        selectedNodeId === section.id ? styles.orgSectionChipActive : ""
                      }`}
                      onClick={() => onSelect(section.id)}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function TeamLoginPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [accounts, setAccounts] = useState<TeamAccount[]>(defaultAccounts);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("assistant");
  const [activeFolder, setActiveFolder] = useState("workspace");
  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState("executive");
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registrationDraft, setRegistrationDraft] = useState({
    fullName: "",
    login: "",
    password: "",
    phone: "",
    branch: "Сеть",
  });
  const [registrationError, setRegistrationError] = useState("");
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawAccounts = window.localStorage.getItem(TEAM_ACCOUNTS_STORAGE_KEY);
      const savedAccounts = rawAccounts ? (JSON.parse(rawAccounts) as TeamAccount[]) : [];
      const nextAccounts = ensureDefaultAccounts(savedAccounts);
      setAccounts(nextAccounts);
      window.localStorage.setItem(TEAM_ACCOUNTS_STORAGE_KEY, JSON.stringify(nextAccounts));

      const savedSessionId = window.localStorage.getItem(TEAM_SESSION_STORAGE_KEY);
      const hasSession = nextAccounts.some((account) => account.id === savedSessionId);
      setCurrentAccountId(hasSession ? savedSessionId : null);
    } catch (_error) {
      window.localStorage.removeItem(TEAM_ACCOUNTS_STORAGE_KEY);
      window.localStorage.removeItem(TEAM_SESSION_STORAGE_KEY);
      setAccounts(defaultAccounts);
      setCurrentAccountId(null);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(TEAM_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (currentAccountId) {
      window.localStorage.setItem(TEAM_SESSION_STORAGE_KEY, currentAccountId);
    } else {
      window.localStorage.removeItem(TEAM_SESSION_STORAGE_KEY);
    }
  }, [currentAccountId]);

  const currentAccount =
    accounts.find((account) => account.id === currentAccountId) ??
    defaultAccounts.find((account) => account.id === currentAccountId) ??
    null;

  const activeFolderLabel =
    folders.find((folder) => folder.id === activeFolder)?.label ?? "Рабочая папка";

  const selectedNode =
    findNodeById(teamOrgRoot, selectedOrgNodeId) ?? teamOrgRoot;

  const selectedProfile = useMemo(
    () => getOrgRoleProfile(selectedNode.id, selectedNode.title),
    [selectedNode.id, selectedNode.title],
  );

  const orgNodesCount = useMemo(() => flattenOrgNodes(teamOrgRoot).length, []);

  const handleSendMessage = () => {
    const cleanMessage = message.trim();

    if (!cleanMessage || !currentAccount) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        author: currentAccount.fullName,
        text: cleanMessage,
      },
    ]);
    setMessage("");
  };

  const submitLogin = () => {
    const identifier = loginIdentifier.trim().toLowerCase();
    const password = loginPassword.trim();

    if (!identifier || !password) {
      setLoginError("Введите логин и пароль.");
      return;
    }

    const account = accounts.find(
      (item) =>
        item.login.toLowerCase() === identifier || item.fullName.toLowerCase() === identifier,
    );

    if (!account) {
      setLoginError("Аккаунт не найден.");
      return;
    }

    if (account.password !== password) {
      setLoginError("Неверный пароль.");
      return;
    }

    setCurrentAccountId(account.id);
    setLoginError("");
    setLoginIdentifier("");
    setLoginPassword("");
  };

  const submitRegistration = () => {
    const fullName = registrationDraft.fullName.trim();
    const login = registrationDraft.login.trim().toLowerCase();
    const password = registrationDraft.password.trim();

    if (!fullName || !login || !password) {
      setRegistrationError("Заполните ФИО, логин и пароль.");
      return;
    }

    const loginIsTaken = accounts.some((account) => account.login.toLowerCase() === login);

    if (loginIsTaken) {
      setRegistrationError("Такой логин уже занят.");
      return;
    }

    const newAccount: TeamAccount = {
      id: `team-${Date.now()}`,
      fullName,
      login,
      password,
      phone: registrationDraft.phone.trim(),
      branch: registrationDraft.branch.trim() || "Сеть",
      role: fullName.toLowerCase() === "павел гуло" ? "Исполнительный директор" : "Член команды",
    };

    const nextAccounts = [...accounts, newAccount];
    setAccounts(nextAccounts);
    setCurrentAccountId(newAccount.id);
    setRegistrationDraft({
      fullName: "",
      login: "",
      password: "",
      phone: "",
      branch: "Сеть",
    });
    setRegistrationError("");
  };

  const logout = () => {
    setCurrentAccountId(null);
    setActiveSection("assistant");
    setActiveFolder("workspace");
    setAuthMode("login");
  };

  if (!currentAccount) {
    return (
      <main className={styles.authPage}>
        <section className={styles.authHero}>
          <div className={styles.authBrand}>
            <div className={styles.authLogo}>S</div>
            <div>
              <p className={styles.authBrandName}>Seee Team</p>
              <p className={styles.authBrandCaption}>Командное рабочее пространство</p>
            </div>
          </div>

          <div className={styles.authCopyWrap}>
            <p className={styles.authEyebrow}>Вход для команды</p>
            <h1>Логин сотрудников и регистрация новых участников команды</h1>
            <p className={styles.authCopy}>
              После входа открывается командный контур: оргсхема, личный кабинет, рабочие папки,
              задачи, документы и ИИ-чат внутри выбранной папки.
            </p>
          </div>

          <div className={styles.authFactGrid}>
            <article className={styles.authFactCard}>
              <span>{orgNodesCount}</span>
              <p>узлов оргсхемы перенесено из Grand Clinic</p>
            </article>
            <article className={styles.authFactCard}>
              <span>1</span>
              <p>человек в списке команды сейчас: Павел Гуло</p>
            </article>
            <article className={styles.authFactCard}>
              <span>5</span>
              <p>рабочих папок доступны сразу после входа</p>
            </article>
          </div>
        </section>

        <section className={styles.authCard}>
          <div className={styles.authTabRow}>
            <button
              type="button"
              className={`${styles.authTab} ${authMode === "login" ? styles.authTabActive : ""}`}
              onClick={() => {
                setAuthMode("login");
                setRegistrationError("");
              }}
            >
              Войти
            </button>
            <button
              type="button"
              className={`${styles.authTab} ${authMode === "register" ? styles.authTabActive : ""}`}
              onClick={() => {
                setAuthMode("register");
                setLoginError("");
              }}
            >
              Регистрация
            </button>
          </div>

          {authMode === "login" ? (
            <div className={styles.authForm}>
              <label className={styles.authField}>
                <span>Логин</span>
                <input
                  value={loginIdentifier}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  placeholder="Логин или ФИО"
                />
              </label>
              <label className={styles.authField}>
                <span>Пароль</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Введите пароль"
                />
              </label>
              <div className={styles.authHint}>
                Для тестового входа владельца: <strong>pavel_gulo</strong> / <strong>seee-team</strong>
              </div>
              {loginError ? <div className={styles.authError}>{loginError}</div> : null}
              <div className={styles.authActions}>
                <button type="button" className={styles.authGhostButton} onClick={() => navigate("/login")}>
                  Назад
                </button>
                <button type="button" className={styles.authPrimaryButton} onClick={submitLogin}>
                  Войти
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.authForm}>
              <label className={styles.authField}>
                <span>ФИО</span>
                <input
                  value={registrationDraft.fullName}
                  onChange={(event) =>
                    setRegistrationDraft((current) => ({ ...current, fullName: event.target.value }))
                  }
                  placeholder="Введите имя сотрудника"
                />
              </label>
              <label className={styles.authField}>
                <span>Логин</span>
                <input
                  value={registrationDraft.login}
                  onChange={(event) =>
                    setRegistrationDraft((current) => ({ ...current, login: event.target.value }))
                  }
                  placeholder="Например: team.member"
                />
              </label>
              <label className={styles.authField}>
                <span>Пароль</span>
                <input
                  type="password"
                  value={registrationDraft.password}
                  onChange={(event) =>
                    setRegistrationDraft((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Придумайте пароль"
                />
              </label>
              <label className={styles.authField}>
                <span>Телефон</span>
                <input
                  value={registrationDraft.phone}
                  onChange={(event) =>
                    setRegistrationDraft((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="+7 (999) 000-00-00"
                />
              </label>
              <label className={styles.authField}>
                <span>Контур</span>
                <input
                  value={registrationDraft.branch}
                  onChange={(event) =>
                    setRegistrationDraft((current) => ({ ...current, branch: event.target.value }))
                  }
                  placeholder="Сеть"
                />
              </label>
              {registrationError ? <div className={styles.authError}>{registrationError}</div> : null}
              <div className={styles.authActions}>
                <button type="button" className={styles.authGhostButton} onClick={() => navigate("/login")}>
                  Назад
                </button>
                <button
                  type="button"
                  className={styles.authPrimaryButton}
                  onClick={submitRegistration}
                >
                  Зарегистрироваться
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

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
          <div className={styles.profileAvatar}>{getInitials(currentAccount.fullName) || "П"}</div>
          <div>
            <p className={styles.profileName}>{currentAccount.fullName}</p>
            <p className={styles.profileRole}>
              {currentAccount.role} · {currentAccount.branch}
            </p>
          </div>
        </div>

        <nav className={styles.topNav} aria-label="Разделы команды">
          <button
            className={styles.navButton}
            type="button"
            onClick={() => setActiveSection("org")}
          >
            <GitBranch size={16} />
            Оргсхема
          </button>
          <button
            className={styles.navButton}
            type="button"
            onClick={() => setActiveSection("cabinet")}
          >
            <User size={16} />
            Личный кабинет
          </button>
          <button className={styles.navButton} type="button" onClick={logout}>
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
                  onClick={() => {
                    setActiveFolder(folder.id);
                    setActiveSection("assistant");
                  }}
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
          <button className={styles.chatPreview} type="button" onClick={() => setActiveSection("assistant")}>
            <span>24.04, 12:16</span>
            <small>{activeFolderLabel}</small>
          </button>
        </section>
      </aside>

      <section className={styles.chatArea}>
        {activeSection === "assistant" ? (
          <>
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
                    handleSendMessage();
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
                <button type="button" className={styles.sendButton} onClick={handleSendMessage}>
                  <Send size={16} />
                  Отправить
                </button>
              </div>
            </footer>
          </>
        ) : null}

        {activeSection === "org" ? (
          <div className={styles.orgLayout}>
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.chatKicker}>Организационная схема</p>
                <h1>Структура компании и функции ролей</h1>
                <span>
                  Схема и роли перенесены из Grand Clinic. В списке участников команды оставлен только Павел Гуло.
                </span>
              </div>
            </header>

            <div className={styles.orgExecutiveWrap}>
              <button
                type="button"
                className={`${styles.orgExecutiveCard} ${
                  selectedOrgNodeId === teamOrgRoot.id ? styles.orgExecutiveCardActive : ""
                }`}
                onClick={() => setSelectedOrgNodeId(teamOrgRoot.id)}
              >
                <p className={styles.orgRoleType}>верхний уровень</p>
                <h2>{teamOrgRoot.title}</h2>
                <span>{teamOrgRoot.assigneeName}</span>
              </button>
            </div>

            <div className={styles.orgMainGrid}>
              <div className={styles.orgCanvas}>
                <div className={styles.orgDeputyGrid}>
                  {teamOrgRoot.children?.map((branch) => (
                    <OrgBranch
                      key={branch.id}
                      node={branch}
                      selectedNodeId={selectedOrgNodeId}
                      onSelect={setSelectedOrgNodeId}
                    />
                  ))}
                </div>
              </div>

              <aside className={styles.orgDetailPanel}>
                <div className={styles.orgDetailHeader}>
                  <p className={styles.orgRoleType}>карточка роли</p>
                  <h3>{selectedProfile.title}</h3>
                  <span>{selectedNode.assigneeName ?? "Роль пока не назначена"}</span>
                </div>

                <section className={styles.orgDetailSection}>
                  <h4>ЦКП</h4>
                  {selectedProfile.ckp.map((item) => (
                    <p key={item} className={styles.orgLeadText}>
                      {item}
                    </p>
                  ))}
                </section>

                <section className={styles.orgDetailSection}>
                  <h4>Ключевые показатели</h4>
                  <div className={styles.orgStatsGrid}>
                    {selectedProfile.statistics.map((item) => (
                      <article key={item.label} className={styles.orgStatCard}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.orgDetailSection}>
                  <h4>KPI</h4>
                  <div className={styles.orgList}>
                    {selectedProfile.kpi.map((item) => (
                      <div key={item} className={styles.orgListItem}>
                        <ChevronRight size={14} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.orgDetailSection}>
                  <h4>В зоне ответственности</h4>
                  <div className={styles.orgList}>
                    {selectedProfile.scopeIn.map((item) => (
                      <div key={item} className={styles.orgListItem}>
                        <ShieldCheck size={14} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.orgDetailSection}>
                  <h4>Вне зоны ответственности</h4>
                  <div className={styles.orgList}>
                    {selectedProfile.scopeOut.map((item) => (
                      <div key={item} className={styles.orgListItem}>
                        <ChevronRight size={14} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.orgDetailSection}>
                  <h4>Список команды</h4>
                  <div className={styles.singleMemberCard}>
                    <div className={styles.singleMemberAvatar}>ПГ</div>
                    <div>
                      <strong>Павел Гуло</strong>
                      <p>Единственный отображаемый участник команды в этой версии.</p>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        ) : null}

        {activeSection === "cabinet" ? (
          <div className={styles.cabinetLayout}>
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.chatKicker}>Личный кабинет</p>
                <h1>{currentAccount.fullName}</h1>
                <span>Профиль командного доступа и базовые параметры входа.</span>
              </div>
            </header>

            <div className={styles.cabinetGrid}>
              <article className={styles.cabinetCard}>
                <p className={styles.cabinetLabel}>Роль</p>
                <strong>{currentAccount.role}</strong>
                <span>Текущий контур: {currentAccount.branch}</span>
              </article>
              <article className={styles.cabinetCard}>
                <p className={styles.cabinetLabel}>Логин</p>
                <strong>{currentAccount.login}</strong>
                <span>Используется для входа команды</span>
              </article>
              <article className={styles.cabinetCard}>
                <p className={styles.cabinetLabel}>Телефон</p>
                <strong>{currentAccount.phone || "Не указан"}</strong>
                <span>Контакт участника команды</span>
              </article>
              <article className={styles.cabinetCard}>
                <p className={styles.cabinetLabel}>Доступы</p>
                <strong>Оргсхема, кабинет, папки, чат</strong>
                <span>Базовый командный набор</span>
              </article>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
