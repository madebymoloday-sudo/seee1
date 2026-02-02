import { makeAutoObservable, runInAction } from "mobx";
import { RootStore } from "../rootStore";
import apiAgent from "../../lib/api";

export default class AuthStore {
  rootStore: RootStore;
  user: { id: string; username: string; email?: string; role?: string } | null = null;
  isAuthenticated = false;
  isLoading = false;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {
      isAdmin: true, // Mark as computed
    }, { autoBind: true });

    // Проверяем токен при инициализации
    this.checkAuth();
  }

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  async login(email: string, password: string) {
    this.isLoading = true;
    try {
      const response = await apiAgent.post<
        { email: string; password: string },
        {
          accessToken: string;
          refreshToken: string;
          user: { id: string; username: string; email?: string; role?: string };
        }
      >("/auth/login", { email, password });

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);

      runInAction(() => {
        this.user = response.user;
        this.isAuthenticated = true;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async register(data: { email: string; password: string; name: string; username: string }) {
    this.isLoading = true;
    try {
      const response = await apiAgent.post<
        { email: string; password: string; name: string; username: string },
        {
          accessToken: string;
          refreshToken: string;
          user: { id: string; username: string; email?: string; role?: string };
        }
      >("/auth/register", data);

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);

      runInAction(() => {
        this.user = response.user;
        this.isAuthenticated = true;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    runInAction(() => {
      this.user = null;
      this.isAuthenticated = false;
    });
  }

  async checkAuth() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      this.isAuthenticated = false;
      return;
    }

    try {
      const user = await apiAgent.get<{
        id: string;
        username: string;
        email?: string;
        role?: string;
      }>("/auth/me");
      runInAction(() => {
        this.user = user;
        this.isAuthenticated = true;
      });
    } catch {
      this.logout();
    }
  }
}

