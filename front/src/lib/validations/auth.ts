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

// Схема для восстановления пароля (забыли пароль)
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email обязателен")
    .email("Введите корректный email"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// Схема для сброса пароля (новый пароль по токену)
export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, "Пароль должен быть не менее 6 символов")
    .max(100, "Пароль должен быть не более 100 символов"),
  confirmPassword: z.string().min(1, "Подтвердите пароль"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
