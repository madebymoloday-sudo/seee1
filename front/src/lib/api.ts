import type { AxiosInstance, AxiosRequestConfig } from "axios";
import axios from "axios";
import { toast } from "sonner";

// BASE_URL для apiAgent - используем /api/v1 по умолчанию
// Но если используется VITE_API_URL, он может быть полным URL
const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

class ApiAgent {
  axiosInstance: AxiosInstance;
  private baseUrl: string;

  constructor(apiUrl: string) {
    this.baseUrl = apiUrl;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
    });

    // Авторизация через interceptor
    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Refresh token interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error.response?.status;
        const errorMessage = error.response?.data?.message;
        const url = error.config?.url || "unknown";
        const method = error.config?.method?.toUpperCase() || "UNKNOWN";

        // message может быть строкой или массивом
        const messageText =
          typeof errorMessage === "string"
            ? errorMessage
            : Array.isArray(errorMessage)
            ? errorMessage[0]
            : "";

        // Логируем все ошибки API запросов
        console.error(`[API Error] ${method} ${url}:`, {
          status,
          message: messageText || error.message || "Unknown error",
          data: error.response?.data,
          error: error.message,
        });

        // Не пытаемся обновлять токен для запросов аутентификации
        const isAuthEndpoint =
          error.config?.url?.includes("/auth/login") ||
          error.config?.url?.includes("/auth/register");

        // Проверяем на ошибку 503 с сообщением о не настроенном LLM
        const isLLMNotConfigured =
          status === 503 &&
          (messageText?.includes("LLM не настроен") ||
            messageText?.includes("не подключен LLM API ключ"));

        if (isLLMNotConfigured) {
          toast.error(
            messageText || "LLM не настроен. Обратитесь к администратору."
          );
        }

        // Проверяем на 403 с сообщением об устаревшем токене или 401
        const isTokenExpired =
          (status === 403 && messageText === "токен устарел") || status === 401;

        if (isTokenExpired && !error.config._retry && !isAuthEndpoint) {
          error.config._retry = true;
          const refreshToken = localStorage.getItem("refreshToken");

          if (refreshToken) {
            try {
              // Используем baseUrl из конструктора
              const { data } = await axios.post(
                `${this.baseUrl}/auth/refresh`,
                {
                  refreshToken,
                }
              );
              localStorage.setItem("accessToken", data.accessToken);
              localStorage.setItem("refreshToken", data.refreshToken);
              // Повторяем запрос
              error.config.headers.Authorization = `Bearer ${data.accessToken}`;
              return this.axiosInstance.request(error.config);
            } catch (refreshError) {
              console.error("[API Error] Token refresh failed:", refreshError);
              // Логика выхода
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              window.location.href = "/login";
            }
          } else {
            // Если нет refresh токена, редиректим на логин
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<R>(url: string, config?: AxiosRequestConfig): Promise<R> {
    return (await this.axiosInstance.get(url, config)).data;
  }

  async post<P, R>(
    url: string,
    data?: P,
    config?: AxiosRequestConfig
  ): Promise<R> {
    return (await this.axiosInstance.post(url, data, config)).data;
  }

  async put<P, R>(
    url: string,
    data?: P,
    config?: AxiosRequestConfig
  ): Promise<R> {
    return (await this.axiosInstance.put(url, data, config)).data;
  }

  async patch<P, R>(
    url: string,
    data?: P,
    config?: AxiosRequestConfig
  ): Promise<R> {
    return (await this.axiosInstance.patch(url, data, config)).data;
  }

  async delete(url: string, config?: AxiosRequestConfig): Promise<void> {
    await this.axiosInstance.delete(url, config);
  }
}

export default new ApiAgent(BASE_URL);
