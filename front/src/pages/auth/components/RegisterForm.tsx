import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { registerSchema, type RegisterFormData } from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react-lite";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm = observer(({ onSwitchToLogin }: RegisterFormProps) => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.name,
        username: data.name.toLowerCase().replace(/\s+/g, "_"), // Генерируем username из имени
      });
      navigate("/");
    } catch (err: any) {
      const errorResponse = err.response?.data;
      const errorMessage =
        typeof errorResponse?.message === "string"
          ? errorResponse.message
          : Array.isArray(errorResponse?.message)
          ? errorResponse.message[0]
          : "Ошибка регистрации";
      const errorField = errorResponse?.field;

      if (errorField) {
        const validFields: (keyof RegisterFormData)[] = [
          "name",
          "email",
          "password",
        ];
        if (validFields.includes(errorField as keyof RegisterFormData)) {
          setError(errorField as keyof RegisterFormData, {
            type: "manual",
            message: errorMessage,
          });
        } else {
          setError("root", {
            type: "manual",
            message: errorMessage,
          });
        }
      } else {
        setError("root", {
          type: "manual",
          message: errorMessage,
        });
      }
    }
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="bg-red-500/20 border border-red-400 text-white px-4 py-3 rounded-md">
          {errors.root.message}
        </div>
      )}

      <FormField>
        <FormItem>
          <FormLabel htmlFor="name" className="text-white">Имя</FormLabel>
          <Input
            id="name"
            {...register("name")}
            autoComplete="name"
            aria-invalid={errors.name ? "true" : "false"}
            className={cn(
              "bg-white/10 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50",
              errors.name &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.name?.message && (
            <FormMessage 
              message={errors.name?.message} 
              className="text-red-200"
            />
          )}
        </FormItem>
      </FormField>

      <FormField>
        <FormItem>
          <FormLabel htmlFor="email" className="text-white">Email</FormLabel>
          <Input
            id="email"
            type="email"
            {...register("email")}
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            className={cn(
              "bg-white/10 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50",
              errors.email &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.email?.message && (
            <FormMessage 
              message={errors.email?.message} 
              className="text-red-200"
            />
          )}
        </FormItem>
      </FormField>

      <FormField>
        <FormItem>
          <FormLabel htmlFor="password" className="text-white">Пароль</FormLabel>
          <Input
            id="password"
            type="password"
            {...register("password")}
            autoComplete="new-password"
            aria-invalid={errors.password ? "true" : "false"}
            className={cn(
              "bg-white/10 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/50",
              errors.password &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.password?.message && (
            <FormMessage 
              message={errors.password?.message} 
              className="text-red-200"
            />
          )}
        </FormItem>
      </FormField>

      <div className="flex gap-3">
        <Button 
          type="button"
          onClick={onSwitchToLogin}
          variant="outline"
          className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" 
        >
          Войти
        </Button>
        <Button 
          type="submit" 
          className="flex-1 bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white" 
          disabled={isLoading}
        >
          {isLoading ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
      </div>
    </Form>
  );
});

export default RegisterForm;
