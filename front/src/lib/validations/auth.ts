import { z } from "zod";

// Схема для входа
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email обязателен")
    .email("Введите корректный email"),
  password: z.string().min(1, "Пароль обязателен"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Схема для регистрации
export const registerSchema = z.object({
  name: z
    .string()
    .min(1, "Имя обязательно")
    .max(100, "Имя должно быть не более 100 символов"),
  email: z
    .string()
    .min(1, "Email обязателен")
    .email("Введите корректный email"),
  password: z
    .string()
    .min(6, "Пароль должен быть не менее 6 символов")
    .max(100, "Пароль должен быть не более 100 символов"),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

