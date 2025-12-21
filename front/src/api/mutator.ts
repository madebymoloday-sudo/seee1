import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios from "axios";
import { toast } from "sonner";

// BASE_URL пустой, так как сгенерированные Orval URL уже содержат /api/v1
// Прокси в Vite перенаправляет /api/v1 на бэкенд
const BASE_URL = import.meta.env.VITE_API_URL || "";

// Axios instance
const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor - добавляем токен
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - обработка refresh token
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const errorMessage = error?.response?.data?.message;
    // message может быть строкой или массивом
    const messageText =
      typeof errorMessage === "string"
        ? errorMessage
        : Array.isArray(errorMessage)
        ? errorMessage[0]
        : "";

    // Проверяем на ошибку 503 с сообщением о не настроенном LLM
    const isLLMNotConfigured =
      status === 503 &&
      (messageText?.includes("LLM не настроен") ||
        messageText?.includes("не подключен LLM API ключ"));

    if (isLLMNotConfigured) {
      toast.error(messageText || "LLM не настроен. Обратитесь к администратору.");
    }

    // Не пытаемся обновлять токен для запросов аутентификации
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
                          originalRequest?.url?.includes('/auth/register');

    // Проверяем на 403 с сообщением об устаревшем токене или 401
    const isTokenExpired =
      (status === 403 && messageText === "токен устарел") || status === 401;

    if (isTokenExpired && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          // Используем полный путь для refresh token
          const refreshUrl = BASE_URL ? `${BASE_URL}/auth/refresh` : "/api/v1/auth/refresh";
          const { data } = await axios.post(refreshUrl, {
            refreshToken,
          });

          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return instance.request(originalRequest);
        } catch {
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

// Для Orval axios client
export const axiosInstance = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<AxiosResponse<TData>> => {
  return instance.request<TData>({ ...config, ...(options || {}) });
};

// Для Orval SWR client
export const swrMutator = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<TData> => {
  return instance
    .request<TData>({ ...config, ...(options || {}) })
    .then((response) => response.data);
};
