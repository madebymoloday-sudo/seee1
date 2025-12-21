import { makeAutoObservable, runInAction } from "mobx";
import { RootStore } from "../rootStore";
import apiAgent from "../../lib/api";

interface SessionResponseDto {
  id: string;
  userId: string;
  title: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default class SessionsStore {
  rootStore: RootStore;
  sessions: SessionResponseDto[] = [];
  currentSession: SessionResponseDto | null = null;
  isLoading = false;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async fetchSessions() {
    this.isLoading = true;
    try {
      const sessions = await apiAgent.get<SessionResponseDto[]>("/sessions");
      runInAction(() => {
        this.sessions = sessions;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async createSession(title?: string) {
    this.isLoading = true;
    try {
      const session = await apiAgent.post<
        { title?: string },
        SessionResponseDto
      >("/sessions", { title });
      runInAction(() => {
        this.sessions.unshift(session);
        this.currentSession = session;
        this.isLoading = false;
      });
      return session;
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  setCurrentSession(session: SessionResponseDto | null) {
    this.currentSession = session;
  }
}

