import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { createHmac } from "crypto";
import { LavaApiException } from "./lava.exception";

export interface CreateInvoiceDto {
  amount: number;
  orderId: string;
  paymentMethod: string;
  successUrl: string;
  failUrl: string;
  email?: string; // Email покупателя (опционально)
  offerId?: string; // ID продукта в Lava (если используется)
}

export interface InvoiceResponse {
  id: string;
  paymentUrl: string;
  status: string;
}

@Injectable()
export class LavaService {
  private readonly logger = new Logger(LavaService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly axiosInstance: AxiosInstance;
  // Кэш для offerId по типу подписки
  private offerIdCache: Map<string, string> = new Map();

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>("LAVA_API_KEY") || "";
    // Согласно документации https://developers.lava.top/ru
    // Базовый URL для API: https://gate.lava.top
    this.baseUrl =
      this.configService.get<string>("LAVA_API_BASE_URL") ||
      "https://gate.lava.top";

    // Создаем axios instance с базовой конфигурацией
    // Согласно документации https://gate.lava.top/docs
    // Авторизация через заголовок X-Api-Key
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey, // Правильное название согласно документации
      },
      timeout: 30000,
    });

    // Добавляем interceptors для логирования
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `[Lava API] ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        this.logger.error(`[Lava API] Request error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error(
          `[Lava API] Response error: ${error.response?.status} - ${JSON.stringify(error.response?.data || {})} - ${error.message}`
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Создать инвойс через Lava API
   */
  async createPayment(dto: CreateInvoiceDto): Promise<InvoiceResponse> {
    try {
      if (!this.apiKey) {
        throw new LavaApiException("LAVA_API_KEY не настроен");
      }

      this.logger.log(`[Lava API] Creating invoice: ${dto.orderId}`);
      this.logger.debug(`[Lava API] Base URL: ${this.baseUrl}`);
      this.logger.debug(
        `[Lava API] Request payload: ${JSON.stringify({
          sum: dto.amount,
          orderId: dto.orderId,
          shopId: this.configService.get<string>("LAVA_SHOP_ID"),
          hookUrl: this.configService.get<string>("LAVA_WEBHOOK_URL"),
          successUrl: dto.successUrl,
          failUrl: dto.failUrl,
        })}`
      );

      // Согласно документации https://gate.lava.top/docs
      // API Lava работает только с продуктами (offers), нужен offerId
      // Пытаемся получить offerId из кэша, конфига или создать автоматически
      let offerId = dto.offerId;

      // Валидируем offerId, если он передан
      if (offerId && !this.isValidUUID(offerId)) {
        this.logger.warn(
          `[Lava API] Invalid offerId format: ${offerId}, will search for product automatically`
        );
        offerId = null; // Сбрасываем невалидный offerId
      }

      if (!offerId) {
        // Пытаемся получить из конфига по типу подписки (определяем по сумме)
        const planType = this.getPlanTypeByAmount(dto.amount);
        offerId = this.getOfferIdForPlan(planType);

        // Валидируем offerId из конфига
        if (offerId && !this.isValidUUID(offerId)) {
          this.logger.warn(
            `[Lava API] Invalid offerId from config: ${offerId}, will search for product automatically`
          );
          offerId = null; // Сбрасываем невалидный offerId
        }

        // Если не найден или невалидный, пытаемся найти продукт автоматически
        if (!offerId) {
          offerId = await this.findOrCreateOffer(dto.amount, planType);
        }
      }

      if (!offerId) {
        throw new LavaApiException(
          "Не удалось получить валидный offerId. Укажите валидный LAVA_OFFER_ID (UUID) или LAVA_OFFER_ID_MONTHLY/QUARTERLY/YEARLY в переменных окружения, либо создайте продукты в Lava."
        );
      }

      if (!dto.email) {
        throw new LavaApiException(
          "Email покупателя обязателен для создания инвойса через Lava API."
        );
      }

      // Используем новый API v3 - работа с продуктами
      return this.createInvoiceV3(dto, offerId);
    } catch (error: any) {
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
      };

      this.logger.error(
        `[Lava API] Error creating invoice: ${JSON.stringify(errorDetails, null, 2)}`
      );

      if (error instanceof LavaApiException) {
        throw error;
      }

      // Формируем более информативное сообщение об ошибке
      let errorMessage = "Не удалось создать инвойс в Lava";
      if (error.response?.data) {
        if (typeof error.response.data === "string") {
          errorMessage = error.response.data;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.text) {
          errorMessage = error.response.data.text;
        }
      }

      throw new LavaApiException(errorMessage);
    }
  }

  /**
   * Получить статус инвойса в Lava API
   */
  async getOrderStatus(orderId: string): Promise<InvoiceResponse> {
    try {
      if (!this.apiKey) {
        throw new LavaApiException("LAVA_API_KEY не настроен");
      }

      this.logger.log(`[Lava API] Getting invoice status: ${orderId}`);

      // Lava API использует эндпоинт /invoice/status
      const response = await this.axiosInstance.get("/invoice/status", {
        params: {
          orderId: orderId,
        },
      });

      const data = response.data;

      if (!data || !data.data) {
        throw new LavaApiException("Неверный формат ответа от Lava API");
      }

      const invoiceData = data.data;

      this.logger.log(
        `[Lava API] Invoice status: ${orderId} - ${invoiceData.status}`
      );

      return {
        id: invoiceData.id || invoiceData.invoiceId || orderId,
        paymentUrl: invoiceData.url || invoiceData.paymentUrl || "",
        status: invoiceData.status || "unknown",
      };
    } catch (error: any) {
      this.logger.error(
        `[Lava API] Error getting invoice status: ${error.response?.data || error.message}`
      );

      if (error instanceof LavaApiException) {
        throw error;
      }

      throw new LavaApiException(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Не удалось получить статус инвойса в Lava"
      );
    }
  }

  /**
   * Создает инвойс через новый API v3 (работа с продуктами)
   * @param dto Данные для создания инвойса
   * @param offerId ID продукта в Lava
   */
  private async createInvoiceV3(
    dto: CreateInvoiceDto,
    offerId: string
  ): Promise<InvoiceResponse> {
    try {
      this.logger.log(
        `[Lava API] Creating invoice v3 with offerId: ${offerId}`
      );

      // Согласно документации https://gate.lava.top/docs
      // API v3 требует обязательные поля: email, offerId, currency
      if (!dto.email) {
        throw new LavaApiException(
          "Email покупателя обязателен для создания инвойса"
        );
      }

      const requestBody: any = {
        email: dto.email, // Email покупателя (обязательное поле)
        offerId: offerId, // ID продукта в Lava (обязательное поле)
        currency: "RUB", // Валюта (обязательное поле, можно сделать настраиваемой)
      };

      // Опциональные параметры
      if (dto.paymentMethod) {
        requestBody.paymentMethod = dto.paymentMethod;
      }

      this.logger.debug(
        `[Lava API] Request body v3: ${JSON.stringify(requestBody, null, 2)}`
      );

      const response = await this.axiosInstance.post(
        "/api/v3/invoice",
        requestBody,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Api-Key": this.apiKey, // Правильное название согласно документации
          },
        }
      );

      const data = response.data;

      // Проверяем на ошибки
      if (data?.status === "error" || data?.error) {
        const errorMessage =
          data?.message || data?.error || "Unknown error from Lava API";
        throw new LavaApiException(errorMessage);
      }

      // Ответ содержит paymentUrl напрямую
      this.logger.log(`[Lava API] Invoice v3 created: ${data?.id}`);

      return {
        id: data?.id || dto.orderId,
        paymentUrl: data?.paymentUrl || "",
        status: data?.status || "pending",
      };
    } catch (error: any) {
      this.logger.error(
        `[Lava API] Error creating invoice v3: ${error.response?.data || error.message}`
      );

      if (error instanceof LavaApiException) {
        throw error;
      }

      throw new LavaApiException(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Не удалось создать инвойс через API v3"
      );
    }
  }

  /**
   * Проверяет, является ли строка валидным UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Определяет тип плана подписки по сумме
   */
  private getPlanTypeByAmount(
    amount: number
  ): "monthly" | "quarterly" | "yearly" {
    if (amount <= 990) return "monthly";
    if (amount <= 2490) return "quarterly";
    return "yearly";
  }

  /**
   * Получает offerId для плана подписки из конфига или кэша
   */
  private getOfferIdForPlan(
    planType: "monthly" | "quarterly" | "yearly"
  ): string | null {
    // Проверяем кэш
    if (this.offerIdCache.has(planType)) {
      const cachedId = this.offerIdCache.get(planType);
      if (cachedId && this.isValidUUID(cachedId)) {
        return cachedId;
      }
      // Удаляем невалидный из кэша
      this.offerIdCache.delete(planType);
    }

    // Получаем из конфига
    const configKey = `LAVA_OFFER_ID_${planType.toUpperCase()}`;
    const offerId =
      this.configService.get<string>(configKey) ||
      this.configService.get<string>("LAVA_OFFER_ID");

    // Валидируем и кэшируем только валидные UUID
    if (offerId && this.isValidUUID(offerId)) {
      this.offerIdCache.set(planType, offerId);
      return offerId;
    }

    return null;
  }

  /**
   * Находит существующий продукт по цене или создает новый
   */
  private async findOrCreateOffer(
    amount: number,
    planType: "monthly" | "quarterly" | "yearly"
  ): Promise<string | null> {
    try {
      this.logger.log(
        `[Lava API] Searching for product with amount: ${amount}`
      );

      // Пытаемся получить список продуктов
      const response = await this.axiosInstance.get("/api/v2/products", {
        headers: {
          Accept: "application/json",
          "X-Api-Key": this.apiKey,
        },
        params: {
          size: 100, // Получаем больше продуктов для поиска
        },
      });

      const products = response.data?.items || [];

      // Ищем продукт с подходящей ценой
      for (const product of products) {
        if (product.data?.offers) {
          for (const offer of product.data.offers) {
            // Проверяем цену в RUB
            const price = offer.prices?.find((p: any) => p.currency === "RUB");
            if (price && Math.abs(price.amount - amount) < 10) {
              // Допуск 10 рублей
              this.logger.log(
                `[Lava API] Found matching offer: ${offer.id} for amount ${amount}`
              );
              this.offerIdCache.set(planType, offer.id);
              return offer.id;
            }
          }
        }
      }

      this.logger.warn(
        `[Lava API] No matching product found for amount ${amount}. Please create products manually in Lava dashboard.`
      );
      return null;
    } catch (error: any) {
      this.logger.error(
        `[Lava API] Error searching for products: ${error.response?.data || error.message}`
      );
      return null;
    }
  }

  /**
   * Генерирует HMAC-подпись для запроса к Lava API
   * @param data Данные запроса
   * @param secretKey Секретный ключ (API ключ)
   * @returns HMAC подпись в формате hex
   */
  private generateSignature(data: any, secretKey: string): string {
    // Lava API требует JSON строку для подписи
    // Сортируем ключи объекта для создания стабильной строки
    const sortedData: any = {};
    Object.keys(data)
      .sort()
      .forEach((key) => {
        sortedData[key] = data[key];
      });

    // Создаем JSON строку из отсортированных данных
    const jsonString = JSON.stringify(sortedData);

    // Создаем HMAC SHA256 подпись
    const signature = createHmac("sha256", secretKey)
      .update(jsonString)
      .digest("hex");

    this.logger.debug(
      `[Lava API] Signature data: ${jsonString.substring(0, 100)}...`
    );

    return signature;
  }
}
