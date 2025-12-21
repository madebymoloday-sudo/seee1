import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { ConfigService } from '@nestjs/config';

const LAVA_API_BASE_URL = 'https://gate.lava.top';

// Создаем axios instance для Lava API
const createLavaInstance = (apiKey: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: LAVA_API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    timeout: 30000,
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Логирование запросов в dev режиме
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Lava API] ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Обработка ошибок Lava API
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // Логирование ошибок
        console.error(`[Lava API Error] ${status}:`, data);

        // Можно добавить retry логику для определенных ошибок
        if (status === 429) {
          // Rate limit - можно добавить retry с задержкой
          console.warn('[Lava API] Rate limit exceeded');
        }
      }

      return Promise.reject(error);
    },
  );

  return instance;
};

// Экспорт для Orval
export const lavaAxiosInstance = <TData = unknown>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<TData>> => {
  // Получаем API ключ из переменных окружения
  const apiKey = process.env.LAVA_API_KEY || '';

  if (!apiKey) {
    throw new Error('LAVA_API_KEY is not configured');
  }

  const instance = createLavaInstance(apiKey);
  return instance.request<TData>({ ...config, ...(options || {}) });
};

