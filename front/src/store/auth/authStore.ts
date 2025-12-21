import { makeAutoObservable, runInAction } from "mobx";
import { RootStore } from "../rootStore";
import apiAgent from "../../lib/api";

export default class AuthStore {
  rootStore: RootStore;
  user: { id: string; username: string; email?: string; role?: string } | null = null;
  isAuthenticated = false;
  isLoading = false;
  hasActiveSubscription = false;
  subscriptionCheckLoading = false;

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

      // Проверяем подписку после успешного входа
      await this.checkSubscription();
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

      // Проверяем подписку после успешной регистрации
      await this.checkSubscription();
    } catch (error) {
      runInAction(() => {
        this.isLoading = false;
      });
      throw error;
    }
  }

  async checkSubscription() {
    this.subscriptionCheckLoading = true;
    try {
      const subscription = await apiAgent.get<{
        id: string;
        plan: string;
        status: string;
        expiresAt: string;
        autoRenew: boolean;
      } | null>("/subscription");

      runInAction(() => {
        // Проверяем, что подписка активна и не истекла
        // Статус из БД всегда 'ACTIVE' (uppercase)
        // Обрабатываем случай, когда API возвращает null
        const hasSubscription = subscription &&
          typeof subscription === 'object' &&
          subscription !== null;

        if (hasSubscription) {
          const status = subscription.status?.toUpperCase();
          const expiresAt = subscription.expiresAt
            ? new Date(subscription.expiresAt)
            : null;
          this.hasActiveSubscription =
            status === "ACTIVE" &&
            expiresAt !== null &&
            expiresAt > new Date();
        } else {
          // Если подписки нет (null или undefined), значит нет активной подписки
          this.hasActiveSubscription = false;
        }
        this.subscriptionCheckLoading = false;
      });
    } catch (error: any) {
      // Если подписки нет (404) или другая ошибка
      console.error("Ошибка проверки подписки:", error);
      runInAction(() => {
        this.hasActiveSubscription = false;
        this.subscriptionCheckLoading = false;
      });
    }
  }

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    runInAction(() => {
      this.user = null;
      this.isAuthenticated = false;
      this.hasActiveSubscription = false;
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
      // Проверяем подписку при проверке авторизации
      await this.checkSubscription();
    } catch {
      this.logout();
    }
  }
}

