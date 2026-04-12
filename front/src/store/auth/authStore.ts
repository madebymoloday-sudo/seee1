import { makeAutoObservable, runInAction } from "mobx";
import { RootStore } from "../rootStore";
import apiAgent from "../../lib/api";
import {
  clearGamificationMirror,
  hydrateGamificationSnapshot,
  syncLocalGamificationRewardsToServer,
} from "../../lib/gamification";

export default class AuthStore {
  rootStore: RootStore;
  user:
    | {
        id: string;
        username: string;
        email?: string;
        role?: string;
        accountType?: "USER" | "MANAGER" | "TEAM_MEMBER";
        dailyPracticeMinutes?: 5 | 10 | 15 | null;
        userId?: string | null;
        telegramId?: string | null;
        subscriptionStatus?: "NONE" | "ACTIVE" | "CANCELED";
        subscriptionActive?: boolean;
        subscriptionEndsAt?: string | null;
        balance?: number;
        dailyStreak?: number;
      }
    | null = null;
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
          user: {
            id: string;
            username: string;
            email?: string;
            role?: string;
            accountType?: "USER" | "MANAGER" | "TEAM_MEMBER";
            dailyPracticeMinutes?: 5 | 10 | 15 | null;
            userId?: string | null;
            telegramId?: string | null;
            subscriptionStatus?: "NONE" | "ACTIVE" | "CANCELED";
            subscriptionActive?: boolean;
            subscriptionEndsAt?: string | null;
            balance?: number;
            dailyStreak?: number;
          };
        }
      >("/auth/login", { email, password });

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);
      const syncResult = await syncLocalGamificationRewardsToServer(
        response.user.balance ?? 0,
      );
      const nextBalance = Math.max(
        0,
        Math.floor(
          Number(
            syncResult.balance ?? response.user.balance ?? 0,
          ),
        ),
      );
      hydrateGamificationSnapshot(
        nextBalance,
        response.user.dailyStreak ?? 0,
      );

      runInAction(() => {
        this.user = {
          ...response.user,
          balance: nextBalance,
        };
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

  async register(data: {
    email: string;
    password: string;
    name: string;
    username: string;
    referrerId?: string;
    teamInviteCode?: string;
  }) {
    this.isLoading = true;
    try {
      const response = await apiAgent.post<
        {
          email: string;
          password: string;
          name: string;
          username: string;
          referrerId?: string;
          teamInviteCode?: string;
        },
        {
          accessToken: string;
          refreshToken: string;
          user: {
            id: string;
            username: string;
            email?: string;
            role?: string;
            accountType?: "USER" | "MANAGER" | "TEAM_MEMBER";
            dailyPracticeMinutes?: 5 | 10 | 15 | null;
            userId?: string | null;
            telegramId?: string | null;
            subscriptionStatus?: "NONE" | "ACTIVE" | "CANCELED";
            subscriptionActive?: boolean;
            subscriptionEndsAt?: string | null;
            balance?: number;
            dailyStreak?: number;
          };
        }
      >("/auth/register", data);

      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);
      const syncResult = await syncLocalGamificationRewardsToServer(
        response.user.balance ?? 0,
      );
      const nextBalance = Math.max(
        0,
        Math.floor(
          Number(
            syncResult.balance ?? response.user.balance ?? 0,
          ),
        ),
      );
      hydrateGamificationSnapshot(
        nextBalance,
        response.user.dailyStreak ?? 0,
      );

      runInAction(() => {
        this.user = {
          ...response.user,
          balance: nextBalance,
        };
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
    clearGamificationMirror();
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
        accountType?: "USER" | "MANAGER" | "TEAM_MEMBER";
        dailyPracticeMinutes?: 5 | 10 | 15 | null;
        userId?: string | null;
        telegramId?: string | null;
        subscriptionStatus?: "NONE" | "ACTIVE" | "CANCELED";
        subscriptionActive?: boolean;
        subscriptionEndsAt?: string | null;
        balance?: number;
        dailyStreak?: number;
      }>("/auth/me");
      const syncResult = await syncLocalGamificationRewardsToServer(
        user.balance ?? 0,
      );
      const nextBalance = Math.max(
        0,
        Math.floor(Number(syncResult.balance ?? user.balance ?? 0)),
      );
      hydrateGamificationSnapshot(nextBalance, user.dailyStreak ?? 0);
      runInAction(() => {
        this.user = {
          ...user,
          balance: nextBalance,
        };
        this.isAuthenticated = true;
      });
    } catch {
      this.logout();
    }
  }
}
